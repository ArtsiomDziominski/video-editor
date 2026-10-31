"""Шаблон «Блиц на белой доске»: таймлайн голоса, события и звуки маркера без музыки.

Проект берётся из папки VPROJ_DIR (распакованный .vproj): project.json и voice/lines/lines.json.
python audio.py  — собрать build/audio.wav, .srt и build/timeline.txt
Все тайминги видео (video.py) берутся из этого модуля; сдвиги событий — project.json → offsets.
Сцены: 1 крючок; 2, 4, 6 — график и отсчёт; 3, 5, 7 — ответ; 8 — финал.
"""
import json
import os
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
SCENE_NAMES = ["Крючок", "График 1", "Ответ 1", "График 2", "Ответ 2", "График 3", "Ответ 3", "Финал"]


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
GAP_IN, GAP_WIPE = 0.18, 0.62
HOLD = {6: 0.25, 8: 0.45}   # перед этими сценами ответ ещё стоит на доске, иначе надпись не успеть прочитать
VOICE_AT, t = [], 0.12
for k, ln in enumerate(LINES):
    if k and ln["scene"] != LINES[k - 1]["scene"] and ln["scene"] % 2 == 0:  # перед новой доской — время на губку
        t += GAP_WIPE - GAP_IN + HOLD.get(ln["scene"], 0.0)
    if k and LINES[k - 1]["emotion"] == "count":  # отсчёт: ровно секунда между «три», «два», «один» и ответом
        t = max(t, VOICE_AT[-1] + 1.0)
    VOICE_AT.append(t)
    t += ln["duration"] + GAP_IN
DURATION = VOICE_AT[-1] + LINES[-1]["duration"] + 1.1
N_SCENES = 8
FIRST = [next(k for k, ln in enumerate(LINES) if ln["scene"] == s) for s in range(1, N_SCENES + 1)]
CUTS = [0.0] + [VOICE_AT[FIRST[s]] - (GAP_WIPE - 0.04 if (s + 1) % 2 == 0 else 0.0) for s in range(1, N_SCENES)] + [DURATION]
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
    TIMELINE.append(dict(name=name, label=label, base=round(float(base), 3), offset=off))
    return base + off


# ---------- события (общие для звука и видео) ----------

WIPE_DUR = 0.56
BOXES = [at(f"T_BOX{k + 1}", f"квадратик {k + 1}", 0.42 + 0.17 * k) for k in range(3)]
T_FINAL = at("T_FINAL", "слово «ФИНАЛ»", word_t(1, "финал") + 0.45)
T_BOARD = [start(s) for s in (2, 4, 6, 8)]                      # губка стирает доску
ANS = [start(s) for s in (3, 5, 7)]                             # ответ — ровно на слове

# график 1: ловушка
T_DRAW1 = at("T_DRAW1", "график 1", T_BOARD[0] + WIPE_DUR * 0.7)
T_LEVEL1 = at("T_LEVEL1", "синий уровень", word_t(2, "первый"))
T_PIERCE = at("T_PIERCE", "тень прокалывает уровень", word_t(2, "проколола"))
T_CLOSE1 = at("T_CLOSE1", "свеча закрывается под уровнем", word_t(2, "закрылась"))
T_BTN1 = at("T_BTN1", "кнопки 1", word_t(2, "куда") - 0.25)
T_WORD1 = at("T_WORD1", "«ЛОВУШКА»", word_t(3, "ложный"))
T_TAIL1 = at("T_TAIL1", "обводка закрытия", word_t(3, "закрытие"))

# график 2: двойное дно
T_DRAW2 = at("T_DRAW2", "буква W", T_BOARD[1] + WIPE_DUR * 0.7)
T_TOUCH = [at("T_TOUCH1", "первое касание", word_t(4, "касания")), at("T_TOUCH2", "второе касание", word_t(4, "дна"))]
T_NECK = at("T_NECK", "пунктир", word_t(4, "дна") + 0.3)
T_CLOSE2 = at("T_CLOSE2", "свеча над пунктиром", word_t(4, "закрылась"))
T_BTN2 = at("T_BTN2", "кнопки 2", word_t(4, "куда") - 0.25)
T_WORD2 = at("T_WORD2", "«ДВОЙНОЕ ДНО»", word_t(5, "двойное"))

# график 3: флаг
T_DRAW3 = at("T_DRAW3", "ровное начало", T_BOARD[2] + WIPE_DUR * 0.7)
T_POLE = at("T_POLE", "рывок вверх", word_t(6, "резкий") - 0.1)
T_RISE = at("T_RISE", "конец рывка", word_t(6, "взлёт") + 0.25)
T_SLIDE = at("T_SLIDE", "откат", word_t(6, "откат") - 0.15)
T_CHANNEL = at("T_CHANNEL", "коридор", word_t(6, "узком"))
T_CLOSE3 = at("T_CLOSE3", "закрытие над коридором", word_t(6, "закрытие"))
T_BTN3 = at("T_BTN3", "кнопки 3", COUNTS[6] - 0.3)
T_WORD3 = at("T_WORD3", "«ФЛАГ»", word_t(7, "флаг"))

# финал
T_ASK = at("T_ASK", "«СКОЛЬКО ИЗ 3?»", word_t(8, "сколько"))
T_TAPS = [at(f"T_TAP{k + 1}", f"стук по квадратику {k + 1}", word_t(8, "три") + 0.1 + 0.24 * k) for k in range(3)]
T_END = at("T_END", "«СЕРИЯ ЗАВЕРШЕНА»", word_t(8, "серия"))
T_TICK = at("T_TICK", "финальная галочка", word_t(8, "серия") + 1.0)


# ---------- звуки маркера ----------

rng = np.random.default_rng(15)


def filt(x, kind, f):
    return signal.sosfilt(signal.butter(2, f, kind, fs=SR, output="sos"), x)


def sweep(f0, f1, dur):
    n = int(dur * SR)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (np.arange(n) / n)) / SR)


def scribble(dur, density=1.0):
    """Маркер по доске: короткие шуршащие штрихи."""
    n = max(1, int(dur * SR))
    out = np.zeros(n)
    t0 = 0.0
    while t0 < dur:
        ln = rng.uniform(0.06, 0.16)
        a, b = int(t0 * SR), min(n, int((t0 + ln) * SR))
        m = b - a
        if m > 10:
            tone = filt(rng.uniform(-1, 1, m), "bandpass", [rng.uniform(1400, 2200), rng.uniform(5000, 8000)])
            out[a:b] += tone * np.sin(np.pi * np.arange(m) / m) ** 0.7 * rng.uniform(0.5, 1.0)
        t0 += ln + rng.uniform(0.01, 0.06) / density
    return out * 0.6


def squeak(dur=0.4):
    """Скрип маркера."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 1900 + 700 * tt / dur + 60 * np.sin(2 * np.pi * 28 * tt)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * np.sin(np.pi * tt / dur) ** 0.5 * 0.35 + 0.3 * scribble(dur)[:n]


def tap():
    """Стук маркера по доске."""
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    click = filt(rng.uniform(-1, 1, n), "bandpass", [1200, 4500]) * np.exp(-tt * 140)
    return (click + np.sin(2 * np.pi * 240 * tt) * np.exp(-tt * 80) * 0.7) * 0.9


def dashes(count=7, gap=0.08):
    """Пунктир — короткие постукивания."""
    out = np.zeros(int((count * gap + 0.1) * SR))
    for k in range(count):
        s = tap() * rng.uniform(0.5, 0.8)
        a = int(k * gap * SR)
        out[a:a + len(s)] += s
    return out


def boing():
    """Мягкая пружинка на касании."""
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 260 + 220 * np.exp(-tt * 9) * (1 + 0.5 * np.sin(2 * np.pi * 14 * tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) * 0.7


def clock_tick():
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


def snap():
    """Щелчок капкана."""
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    hit = filt(rng.uniform(-1, 1, n), "bandpass", [900, 5000]) * np.exp(-tt * 45)
    metal = (np.sin(2 * np.pi * 1450 * tt) + 0.6 * np.sin(2 * np.pi * 2210 * tt)) * np.exp(-tt * 18) * 0.5
    thump = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-tt * 20) + 60) / SR) * np.exp(-tt * 14)
    return np.tanh(1.8 * (hit + metal + thump))


def wipe(dur=WIPE_DUR):
    """Сухая губка по белой доске: шорох туда-обратно."""
    n = int(dur * SR)
    x = np.arange(n) / n
    e = np.sin(np.pi * x) ** 0.8 * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 2 * x)))
    return filt(rng.uniform(-1, 1, n), "bandpass", [500, 4200]) * e * 0.8


def place(buf, sig, at_, gain=1.0):
    a = int(round(at_ * SR))
    if a < 0:
        sig, a = sig[-a:], 0
    if a < len(buf):
        b = min(len(buf), a + len(sig))
        buf[a:b] += sig[:b - a] * gain


EVENTS = []  # (время, звук, громкость, что происходит в кадре)


def ev(at_, sound, gain, what):
    EVENTS.append((at_, sound, gain, what))


def build_events():
    # 1. Крючок
    ev(0.0, scribble(0.45, 1.5), 0.9, "маркер пишет «УГАДАЙ СВЕЧУ #4»")
    ev(0.02, squeak(0.35), 0.55, "скрип маркера")
    for k, tb in enumerate(BOXES):
        ev(tb, tap(), 1.3, f"стук: квадратик {k + 1}")
    ev(T_FINAL, scribble(0.4, 2), 0.9, "«ФИНАЛ»")
    # 2. График 1
    ev(T_BOARD[0], wipe(), 0.7, "губка стирает заголовок")
    ev(T_DRAW1, scribble(0.8, 1.4), 0.55, "маркер рисует график с двумя отскоками")
    ev(T_LEVEL1, dashes(5, 0.06), 0.6, "синий уровень")
    ev(T_PIERCE, squeak(0.3), 0.6, "тень прокалывает уровень")
    ev(T_CLOSE1, scribble(0.35, 2), 0.75, "свеча закрывается под уровнем")
    ev(T_BTN1, scribble(0.25, 2), 0.6, "кнопки")
    for k in range(3):
        ev(COUNTS[k], clock_tick(), 1.5, f"тик: {3 - k}")
    # 3. Ответ 1
    ev(ANS[0], ding(), 1.0, "ответ: ВНИЗ")
    ev(ANS[0], bass_hit(), 0.9, "удар баса")
    ev(ANS[0] + 0.1, scribble(0.3, 2.5), 0.8, "обводка кнопки")
    ev(T_WORD1, snap(), 1.3, "щелчок капкана: «ЛОВУШКА»")
    ev(T_TAIL1, scribble(0.3, 2), 0.7, "обводка закрытия")
    # 4. График 2
    ev(T_BOARD[1], wipe(), 1.0, "губка стирает доску")
    ev(T_DRAW2, scribble(1.0, 1.3), 0.6, "маркер рисует W")
    for k, tt in enumerate(T_TOUCH):
        ev(tt, boing(), 1.0, f"касание {k + 1}: боинг")
    ev(T_NECK, dashes(8), 0.7, "пунктир через середину")
    ev(T_CLOSE2, scribble(0.3, 2), 0.75, "свеча закрывается над пунктиром")
    ev(T_BTN2, scribble(0.25, 2), 0.6, "кнопки")
    for k in range(3):
        ev(COUNTS[3 + k], clock_tick(), 1.5, f"тик: {3 - k}")
    # 5. Ответ 2
    ev(ANS[1], ding(), 1.0, "ответ: ВВЕРХ")
    ev(ANS[1], bass_hit(), 0.9, "удар баса")
    ev(ANS[1] + 0.25, whoosh_up(), 0.8, "вжух вверх")
    ev(T_WORD2, scribble(0.5, 1.6), 0.8, "«ДВОЙНОЕ ДНО»")
    # 6. График 3
    ev(T_BOARD[2], wipe(), 1.0, "губка стирает доску")
    ev(T_DRAW3, scribble(0.3, 1.6), 0.5, "ровное начало графика")
    ev(T_POLE, scribble(0.7, 1.6), 0.7, "резкий рывок вверх")
    ev(T_POLE + 0.05, squeak(0.45), 0.5, "скрип маркера")
    ev(T_SLIDE, scribble(0.9, 1.2), 0.5, "маленькие свечи сползают")
    ev(T_CHANNEL, dashes(6, 0.07), 0.6, "линии коридора")
    ev(T_CLOSE3, scribble(0.3, 2), 0.75, "закрытие над коридором")
    ev(T_BTN3, scribble(0.25, 2), 0.6, "кнопки")
    for k in range(3):
        ev(COUNTS[6 + k], clock_tick(), 1.5, f"тик: {3 - k}")
    # 7. Ответ 3
    ev(ANS[2], ding(), 1.0, "ответ: ВВЕРХ")
    ev(ANS[2], bass_hit(), 0.9, "удар баса")
    ev(ANS[2] + 0.25, whoosh_up(0.55), 0.85, "вжух вверх")
    ev(T_WORD3, scribble(0.4, 1.8), 0.8, "«ФЛАГ»")
    # 8. Финал
    ev(T_BOARD[3], wipe(), 1.0, "губка стирает доску")
    ev(T_ASK, scribble(0.5, 1.6), 0.75, "«СКОЛЬКО ИЗ 3?»")
    for k, tt in enumerate(T_TAPS):
        ev(tt, tap(), 1.4, f"стук по квадратику {k + 1}")
    ev(T_END, scribble(0.7, 1.5), 0.75, "«СЕРИЯ ЗАВЕРШЕНА»")
    ev(T_TICK, squeak(0.25), 0.7, "галочка")
    ev(T_TICK, tap(), 1.2, "галочка: стук")


# ---------- сборка ----------

def srt_time(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main():
    build_events()
    n = int(DURATION * SR)
    voice, fx = np.zeros(n), np.zeros(n)
    for at_, ln in zip(VOICE_AT, LINES):
        wav, sr = sf.read(LINES_JSON.parent / ln["file"], dtype="float32")
        assert sr == SR, sr
        place(voice, wav.astype(np.float64), at_)
    on = np.abs(voice) > 0.02 * np.abs(voice).max()
    voice *= 10 ** (-15 / 20) / np.sqrt(np.mean(voice[on] ** 2))
    for at_, sound, gain, _ in EVENTS:
        place(fx, sound, at_, gain)
    mix = voice + fx * float(PROJECT.get("sfx_gain", 0.34))  # без фоновой музыки: только голос и эффекты
    mix = 0.97 * np.tanh(mix / 0.97)
    mix[:240] *= np.linspace(0, 1, 240)
    mix[-960:] *= np.linspace(1, 0, 960)
    sf.write(OUT + ".wav", mix.astype(np.float32), SR)

    with open(OUT + ".srt", "w", encoding="utf-8") as f:
        for k, (at_, ln) in enumerate(zip(VOICE_AT, LINES), 1):
            text = re.sub(r"(?<=[а-яё])[А-ЯЁ]", lambda m: m.group(0).lower(), ln["text"])  # «пробОй» → «пробой»
            f.write(f"{k}\n{srt_time(at_)} --> {srt_time(at_ + ln['duration'])}\n{text}\n\n")

    with open(BUILD / "timeline.txt", "w", encoding="utf-8") as f:
        f.write(f"{PROJECT.get('title', '')} — тайминги дорожки {OUT}.wav, длина {DURATION:.2f} с\n\nСЦЕНЫ:\n")
        for k, name in enumerate(SCENE_NAMES):
            f.write(f"  {k + 1}. {name:10s} {CUTS[k]:6.2f} – {CUTS[k + 1]:6.2f} с\n")
        f.write("\nЭФФЕКТЫ (что происходит в кадре):\n")
        for at_, _, _, what in sorted(EVENTS, key=lambda e: e[0]):
            f.write(f"  {at_:6.2f} с  {what}\n")

    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    on = np.abs(voice) > 0.02
    idx = np.flatnonzero(np.convolve(on, np.ones(480), "same") > 0)
    print("сцены:", " | ".join(f"{a:.2f}–{b:.2f}" for a, b in zip(CUTS, CUTS[1:])), f"→ {DURATION:.2f} с")
    print(f"голос {rms(voice[on]):.1f} дБ, эффекты {rms(fx * 0.34):.1f} дБ, пик {np.abs(mix).max():.2f}, "
          f"самая длинная пауза голоса {np.diff(idx).max() / SR:.2f} с")
    if MISSING:
        print("не найдены опорные слова:", ", ".join(sorted(set(MISSING))))


if __name__ == "__main__":
    main()
