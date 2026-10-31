"""Шаблон «Моушен-урок» (YouTube 16:9): таймлайн голоса по главам, звуки и тихий эмбиент во вступлении и финале.

Проект берётся из папки VPROJ_DIR (распакованный .vproj): project.json и voice/lines/lines.json.
python audio.py  — собрать build/audio.wav, .srt, build/timeline.txt и build/chapters.txt (таймкоды для описания)
События и их звуки описаны в beats.py: звук стоит ровно там же, где событие в кадре.
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
SCENE_NAMES = PROJECT.get("chapters") or []


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
GAP_IN, GAP_SCENE = 0.6, 2.4    # между главами — заставка «новый канал»
VOICE_AT, t = [], 0.6
for k, ln in enumerate(LINES):
    if k and ln["scene"] != LINES[k - 1]["scene"]:
        t += GAP_SCENE - GAP_IN
    VOICE_AT.append(t)
    t += ln["duration"] + GAP_IN
DURATION = VOICE_AT[-1] + LINES[-1]["duration"] + 3.0
N_SCENES = max(ln["scene"] for ln in LINES)
FIRST = [next(k for k, ln in enumerate(LINES) if ln["scene"] == s) for s in range(1, N_SCENES + 1)]
CUTS = [0.0] + [VOICE_AT[FIRST[s]] - 1.15 for s in range(1, N_SCENES)] + [DURATION]   # в CUT шторка закрыла кадр


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


# ---------- звуки: мягкие клики, вжухи, динь; эмбиент только под вступлением и финалом ----------

rng = np.random.default_rng(14)


def filt(x, kind, f):
    return signal.sosfilt(signal.butter(2, f, kind, fs=SR, output="sos"), x)


def sweep(f0, f1, dur):
    n = int(dur * SR)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (np.arange(n) / n)) / SR)


def click():
    """Мягкий щелчок: стрелка, подпись, строка таблицы."""
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    tick_ = filt(rng.uniform(-1, 1, n), "bandpass", [1200, 5200]) * np.exp(-tt * 190)
    return (tick_ + np.sin(2 * np.pi * 240 * tt) * np.exp(-tt * 80) * 0.7) * 0.9


def clunk():
    """Переключение канала: щелчок ручки и короткий хвост помех."""
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(170 * np.exp(-tt * 30) + 90) / SR) * np.exp(-tt * 24)
    hiss = filt(rng.uniform(-1, 1, n), "bandpass", [1800, 7500]) * np.exp(-tt * 34) * 0.5
    return np.tanh(1.6 * (body + hiss))


def clock_tick():
    n = int(0.1 * SR)
    tt = np.arange(n) / SR
    wood = (np.sin(2 * np.pi * 1050 * tt) + 0.5 * np.sin(2 * np.pi * 2300 * tt)) * np.exp(-tt * 70)
    return np.tanh(1.4 * (filt(rng.uniform(-1, 1, n), "bandpass", [1800, 7000]) * np.exp(-tt * 260) + 0.8 * wood))


def ding():
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for f, a, d in ((1318.5, 0.5, 0.0), (1760.0, 0.45, 0.09), (2637.0, 0.22, 0.09)):
        k = int(d * SR)
        s[k:] += a * np.sin(2 * np.pi * f * tt[:n - k]) * np.exp(-tt[:n - k] * 4)
    return s


def whoosh(dur=0.45):
    n = int(dur * SR)
    e = np.sin(np.pi * np.arange(n) / n) ** 2
    return (filt(rng.uniform(-1, 1, n), "bandpass", [600, 7000]) + 0.4 * sweep(300, 1900, dur)) * e * 0.7


def soft_whoosh(dur=0.9):
    n = int(dur * SR)
    e = np.sin(np.pi * np.arange(n) / n) ** 1.6
    return filt(rng.uniform(-1, 1, n), "bandpass", [240, 2400]) * e * 0.8


def stretch(dur=0.9):
    """Растягивающийся вжух: плечо тянет движение."""
    n = int(dur * SR)
    x = np.arange(n) / n
    return (0.5 * sweep(180, 1300, dur) + filt(rng.uniform(-1, 1, n), "bandpass", [500, 5000]) * x) * np.sin(np.pi * x) ** 0.8 * 0.75


def low_alarm(dur=1.0):
    """Тревожный низкий звук на потере."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    w = np.sin(2 * np.pi * 62 * tt) + 0.6 * np.sin(2 * np.pi * 93.5 * tt) + 0.3 * np.sin(2 * np.pi * 124.7 * tt)
    return np.tanh(1.5 * w) * (0.7 + 0.3 * np.sin(2 * np.pi * 5 * tt)) * np.sin(np.pi * tt / dur) ** 0.7 * 0.8


def calm_low():
    """Спокойный низкий звук: сработала защита."""
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 98 * tt) + 0.4 * np.sin(2 * np.pi * 147 * tt)) * np.exp(-tt * 3.6) * np.minimum(1, tt / 0.015) * 0.8


def clink():
    """Металлический звон весов."""
    n = int(1.0 * SR)
    tt = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, a, d in
            ((1870, 0.5, 7), (3120, 0.35, 9), (4860, 0.22, 14), (6410, 0.12, 20)))
    return (s + filt(rng.uniform(-1, 1, n), "highpass", 3500) * np.exp(-tt * 120) * 0.4) * 0.8


def rumble(dur=2.2):
    """Глубокий подводный гул."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    low = np.sin(2 * np.pi * (46 + 5 * np.sin(2 * np.pi * 0.7 * tt)) * tt) + 0.5 * np.sin(2 * np.pi * 69 * tt)
    water = filt(rng.uniform(-1, 1, n), "lowpass", 420) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * tt))
    return (low + 0.7 * water) * np.sin(np.pi * tt / dur) ** 0.9 * 0.8


def step():
    """Шаг по ступени."""
    n = int(0.16 * SR)
    tt = np.arange(n) / SR
    return np.tanh(2 * (np.sin(2 * np.pi * np.cumsum(120 * np.exp(-tt * 40) + 70) / SR) * np.exp(-tt * 26)
                        + 0.4 * filt(rng.uniform(-1, 1, n), "bandpass", [700, 3000]) * np.exp(-tt * 90)))


def pop():
    tt = np.arange(int(0.13 * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(420 + 5200 * tt) / SR) * np.minimum(1, tt / 0.006) * np.exp(-tt * 22)


def buzz():
    """Бзз на кресте."""
    tt = np.arange(int(0.3 * SR)) / SR
    wave = np.sign(np.sin(2 * np.pi * 118 * tt)) + 0.5 * np.sign(np.sin(2 * np.pi * 177 * tt))
    return filt(wave, "lowpass", 1400) * np.minimum(1, tt / 0.01) * np.minimum(1, (0.3 - tt) / 0.03) * 0.55


def noise_rise(dur=8.0):
    """Нарастающий цифровой шум: обрывается резко, под тишину на одной свече."""
    n = int(dur * SR)
    x = np.arange(n) / n
    hold = np.repeat(rng.uniform(-1, 1, n // 12 + 1), 12)[:n]
    bleeps = sum(np.sign(np.sin(2 * np.pi * f * np.arange(n) / SR)) * (rng.uniform(0, 1, n // 4800 + 1).repeat(4800)[:n] > 0.86)
                 for f in (880, 1320, 1975, 2640)) * 0.14
    return (filt(hold, "bandpass", [500, 6500]) + bleeps) * x ** 1.5


def chord():
    """Мягкий финальный аккорд."""
    n = int(4.5 * SR)
    tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) * 0.3 / (1 + k * 0.4) for k, f in enumerate((110, 164.8, 220, 277.2, 329.6, 415.3)))
    return s * np.minimum(1, tt / 0.5) * np.exp(-tt * 0.9)


def ambient(n):
    """Тихий эмбиент: медленные переливы двух аккордов и воздух."""
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for k, (f, ph) in enumerate(((55.0, 0), (82.4, 1.3), (110.0, 2.1), (164.8, 0.4), (207.7, 3.0), (246.9, 4.2), (329.6, 5.1))):
        lfo = 0.5 + 0.5 * np.sin(2 * np.pi * tt / (17 + 5 * k) + ph)
        out += (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.003 * tt + ph)) * lfo ** 1.5 / (1 + 0.25 * k)
    air = filt(rng.uniform(-1, 1, n), "bandpass", [300, 1400]) * 0.08
    return out / 3.5 + air


SOUNDS = {
    "click": lambda _: click(),
    "clunk": lambda _: clunk(),
    "tick": lambda _: clock_tick(),
    "ding": lambda _: ding(),
    "whoosh": lambda d: whoosh(max(0.3, min(d or 0.45, 0.8))),
    "soft_whoosh": lambda d: soft_whoosh(max(0.5, min(d or 0.9, 1.6))),
    "stretch": lambda d: stretch(max(0.5, min(d or 0.9, 1.4))),
    "low_alarm": lambda d: low_alarm(max(0.6, min(d or 1.0, 1.6))),
    "calm_low": lambda _: calm_low(),
    "clink": lambda _: clink(),
    "rumble": lambda d: rumble(max(1.0, min(d or 2.2, 4.0))),
    "step": lambda _: step(),
    "pop": lambda _: pop(),
    "buzz": lambda _: buzz(),
    "noise_rise": lambda d: noise_rise(max(1.0, d or 8.0)),
    "chord": lambda _: chord(),
}
GAINS = {"click": 0.9, "clunk": 0.8, "tick": 1.2, "ding": 0.85, "whoosh": 0.7, "soft_whoosh": 0.7, "stretch": 0.8,
         "low_alarm": 1.1, "calm_low": 1.0, "clink": 0.8, "rumble": 1.3, "step": 1.0, "pop": 0.8, "buzz": 0.8,
         "noise_rise": 0.55, "chord": 1.1}


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
    import beats  # события и их звуки — общие с видео
    n = int(DURATION * SR)
    voice, fx, music = np.zeros(n), np.zeros(n), np.zeros(n)
    for at_, ln in zip(VOICE_AT, LINES):
        wav, sr = sf.read(LINES_JSON.parent / ln["file"], dtype="float32")
        assert sr == SR, sr
        place(voice, wav.astype(np.float64), at_)
    on = np.abs(voice) > 0.02 * np.abs(voice).max()
    if on.any():
        voice *= 10 ** (-15 / 20) / np.sqrt(np.mean(voice[on] ** 2))
    for at_, kind, arg, what in beats.SOUND_EVENTS:
        place(fx, SOUNDS[kind](arg), at_, GAINS[kind])
    for a, b, fade in ((0.0, CUTS[1], 2.0), (CUTS[N_SCENES - 1], DURATION, 3.0)):
        i0, i1 = int(a * SR), min(n, int(b * SR))
        k = np.arange(i1 - i0)
        env = np.minimum(1, np.minimum(k, k[-1] - k) / (fade * SR))
        music[i0:i1] += ambient(i1 - i0) * np.sin(env * np.pi / 2) ** 2 * 10 ** (-29 / 20)
    mix = voice + fx * float(PROJECT.get("sfx_gain", 0.3)) + music  # в главах только голос и эффекты
    mix = 0.97 * np.tanh(mix / 0.97)
    mix[:240] *= np.linspace(0, 1, 240)
    mix[-4800:] *= np.linspace(1, 0, 4800)
    sf.write(OUT + ".wav", mix.astype(np.float32), SR)

    with open(OUT + ".srt", "w", encoding="utf-8") as f:
        for k, (at_, ln) in enumerate(zip(VOICE_AT, LINES), 1):
            text = re.sub(r"(?<=[а-яё])[А-ЯЁ]", lambda m: m.group(0).lower(), ln["text"]).replace("прабои", "пробои")
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
    gaps = np.diff(idx) / SR
    print("главы:", " | ".join(f"{mmss(a)}" for a in CUTS[:-1]), f"→ {DURATION:.1f} с ({mmss(DURATION)})")
    print(f"голос {rms(voice[on]):.1f} дБ, эффекты {rms(fx * 0.3):.1f} дБ, эмбиент {rms(music[music != 0]):.1f} дБ, "
          f"пик {np.abs(mix).max():.2f}, самая длинная пауза голоса {max(gaps, default=0):.2f} с, "
          f"звуковых событий {len(beats.SOUND_EVENTS)}")
    if MISSING:
        print("не найдены опорные слова:", ", ".join(sorted(set(MISSING))))


if __name__ == "__main__":
    main()
