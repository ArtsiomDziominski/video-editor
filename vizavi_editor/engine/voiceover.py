"""Эмоциональная озвучка: интонацию каждой фразы задаёт кусок emotions_ru.wav с нужной эмоцией.

py voiceover_emotions.py grid_script.txt voiceover4
py voiceover_emotions.py grid_script.txt voiceover5 --voice voice_0108.json   — другим голосом
py voiceover_emotions.py quiz3_script.txt voiceover13 --voice voice_0108.json --only 3,9   — только эти фразы,
    остальные берутся из готового lines.json (так переозвучивает редактор проектов)

out_dir/forced.json {"3": 7} — для фразы 3 взять дубль 7 без автоматического выбора.
out_dir/takes.json — что Whisper услышал в каждом дубле (для редактора).

Сценарий — строки «сцена | эмоция | фраза». Тембр везде один (ровный кусок записи),
а образец интонации (prompt) берётся из эмоционального куска того же голоса.
По каждой фразе делается несколько дублей, лучший выбирает Whisper.
Результат: out_dir/line_N.wav и out_dir/lines.json.
"""
import difflib
import json
import re
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from voxcpm import VoxCPM

from asr import transcribe

VOICE_WAV = "emotions_ru.wav"
# куски записи по таймингам Whisper: (начало, конец, точный текст)
SEGMENTS = {
    "neutral": (0.0, 3.05, "Привет, сегодня я расскажу, как прошёл мой день."),
    "joy": (3.45, 7.98, "Ура, я наконец-то продал машину и за отличную цену."),
    "angry": (12.9, 16.0, "Да сколько можно, я же просил не трогать мои вещи."),
    "surprise": (16.45, 21.4, "Кто? Серьёзно? Не может быть, он правда согласился?"),
    "whisper": (21.7, 25.12, "Тихо. Только никому не говори."),
}
TIMBRE = (0.0, 7.98)  # ровный энергичный кусок — общий тембр для всех фраз
# эмоция сценария → (кусок-образец интонации, желаемый темп в символах/с)
EMOTIONS = {
    "surprise": ("surprise", 15),
    "joy": ("joy", 15),
    "neutral": ("neutral", 15),
    "fast": ("joy", 17),
    "excited": ("joy", 16),
    "calm": ("neutral", 13.5),
    "serious": ("whisper", 12.5),
    "firm": ("angry", 13.5),
}
TAKES = 4

# --voice профиль.json — другой голос: файл, кусок для тембра, куски-образцы и привязка эмоций
args = sys.argv[1:]
if "--voice" in args:
    k = args.index("--voice")
    profile = json.loads(Path(args[k + 1]).read_text(encoding="utf-8"))
    del args[k:k + 2]
    VOICE_WAV, TIMBRE = profile["wav"], tuple(profile["timbre"])
    SEGMENTS = {name: tuple(seg) for name, seg in profile["segments"].items()}
    EMOTIONS = {name: tuple(e) for name, e in profile["emotions"].items()}
ONLY = None
if "--only" in args:
    k = args.index("--only")
    ONLY = {int(x) for x in args[k + 1].split(",")}
    del args[k:k + 2]
sys.argv[1:] = args

script, OUT_DIR = Path(sys.argv[1]), Path(sys.argv[2])
# третий аргумент «1,13» — сделать по TAKES дополнительных дублей для этих фраз
EXTRA = {int(x) for x in sys.argv[3].split(",")} if len(sys.argv) > 3 else set()
OUT_DIR.mkdir(exist_ok=True)
PHRASES = []
for row in script.read_text(encoding="utf-8").splitlines():
    if row.strip() and not row.startswith("#"):
        scene, emotion, text = (s.strip() for s in row.split("|", 2))
        PHRASES.append((int(scene), emotion, text))


def norm(s):
    return re.sub(r"[^а-яa-z ]", "", s.lower().replace("ё", "е").replace("-", " ")).split()


# Whisper пишет числа цифрами («1%», «100»), поэтому числительные в сравнении не участвуют
NUM_WORDS = {"сто", "ста", "два", "три", "пять", "один", "десять"}
NUM_STEMS = ("двух", "трех", "четыр", "пяти", "десят", "сотн", "тысяч", "перв", "втор", "восемьдес",
             "восьмидесят", "процент", "пятидесят")
QUIET = {"serious", "whisper", "low"}  # эмоции, которые после выравнивания громкости чуть тише остальных


def no_numbers(words):
    return [w for w in words if w not in NUM_WORDS and not w.startswith(NUM_STEMS)]


def cer(a, b):
    a, b = " ".join(no_numbers(norm(a))), " ".join(no_numbers(norm(b)))
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] / max(1, len(a))


def align(words, chunks, dur):
    """Тайминги слов сценария по словам Whisper.

    Совпавшие слова берут время у Whisper, остальные (числа, которые он пишет цифрами,
    слитые и разбитые слова) раскладываются по длине между соседними совпавшими.
    """
    wn = [" ".join(norm(w)) for w in words]
    cn = [" ".join(norm(c[0])) for c in chunks]
    times = [None] * len(words)
    for a, b, size in difflib.SequenceMatcher(None, wn, cn, autojunk=False).get_matching_blocks():
        for k in range(size):
            if wn[a + k]:
                s, e = chunks[b + k][1], chunks[b + k][2]
                times[a + k] = (s, e if e is not None else dur)
    i = 0
    while i < len(words):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(words) and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else 0.0
        t1 = times[j][0] if j < len(words) else dur
        weights = [len(words[k]) + 1 for k in range(i, j)]
        acc = t0
        for k, wgt in zip(range(i, j), weights):
            d = max(0.0, t1 - t0) * wgt / sum(weights)
            times[k] = (acc, acc + d)
            acc += d
        i = j
    return [(w, s, e) for w, (s, e) in zip(words, times)]


VOWELS = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"


def stress_targets(text):
    """Слова с ударной гласной, записанной заглавной («пробОй»): (слово, номер ударного слога)."""
    out = []
    for w in text.split():
        vow = [(k, ch) for k, ch in enumerate(w) if ch in VOWELS]
        caps = [n for n, (k, ch) in enumerate(vow) if ch.isupper() and k > 0]
        if len(vow) == 2 and caps:  # измерение надёжно только для двусложных слов
            out.append((norm(w)[0] if norm(w) else "", caps[0]))
    return out


def syllable_ratio(y, sr):
    """Ударность второго слога относительно первого: длина × громкость × высота тона гласной."""
    if len(y) < int(0.12 * sr):
        return None
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    f0, voiced, _ = librosa.pyin(y16, fmin=70, fmax=300, sr=16000, frame_length=640, hop_length=160)
    e = librosa.feature.rms(y=y16, frame_length=640, hop_length=160)[0][:len(f0)]
    vow = np.flatnonzero(voiced & (e > 0.45 * e.max()))
    if len(vow) < 6:
        return None
    d = np.diff(vow)
    gap = int(np.argmax(d)) if d.max() > 2 else len(vow) // 2
    a, b = vow[:gap + 1], vow[gap + 1:]
    if len(a) < 2 or len(b) < 2:
        return None
    s = lambda ix: len(ix) * e[ix].mean() * np.nanmean(f0[ix])
    return s(b) / s(a)


def wrong_stress(text, audio, sr, chunks):
    """Сколько размеченных ударений модель поставила не туда (неизмеримые не считаются)."""
    targets = stress_targets(text)
    if not targets:
        return 0
    bad, used = 0, set()
    for word, k in targets:
        c = next((j for j, ch in enumerate(chunks) if j not in used and norm(ch[0]) and norm(ch[0])[0] == word), None)
        if c is None:
            continue
        used.add(c)
        s, e = chunks[c][1], chunks[c][2] or len(audio) / sr
        r = syllable_ratio(audio[int(s * sr):int(e * sr)], sr)
        if r is not None and (r > 1) != (k == 1):
            bad += 1
    return bad


def tighten(audio, sr, max_pause=0.4, keep=0.3):
    """Сжимает паузы внутри фразы: по сценарию голос не молчит дольше полсекунды."""
    fr = int(0.02 * sr)
    e = np.array([np.sqrt(np.mean(audio[k:k + fr] ** 2)) for k in range(0, len(audio) - fr, fr)])
    quiet = np.r_[e < 0.1 * np.percentile(e, 90), False]
    out, pos, run_start = [], 0, None
    for k, q in enumerate(quiet):
        if q and run_start is None:
            run_start = k
        elif not q and run_start is not None:
            a, b = run_start * fr, k * fr
            limit = 0.1 if run_start == 0 else max_pause  # тишину в начале почти убираем
            if (b - a) / sr > limit:
                half = int((0.05 if run_start == 0 else keep) * sr / 2)
                out.append(audio[pos:a + half])
                pos = b - half
            run_start = None
    out.append(audio[pos:])
    xf = int(0.01 * sr)  # короткие кроссфейды на стыках
    res = out[0]
    for piece in out[1:]:
        if len(res) > xf and len(piece) > xf:
            ramp = np.linspace(0, 1, xf)
            res = np.r_[res[:-xf], res[-xf:] * (1 - ramp) + piece[:xf] * ramp, piece[xf:]]
        else:
            res = np.r_[res, piece]
    return res.astype(np.float32)


wav, sr = sf.read(VOICE_WAV, dtype="float32")
if wav.ndim > 1:
    wav = wav.mean(axis=1)
refs = {}
for name, (a, b, _) in {**SEGMENTS, "timbre": (*TIMBRE, None)}.items():
    refs[name] = OUT_DIR / f"ref_{name}.wav"
    sf.write(refs[name], wav[int(a * sr):int(b * sr)], sr)

model = None
result = []
forced_file, takes_file, lines_file = OUT_DIR / "forced.json", OUT_DIR / "takes.json", OUT_DIR / "lines.json"
FORCED = {int(k): v for k, v in json.loads(forced_file.read_text(encoding="utf-8")).items()} if forced_file.exists() else {}
REPORT = json.loads(takes_file.read_text(encoding="utf-8")) if takes_file.exists() else {}
OLD = json.loads(lines_file.read_text(encoding="utf-8")) if ONLY and lines_file.exists() else []
for i, (scene, emotion, text) in enumerate(PHRASES, 1):
    if ONLY and i not in ONLY and len(OLD) == len(PHRASES) and OLD[i - 1]["text"] == text:
        result.append(OLD[i - 1])  # фраза не трогается — берём как есть
        continue
    # (кусок-образец, темп) — продолжение интонации куска; (None, темп, «стиль») — описание стиля
    # в скобках перед текстом, документированный режим VoxCPM2 «клон + управление стилем»
    seg, tempo, *style = EMOTIONS[emotion]
    cands, report = [], []
    have = len(list(OUT_DIR.glob(f"line_{i}_take*.wav")))
    for take in range(max(TAKES, have) + (TAKES if i in EXTRA else 0)):
        path = OUT_DIR / f"line_{i}_take{take}.wav"
        if path.exists():  # дубль уже есть — только переоцениваем
            audio, sr = sf.read(path, dtype="float32")
        else:
            if model is None:
                model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
            torch.manual_seed(100 * i + take)
            if seg:
                prompt = dict(text=text, prompt_wav_path=str(refs[seg]), prompt_text=SEGMENTS[seg][2])
            else:
                prompt = dict(text=f"({style[0]}){text}")
            audio = model.generate(
                **prompt,
                reference_wav_path=str(refs["timbre"]),
                cfg_value=2.0,
                inference_timesteps=16,
            )
            sr = model.tts_model.sample_rate
            audio, _ = librosa.effects.trim(audio, top_db=38)
            sf.write(path, audio, sr)
        heard, chunks = transcribe(str(path))
        err = cer(text, heard)
        dur = len(audio) / sr
        phrasing = (2 * min(text.count("?"), heard.count("?")) + min(text.count("."), heard.count("."))
                    + min(text.count("!"), heard.count("!") + heard.count(".")))
        stress = wrong_stress(text, audio, sr, chunks)
        print(f"{i}.{take} [{emotion}]: {dur:4.2f} с  CER {err:.2f}  ударения мимо {stress}  "
              f"фразировка {phrasing}  «{heard}»")
        # меньше ошибок, потом верные ударения, потом интонация, потом темп
        score = (round(err, 2), stress, -phrasing, abs(len(text) / dur - tempo))
        cands.append((score, take, audio))
        report.append(dict(take=take, heard=heard, cer=round(err, 2), stress=stress, duration=round(dur, 2)))

    # финальную версию (сжатые паузы, ровная громкость) проверяем заново: берём первый дубль, который
    # и после обработки распознаётся так же чисто; если такого нет — лучший по исходной оценке
    cands.sort(key=lambda c: c[0])
    if i in FORCED:  # дубль выбран вручную в редакторе
        cands = [c for c in cands if c[1] == FORCED[i]] + [c for c in cands if c[1] != FORCED[i]]
    done = False
    for score, take, raw in cands:
        for audio in (tighten(raw, sr), raw):  # паузы сжимаем, но не ценой разборчивости
            rms = np.sqrt(np.mean(audio ** 2))
            audio = audio * (0.08 / rms) * (0.85 if emotion in QUIET else 1.0)  # ровная громкость, шёпот чуть тише
            sf.write(OUT_DIR / f"line_{i}.wav", np.clip(audio, -1, 1), sr)
            heard, chunks = transcribe(str(OUT_DIR / f"line_{i}.wav"))  # тайминги слов после сжатия пауз
            if cer(text, heard) <= score[0] + 0.01 or FORCED.get(i) == take:
                done = True
                break
            print(f"   дубль {take} после обработки: «{heard}» — пробую дальше")
        if done:
            break
    if not done:
        score, take, raw = cands[0]
        audio = tighten(raw, sr)
        audio = audio * (0.08 / np.sqrt(np.mean(audio ** 2))) * (0.85 if emotion in QUIET else 1.0)
        sf.write(OUT_DIR / f"line_{i}.wav", np.clip(audio, -1, 1), sr)
        heard, chunks = transcribe(str(OUT_DIR / f"line_{i}.wav"))
    words = [w for w in text.split() if w != "—"]
    timed = align(words, chunks, len(audio) / sr)  # тайминги у Whisper, написание из сценария
    result.append(dict(scene=scene, emotion=emotion, text=text, file=f"line_{i}.wav", take=take, heard=heard,
                       duration=len(audio) / sr, words=timed))
    REPORT[str(i)] = dict(text=text, chosen=take, takes=report)
    print(f"-> фраза {i}: дубль {take}, {len(audio) / sr:.2f} с")

lines_file.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
takes_file.write_text(json.dumps(REPORT, ensure_ascii=False, indent=1), encoding="utf-8")
