"""Шаблон «Урок на доске» (YouTube 16:9): таймлайн голоса по главам и звуки мела без музыки.

Проект берётся из папки VPROJ_DIR (распакованный .vproj): project.json и voice/lines/lines.json.
python audio.py  — собрать build/audio.wav, .srt, build/timeline.txt и build/chapters.txt (таймкоды для описания)
Рисунки и их звуки описаны в beats.py: звук события стоит ровно там же, где событие в кадре.
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
SCENE_NAMES = PROJECT.get("chapters") or ["Вступление", "Свеча", "Уровни", "Направление", "Пробой и ловушка",
                                          "Фигуры", "Всё вместе", "Чек-лист", "Загадка"]


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
GAP_IN, GAP_SCENE = 0.22, 0.9   # между главами — короткая пауза на губку и новую доску
VOICE_AT, t = [], 0.6
for k, ln in enumerate(LINES):
    if k and ln["scene"] != LINES[k - 1]["scene"]:
        t += GAP_SCENE - GAP_IN
    if k and LINES[k - 1]["emotion"] == "count":  # отсчёт: ровно секунда между числами
        t = max(t, VOICE_AT[-1] + 1.0)
    VOICE_AT.append(t)
    t += ln["duration"] + GAP_IN
DURATION = VOICE_AT[-1] + LINES[-1]["duration"] + 1.6
N_SCENES = max(ln["scene"] for ln in LINES)
FIRST = [next(k for k, ln in enumerate(LINES) if ln["scene"] == s) for s in range(1, N_SCENES + 1)]
CUTS = [0.0] + [VOICE_AT[FIRST[s]] - 0.75 for s in range(1, N_SCENES)] + [DURATION]
COUNTS = [VOICE_AT[k] for k, ln in enumerate(LINES) if ln["emotion"] == "count"]


def start(scene):
    return CUTS[scene - 1]


MISSING = []   # опорные слова, которых нет в изменённом тексте (событие встаёт в начало его фразы или сцены)


def word_t(scene, stem, nth=0):
    hits = [VOICE_AT[k] + s for k, ln in enumerate(LINES) if ln["scene"] == scene
            for w, s, _ in ln["words"] if norm(w).startswith(norm(stem))]
    if len(hits) > nth:
        return hits[nth]
    MISSING.append(f"глава {scene}: «{stem}»")
    return VOICE_AT[FIRST[scene - 1]] + 0.5


TIMELINE = []  # редактируемые события для редактора: имя, подпись, исходное время, сдвиг


def at(name, label, base):
    off = float(OFFSETS.get(name, 0.0))
    TIMELINE.append(dict(name=name, label=label, base=round(float(base), 3), offset=off))
    return base + off


# ---------- звуки мела ----------

rng = np.random.default_rng(14)


def filt(x, kind, f):
    return signal.sosfilt(signal.butter(2, f, kind, fs=SR, output="sos"), x)


def sweep(f0, f1, dur):
    n = int(dur * SR)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (np.arange(n) / n)) / SR)


def chalk(dur, density=1.0, grit=1.0):
    """Мел по доске: шершавые штрихи с зернистым «треском»."""
    n = max(1, int(dur * SR))
    out = np.zeros(n)
    t0 = 0.0
    while t0 < dur:
        ln = rng.uniform(0.07, 0.18)
        a, b = int(t0 * SR), min(n, int((t0 + ln) * SR))
        m = b - a
        if m > 10:
            tone = filt(rng.uniform(-1, 1, m), "bandpass", [rng.uniform(700, 1300), rng.uniform(3500, 6000)])
            crackle = filt((rng.random(m) < 0.004 * grit) * rng.uniform(-1, 1, m), "highpass", 2000) * 3
            shape = np.sin(np.pi * np.arange(m) / m) ** 0.6
            out[a:b] += (tone * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(60, 140) * np.arange(m) / SR)) + crackle) \
                * shape * rng.uniform(0.6, 1.0)
        t0 += ln + rng.uniform(0.01, 0.05) / density
    return out * 0.55


def tap():
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    click = filt(rng.uniform(-1, 1, n), "bandpass", [1500, 6000]) * np.exp(-tt * 160)
    return (click + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 70) * 0.6) * 0.9


def taps(count, gap=0.08):
    out = np.zeros(int((count * gap + 0.1) * SR))
    for k in range(count):
        s = tap() * rng.uniform(0.7, 1.0)
        a = int(k * gap * SR)
        out[a:a + len(s)] += s
    return out


def clock_tick():
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    click = filt(rng.uniform(-1, 1, n), "bandpass", [1800, 7000]) * np.exp(-tt * 260)
    wood = (np.sin(2 * np.pi * 950 * tt) + 0.5 * np.sin(2 * np.pi * 2300 * tt)) * np.exp(-tt * 55)
    return np.tanh(1.5 * (click + 0.8 * wood))


def ding():
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for f, a, d in ((1318.5, 0.5, 0.0), (1760.0, 0.45, 0.09), (2637.0, 0.22, 0.09)):
        k = int(d * SR)
        s[k:] += a * np.sin(2 * np.pi * f * tt[:n - k]) * np.exp(-tt[:n - k] * 4)
    return s


def whoosh_up(dur=0.45):
    n = int(dur * SR)
    e = np.sin(np.pi * np.arange(n) / n) ** 2
    return (filt(rng.uniform(-1, 1, n), "bandpass", [600, 7000]) + 0.4 * sweep(300, 1900, dur)) * e * 0.7


def riser(dur=0.8):
    n = int(dur * SR)
    ramp = (np.arange(n) / n) ** 2
    return (filt(rng.uniform(-1, 1, n), "highpass", 1500) * 0.6 + 0.3 * sweep(300, 1600, dur)) * ramp


def snap():
    """Щелчок капкана."""
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    hit = filt(rng.uniform(-1, 1, n), "bandpass", [900, 5000]) * np.exp(-tt * 45)
    metal = (np.sin(2 * np.pi * 1450 * tt) + 0.6 * np.sin(2 * np.pi * 2210 * tt)) * np.exp(-tt * 18) * 0.5
    thump = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-tt * 20) + 60) / SR) * np.exp(-tt * 14)
    return np.tanh(1.8 * (hit + metal + thump))


def boing():
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 260 + 220 * np.exp(-tt * 9) * (1 + 0.5 * np.sin(2 * np.pi * 14 * tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) * 0.6


def sponge(dur=0.75):
    n = int(dur * SR)
    x = np.arange(n) / n
    noise = rng.uniform(-1, 1, n)
    rub = filt(noise, "bandpass", [250, 2600]) * (1 + 0.35 * np.sin(2 * np.pi * 18 * x * dur))
    return (rub + 0.25 * filt(noise, "highpass", 3000) * x) * np.sin(np.pi * x) ** 1.2


def dust_puff(dur=0.35):
    n = int(dur * SR)
    e = np.exp(-np.arange(n) / SR * 9) * np.minimum(1, np.arange(n) / (0.02 * SR))
    return filt(rng.uniform(-1, 1, n), "bandpass", [300, 1800]) * e * 0.6


def ding_bass():
    """Динь с басом — правильный ответ."""
    tt = np.arange(int(1.2 * SR)) / SR
    return ding() + 0.8 * np.sin(2 * np.pi * 73 * tt) * np.exp(-tt * 5)


def boom():
    """Глухой удар: график уронили."""
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-tt * 12) + 45) / SR) * np.exp(-tt * 9)
    return np.tanh(2.2 * (thump + 0.5 * filt(rng.uniform(-1, 1, n), "lowpass", 900) * np.exp(-tt * 30)))


def creak(dur=1.2):
    """Натяжение каната: неровный скрип волокон."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    rate = 58 + 30 * np.sin(2 * np.pi * rng.uniform(1.2, 2.2) * tt + rng.uniform(0, 6))
    pulses = (np.diff(np.floor(np.cumsum(rate) / SR), prepend=0) > 0) * rng.uniform(0.5, 1, n)
    body = filt(pulses, "bandpass", [350, 1800]) + 0.5 * filt(pulses, "bandpass", [1800, 3800])
    return np.tanh(3 * body) * np.sin(np.pi * np.arange(n) / n) ** 0.7 * 0.8


def crunch():
    """Хруст: большая свеча съела маленькую."""
    out = np.zeros(int(0.34 * SR))
    for k in range(7):
        m = int(rng.uniform(0.03, 0.07) * SR)
        tt = np.arange(m) / SR
        burst = filt(rng.uniform(-1, 1, m), "bandpass", [rng.uniform(500, 1200), rng.uniform(3000, 6500)]) * np.exp(-tt * 70)
        a = int((k * 0.04 + rng.uniform(0, 0.012)) * SR)
        out[a:a + m] += burst * rng.uniform(0.6, 1.0)
    return np.tanh(2 * out)


def pop():
    """Вопросительный поп."""
    tt = np.arange(int(0.13 * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(420 + 5200 * tt) / SR) * np.minimum(1, tt / 0.006) * np.exp(-tt * 22)


def buzz():
    """Бзз на крестике."""
    tt = np.arange(int(0.3 * SR)) / SR
    wave = np.sign(np.sin(2 * np.pi * 118 * tt)) + 0.5 * np.sign(np.sin(2 * np.pi * 177 * tt))
    return filt(wave, "lowpass", 1400) * np.minimum(1, tt / 0.01) * np.minimum(1, (0.3 - tt) / 0.03) * 0.55


SOUNDS = {
    "chalk": lambda d: chalk(max(0.15, min(d, 2.5)), 1.3),
    "chalk_fast": lambda d: chalk(max(0.15, min(d, 1.2)), 2.2),
    "taps": lambda n: taps(int(n)),
    "tap": lambda _: tap(),
    "tick": lambda _: clock_tick(),
    "ding": lambda _: ding(),
    "whoosh": lambda d: whoosh_up(max(0.3, min(d, 0.8))),
    "riser": lambda d: riser(max(0.4, min(d, 1.2))),
    "snap": lambda _: snap(),
    "boing": lambda _: boing(),
    "sponge": lambda _: sponge(),
    "dust": lambda _: dust_puff(),
    "ding_bass": lambda _: ding_bass(),
    "boom": lambda _: boom(),
    "creak": lambda d: creak(max(0.5, min(d, 2.0))),
    "crunch": lambda _: crunch(),
    "pop": lambda _: pop(),
    "buzz": lambda _: buzz(),
}
GAINS = {"chalk": 0.7, "chalk_fast": 0.6, "taps": 0.9, "tap": 0.9, "tick": 1.3, "ding": 0.9, "whoosh": 0.7,
         "riser": 0.5, "snap": 1.0, "boing": 0.8, "sponge": 1.0, "dust": 0.6, "ding_bass": 0.9, "boom": 1.0,
         "creak": 0.8, "crunch": 1.0, "pop": 0.9, "buzz": 0.8}


def place(buf, sig, at_, gain=1.0):
    a = int(round(at_ * SR))
    if a < 0:
        sig, a = sig[-a:], 0
    if a < len(buf):
        b = min(len(buf), a + len(sig))
        buf[a:b] += sig[:b - a] * gain


def srt_time(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def mmss(x):
    return f"{int(x // 60)}:{int(x % 60):02}"


def main():
    import beats  # рисунки и их звуки — общие с видео
    n = int(DURATION * SR)
    voice, fx = np.zeros(n), np.zeros(n)
    for at_, ln in zip(VOICE_AT, LINES):
        wav, sr = sf.read(LINES_JSON.parent / ln["file"], dtype="float32")
        assert sr == SR, sr
        place(voice, wav.astype(np.float64), at_)
    on = np.abs(voice) > 0.02 * np.abs(voice).max()
    voice *= 10 ** (-15 / 20) / np.sqrt(np.mean(voice[on] ** 2))
    for at_, kind, arg, what in beats.SOUND_EVENTS:
        place(fx, SOUNDS[kind](arg), at_, GAINS[kind])
    mix = voice + fx * float(PROJECT.get("sfx_gain", 0.3))  # без музыки: только голос и эффекты
    mix = 0.97 * np.tanh(mix / 0.97)
    mix[:240] *= np.linspace(0, 1, 240)
    mix[-4800:] *= np.linspace(1, 0, 4800)
    sf.write(OUT + ".wav", mix.astype(np.float32), SR)

    with open(OUT + ".srt", "w", encoding="utf-8") as f:
        for k, (at_, ln) in enumerate(zip(VOICE_AT, LINES), 1):
            text = re.sub(r"(?<=[а-яё])[А-ЯЁ]", lambda m: m.group(0).lower(), ln["text"])
            text = text.replace("дабл-ю", "«W»").replace("буква эм", "буква «М»")
            f.write(f"{k}\n{srt_time(at_)} --> {srt_time(at_ + ln['duration'])}\n{text}\n\n")
    with open(BUILD / "chapters.txt", "w", encoding="utf-8") as f:   # таймкоды глав для описания YouTube
        for k, name in enumerate(SCENE_NAMES[:N_SCENES]):
            f.write(f"{mmss(CUTS[k])} {name}\n")
    with open(BUILD / "timeline.txt", "w", encoding="utf-8") as f:
        f.write(f"{PROJECT.get('title', '')} — длина {DURATION:.1f} с ({mmss(DURATION)})\n\n")
        for k, name in enumerate(SCENE_NAMES[:N_SCENES]):
            f.write(f"  {k + 1}. {name:18s} {CUTS[k]:7.2f} – {CUTS[k + 1]:7.2f} с\n")
        f.write("\nСОБЫТИЯ:\n")
        for at_, kind, _, what in sorted(beats.SOUND_EVENTS, key=lambda e: e[0]):
            if what:
                f.write(f"  {at_:7.2f} с  [{kind}] {what}\n")

    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    on = np.abs(voice) > 0.02
    idx = np.flatnonzero(np.convolve(on, np.ones(480), "same") > 0)
    gaps = [g for g, s in zip(np.diff(idx) / SR, idx[:-1] / SR) if not (COUNTS and COUNTS[0] - 0.5 <= s <= COUNTS[-1] + 1.2)]
    print("главы:", " | ".join(f"{mmss(a)}" for a in CUTS[:-1]), f"→ {DURATION:.1f} с ({mmss(DURATION)})")
    print(f"голос {rms(voice[on]):.1f} дБ, эффекты {rms(fx * 0.3):.1f} дБ, пик {np.abs(mix).max():.2f}, "
          f"самая длинная пауза голоса {max(gaps, default=0):.2f} с, звуковых событий {len(beats.SOUND_EVENTS)}")
    if MISSING:
        print("не найдены опорные слова:", ", ".join(sorted(set(MISSING))))


if __name__ == "__main__":
    main()
