"""Шаблон «Квиз на школьной доске»: таймлайн голоса, события и звуки мела без музыки.

Проект берётся из папки VPROJ_DIR (распакованный .vproj): project.json и voice/lines/lines.json.
python audio.py  — собрать build/audio.wav, .srt и build/timeline.txt
Все тайминги видео (video.py) берутся из этого модуля; сдвиги событий — project.json → offsets.
"""
import os
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

PROJECT_DIR = Path(os.environ.get("VPROJ_DIR", "."))
PROJECT = json.loads((PROJECT_DIR / "project.json").read_text(encoding="utf-8"))
OFFSETS = PROJECT.get("offsets", {})
LINES_JSON = PROJECT_DIR / "voice" / "lines" / "lines.json"
BUILD = PROJECT_DIR / "build"
BUILD.mkdir(exist_ok=True)
OUT = str(BUILD / "audio")
SR = 48000


def norm(s):
    return re.sub(r"[^\wё]", "", s.lower()).replace("ё", "е")


# ---------- таймлайн голоса ----------

LINES = json.loads(LINES_JSON.read_text(encoding="utf-8"))


def snap_onsets(lines, folder):
    """Whisper ставит начало слова после паузы в начало паузы — сдвигаем на первый звук слова."""
    for ln in lines:
        wav, sr = sf.read(folder / ln["file"], dtype="float32")
        fr = int(0.01 * sr)
        e = np.sqrt(np.convolve(wav ** 2, np.ones(fr) / fr, "valid")[::fr])
        db = 20 * np.log10(e / (np.percentile(e, 90) + 1e-9) + 1e-9)
        for w in ln["words"]:
            k0, k1 = int(w[1] * 100), min(int(w[2] * 100), len(db))
            k = next((k for k in range(k0, k1) if db[k] > -20), k0)
            if k / 100 < w[2] - 0.05:
                w[1] = min(k / 100, w[1] + 0.35)


snap_onsets(LINES, LINES_JSON.parent)
GAP_IN, GAP_SCENE = 0.18, 0.28
VOICE_AT, t = [], 0.12
for k, ln in enumerate(LINES):
    if k and ln["scene"] != LINES[k - 1]["scene"]:
        t += GAP_SCENE - GAP_IN
    if k and LINES[k - 1]["emotion"] == "count":  # отсчёт: ровно секунда между «три», «два», «один» и ответом
        t = max(t, VOICE_AT[-1] + 1.0)
    VOICE_AT.append(t)
    t += ln["duration"] + GAP_IN
DURATION = VOICE_AT[-1] + LINES[-1]["duration"] + 0.35  # хвост короткий: на стыке петли тишина < 0.5 с
N_SCENES = 6
FIRST = [next(k for k, ln in enumerate(LINES) if ln["scene"] == s) for s in range(1, N_SCENES + 1)]
CUTS = [0.0] + [VOICE_AT[FIRST[s]] - 0.1 for s in range(1, N_SCENES)] + [DURATION]
CUTS[3] = VOICE_AT[FIRST[3]]  # ответ ровно на слове «Вверх!»
COUNTS = [VOICE_AT[k] for k, ln in enumerate(LINES) if ln["emotion"] == "count"]


def start(scene):
    return CUTS[scene - 1]


MISSING = []   # опорные слова, которых нет в изменённом тексте (событие встаёт в начало сцены)


def word_t(scene, stem, nth=0):
    hits = [VOICE_AT[k] + s for k, ln in enumerate(LINES) if ln["scene"] == scene
            for w, s, _ in ln["words"] if norm(w).startswith(norm(stem))]
    if len(hits) > nth:
        return hits[nth]
    MISSING.append(f"сцена {scene}: «{stem}»")
    return VOICE_AT[FIRST[scene - 1]] + 0.5


TIMELINE = []  # редактируемые события для редактора: имя, подпись, исходное время, сдвиг


def at(name, label, base):
    off = float(OFFSETS.get(name, 0.0))
    first = base[0] if isinstance(base, list) else base
    TIMELINE.append(dict(name=name, label=label, base=round(float(first), 3), offset=off))
    return [b + off for b in base] if isinstance(base, list) else base + off


# ---------- события (общие для звука и видео) ----------

T_THREE = at("T_THREE", "«?» подпрыгивает", word_t(1, "три"))
T_HARDER = at("T_HARDER", "«СЛОЖНЕЕ»", word_t(1, "сложнее"))
T_ROSE = at("T_ROSE", "стрелка вдоль древка", word_t(2, "взлетел"))
T_SLIDE, T_NARROW = word_t(2, "сползать"), word_t(2, "узком")
SMALL = at("SMALL", "свечи полотнища",  # не меньше 0.9 с на пять свечей, даже если фраза короткая
           list(np.linspace(T_SLIDE - 0.1, max(T_NARROW - 0.55, T_SLIDE + 0.8), 5)))
CHANNEL = at("CHANNEL", "линии коридора", [T_NARROW, T_NARROW + 0.55])
FLAG_SKETCH = at("FLAG_SKETCH", "контур флага", T_NARROW + 1.15)
T_CRASH = at("T_CRASH", "стрелка «рухнет»", word_t(2, "рухнет"))
T_GROW = at("T_GROW", "свеча-загадка", start(3) + 0.1)  # дорисована до половины
T_FREEZE = T_GROW + 0.5
T_UP3 = at("T_UP3", "кнопка «вверх»", word_t(3, "вверх"))
T_DOWN3 = at("T_DOWN3", "кнопка «вниз»", word_t(3, "вниз"))
T_REVEAL = start(4)                                          # ответ — ровно на слове «Вверх!»
T_CHECK = T_REVEAL + 0.12                                    # галочка на «ВВЕРХ»
T_CROSS = T_REVEAL + 0.3                                     # стрелка «рухнет» зачёркнута
T_CLOSE = T_REVEAL + 0.35                                    # свеча закрывается над коридором
SHOOT = [T_REVEAL + 0.6 + 0.2 * k for k in range(3)]         # график улетает вверх на длину древка
T_FLAG = at("T_FLAG", "«ФЛАГ»", word_t(4, "флаг"))
T_POLE = at("T_POLE", "скобка древка", word_t(4, "древко"))
T_CLOTH = at("T_CLOTH", "штриховка полотнища", word_t(4, "полотнище"))
T_MEASURE = at("T_MEASURE", "скобка едет к пробою", word_t(4, "длину") - 0.05)
T_SIGNS = [at(f"T_SIGN{k + 1}", f"пункт правила {k + 1}", word_t(5, s))
           for k, s in enumerate(("резкий", "спокойный", "закрытие"))]
DISSOLVE_Q = start(2)                                        # «?» крючка рассыпается
DISSOLVE_TITLE = COUNTS[0] - 0.45                            # заголовок рассыпается — место для отсчёта
DISSOLVE_COUNT = T_REVEAL + 0.1
DISSOLVE_BTN = T_FLAG + 0.75                                 # кнопки сделали своё — рассыпаются
DISSOLVE_FLAG = start(5)
T_WIPE = start(6)                                            # губка
REDRAW = [T_WIPE + 0.8 + 0.15 * k for k in range(5)]         # древко снова на доске
T_NEXT = at("T_NEXT", "надпись про следующий выпуск", word_t(6, "завтра") - 0.3)
DISSOLVE_NEXT = DURATION - 1.55
T_LAST_Q = DURATION - 1.0                                    # «?» — последний кадр = первый


# ---------- звуки мела ----------

rng = np.random.default_rng(13)


def filt(x, kind, f):
    return signal.sosfilt(signal.butter(2, f, kind, fs=SR, output="sos"), x)


def sweep(f0, f1, dur):
    n = int(dur * SR)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (np.arange(n) / n)) / SR)


def chalk(dur, density=1.0, grit=1.0):
    """Мел по доске: шершавые штрихи с зернистым «треском»."""
    n = int(dur * SR)
    out = np.zeros(n)
    t0 = 0.0
    while t0 < dur:
        ln = rng.uniform(0.07, 0.18)
        a, b = int(t0 * SR), min(n, int((t0 + ln) * SR))
        m = b - a
        if m > 10:
            tone = filt(rng.uniform(-1, 1, m), "bandpass", [rng.uniform(700, 1300), rng.uniform(3500, 6000)])
            crackle = (rng.random(m) < 0.004 * grit) * rng.uniform(-1, 1, m)          # зёрна мела
            crackle = filt(crackle, "highpass", 2000) * 3
            shape = np.sin(np.pi * np.arange(m) / m) ** 0.6
            out[a:b] += (tone * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(60, 140) * np.arange(m) / SR)) + crackle) \
                * shape * rng.uniform(0.6, 1.0)
        t0 += ln + rng.uniform(0.01, 0.05) / density
    return out * 0.55


def chalk_tap():
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    click = filt(rng.uniform(-1, 1, n), "bandpass", [1500, 6000]) * np.exp(-tt * 160)
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 70) * 0.6
    return (click + body) * 0.9


def taps(dur, gap=0.07):
    """Линия коридора: мел постукивает по доске."""
    out = np.zeros(int((dur + 0.1) * SR))
    k = 0
    while k * gap < dur:
        s = chalk_tap() * rng.uniform(0.7, 1.0)
        a = int(k * gap * SR)
        out[a:a + len(s)] += s
        k += 1
    return out + 0.35 * np.r_[chalk(dur, 1.5), np.zeros(len(out) - int(dur * SR))]


def pop_whistle():
    """Мультяшный поп и восходящий свисток."""
    n = int(0.55 * SR)
    tt = np.arange(n) / SR
    pop = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-tt * 25) + 250) / SR) * np.exp(-tt * 30) * 0.8
    f = 650 * (2.6 ** (tt / 0.5)) * (1 + 0.025 * np.sin(2 * np.pi * 9 * tt))
    whistle = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(tt / 0.5, 0, 1)) ** 0.7 * 0.45
    return pop + whistle


def clock_tick():
    """Громкий тик настенных часов: деревянный щелчок с резонансом."""
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    click = filt(rng.uniform(-1, 1, n), "bandpass", [1800, 7000]) * np.exp(-tt * 260)
    wood = (np.sin(2 * np.pi * 950 * tt) + 0.5 * np.sin(2 * np.pi * 2300 * tt)) * np.exp(-tt * 55)
    return np.tanh(1.5 * (click + 0.8 * wood))


def ding():
    n = int(1.3 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for f, a, d in ((1318.5, 0.5, 0.0), (1760.0, 0.45, 0.09), (2637.0, 0.22, 0.09)):
        k = int(d * SR)
        s[k:] += a * np.sin(2 * np.pi * f * tt[:n - k]) * np.exp(-tt[:n - k] * 4)
    return s


def bass_hit():
    n = int(1.0 * SR)
    tt = np.arange(n) / SR
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-tt * 14)) / SR) * np.exp(-tt * 3.5))


def whoosh_up(dur=0.45):
    n = int(dur * SR)
    e = np.sin(np.pi * np.arange(n) / n) ** 2
    return (filt(rng.uniform(-1, 1, n), "bandpass", [600, 7000]) + 0.4 * sweep(300, 1900, dur)) * e * 0.7


def sponge(dur=0.7):
    """Влажная губка одним махом: мягкое трение войлока."""
    n = int(dur * SR)
    x = np.arange(n) / n
    e = np.sin(np.pi * x) ** 1.2
    noise = rng.uniform(-1, 1, n)
    rub = filt(noise, "bandpass", [250, 2600]) * (1 + 0.35 * np.sin(2 * np.pi * 18 * x * dur))
    return (rub + 0.25 * filt(noise, "highpass", 3000) * x) * e


def dust_puff(dur=0.35):
    """Мел рассыпается пылью."""
    n = int(dur * SR)
    e = np.exp(-np.arange(n) / SR * 9) * np.minimum(1, np.arange(n) / (0.02 * SR))
    return filt(rng.uniform(-1, 1, n), "bandpass", [300, 1800]) * e * 0.6


def place(buf, sig, at, gain=1.0):
    a = int(round(at * SR))
    if a < 0:
        sig, a = sig[-a:], 0
    if a < len(buf):
        b = min(len(buf), a + len(sig))
        buf[a:b] += sig[:b - a] * gain


EVENTS = []  # (время, звук, громкость, что происходит в кадре)


def ev(at, sound, gain, what):
    EVENTS.append((at, sound, gain, what))


def build_events():
    # 1. Крючок: древко и «?» уже на доске — как в последнем кадре
    ev(0.0, chalk(1.1, 1.3), 0.9, "мел пишет «УГАДАЙ СВЕЧУ #3»")
    ev(T_THREE, pop_whistle(), 0.75, "«?» подпрыгивает: поп и свисток вверх")
    ev(T_HARDER, chalk(0.45, 1.5), 0.9, "красным мелом «СЛОЖНЕЕ»")
    ev(T_HARDER + 0.45, chalk(0.3, 2), 0.8, "двойное подчёркивание")
    # 2. Флаг
    ev(DISSOLVE_Q, dust_puff(), 0.7, "«?» рассыпается пылью")
    ev(T_ROSE, chalk(0.4, 1.6), 0.75, "стрелка вдоль древка — «резко взлетел»")
    for k, ts in enumerate(SMALL):
        ev(ts, chalk(0.32, 1.6), 0.7, f"маленькая свеча полотнища {k + 1}")
    for k, tc in enumerate(CHANNEL):
        ev(tc, taps(0.45), 0.9, ("верхняя", "нижняя")[k] + " жёлтая линия коридора — постукивание")
    ev(FLAG_SKETCH, chalk(0.6, 1.0, 0.5), 0.45, "лёгкий контур флага")
    ev(T_CRASH, chalk(0.35, 2), 0.6, "красная пунктирная стрелка вниз — «сейчас рухнет»")
    # 3. Отсчёт
    ev(T_GROW, chalk(0.5, 1.2), 0.75, "свеча дорисована до половины и упирается в верх коридора")
    ev(T_UP3 - 0.1, chalk(0.25, 2), 0.7, "кнопка «ВВЕРХ»")
    ev(T_DOWN3 - 0.1, chalk(0.25, 2), 0.7, "кнопка «ВНИЗ»")
    ev(DISSOLVE_TITLE, dust_puff(), 0.6, "заголовок рассыпается — место для отсчёта")
    for k, c in enumerate(COUNTS):
        ev(c, clock_tick(), 1.5, f"тик часов, мел пишет «{3 - k}…»")
    # 4. Ответ
    ev(T_REVEAL, ding(), 1.0, "правильный ответ: ВВЕРХ")
    ev(T_REVEAL, bass_hit(), 0.9, "удар баса")
    ev(T_CHECK, chalk(0.25, 2.5), 0.9, "жирная галочка на зелёной кнопке")
    ev(T_CROSS, chalk(0.2, 2.5), 0.6, "стрелка «рухнет» зачёркнута")
    ev(SHOOT[0] - 0.1, whoosh_up(), 0.8, "свеча закрылась над коридором — график улетает вверх")
    ev(T_FLAG, chalk(0.6, 1.3), 0.85, "огромное «ФЛАГ» — и оно развевается")
    ev(DISSOLVE_BTN, dust_puff(), 0.5, "кнопки рассыпаются пылью")
    ev(T_POLE, chalk(0.35, 1.5), 0.7, "скобка вдоль древка")
    ev(T_CLOTH, chalk(0.45, 1.2), 0.55, "штриховка полотнища")
    ev(T_MEASURE, whoosh_up(0.6), 0.35, "копия скобки едет к пробою")
    ev(T_MEASURE + 0.7, chalk(0.25, 2), 0.8, "стрелка длиной с древко")
    # 5. Правило
    ev(DISSOLVE_FLAG, dust_puff(), 0.6, "«ФЛАГ» рассыпается")
    for k, ts in enumerate(T_SIGNS):
        ev(ts, chalk(0.35, 1.5), 0.7, ("«РЕЗКИЙ РОСТ»", "«ОТКАТ В КАНАЛЕ»", "«ЗАКРЫТИЕ НАД КАНАЛОМ»")[k])
        ev(ts + 0.38, chalk(0.16, 3), 1.0, "галочка")
    # 6. Петля
    ev(T_WIPE, sponge(), 1.0, "губка стирает доску одним махом")
    ev(REDRAW[0], chalk(0.85, 1.4), 0.75, "мел снова рисует древко")
    ev(T_NEXT, chalk(0.6, 1.4), 0.8, "«#4 ЗАВТРА»")
    ev(DISSOLVE_NEXT, dust_puff(), 0.6, "надпись рассыпается")
    ev(T_LAST_Q, chalk(0.45, 1.6), 0.9, "жёлтый «?» — последний кадр совпадает с первым")


# ---------- сборка ----------

def srt_time(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main():
    build_events()
    n = int(DURATION * SR)
    voice, fx = np.zeros(n), np.zeros(n)
    for at, ln in zip(VOICE_AT, LINES):
        wav, sr = sf.read(LINES_JSON.parent / ln["file"], dtype="float32")
        assert sr == SR, sr
        place(voice, wav.astype(np.float64), at)
    on = np.abs(voice) > 0.02 * np.abs(voice).max()
    voice *= 10 ** (-15 / 20) / np.sqrt(np.mean(voice[on] ** 2))
    for at, sound, gain, _ in EVENTS:
        place(fx, sound, at, gain)
    mix = voice + fx * float(PROJECT.get("sfx_gain", 0.34))  # без фоновой музыки: только голос и эффекты
    mix = 0.97 * np.tanh(mix / 0.97)
    mix[:240] *= np.linspace(0, 1, 240)
    mix[-960:] *= np.linspace(1, 0, 960)
    sf.write(OUT + ".wav", mix.astype(np.float32), SR)

    with open(OUT + ".srt", "w", encoding="utf-8") as f:
        for k, (at, ln) in enumerate(zip(VOICE_AT, LINES), 1):
            text = re.sub(r"(?<=[а-яё])[А-ЯЁ]", lambda m: m.group(0).lower(), ln["text"])  # «дрЕвко» → «древко»
            f.write(f"{k}\n{srt_time(at)} --> {srt_time(at + ln['duration'])}\n{text}\n\n")

    names = ["Крючок", "Флаг", "Отсчёт", "Ответ", "Правило", "Петля"]
    with open(BUILD / "timeline.txt", "w", encoding="utf-8") as f:
        f.write(f"{PROJECT.get('title', '')} — тайминги дорожки {OUT}.wav, длина {DURATION:.2f} с\n\n")
        f.write("СЦЕНЫ:\n")
        for k, name in enumerate(names):
            f.write(f"  {k + 1}. {name:8s} {CUTS[k]:6.2f} – {CUTS[k + 1]:6.2f} с\n")
        f.write("\nОТСЧЁТ: " + ", ".join(f"«{3 - k}» {c:.2f} с" for k, c in enumerate(COUNTS))
                + f", ответ «Вверх!» {T_REVEAL:.2f} с\n")
        f.write("\nЭФФЕКТЫ (что происходит в кадре):\n")
        for at, _, _, what in sorted(EVENTS, key=lambda e: e[0]):
            f.write(f"  {at:6.2f} с  {what}\n")

    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    on = np.abs(voice) > 0.02
    idx = np.flatnonzero(np.convolve(on, np.ones(480), "same") > 0)
    gaps = [(g, s) for g, s in zip(np.diff(idx) / SR, idx[:-1] / SR) if not (COUNTS[0] - 0.5 <= s <= T_REVEAL + 0.2)]
    print("сцены:", " | ".join(f"{a:.2f}–{b:.2f}" for a, b in zip(CUTS, CUTS[1:])), f"→ {DURATION:.2f} с")
    print(f"голос {rms(voice[on]):.1f} дБ, эффекты {rms(fx * 0.34):.1f} дБ, пик {np.abs(mix).max():.2f}, "
          f"самая длинная пауза голоса вне отсчёта {max(g for g, _ in gaps):.2f} с, "
          f"на стыке петли {DURATION - (VOICE_AT[-1] + LINES[-1]['duration']) + VOICE_AT[0]:.2f} с")


if __name__ == "__main__":
    main()
