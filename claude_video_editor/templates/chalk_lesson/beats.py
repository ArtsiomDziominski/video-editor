"""Рисунки урока: что, где и когда рисует мел. Общие для звука (audio.py) и видео (video.py).

Здесь — набор элементов, сами рисунки каждого выпуска лежат в episode<номер>.py (номер — project.json → episode).
Каждый элемент привязан к слову озвучки (word_t) — если фраза изменится, рисунок поедет за словом.
Подписанные элементы попадают в редактор: их можно сдвигать по времени, а надписи — править.
Кадр 1920×1080: рисунок слева (x 90…1210, y 150…880), колонка надписей справа (x 1280…1840), субтитры внизу.
"""
from pathlib import Path

import numpy as np

import audio as A
from audio import at, start, word_t

ELEMENTS = []       # элементы рисунка
SOUND_EVENTS = []   # (время, звук, параметр, что происходит)
TEXT_DEFAULTS = {}  # ключ надписи → текст по умолчанию (в проекте можно переписать)
TEXT_TRACK = []     # дорожка «Тексты на экране» в редакторе
EXTRA_WIPES = []    # губка внутри главы
RX, RW = 1560, 540  # колонка надписей: центр и ширина

WHITE, YELLOW, GREEN, RED, BLUE, GREY = "white", "yellow", "green", "red", "blue", "grey"


def W_(scene, stem, nth=0, d=0.0):
    return word_t(scene, stem, nth) + d


def end_of(ch):
    return start(ch + 1) if ch < A.N_SCENES else A.DURATION + 5


def el(kind, ch, t0, dur=0.5, label=None, sound=None, sound_arg=None, end=None, end_mode="wipe", **kw):
    name = f"{ch}:{label}" if label else f"{ch}#{len(ELEMENTS)}"
    if label:
        t0 = at(name, label, t0)
    e = dict(kind=kind, ch=ch, t0=t0, dur=dur, name=name, end=end if end is not None else end_of(ch),
             end_mode=end_mode, **kw)
    ELEMENTS.append(e)
    if sound:
        SOUND_EVENTS.append((t0, sound, dur if sound_arg is None else sound_arg, label or ""))
    return e


def txt(ch, key, default, x, y, t0, size=56, color=WHITE, align="center", dur=None, label=None, sound="chalk", **kw):
    TEXT_DEFAULTS[key] = default
    e = el("text", ch, t0, dur or min(1.2, 0.25 + 0.045 * len(default)), label=label or default.replace("\n", " "),
           sound=sound, key=key, x=x, y=y, size=size, color=color, align=align, **kw)
    TEXT_TRACK.append((key, None, (label or default).replace("\n", " "), e["name"]))
    return e


def plate(ch, key, default):
    """Плашка главы в левом верхнем углу — вся глава."""
    return txt(ch, key, default, 90, 92, start(ch) + 0.35, size=40, color=GREY, align="left", label="Плашка главы")


# ---------- графики ----------

class Chart:
    def __init__(self, x0, step, ytop, ybot, pmin=0.0, pmax=100.0, bw=None):
        self.x0, self.step, self.ytop, self.ybot, self.pmin, self.pmax = x0, step, ytop, ybot, pmin, pmax
        self.bw = bw or step * 0.32

    def x(self, i):
        return self.x0 + i * self.step

    def y(self, p):
        return self.ybot - (p - self.pmin) / (self.pmax - self.pmin) * (self.ybot - self.ytop)


def ohlc_path(closes, first_open, seed, wick=1.6):
    """Свечи по последовательности закрытий: открытие = прошлое закрытие, тени — небольшие случайные."""
    r = np.random.default_rng(seed)
    out, o = [], first_open
    for c in closes:
        h = max(o, c) + r.uniform(0.3, 1.0) * wick
        lo = min(o, c) - r.uniform(0.3, 1.0) * wick
        out.append((o, h, lo, c))
        o = c
    return out


def candles(ch, chart, data, i0, t0, t1, label=None, sound="chalk_fast", end=None, end_mode="wipe", colors=None):
    """Серия свечей рисуется слева направо от t0 до t1. Возвращает элементы свечей."""
    n = len(data)
    step = (t1 - t0) / max(n, 1)
    if label:
        shift = at(f"{ch}:{label}", label, t0) - t0
        t0 += shift
        t1 += shift
    if sound:
        SOUND_EVENTS.append((t0, sound, t1 - t0, label or ""))
    out = []
    for k, (o, h, lo, c) in enumerate(data):
        col = (colors[k] if colors else (GREEN if c >= o else RED))
        out.append(el("candle", ch, t0 + step * k, max(0.2, min(0.45, step * 1.6)), end=end, end_mode=end_mode,
                      x=chart.x(i0 + k), bw=chart.bw, yh=chart.y(h), yo=chart.y(o), yc=chart.y(c), yl=chart.y(lo),
                      color=col))
    return out


def big_candle(ch, x, bw, yh, yo, yc, yl, color, t0, label=None, sound="chalk", **kw):
    return el("candle", ch, t0, 0.8, label=label, sound=sound, x=x, bw=bw, yh=yh, yo=yo, yc=yc, yl=yl, color=color,
              big=True, **kw)


def line(ch, pts, t0, dur=0.6, color=WHITE, thick=6, label=None, sound="chalk", dashed=False, **kw):
    return el("line", ch, t0, dur, label=label, sound="taps" if dashed and sound else sound,
              sound_arg=8 if dashed else None, pts=[tuple(map(float, p)) for p in pts], color=color, thick=thick,
              dashed=dashed, **kw)


def arrow(ch, pts, t0, dur=0.45, color=WHITE, thick=7, head=34, label=None, sound="chalk", **kw):
    return el("arrow", ch, t0, dur, label=label, sound=sound, pts=[tuple(map(float, p)) for p in pts], color=color,
              thick=thick, head=head, **kw)


def ring(ch, cx, cy, rx, ry, t0, color=YELLOW, thick=5, label=None, sound="chalk_fast", **kw):
    return el("ellipse", ch, t0, 0.35, label=label, sound=sound, cx=cx, cy=cy, rx=rx, ry=ry, color=color,
              thick=thick, **kw)


def tick_mark(ch, cx, cy, s, t0, color=GREEN, label=None, sound="chalk_fast", **kw):
    return el("check", ch, t0, 0.25, label=label, sound=sound, cx=cx, cy=cy, s=s, color=color, **kw)


def band(ch, x0, x1, y0, y1, t0, color=BLUE, label=None, opacity=0.35, **kw):
    return el("band", ch, t0, 0.6, label=label, sound="chalk", x0=x0, x1=x1, y0=y0, y1=y1, color=color,
              opacity=opacity, **kw)


def dots(ch, pts, t0, gap=0.22, color=GREEN, r=9, label=None, **kw):
    out = []
    for k, (x, y) in enumerate(pts):
        out.append(el("dot", ch, t0 + gap * k, 0.15, label=label if k == 0 else None, x=x, y=y, r=r, color=color, **kw))
    SOUND_EVENTS.append((out[0]["t0"], "taps", len(pts), label or ""))
    return out


def wave(ch, pts, t0, t1, squeeze_at, cx, color=WHITE, thick=6, label=None, **kw):
    """Извилистая линия: рисуется от t0 до t1, а на squeeze_at сжимается в вертикаль cx."""
    return el("wave", ch, t0, t1 - t0, label=label, sound="chalk", pts=[tuple(map(float, q)) for q in pts], cx=cx,
              close_at=squeeze_at, settle=0.6, color=color, thick=thick, **kw)


def live(ch, x, bw, yo, keys, label=None, **kw):
    """Свеча в реальном времени: keys — (время, y текущей точки)."""
    keys = [(float(t), float(y)) for t, y in keys]
    return el("live", ch, keys[0][0], keys[-1][0] - keys[0][0], label=label, x=x, bw=bw, yo=yo, keys=keys, **kw)


def rope(ch, cx, cy, half, pull, t0, keys, label=None, **kw):
    return el("rope", ch, t0, 0.8, label=label, sound="chalk", cx=cx, cy=cy, half=half, pull=pull,
              keys=[(float(t), float(y)) for t, y in keys], **kw)


def cross_mark(ch, cx, cy, s, t0, color=RED, label=None, sound="buzz", **kw):
    return el("cross", ch, t0, 0.3, label=label, sound=sound, sound_arg=0, cx=cx, cy=cy, s=s, color=color, **kw)


def chalk_run(t0, t1, what=""):
    """Длинная серия свечей: мел скрипит всю дорогу, а не одним штрихом."""
    for k in range(int(max(t1 - t0, 1))):
        SOUND_EVENTS.append((t0 + k, "chalk_fast", 1.0, what if k == 0 else ""))


def ema(xs, n):
    out, e = [], xs[0]
    a = 2 / (n + 1)
    for x in xs:
        e = e + a * (x - e)
        out.append(e)
    return out


# ---------- рисунки выпуска ----------

EPISODE = Path(__file__).with_name(f"episode{A.PROJECT.get('episode', 1)}.py")
exec(compile(EPISODE.read_text(encoding="utf-8"), str(EPISODE), "exec"))

# смена главы — губка стирает доску; рассыпание части рисунка — пыль
for s in range(2, A.N_SCENES + 1):
    SOUND_EVENTS.append((start(s), "sponge", 0, f"губка — глава {s - 1}"))
for t_end in sorted({e["end"] for e in ELEMENTS if e["end_mode"] == "dissolve"}):
    SOUND_EVENTS.append((t_end, "dust", 0, "часть рисунка рассыпается"))
WIPES = sorted({start(s) for s in range(2, A.N_SCENES + 1)} | set(EXTRA_WIPES))
