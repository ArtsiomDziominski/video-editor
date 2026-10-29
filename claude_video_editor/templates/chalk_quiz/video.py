"""Шаблон «Квиз на школьной доске»: мел рисует график штрих за штрихом (по раскадровке vizavi_motion).

Проект — папка VPROJ_DIR (распакованный .vproj); тексты на экране — project.json → texts.
python video.py                 — собрать MP4 в VPROJ_OUT
python video.py 0.5 4.2 ...     — кадры на эти секунды в build/sheet.png
python video.py --seq 23.0 0.3  — каждый кадр отрезка в build/seq.png
"""
import os
import subprocess
import sys
import zlib
from functools import lru_cache
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import audio as A
from audio import LINES, VOICE_AT, norm, start

W, H = 1080, 1920
FPS = int(A.PROJECT.get("fps", 60))
VIDEO_OUT = os.environ.get("VPROJ_OUT", str(A.BUILD / "video.mp4"))
AUDIO = A.OUT + ".wav"
DURATION = round(A.DURATION * FPS) / FPS
FONT = "C:/Windows/Fonts/segoeprb.ttf"   # рукописный, с кириллицей и стрелками
TEXTS = {"title": "УГАДАЙ СВЕЧУ #3", "subtitle": "СЛОЖНЕЕ", "btn_up": "ВВЕРХ ↑", "btn_down": "ВНИЗ ↓",
         "flag": "ФЛАГ", "rules": ["РЕЗКИЙ РОСТ", "ОТКАТ В КАНАЛЕ", "ЗАКРЫТИЕ\nНАД КАНАЛОМ"],
         "next_tag": "#4", "next_word": "ЗАВТРА", **A.PROJECT.get("texts", {})}
# дорожка «Тексты на экране» в редакторе: ключ, номер в списке, подпись, событие появления (None — с начала)
TEXT_TRACK = [("title", None, "Заголовок", None), ("subtitle", None, "Подзаголовок", "T_HARDER"),
              ("btn_up", None, "Кнопка «вверх»", "T_UP3"), ("btn_down", None, "Кнопка «вниз»", "T_DOWN3"),
              ("flag", None, "Крупное слово на ответе", "T_FLAG"), ("rules", 0, "Правило, пункт 1", "T_SIGN1"),
              ("rules", 1, "Правило, пункт 2", "T_SIGN2"), ("rules", 2, "Правило, пункт 3", "T_SIGN3"),
              ("next_tag", None, "Метка следующего выпуска", "T_NEXT"), ("next_word", None, "Когда следующий выпуск", "T_NEXT")]

# мел, BGR
WHITE = (232, 238, 236)
YELLOW = (95, 214, 247)
GREEN = (125, 222, 140)
RED = (105, 112, 240)
SHADE = (22, 34, 18)

# безопасная зона TikTok: сверху 10%, снизу 20%, справа 15%
MID_X = 485
FORMAT = A.PROJECT.get("format", "9:16")       # «9:16» — TikTok 1080×1920, «16:9» — YouTube 1920×1080
LAND = FORMAT == "16:9"
OUT_W, OUT_H = (1920, 1080) if LAND else (1080, 1920)
X0, DX, BW = 150, 50, 20
SUB_Y, SUB_SIZE, SUB_MAXW = 1448, 76, 820


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ease_out(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_io(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seed(*parts):
    return zlib.crc32(repr(parts).encode())


# ---------- график: древко, полотнище, пробой ----------

CANDLES = [  # o, h, l, c — без цен на экране, только форма
    (12, 23, 10, 21), (21, 33, 19, 31), (31, 43, 29, 41), (41, 53, 39, 51), (51, 63.5, 49, 62.5),      # древко
    (62, 63, 57.5, 58.5), (58.5, 59.5, 54, 55), (55, 58, 54, 57), (57, 57.5, 51.5, 53),
    (53, 54, 49.5, 50.5),                                                                              # полотнище
    (50.5, 59.5, 49, 58),                                                                              # свеча-загадка
    (58, 76, 57, 75), (75, 93, 74, 92), (92, 108.5, 91, 107.5),                                        # рост на длину древка
]
MYST, FROZEN = 10, 53.2
POLE = (10, 63.5)                   # низ и верх древка
BREAK = 54.5                        # верх коридора над свечой-загадкой — отсюда меряем древко


def X(i):
    return X0 + i * DX


def Y(p):
    return 1195 - (p - 10) * 7.4


def upper(i):
    return 63.5 - 1.8 * (i - 5)


def channel_line(k):
    lo = 0.0 if k == 0 else -10.0
    return np.array([(X(4.4), Y(upper(4.4) + lo)), (X(10.8), Y(upper(10.8) + lo))])


DRAW = {i: (A.SMALL[i - 5], 0.32) for i in range(5, 10)}
DRAW.update({11 + k: (A.SHOOT[k], 0.22) for k in range(3)})
BRACKET_X, MEASURE_X = 100, 850
ARROW_X = X(MYST) + 60
RISE_ARROW = ((X(1) + 40, Y(10)), (X(4) + 52, Y(47)))   # «резко взлетел» — вдоль древка


# ---------- текстуры ----------

from chalk_tex import BOARD, DISS, GRAIN, HATCH, PRESS, STREAK, landscape, noise  # noqa: E402


def crop(arr, x, y, w, h):
    """Кусок текстуры доски с нулями за краем кадра."""
    out = np.zeros((h, w) + arr.shape[2:], arr.dtype)
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, arr.shape[1]), min(y + h, arr.shape[0])
    if x0 < x1 and y0 < y1:
        out[y0 - y:y1 - y, x0 - x:x1 - x] = arr[y0:y1, x0:x1]
    return out


def chalk_alpha(m, x, y, opacity=0.9, bite=0.95):
    """Мел по маске: зерно доски выедает края и даёт пропуски в штрихе."""
    h, w = m.shape
    return np.clip((m - (1 - crop(GRAIN, x, y, w, h)) * bite) * 1.8, 0, 1) * opacity * crop(PRESS, x, y, w, h)


class Chalk:
    """Слой мела: цвет с premultiplied alpha поверх доски."""

    def __init__(self, w=W, h=H):
        self.P = np.zeros((h, w, 3), np.float32)
        self.A = np.zeros((h, w), np.float32)

    def put(self, a, x, y, color):
        h, w = a.shape
        x, y = int(round(x)), int(round(y))
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, self.A.shape[1]), min(y + h, self.A.shape[0])
        if x0 >= x1 or y0 >= y1:
            return
        aa = a[y0 - y:y1 - y, x0 - x:x1 - x]
        self.P[y0:y1, x0:x1] = self.P[y0:y1, x0:x1] * (1 - aa[..., None]) + np.array(color, np.float32) * aa[..., None]
        self.A[y0:y1, x0:x1] = self.A[y0:y1, x0:x1] * (1 - aa) + aa

    def mask(self, m, x, y, color, opacity=0.9):
        self.put(chalk_alpha(m, int(x), int(y), opacity), int(x), int(y), color)

    def over(self, other, box):
        x0, y0, x1, y1 = box
        a = other.A[y0:y1, x0:x1]
        self.P[y0:y1, x0:x1] = other.P[y0:y1, x0:x1] + self.P[y0:y1, x0:x1] * (1 - a[..., None])
        self.A[y0:y1, x0:x1] = a + self.A[y0:y1, x0:x1] * (1 - a)

    def scale(self, k, box):
        x0, y0, x1, y1 = box
        self.P[y0:y1, x0:x1] *= k[..., None]
        self.A[y0:y1, x0:x1] *= k


# ---------- штрихи ----------

def path_part(pts, p):
    """Первая доля p длины ломаной — мел ведёт линию."""
    pts = np.asarray(pts, float)
    if p >= 1:
        return pts
    seg = np.hypot(*np.diff(pts, axis=0).T)
    cum = np.r_[0, np.cumsum(seg)]
    target = cum[-1] * p
    k = min(int(np.searchsorted(cum, target, side="right")) - 1, len(seg) - 1)
    u = (target - cum[k]) / max(seg[k], 1e-9)
    return np.vstack([pts[:k + 1], pts[k] + (pts[k + 1] - pts[k]) * u])


def poly_mask(pts, thick, closed=False, fill=False):
    pts = np.asarray(pts, float)
    pad = thick + 3
    x0, y0 = np.floor(pts.min(0) - pad).astype(int)
    x1, y1 = np.ceil(pts.max(0) + pad).astype(int)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    q = [np.round((pts - (x0, y0)) * 16).astype(np.int32)]
    if fill:
        cv2.fillPoly(m, q, 255, cv2.LINE_AA, shift=4)
    else:
        cv2.polylines(m, q, closed, 255, int(thick), cv2.LINE_AA, shift=4)
    return m.astype(np.float32) / 255, x0, y0


def line(ch, pts, p, color, thick, opacity=0.9):
    p = clamp01(p)
    if p <= 0:
        return
    q = path_part(pts, p)
    if len(q) >= 2:
        m, x0, y0 = poly_mask(q, thick)
        ch.mask(m, x0, y0, color, opacity)


def wobbly(p0, p1, sd, amp=1.5, step=8, over=3):
    """Линия от руки: лёгкая волна и небольшой перелёт на концах."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    length = np.hypot(*d) + 1e-9
    tang = d / length
    nrm = np.array([-tang[1], tang[0]])
    r = np.random.default_rng(sd)
    p0, p1 = p0 - tang * r.uniform(0, over), p1 + tang * r.uniform(0, over)
    u = np.linspace(0, 1, max(2, int(length / step) + 2))
    f, ph = r.uniform(0.5, 1.4, 2), r.uniform(0, 2 * np.pi, 2)
    off = amp * (0.65 * np.sin(2 * np.pi * f[0] * u + ph[0]) + 0.35 * np.sin(4 * np.pi * f[1] * u + ph[1]))
    return p0 + np.outer(u, p1 - p0) + np.outer(off, nrm)


def chain(points, sd, amp=1.2):
    return np.vstack([wobbly(a, b, sd + k, amp, 7, 2) for k, (a, b) in enumerate(zip(points, points[1:]))])


def ellipse_path(cx, cy, rx, ry, sd, turns=1.15, n=90):
    r = np.random.default_rng(sd)
    a = r.uniform(0, 2 * np.pi) + np.linspace(0, 2 * np.pi * turns, n)
    k = 1 + 0.045 * np.sin(3 * a + r.uniform(0, 6)) + np.linspace(-0.04, 0.07, n)
    return np.c_[cx + rx * k * np.cos(a), cy + ry * k * np.sin(a)]


def rrect_path(cx, cy, w, h, r, sd):
    pts = []
    for ax, ay, a0 in ((cx + w / 2 - r, cy - h / 2 + r, -90), (cx + w / 2 - r, cy + h / 2 - r, 0),
                       (cx - w / 2 + r, cy + h / 2 - r, 90), (cx - w / 2 + r, cy - h / 2 + r, 180)):
        for a in np.radians(np.linspace(a0, a0 + 90, 8)):
            pts.append((ax + r * np.cos(a), ay + r * np.sin(a)))
    pts.append(pts[0])
    pts = np.array(pts)
    dense = np.vstack([np.linspace(a, b, max(2, int(np.hypot(*(b - a)) / 8)), endpoint=False)
                       for a, b in zip(pts, pts[1:])])
    u = np.linspace(0, 1, len(dense))
    radial = (dense - (cx, cy)) / np.hypot(*(dense - (cx, cy)).T)[:, None]
    dense = dense + radial * (2.2 * np.sin(2 * np.pi * 3 * u + np.random.default_rng(sd).uniform(0, 6)))[:, None]
    return np.vstack([dense, dense[:6] + (0, 3)])        # перехлёст в конце, как рукой


def hatch_box(ch, x0, y0, x1, y1, color, q, from_bottom=True, opacity=0.8):
    """Заливка свечи штриховкой мелом; растёт от открытия."""
    q = clamp01(q)
    if q <= 0 or y1 - y0 < 2:
        return
    xa, ya, w, h = int(x0), int(y0), int(x1 - x0) + 1, int(y1 - y0) + 1
    m = crop(HATCH, xa, ya, w, h).copy()
    rows = np.arange(h, dtype=np.float32)
    edge = (h - rows) / h if from_bottom else (rows + 1) / h
    m *= np.clip((q * 1.15 - edge) / 0.15, 0, 1)[:, None]
    ch.mask(m, xa, ya, color, opacity)


def hatch_poly(ch, pts, color, q, opacity=0.4):
    q = clamp01(q)
    if q <= 0:
        return
    m, x0, y0 = poly_mask(pts, 1, fill=True)
    m *= crop(HATCH, x0, y0, m.shape[1], m.shape[0])
    m *= np.clip((q * (m.shape[1] + 40) - np.arange(m.shape[1])) / 40, 0, 1)[None]
    ch.mask(m, x0, y0, color, opacity)


def doodle_arrow(ch, pts, p, color, thick, head=30, opacity=0.9):
    p = clamp01(p)
    if p <= 0:
        return
    pts = np.asarray(pts, float)
    line(ch, pts, p / 0.75, color, thick, opacity)
    if p > 0.75:
        tip, d = pts[-1], pts[-1] - pts[max(0, len(pts) - 3)]
        d /= np.hypot(*d)
        for ang in (0.5, -0.5):
            r = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]) @ -d
            line(ch, np.array([tip, tip + r * head]), (p - 0.75) / 0.25, color, thick, opacity)


def check(ch, cx, cy, s, p, color, thick, sd=0):
    pts = np.vstack([wobbly((cx - 0.42 * s, cy - 0.02 * s), (cx - 0.12 * s, cy + 0.3 * s), sd, 1.2, 6, 0),
                     wobbly((cx - 0.12 * s, cy + 0.3 * s), (cx + 0.5 * s, cy - 0.45 * s), sd + 1, 2.0, 6, 3)])
    line(ch, pts, p, color, thick, 0.95)


def cross(ch, cx, cy, s, p, color, thick):
    line(ch, wobbly((cx - s, cy - s), (cx + s, cy + s), 7, 1.0), p / 0.5, color, thick)
    line(ch, wobbly((cx + s, cy - s), (cx - s, cy + s), 8, 1.0), (p - 0.5) / 0.5, color, thick)


# ---------- текст мелом ----------

@lru_cache(maxsize=None)
def font(size):
    return ImageFont.truetype(FONT, size)


@lru_cache(maxsize=4096)
def text_pair(s, size, stroke_w):
    f = font(size)
    pad = stroke_w + 8
    asc, desc = f.getmetrics()
    w, h = int(np.ceil(f.getlength(s))) + 2 * pad, asc + desc + 2 * pad
    masks = []
    for sw in (0, stroke_w):
        im = Image.new("L", (w, h))
        ImageDraw.Draw(im).text((pad, pad), s, font=f, fill=255, stroke_width=sw, stroke_fill=255)
        masks.append(np.asarray(im, np.float32) / 255)
    _, ct, _, cb = f.getbbox("Н")
    return masks[0], masks[1], pad + (ct + cb) / 2, pad


def fit(s, size, max_w):
    return max(10, int(size * min(1.0, max_w / font(size).getlength(s))))


def text_w(s, size):
    return font(size).getlength(s)


def text_box(s, size, x, y, align="center"):
    _, m, cy, pad = text_pair(s, size, max(2, size // 36))
    tw = m.shape[1] - 2 * pad
    x0 = {"left": x, "center": x - tw / 2, "right": x - tw}[align]
    return m, int(round(x0 - pad)), int(round(y - cy))


def write(ch, s, size, x, y, p, color, align="center", opacity=0.92):
    """Надпись мелом; p — сколько уже написано слева направо."""
    p = clamp01(p)
    if p <= 0:
        return
    m, x0, y0 = text_box(s, size, x, y, align)
    if p < 1:
        soft = 0.45 * size
        m = m * np.clip(((m.shape[1] + soft) * p - np.arange(m.shape[1])) / soft, 0, 1)[None]
    ch.mask(m, x0, y0, color, opacity)


# ---------- пыль ----------

LIFE = 0.5
EMIT = []   # (t0, dur, точки пути, длины, цвет, частиц на кадр)


def emitter(t0, dur, pts, color=WHITE, n=2):
    pts = np.asarray(pts, float)
    cum = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    EMIT.append((t0, dur, pts, cum, color, n))


def point_at(pts, cum, p):
    d = cum[-1] * clamp01(p)
    return np.array([np.interp(d, cum, pts[:, 0]), np.interp(d, cum, pts[:, 1])])


def draw_dust(dust, t):
    """Пыль с кончика мела: каждая частица — аналитическая траектория, поэтому кадр воспроизводим при любом seek."""
    for k, (t0, dur, pts, cum, color, n) in enumerate(EMIT):
        if t <= t0 or t > t0 + dur + LIFE:
            continue
        j0 = int(np.ceil((max(t0, t - LIFE) - t0) * 60))
        j1 = int(np.floor((min(t, t0 + dur) - t0) * 60))
        for j in range(j0, j1 + 1):
            te = t0 + j / 60
            age = t - te
            if age <= 0:
                continue
            tip = point_at(pts, cum, (te - t0) / max(dur, 1e-6))
            r = np.random.default_rng(seed("dust", k, j))
            for _ in range(n):
                vx, vy = r.normal(0, 45), r.normal(-25, 35)
                x, y = tip[0] + vx * age, tip[1] + vy * age + 130 * age * age
                a = r.uniform(0.35, 0.85) * max(0.0, 1 - age / LIFE) ** 1.5
                cv2.circle(dust, (int(x), int(y)), int(r.choice((1, 1, 2, 2, 3))), float(a), -1, cv2.LINE_AA)


# ---------- рассыпание в пыль и губка ----------

class Dissolve:
    def __init__(self, t0, dur, box):
        self.t0, self.dur, self.box = t0, dur, box
        self.samples = None

    def gone(self, t):
        return t >= self.t0 + self.dur + LIFE + 0.3

    def apply(self, layer, t):
        x0, y0, x1, y1 = self.box
        u = -0.12 + 1.24 * clamp01((t - self.t0) / self.dur)
        layer.scale(np.clip((DISS[y0:y1, x0:x1] - u) / 0.12, 0, 1), self.box)

    def dust(self, dust, layer_at_start, t):
        """Каждая крупинка срывается, когда рассыпается её место, и падает."""
        if self.samples is None:
            x0, y0, x1, y1 = self.box
            ys, xs = np.nonzero(layer_at_start.A[y0:y1, x0:x1] > 0.35)
            r = np.random.default_rng(seed("diss", self.t0))
            pick = r.choice(len(xs), min(len(xs), 900), replace=False) if len(xs) else []
            xs, ys = xs[pick] + x0, ys[pick] + y0
            te = self.t0 + self.dur * (DISS[ys, xs] + 0.12) / 1.24
            self.samples = (xs, ys, te, r.normal(0, 35, len(xs)), r.normal(-15, 25, len(xs)), r.uniform(0.3, 0.8, len(xs)))
        xs, ys, te, vx, vy, a0 = self.samples
        age = t - te
        live = (age > 0) & (age < LIFE + 0.3)
        for x, y, ag, ux, uy, a in zip(xs[live], ys[live], age[live], vx[live], vy[live], a0[live]):
            cv2.circle(dust, (int(x + ux * ag), int(y + uy * ag + 160 * ag * ag)), 1 + int(a > 0.6),
                       float(a * (1 - ag / (LIFE + 0.3)) ** 1.5), -1, cv2.LINE_AA)


class Wipe:
    """Губка одним махом по диагонали: стирает всё за передним краем, оставляет мокрый след и меловую дымку."""
    t0, dur = A.T_WIPE, 0.7

    def __init__(self, w=W, h=H, u=(0.55, 0.835), streak=STREAK):
        self.w, self.h, self.u, self.streak = w, h, np.array(u), streak
        self.box = (0, 0, w, h)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        self.D = xx * self.u[0] + yy * self.u[1]
        self.dmin, self.dmax = -380.0, float(w * self.u[0] + h * self.u[1]) + 380
        grid = np.linspace(0, 1, 512)
        frac = np.clip((self.D - self.dmin) / (self.dmax - self.dmin), 0, 1)
        self.T_PASS = self.t0 + self.dur * np.interp(frac, ease_io_arr(grid), grid).astype(np.float32)

    def front(self, t):
        return self.dmin + (self.dmax - self.dmin) * ease_io((t - self.t0) / self.dur)

    def gone(self, t):
        return t >= self.t0 + self.dur + 1.3

    def apply(self, layer, t):
        k = np.clip((self.front(t) - self.D) / 60, 0, 1)
        ghost = 0.08 * self.streak * np.clip(1 - (t - self.T_PASS) / 1.2, 0, 1)
        layer.scale(1 - k * (1 - ghost), self.box)

    def wet(self, t):
        """Мокрый след темнее доски и подсыхает."""
        if t < self.t0 or t > self.t0 + self.dur + 1.5:
            return None
        age = t - self.T_PASS
        return np.where(age > 0, 0.22 * np.clip(1 - age / 1.4, 0, 1) ** 1.5 * (0.7 + 0.3 * self.streak), 0).astype(np.float32)


def ease_io_arr(x):
    return x * x * (3 - 2 * x)


def make_sponge():
    """Губка для доски сверху: деревянная спинка, войлочный край в меловой пыли."""
    w, h = 560, 150
    img = np.zeros((h + 40, w + 40, 3), np.float32)
    a = np.zeros((h + 40, w + 40), np.float32)
    box = np.zeros_like(a, np.uint8)
    rr = rrect_path((w + 40) / 2, (h + 40) / 2, w, h, 26, 3)
    cv2.fillPoly(box, [np.round(rr * 16).astype(np.int32)], 255, cv2.LINE_AA, shift=4)
    m = box.astype(np.float32) / 255
    felt = cv2.erode(box, np.ones((19, 19), np.uint8)).astype(np.float32) / 255
    wood = np.array((60, 108, 158), np.float32)
    grain = 1 + 0.08 * np.sin(np.arange(w + 40)[None, :] / 9 + 3 * noise(4, (h + 40, w + 40), 21))
    img[:] = wood * grain[..., None]
    rim = m - felt
    img = img * (1 - rim[..., None]) + np.array((205, 212, 214), np.float32) * rim[..., None]
    img *= (1.08 - 0.25 * np.linspace(0, 1, h + 40)[:, None, None])           # свет сверху
    a[:] = m
    return img, a


SPONGE, SPONGE_A = make_sponge()


def draw_sponge(img, wipe, t):
    """Губка на переднем крае стирания: вес, наклон по ходу, тень и смаз движения за выдержку."""
    if not (wipe.t0 <= t <= wipe.t0 + wipe.dur):
        return
    w, h = wipe.w, wipe.h
    acc_img, acc_a, acc_sh = np.zeros_like(img), np.zeros((h, w), np.float32), np.zeros((h, w), np.float32)
    subs = 5
    for k in range(subs):
        ts = t + (k / (subs - 1) - 0.5) * 0.5 / FPS
        p = clamp01((ts - wipe.t0) / wipe.dur)
        c = np.array((w / 2, h / 2)) + wipe.u * (wipe.front(ts) - (w / 2 * wipe.u[0] + h / 2 * wipe.u[1])) \
            + np.array((-wipe.u[1], wipe.u[0])) * 120 * np.sin(np.pi * p * 1.5)
        ang = np.degrees(np.arctan2(wipe.u[1], wipe.u[0])) + 90 + 7 * np.sin(2 * np.pi * p)
        sh, sw = SPONGE_A.shape
        for (dx, dy), target, tex in (((18, 26), acc_sh, None), ((0, 0), acc_a, SPONGE)):
            m = cv2.getRotationMatrix2D((sw / 2, sh / 2), -ang, 1.0)
            m[:, 2] += (c[0] + dx - sw / 2, c[1] + dy - sh / 2)
            aa = cv2.warpAffine(SPONGE_A, m, (w, h))
            if tex is None:
                target += cv2.GaussianBlur(aa, (0, 0), 10) * 0.45 / subs
            else:
                target += aa / subs
                acc_img += cv2.warpAffine(tex, m, (w, h)) * (aa / max(aa.max(), 1e-6))[..., None] / subs
    img *= (1 - acc_sh)[..., None]
    img[:] = img * (1 - acc_a[..., None]) + acc_img


# ---------- группы рисунков (каждую убирает своё стирание) ----------

def q_path(cx, cy, sx=1.0, sy=1.0):
    """Жёлтый «?» мелом: крючок и точка; масштаб от основания."""
    u = np.linspace(0, 1, 60)[:, None]
    b = [np.array(v, float) for v in ((-95, -55), (-105, -245), (150, -245), (18, 18))]
    hook = (1 - u) ** 3 * b[0] + 3 * (1 - u) ** 2 * u * b[1] + 3 * (1 - u) * u ** 2 * b[2] + u ** 3 * b[3]
    hook = np.vstack([hook, np.linspace((18, 18), (12, 128), 10)])
    base = 215.0
    tf = lambda p: np.c_[cx + p[:, 0] * sx, cy + base + (p[:, 1] - base) * sy]
    return tf(hook), tf(np.array([(8.0, 195.0), (20.0, 199.0)]))


Q_C = (655, 845)


def big_question(ch, p, t_bounce=None, t=0.0):
    sx = sy = 1.0
    if t_bounce is not None and 0 <= t - t_bounce < 0.6:   # приседает, подпрыгивает, приземляется
        a = (t - t_bounce) / 0.6
        sy = 1 - 0.3 * np.sin(np.pi * a / 0.2) if a < 0.2 else 1 + 0.16 * np.sin(np.pi * (a - 0.2) / 0.5) \
            if a < 0.7 else 1 - 0.08 * np.sin(np.pi * (a - 0.7) / 0.3)
        sx = 1 / np.sqrt(sy)
    dy = -90 * np.sin(np.pi * clamp01(((t - t_bounce) / 0.6 - 0.2) / 0.5)) if t_bounce is not None and \
        0.12 <= (t - t_bounce) / 0.6 < 0.7 else 0.0
    hook, dot = q_path(Q_C[0], Q_C[1] + dy, sx, sy)
    line(ch, hook, p / 0.85, YELLOW, 30, 0.95)
    line(ch, dot, (p - 0.85) / 0.15, YELLOW, 40, 0.95)


def g_hook_q(ch, t):
    big_question(ch, 1.0, A.T_THREE, t)


def g_title(ch, t):
    write(ch, TEXTS["title"], fit(TEXTS["title"], 86, 820), MID_X, 272, t / 1.05, WHITE)
    write(ch, TEXTS["subtitle"], fit(TEXTS["subtitle"], 104, 820), MID_X, 392, (t - A.T_HARDER) / 0.45, RED)
    for k in range(2):
        line(ch, wobbly((MID_X - 260, 452 + 13 * k), (MID_X + 260, 455 + 13 * k), seed("ul", k), 3.0, 10),
             (t - A.T_HARDER - 0.45 - 0.13 * k) / 0.15, RED, 6)


COUNT_X = (215, 485, 755)


def g_count(ch, t):
    for k, c in enumerate(A.COUNTS):
        write(ch, f"{3 - k}…", 150, COUNT_X[k], 330, (t - c) / 0.25, YELLOW if k == 2 else WHITE)


def wave_remap(a, t, amp=10, lam=420, speed=1.3):
    """Слово развевается, как полотнище: древко слева неподвижно, свободный край колышется сильнее."""
    h, w = a.shape
    xs = np.arange(w, dtype=np.float32)
    dy = amp * (xs / w) * np.sin(2 * np.pi * (xs / lam - speed * t))
    mx = np.repeat(xs[None], h, 0)
    my = np.arange(h, dtype=np.float32)[:, None] - dy[None]
    return cv2.remap(a, mx, my, cv2.INTER_LINEAR, borderValue=0)


def g_flagword(ch, t):
    p = clamp01((t - A.T_FLAG) / 0.6)
    if p <= 0:
        return
    m, x0, y0 = text_box(TEXTS["flag"], fit(TEXTS["flag"], 200, 820), MID_X, 330)
    if p < 1:
        m = m * np.clip(((m.shape[1] + 90) * p - np.arange(m.shape[1])) / 90, 0, 1)[None]
    a = chalk_alpha(m, x0, y0, 0.94)                      # мел на месте, потом вместе с ним колышется
    if t > A.T_FLAG + 0.6:
        a = wave_remap(a, t, 12 * clamp01((t - A.T_FLAG - 0.6) / 0.5))
    ch.put(a, x0, y0, YELLOW)


BTN_Y = 1275


def button(ch, cx, cy, w, h, label, col, p, sd, label_dx=0.0):
    p = clamp01(p)
    if p <= 0:
        return
    pts = rrect_path(cx, cy, w, h, 34, sd)
    m, x0, y0 = poly_mask(pts, 1, fill=True)
    m *= crop(HATCH, x0, y0, m.shape[1], m.shape[0])
    q = clamp01((p - 0.25) / 0.5)
    if q < 1:
        m *= np.clip(((m.shape[1] + 60) * q - np.arange(m.shape[1])) / 60, 0, 1)[None]
    ch.mask(m, x0, y0, col, 0.55)
    line(ch, pts, p / 0.5, col, 6, 0.95)
    write(ch, label, fit(label, 60, w - 70), cx + label_dx, cy, (p - 0.45) / 0.55, WHITE)


def g_buttons(ch, t):
    button(ch, 290, BTN_Y, 360, 112, TEXTS["btn_up"], GREEN, (t - A.T_UP3 + 0.1) / 0.3, seed("bu"), -32)
    button(ch, 700, BTN_Y, 330, 112, TEXTS["btn_down"], RED, (t - A.T_DOWN3 + 0.1) / 0.3, seed("bd"))
    check(ch, 452, BTN_Y - 18, 120, (t - A.T_CHECK) / 0.25, WHITE, 15, seed("ck"))  # на углу кнопки, рядом со стрелкой


def draw_candle(ch, i, p, close=None, closed=True, wick_to=None):
    """Свеча мелом: тени, контур, штриховка. close/closed — для свечи, которую ещё дорисовывают."""
    p = clamp01(p)
    if p <= 0:
        return
    o, h, l, c = CANDLES[i]
    if close is not None:
        c = close
    x, sd = X(i), seed("candle", i)
    up = c >= o
    col = GREEN if up else RED
    yt, yb = sorted((Y(o), Y(c)))
    top = Y(h) if closed else (Y(wick_to) if wick_to is not None else None)
    if top is not None:
        line(ch, wobbly((x, top), (x, yt), sd, 0.7, 6, 1), p / 0.2, WHITE, 4, 0.85)
    line(ch, wobbly((x, yb), (x, Y(l)), sd + 1, 0.7, 6, 1), p / 0.2, WHITE, 4, 0.85)
    hatch_box(ch, x - BW + 2, yt + 2, x + BW - 2, yb - 2, col, (p - 0.45) / 0.55, from_bottom=up)
    if closed:
        corners = [(x - BW, yt), (x + BW, yt), (x + BW, yb), (x - BW, yb), (x - BW, yt)]
        line(ch, chain(corners, sd + 3, 0.8), (p - 0.15) / 0.5, col, 4)
    else:  # верх ещё не закрыт: только бока и низ
        q = (p - 0.15) / 0.5
        line(ch, wobbly((x - BW, yb), (x + BW, yb), sd + 4, 0.7, 6, 2), q, col, 4)
        for k, xs in enumerate((x - BW, x + BW)):
            line(ch, wobbly((xs, yb), (xs, yt), sd + 5 + k, 0.7, 6, 1), q, col, 4)


def mystery(ch, t):
    """Свеча-загадка: дорисована до половины, упирается тенью в верх коридора; на ответе закрывается над ним."""
    if t < A.T_GROW:
        return
    o = CANDLES[MYST][0]
    if t < A.T_CLOSE:
        g = ease_out((t - A.T_GROW) / (A.T_FREEZE - A.T_GROW))
        c = o + (FROZEN - o) * g
        draw_candle(ch, MYST, 1.0, close=max(c, o + 0.4), closed=False, wick_to=c + (BREAK - FROZEN) * g)
        return
    q = (t - A.T_CLOSE) / 0.22
    if q < 1:
        c = FROZEN + (CANDLES[MYST][3] - FROZEN) * ease_out(q)
        draw_candle(ch, MYST, 1.0, close=c, closed=False, wick_to=max(c, BREAK))
        return
    draw_candle(ch, MYST, 1.0, closed=False)
    k = (q - 1) / 0.6                                     # мел закрывает верх и дотягивает тень
    x, sd = X(MYST), seed("candle", MYST)
    yt = Y(CANDLES[MYST][3])
    line(ch, wobbly((x - BW, yt), (x + BW, yt), sd + 9, 0.7, 6, 2), k / 0.5, GREEN, 4)
    line(ch, wobbly((x, yt), (x, Y(CANDLES[MYST][1])), sd + 10, 0.7, 6, 1), (k - 0.4) / 0.6, WHITE, 4, 0.85)


def flag_outline(t, wave_amp):
    """Контур полотнища вокруг коридора; на «флаг» края колышутся."""
    xa, xb = X(4) + 12, X(MYST) + 50
    u = np.linspace(0, 1, 48)
    wv = (7 + wave_amp) * u * np.sin(2 * np.pi * (u * 1.5 - 1.2 * t * (wave_amp > 0)))   # ткань, а не рамка
    top = np.c_[xa + (xb - xa) * u, Y(67) + (Y(58) - Y(67)) * u + wv]
    bot = np.c_[xb + (xa - xb) * u, Y(42) + (Y(51.5) - Y(42)) * u + wv[::-1]]
    fly = np.c_[xb + 6 * np.sin(np.linspace(0, 2 * np.pi, 10) + t * 2 * (wave_amp > 0)) * (1 + wave_amp / 6),
                np.linspace(top[-1, 1], bot[0, 1], 10)]
    return np.vstack([top, fly, bot, top[:1]])


def bracket(ch, x, y0, y1, p, color, opacity=0.9):
    pts = np.vstack([wobbly((x + 16, y0), (x, y0), 31, 0.6, 5, 1), wobbly((x, y0), (x, y1), 32, 1.2, 8, 1),
                     wobbly((x, y1), (x + 16, y1), 33, 0.6, 5, 1)])
    line(ch, pts, p, color, 5, opacity)


def g_chart(ch, t):
    # полотнище: штриховка на «полотнище» (под свечами)
    hatch_poly(ch, np.vstack([channel_line(0), channel_line(1)[::-1]]), YELLOW, (t - A.T_CLOTH) / 0.45, 0.35)
    for i in range(5):                                    # древко уже на доске
        draw_candle(ch, i, 1.0)
    for i, (t0, dur) in DRAW.items():
        draw_candle(ch, i, (t - t0) / dur)
    mystery(ch, t)
    for k, tc in enumerate(A.CHANNEL):                    # коридор: две параллельные жёлтые линии вниз
        thick = 6 + 2 * ease_out((t - A.T_SIGNS[1]) / 0.25)
        line(ch, wobbly(*channel_line(k), seed("ch", k), 1.3, 10, 6), (t - tc) / 0.45, YELLOW, thick)
    if t >= A.FLAG_SKETCH:                                # лёгкий контур флага, на ответе — смелее и колышется
        bold = clamp01((t - A.T_FLAG) / 0.4)
        line(ch, flag_outline(t, 6 * bold), (t - A.FLAG_SKETCH) / 0.6, WHITE, 3 + bold, 0.35 + 0.45 * bold)
    doodle_arrow(ch, wobbly(*RISE_ARROW, seed("rise"), 2.0, 10, 0), (t - A.T_ROSE) / 0.4, WHITE, 5, 26, 0.8)
    # «сейчас рухнет»: бледная красная пунктирная стрелка вниз, на ответе зачёркнута
    ya, yb = Y(48), Y(27)
    for k in range(4):
        a = ya + (yb - ya) * k / 4
        line(ch, wobbly((ARROW_X, a), (ARROW_X, a + (yb - ya) / 4 * 0.6), seed("rd", k), 0.8, 6, 1),
             (t - A.T_CRASH - 0.08 * k) / 0.08, RED, 5, 0.6)
    if t >= A.T_CRASH + 0.32:
        doodle_arrow(ch, np.array([(ARROW_X, yb - 30), (ARROW_X, yb)]), 1.0 if t > A.T_CRASH + 0.5 else
                     (t - A.T_CRASH - 0.32) / 0.18 * 0.25 + 0.75, RED, 5, 22, 0.6)
    cross(ch, ARROW_X, (ya + yb) / 2, 26, (t - A.T_CROSS) / 0.25, WHITE, 6)
    # древко: скобка, потом её копия едет к пробою и становится стрелкой той же длины
    y0, y1 = Y(POLE[0]), Y(POLE[1])
    bracket(ch, BRACKET_X, y0, y1, (t - A.T_POLE) / 0.35, WHITE)
    if t >= A.T_SIGNS[0] + 0.1:
        bracket(ch, BRACKET_X, y0, y1, (t - A.T_SIGNS[0] - 0.1) / 0.3, GREEN, 0.95)
    shift = Y(BREAK) - y0
    mv = (t - A.T_MEASURE) / 0.7
    if 0 < mv < 1:                                        # меловой «призрак» скобки в пути
        e = ease_io(mv)
        ghost = Chalk()
        bracket(ghost, BRACKET_X, y0, y1, 1.0, WHITE)
        dx, dy = (MEASURE_X - BRACKET_X) * e, shift * e
        box = (0, int(y1) - 20, 140, int(y0) + 20)
        a = ghost.A[box[1]:box[3], box[0]:box[2]] * (0.55 + 0.35 * np.sin(np.pi * e))
        ch.put(a, box[0] + dx, box[1] + dy, WHITE)
    if mv >= 1:
        doodle_arrow(ch, wobbly((MEASURE_X, y0 + shift), (MEASURE_X, y1 + shift), seed("ma"), 1.0, 8, 0),
                     (t - A.T_MEASURE - 0.7) / 0.25, WHITE, 6, 30)
        bracket(ch, MEASURE_X - 2, y0 + shift, y1 + shift, 1.0, WHITE, 0.5)
    line(ch, ellipse_path(X(MYST), Y(CANDLES[MYST][3]), 40, 20, seed("cl")), (t - A.T_SIGNS[2] - 0.2) / 0.3, GREEN, 5)


def g_rules(ch, t):
    """Правило: чек-лист в зоне заголовка."""
    rows =[r.split("\n")[:2] for r in TEXTS["rules"][:3]]
    for k, (ts, rw) in enumerate(zip(A.T_SIGNS, rows)):
        y = 238 + 86 * k
        line(ch, chain([(118, y - 23), (162, y - 23), (162, y + 23), (118, y + 23), (118, y - 23)], seed("box", k)),
             (t - ts + 0.1) / 0.15, WHITE, 4)
        for r, s in enumerate(rw):
            write(ch, s, fit(s, 56, 700), 190, y + 60 * r, (t - ts - 0.15 * r) / (0.32 if len(rw) == 1 else 0.2), WHITE, "left")
        check(ch, 142, y - 6, 66, (t - ts - 0.38) / 0.16, GREEN, 9, seed("chk", k))


def g_next(ch, t):
    s1, s2 = TEXTS["next_tag"] + " ", TEXTS["next_word"]
    fs = fit(s1 + s2, 104, 820)
    xs = MID_X - text_w(s1 + s2, fs) / 2
    write(ch, s1.strip(), fs, xs, 330, (t - A.T_NEXT) / 0.15, YELLOW, "left")
    write(ch, s2, fs, xs + text_w(s1, fs), 330, (t - A.T_NEXT - 0.15) / 0.45, WHITE, "left")


def g_end(ch, t):
    """Петля: то же древко и тот же «?», что в первом кадре."""
    for i, tr in enumerate(A.REDRAW):
        draw_candle(ch, i, (t - tr) / 0.25)
    if t >= A.T_LAST_Q:
        big_question(ch, (t - A.T_LAST_Q) / 0.45)


HEAD = (40, 150, 1000, 560)
D_Q = Dissolve(A.DISSOLVE_Q, 0.45, (440, 540, 900, 1160))
D_TITLE = Dissolve(A.DISSOLVE_TITLE, 0.4, HEAD)
D_COUNT = Dissolve(A.DISSOLVE_COUNT, 0.4, HEAD)
D_FLAG = Dissolve(A.DISSOLVE_FLAG, 0.4, HEAD)
D_BTN = Dissolve(A.DISSOLVE_BTN, 0.45, (60, 1150, 940, 1360))
D_NEXT = Dissolve(A.DISSOLVE_NEXT, 0.45, HEAD)
WIPE = Wipe()
GROUPS = [(D_Q, g_hook_q), (D_TITLE, g_title), (D_COUNT, g_count), (D_FLAG, g_flagword), (D_BTN, g_buttons),
          (WIPE, g_chart), (WIPE, g_rules), (D_NEXT, g_next), (None, g_end)]
HEAD_FNS = {g_title, g_count, g_flagword, g_rules, g_next}   # зона заголовка


def build_emitters():
    """Пыль сходит с кончика мела там и тогда, где он рисует."""
    base = lambda x0, x1, y: [(x0, y + 20), (x1, y + 20)]
    emitter(0.0, 1.05, base(MID_X - 400, MID_X + 400, 272))
    emitter(A.T_HARDER, 0.45, base(MID_X - 230, MID_X + 230, 392), RED)
    emitter(A.T_HARDER + 0.45, 0.3, base(MID_X - 260, MID_X + 260, 455), RED)
    for i in range(5, 10):
        t0, dur = DRAW[i]
        emitter(t0, dur, [(X(i), Y(CANDLES[i][1])), (X(i), Y(CANDLES[i][2]))], WHITE, 1)
    for k, tc in enumerate(A.CHANNEL):
        emitter(tc, 0.45, channel_line(k), YELLOW, 2)
    emitter(A.T_ROSE, 0.4, RISE_ARROW, WHITE, 2)
    emitter(A.T_CRASH, 0.4, [(ARROW_X, Y(48)), (ARROW_X, Y(27))], RED, 1)
    emitter(A.T_GROW, 0.5, [(X(MYST), Y(51)), (X(MYST), Y(BREAK))], GREEN, 1)
    for tb, cx in ((A.T_UP3 - 0.1, 290), (A.T_DOWN3 - 0.1, 700)):
        emitter(tb, 0.3, base(cx - 160, cx + 160, BTN_Y - 30), WHITE, 1)
    for k, c in enumerate(A.COUNTS):
        emitter(c, 0.25, base(COUNT_X[k] - 90, COUNT_X[k] + 90, 330), WHITE, 3)
    emitter(A.T_CHECK, 0.25, [(402, BTN_Y - 20), (438, BTN_Y + 18), (512, BTN_Y - 72)], WHITE, 3)
    for k in range(3):
        i = 11 + k
        emitter(DRAW[i][0], 0.22, [(X(i), Y(CANDLES[i][2])), (X(i), Y(CANDLES[i][1]))], GREEN, 2)
    emitter(A.T_FLAG, 0.6, base(MID_X - 340, MID_X + 340, 330), YELLOW, 3)
    emitter(A.T_POLE, 0.35, [(BRACKET_X, Y(POLE[0])), (BRACKET_X, Y(POLE[1]))], WHITE, 1)
    emitter(A.T_MEASURE + 0.7, 0.25, [(MEASURE_X, Y(BREAK)), (MEASURE_X, Y(BREAK + POLE[1] - POLE[0]))], WHITE, 2)
    for k, ts in enumerate(A.T_SIGNS):
        emitter(ts, 0.35, base(190, 720, 238 + 86 * k), WHITE, 2)
        emitter(ts + 0.38, 0.16, [(114, 232 + 86 * k), (175, 205 + 86 * k)], GREEN, 3)
    for i, tr in enumerate(A.REDRAW):
        emitter(tr, 0.25, [(X(i), Y(CANDLES[i][1])), (X(i), Y(CANDLES[i][2]))], GREEN, 1)
    emitter(A.T_NEXT, 0.6, base(MID_X - 380, MID_X + 380, 330), WHITE, 2)
    hook, _ = q_path(*Q_C)
    emitter(A.T_LAST_Q, 0.4, hook, YELLOW, 2)


build_emitters()
_start_layers = {}


def render_board(t):
    """Доска в координатах доски: мел, пыль, губка."""
    ch, dust = Chalk(), np.zeros((H, W), np.float32)
    for er, fn in GROUPS:
        if er is None or t < er.t0:
            fn(ch, t)
            continue
        if er.gone(t):
            continue
        layer = Chalk()
        fn(layer, t)
        if isinstance(er, Dissolve):
            if id(er) not in _start_layers:
                first = Chalk()
                fn(first, er.t0)
                _start_layers[id(er)] = first
            er.dust(dust, _start_layers[id(er)], t)
        er.apply(layer, t)
        ch.over(layer, er.box)
    draw_dust(dust, t)
    img = BOARD.copy()
    wet = WIPE.wet(t)
    if wet is not None:
        img *= (1 - wet)[..., None]
    img = img * (1 - ch.A[..., None]) + ch.P
    dust = np.clip(dust, 0, 1)
    img = img * (1 - dust[..., None]) + np.array(WHITE, np.float32) * dust[..., None]
    draw_sponge(img, WIPE, t)
    return img


# ---------- камера: одна связная траектория, периодическая для петли ----------

KEYS = [  # время, масштаб, центр кадра на доске, наклон; кадр держит контент между y 192 и 1370 (выше субтитров)
    (0.0, 1.045, 510, 930, 0.0),
    (1.6, 1.06, 500, 900, -0.5),
    (A.T_ROSE, 1.09, 470, 880, -0.7),             # к древку
    (A.T_NARROW, 1.12, 490, 865, 0.3),            # наезд на полотнище
    (A.T_CRASH, 1.11, 500, 870, 0.6),
    (start(3) + 0.4, 1.09, 500, 880, 0.2),
    (A.T_UP3 - 0.2, 1.065, 505, 948, -0.2),       # кнопки внизу: кадр опускается, наезд ограничен
    (A.T_REVEAL - 0.03, 1.07, 510, 950, -0.4),
    (A.T_REVEAL + 0.5, 1.05, 515, 945, 0.0),
    (A.DISSOLVE_BTN + 0.5, 1.07, 520, 860, 0.5),  # кнопок нет — вверх за ростом
    (A.T_MEASURE + 0.6, 1.08, 520, 850, 0.2),
    (start(5) + 0.5, 1.08, 480, 850, -0.5),       # к чек-листу
    (A.T_SIGNS[2] + 0.4, 1.09, 490, 855, -0.2),
    (A.T_WIPE + 0.35, 1.05, 540, 930, 0.6),       # за губкой
    (A.T_WIPE + 1.5, 1.05, 515, 930, 0.2),
    (DURATION, 1.045, 510, 930, 0.0),
]
KT = np.array([k[0] for k in KEYS])
KV = np.array([k[1:] for k in KEYS], float)


def cam_state(t):
    """Кубический Эрмит с касательными по соседям: скорость не обнуляется на каждом ключе; конец переходит в начало."""
    n = len(KT)
    i = int(np.clip(np.searchsorted(KT, t, side="right") - 1, 0, n - 2))

    def tangent(j):
        if j == 0 or j == n - 1:
            tp, vp, tn, vn = KT[-2] - DURATION, KV[-2], KT[1], KV[1]
        else:
            tp, vp, tn, vn = KT[j - 1], KV[j - 1], KT[j + 1], KV[j + 1]
        return (vn - vp) / (tn - tp)

    h = KT[i + 1] - KT[i]
    u = (t - KT[i]) / h
    h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
    s, cx, cy, rot = h00 * KV[i] + h10 * h * tangent(i) + h01 * KV[i + 1] + h11 * h * tangent(i + 1)
    a = t - A.T_REVEAL                                    # удар на ответе: короткий наезд и тряска
    if 0 <= a < 0.45:
        k = (1 - a / 0.45) ** 2
        s += 0.035 * k
        cx += 9 * k * np.sin(a * 90)
        cy += 9 * k * np.cos(a * 77)
    return s, cx, cy, rot


def cam_matrix(t, depth=1.0):
    """depth > 1 — слой ближе к камере: смещается и масштабируется сильнее (параллакс)."""
    s, cx, cy, rot = cam_state(t)
    s = 1 + (s - 1) * depth
    cx, cy = 540 + (cx - 540) * depth, 960 + (cy - 960) * depth
    m = cv2.getRotationMatrix2D((cx, cy), rot * depth, s)
    m[:, 2] += (540 - cx, 960 - cy)
    return m


def cam_matrix_land(t, depth=1.0):
    """Горизонтальный кадр: та же траектория, но мягче — дрейф и наклон вокруг центра кадра."""
    s, cx, cy, rot = cam_state(t)
    s = 1 + (s - 1) * 0.6 * depth
    m = cv2.getRotationMatrix2D((960, 540), rot * 0.6 * depth, s)
    m[:, 2] -= ((cx - 510) * 0.25 * depth, (cy - 930) * 0.25 * depth)
    return m


CAM = cam_matrix_land if LAND else cam_matrix


def camera(img, t):
    """Камера; на быстрых участках — смаз за выдержку (180°) из трёх положений."""
    w, h = img.shape[1], img.shape[0]
    m0, m1 = CAM(t - 0.25 / FPS), CAM(t + 0.25 / FPS)
    corners = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], float).T
    shift = np.abs(m1 @ corners - m0 @ corners).max()
    if shift < 2.5:
        return cv2.warpAffine(img, CAM(t), (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    acc = np.zeros((h, w, 3), np.float32)
    for k in range(3):
        acc += cv2.warpAffine(img, CAM(t + (k - 1) * 0.25 / FPS), (w, h), flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_REFLECT)
    return acc / 3


# ---------- передний план: пылинки в луче не в фокусе ----------

_r = np.random.default_rng(31)
MOTES = np.c_[_r.uniform(0, OUT_W, 14), _r.uniform(0, OUT_H, 14), _r.uniform(10, 34, 14), _r.uniform(0.08, 0.22, 14),
              _r.integers(1, 3, 14), _r.uniform(0, 2 * np.pi, 14), _r.uniform(20, 60, 14)]
_yy, _xx = np.mgrid[0:OUT_H // 4, 0:OUT_W // 4].astype(np.float32) * 4
BEAM = (np.exp(-(((_xx * 0.55 + _yy * 0.83) - (1500 if LAND else 1150)) / 280) ** 2) * 0.09).astype(np.float32)


@lru_cache(maxsize=None)
def mote_sprite(r):
    s = int(r * 3) | 1
    yy, xx = np.mgrid[0:s, 0:s] - s // 2
    return np.exp(-(xx ** 2 + yy ** 2) / (2 * (r * 0.6) ** 2)).astype(np.float32)


def foreground(img, t):
    W, H = OUT_W, OUT_H
    m = CAM(t, 1.6)
    beam = cv2.warpAffine(BEAM, np.float32([[0.25, 0, 0], [0, 0.25, 0]]) @ np.vstack([m, (0, 0, 1)]) @
                          np.float32([[4, 0, 0], [0, 4, 0], [0, 0, 1]]), (W // 4, H // 4))
    glow = cv2.resize(beam, (W, H), interpolation=cv2.INTER_LINEAR)
    for x, y, r, a, cyc, ph, amp in MOTES:                # дрейф с периодом ролика — петля бесшовна
        bx = x + amp * np.sin(2 * np.pi * cyc * t / DURATION + ph)
        by = y + amp * 1.5 * np.sin(2 * np.pi * cyc * t / DURATION * 0.5 * 2 + ph * 1.7)
        sx, sy = m @ (bx, by, 1)
        spr = mote_sprite(int(round(r)))
        k = spr.shape[0] // 2
        x0, y0 = int(sx) - k, int(sy) - k
        hh, ww = spr.shape
        X0c, Y0c, X1c, Y1c = max(x0, 0), max(y0, 0), min(x0 + ww, W), min(y0 + hh, H)
        if X0c < X1c and Y0c < Y1c:
            light = 0.6 + 8 * BEAM[min(int(sy) // 4, H // 4 - 1) if 0 <= sy < H else 0,
                                   min(int(sx) // 4, W // 4 - 1) if 0 <= sx < W else 0]
            glow[Y0c:Y1c, X0c:X1c] += spr[Y0c - y0:Y1c - y0, X0c - x0:X1c - x0] * a * light
    return img + glow[..., None] * np.array((150, 205, 245), np.float32)


# ---------- субтитры ----------

SUB_STEMS = [
    (GREEN, ("вверх", "взлет", "рост", "закрыти", "дальше")),
    (RED, ("вниз", "рухнет", "сползать", "разворот", "сложнее")),
    (YELLOW, ("коридор", "канал", "флаг", "древк", "полотнищ", "границу")),
]


def word_color(w):
    n = norm(w)
    return next((col for col, stems in SUB_STEMS if n.startswith(stems)), WHITE)


def build_subs():
    chunks = []
    for li, ln in enumerate(LINES):
        disp = []
        for tok in ln["text"].split():
            if tok == "—":
                disp[-1] += " —"
            else:
                disp.append(tok)
        assert len(disp) == len(ln["words"]), ln["text"]
        timed = [dict(word=d.upper(), t=VOICE_AT[li] + s, color=word_color(d)) for d, (_, s, _) in zip(disp, ln["words"])]
        groups, rows = [], [[]]
        for tk in timed:
            row = rows[-1]
            if row and sum(len(x["word"]) + 1 for x in row) + len(tk["word"]) > 13:
                if len(rows) == 2:
                    groups.append(rows)
                    rows = [[]]
                else:
                    rows.append([])
            rows[-1].append(tk)
            if tk["word"][-1] in ".?!,:…":
                groups.append(rows)
                rows = [[]]
        if rows[0]:
            groups.append(rows)
        for rows in groups:
            chunks.append(dict(line=li, start=rows[0][0]["t"] - 0.05, rows=rows, line_end=VOICE_AT[li] + ln["duration"]))
    for k, ch in enumerate(chunks):
        nxt = chunks[k + 1] if k + 1 < len(chunks) else None
        ch["end"] = nxt["start"] if nxt else min(ch["line_end"] + 0.3, DURATION - 0.1)  # в конце доска чистая
        if nxt and nxt["line"] != ch["line"]:
            ch["end"] = min(ch["line_end"] + 0.35, nxt["start"])
    return chunks


CHUNKS = build_subs()


def blit(dst, mask, x, y, color, alpha=1.0):
    h, w = mask.shape
    x, y = int(round(x)), int(round(y))
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, dst.shape[1]), min(y + h, dst.shape[0])
    if x0 >= x1 or y0 >= y1:
        return
    m = mask[y0 - y:y1 - y, x0 - x:x1 - x, None] * alpha
    dst[y0:y1, x0:x1] = dst[y0:y1, x0:x1] * (1 - m) + np.array(color, np.float32) * m


def draw_subs(frame, t):
    ch = next((c for c in CHUNKS if c["start"] <= t < c["end"]), None)
    if ch is None:
        return
    f = font(SUB_SIZE)
    widest = max(sum(f.getlength(tk["word"]) for tk in row) + f.getlength(" ") * (len(row) - 1) for row in ch["rows"])
    pop = 0.75 + 0.25 * (1 + 2.9 * (clamp01((t - ch["start"]) / 0.2) - 1) ** 3 + 1.9 * (clamp01((t - ch["start"]) / 0.2) - 1) ** 2)
    fs = max(10, int(SUB_SIZE * min(1.0, SUB_W / widest) * pop))
    stroke_w = max(3, int(fs * 0.13))
    f = font(fs)
    space, lh = f.getlength(" "), fs * 1.18
    for r, row in enumerate(ch["rows"]):
        x = SUB_X - (sum(f.getlength(tk["word"]) for tk in row) + space * (len(row) - 1)) / 2
        cy = SUB_CY - lh * (len(ch["rows"]) - 1) / 2 + lh * r
        for tk in row:
            fill, outline, mcy, pad = text_pair(tk["word"], fs, stroke_w)
            on = t >= tk["t"] - 0.03
            blit(frame, outline, x - pad, cy - mcy, SHADE, 0.9)
            blit(frame, fill, x - pad, cy - mcy, tk["color"] if on else (150, 170, 150), 1.0 if on else 0.8)
            x += f.getlength(tk["word"]) + space


# горизонтальная раскладка 16:9: зона графика крупно слева, зона заголовка справа сверху, субтитры под ней
SRC_CHART, SRC_HEAD = (40, 450, 1000, 1360), (40, 190, 1000, 560)


def panel_matrix(src, x, y, scale):
    return np.float32([[scale, 0, x - src[0] * scale], [0, scale, y - src[1] * scale]])


M_CHART = panel_matrix(SRC_CHART, 70, 50, 1.08)
M_HEAD = panel_matrix(SRC_HEAD, 1080, 70, 0.86)
SUB_X, SUB_CY, SUB_W = (1463, 720, 720) if LAND else (MID_X, SUB_Y, SUB_MAXW)
WIPE_L = Wipe(1920, 1080, (0.85, 0.53), landscape()[1]) if LAND else None


def crop_to(arr, box):
    out = np.zeros_like(arr)
    x0, y0, x1, y1 = box
    out[y0:y1, x0:x1] = arr[y0:y1, x0:x1]
    return out


def place(dst, src, m, box):
    """Переносит зону доски (box) в горизонтальный кадр."""
    P = cv2.warpAffine(crop_to(src.P, box), m, (OUT_W, OUT_H))
    a = cv2.warpAffine(crop_to(src.A, box), m, (OUT_W, OUT_H))
    dst.P = P + dst.P * (1 - a[..., None])
    dst.A = a + dst.A * (1 - a)


def render_land(t):
    """Горизонтальный кадр: зоны вертикальной доски на широкой доске; губка стирает уже широкий кадр."""
    head, chart, wiped, dust = Chalk(), Chalk(), [], np.zeros((H, W), np.float32)
    for er, fn in GROUPS:
        target = head if fn in HEAD_FNS else chart
        if er is None or t < er.t0:
            fn(target, t)
            continue
        if er.gone(t):
            continue
        layer = Chalk()
        fn(layer, t)
        if er is WIPE:
            wiped.append((layer, fn in HEAD_FNS))
            continue
        if id(er) not in _start_layers:
            first = Chalk()
            fn(first, er.t0)
            _start_layers[id(er)] = first
        er.dust(dust, _start_layers[id(er)], t)
        er.apply(layer, t)
        target.over(layer, er.box)
    draw_dust(dust, t)
    canvas = Chalk(OUT_W, OUT_H)
    place(canvas, chart, M_CHART, SRC_CHART)
    place(canvas, head, M_HEAD, SRC_HEAD)
    if wiped:
        wc = Chalk(OUT_W, OUT_H)
        for layer, is_head in wiped:
            place(wc, layer, M_HEAD if is_head else M_CHART, SRC_HEAD if is_head else SRC_CHART)
        WIPE_L.apply(wc, t)
        canvas.P = wc.P + canvas.P * (1 - wc.A[..., None])
        canvas.A = wc.A + canvas.A * (1 - wc.A)
    d = np.maximum(cv2.warpAffine(crop_to(dust, SRC_CHART), M_CHART, (OUT_W, OUT_H)),
                   cv2.warpAffine(crop_to(dust, SRC_HEAD), M_HEAD, (OUT_W, OUT_H)))
    img = landscape()[0].copy()
    wet = WIPE_L.wet(t)
    if wet is not None:
        img *= (1 - wet)[..., None]
    img = img * (1 - canvas.A[..., None]) + canvas.P
    d = np.clip(d, 0, 1)
    img = img * (1 - d[..., None]) + np.array(WHITE, np.float32) * d[..., None]
    draw_sponge(img, WIPE_L, t)
    return img


# ---------- свои надписи из редактора: мелом поверх кадра, в долях кадра (x, y — центр) ----------

CUSTOM = A.PROJECT.get("custom_texts", [])
CHALK = {"white": WHITE, "yellow": YELLOW, "green": GREEN, "red": RED}
GRAIN_T, PRESS_T = np.tile(GRAIN, (2, 2)), np.tile(PRESS, (2, 2))   # покрывают и 1080×1920, и 1920×1080


def draw_custom(img, t):
    for c in CUSTOM:
        a0, dur = float(c.get("start", 0)), float(c.get("duration", 2.5))
        if not (a0 <= t < a0 + dur) or not c.get("text", "").strip():
            continue
        p, fade = clamp01((t - a0) / 0.4), clamp01((a0 + dur - t) / 0.3)    # пишется мелом, в конце тает
        rows = c["text"].split("\n")[:3]
        size = int(c.get("size", 90))
        cx, cy = float(c.get("x", 0.5)) * OUT_W, float(c.get("y", 0.2)) * OUT_H
        for r, s in enumerate(rows):
            fs = fit(s, size, OUT_W * 0.86)
            m, x0, y0 = text_box(s, fs, cx, cy + (r - (len(rows) - 1) / 2) * fs * 1.2)
            if p < 1:
                m = m * np.clip(((m.shape[1] + 0.45 * fs) * p - np.arange(m.shape[1])) / (0.45 * fs), 0, 1)[None]
            h, w = m.shape
            a = np.clip((m - (1 - crop(GRAIN_T, x0, y0, w, h)) * 0.95) * 1.8, 0, 1) * 0.94 * fade * crop(PRESS_T, x0, y0, w, h)
            X0, Y0, X1, Y1 = max(x0, 0), max(y0, 0), min(x0 + w, OUT_W), min(y0 + h, OUT_H)
            if X0 < X1 and Y0 < Y1:
                aa = a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
                img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - aa) + np.array(CHALK.get(c.get("color"), WHITE), np.float32) * aa


def render_frame(t):
    img = camera(render_land(t) if LAND else render_board(t), t)
    img = foreground(img, t)
    draw_custom(img, t)
    draw_subs(img, t)
    return np.clip(img, 0, 255).astype(np.uint8)


# ---------- сборка ----------

def main():
    print("сцены:", " | ".join(f"{a:.2f}–{b:.2f}" for a, b in zip(A.CUTS, A.CUTS[1:])), f"→ {DURATION:.2f} с")
    out = A.BUILD
    if len(sys.argv) > 1 and sys.argv[1] == "--seq":
        t0, dur = float(sys.argv[2]), float(sys.argv[3])
        times = [t0 + k / FPS for k in range(int(round(dur * FPS)))]
        tw, th = (384, 216) if LAND else (216, 384)
        tiles = [cv2.resize(render_frame(tt), (tw, th), interpolation=cv2.INTER_AREA) for tt in times]
        for tile, tt in zip(tiles, times):
            cv2.putText(tile, f"{tt:.3f}", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 6)
        cv2.imwrite(str(out / "seq.png"), np.vstack([np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles), 6)]))
        return
    if len(sys.argv) > 1:
        tw, th = (640, 360) if LAND else (360, 640)
        tiles = [cv2.resize(render_frame(float(a)), (tw, th), interpolation=cv2.INTER_AREA) for a in sys.argv[1:]]
        for tile, a in zip(tiles, sys.argv[1:]):
            cv2.putText(tile, a, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 3)
        cv2.imwrite(str(out / "sheet.png"), np.vstack([np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)]))
        return

    total = round(DURATION * FPS)
    first, last = render_frame(0.0), render_frame((total - 1) / FPS)
    print(f"петля: средняя разница первого и последнего кадра {np.abs(first.astype(int) - last).mean():.2f}")
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "-",
           "-i", AUDIO, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-t", f"{DURATION:.4f}", "-movflags", "+faststart", VIDEO_OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(total):
        proc.stdin.write(render_frame(k / FPS).tobytes())
        if k % 30 == 0:
            print(f"кадр {k}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("готово:", VIDEO_OUT)


if __name__ == "__main__":
    main()
