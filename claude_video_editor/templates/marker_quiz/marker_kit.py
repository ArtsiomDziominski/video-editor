"""Набор для шаблона «Блиц на белой доске» (9:16): доска, маркер, штрихи, текст, губка."""
import zlib
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FONT = "C:/Windows/Fonts/segoeprb.ttf"   # рукописный, с кириллицей и стрелками

# маркеры, BGR
INK = (38, 34, 32)
GREEN = (70, 170, 40)
RED = (55, 55, 215)
BLUE = (200, 115, 25)
YELLOW = (40, 205, 255)
GREY = (150, 150, 150)
PAPER_WHITE = (250, 251, 252)


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ease_out(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_io(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seed(*parts):
    return zlib.crc32(repr(parts).encode())


def make_textures():
    rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    low = cv2.resize(cv2.GaussianBlur(rng.normal(0, 1, (H // 8, W // 8)).astype(np.float32), (0, 0), 5), (W, H))
    low *= 3.5 / np.abs(low).max()
    grain = rng.normal(0, 1.4, (H, W)).astype(np.float32)
    light = 5 - 11 * (((xx - 250) / 1300) ** 2 + ((yy - 250) / 2100) ** 2)   # дневной свет слева сверху
    paper = np.array((244, 246, 247), np.float32) + (low + grain + light)[..., None]
    paper[..., 0] -= 1.5                                                        # чуть тёплая
    smudge = np.zeros((H, W), np.float32)                                       # следы старых стёртых надписей
    for _ in range(7):
        x, y = rng.uniform(80, W - 80), rng.uniform(250, H - 300)
        pts = np.c_[x + np.linspace(0, rng.uniform(150, 420), 12), y + rng.normal(0, 12, 12).cumsum()]
        cv2.polylines(smudge, [pts.astype(np.int32)], False, 1.0, int(rng.uniform(8, 22)), cv2.LINE_AA)
    smudge = cv2.GaussianBlur(smudge, (0, 0), 9)
    paper *= (1 - 0.035 * smudge)[..., None]
    paper[..., 0] += 2.5 * smudge                                               # синеватый оттенок старого маркера
    streak = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), sigmaX=1.2, sigmaY=7)
    tex = 0.88 + 0.12 * np.clip(streak / (3 * streak.std()) + 0.5, 0, 1)        # неровная заливка маркером
    ghost = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), sigmaX=40, sigmaY=2.5)
    ghost = np.clip(ghost / (2.5 * ghost.std()) + 0.35, 0, 1)                   # полосы после губки
    return np.clip(paper, 0, 255), tex.astype(np.float32), ghost.astype(np.float32)


PAPER, TEX, GHOST = make_textures()


def crop(arr, x, y, w, h):
    out = np.ones((h, w), np.float32) * 0.94
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, arr.shape[1]), min(y + h, arr.shape[0])
    if x0 < x1 and y0 < y1:
        out[y0 - y:y1 - y, x0 - x:x1 - x] = arr[y0:y1, x0:x1]
    return out


class Ink:
    """Слой маркера: цвет с premultiplied alpha поверх доски."""

    def __init__(self):
        self.P = np.zeros((H, W, 3), np.float32)
        self.A = np.zeros((H, W), np.float32)

    def put(self, a, x, y, color):
        h, w = a.shape
        x, y = int(round(x)), int(round(y))
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
        if x0 >= x1 or y0 >= y1:
            return
        aa = a[y0 - y:y1 - y, x0 - x:x1 - x, None]
        self.P[y0:y1, x0:x1] = self.P[y0:y1, x0:x1] * (1 - aa) + np.array(color, np.float32) * aa
        self.A[y0:y1, x0:x1] = self.A[y0:y1, x0:x1] * (1 - aa[..., 0]) + aa[..., 0]

    def mask(self, m, x, y, color, opacity=0.97):
        x, y = int(x), int(y)
        self.put(m * opacity * crop(TEX, x, y, m.shape[1], m.shape[0]), x, y, color)

    def scale(self, k):
        self.P *= k[..., None]
        self.A *= k

    def onto(self, img):
        img[:] = img * (1 - self.A[..., None]) + self.P


def path_part(pts, p):
    """Первая доля p длины ломаной — маркер ведёт линию."""
    pts = np.asarray(pts, float)
    if p >= 1:
        return pts
    seg = np.hypot(*np.diff(pts, axis=0).T)
    cum = np.r_[0, np.cumsum(seg)]
    target = cum[-1] * p
    k = min(int(np.searchsorted(cum, target, side="right")) - 1, len(seg) - 1)
    u = (target - cum[k]) / max(seg[k], 1e-9)
    return np.vstack([pts[:k + 1], pts[k] + (pts[k + 1] - pts[k]) * u])


def poly_mask(pts, thick, fill=False):
    pts = np.asarray(pts, float)
    pad = int(thick) + 3
    x0, y0 = np.floor(pts.min(0) - pad).astype(int)
    x1, y1 = np.ceil(pts.max(0) + pad).astype(int)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    q = [np.round((pts - (x0, y0)) * 16).astype(np.int32)]
    if fill:
        cv2.fillPoly(m, q, 255, cv2.LINE_AA, shift=4)
    else:
        cv2.polylines(m, q, False, 255, int(thick), cv2.LINE_AA, shift=4)
    return m.astype(np.float32) / 255, x0, y0


def line(ink, pts, p, color, thick, opacity=0.97):
    p = clamp01(p)
    if p <= 0:
        return
    q = path_part(pts, p)
    if len(q) >= 2:
        m, x0, y0 = poly_mask(q, thick)
        ink.mask(m, x0, y0, color, opacity)


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


def ellipse_path(cx, cy, rx, ry, sd, turns=1.12, n=70):
    r = np.random.default_rng(sd)
    a = r.uniform(0, 2 * np.pi) + np.linspace(0, 2 * np.pi * turns, n)
    k = 1 + 0.04 * np.sin(3 * a + r.uniform(0, 6)) + np.linspace(-0.04, 0.07, n)
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
    dense = dense + radial * (1.8 * np.sin(2 * np.pi * 3 * u + np.random.default_rng(sd).uniform(0, 6)))[:, None]
    return np.vstack([dense, dense[:5] + (0, 2)])        # перехлёст в конце, как рукой


def doodle_arrow(ink, pts, p, color, thick, head=30, opacity=0.97):
    p = clamp01(p)
    if p <= 0:
        return
    pts = np.asarray(pts, float)
    line(ink, pts, p / 0.75, color, thick, opacity)
    if p > 0.75:
        tip, d = pts[-1], pts[-1] - pts[max(0, len(pts) - 3)]
        d /= np.hypot(*d)
        for ang in (0.5, -0.5):
            r = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]) @ -d
            line(ink, np.array([tip, tip + r * head]), (p - 0.75) / 0.25, color, thick, opacity)


def check(ink, cx, cy, s, p, color, thick, sd=0):
    pts = np.vstack([wobbly((cx - 0.42 * s, cy - 0.02 * s), (cx - 0.12 * s, cy + 0.3 * s), sd, 1.2, 6, 0),
                     wobbly((cx - 0.12 * s, cy + 0.3 * s), (cx + 0.5 * s, cy - 0.45 * s), sd + 1, 2.0, 6, 3)])
    line(ink, pts, p, color, thick)


# ---------- текст ----------

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
    w = font(size).getlength(s)
    return size if w <= 0 else max(10, int(size * min(1.0, max_w / w)))   # пустая надпись — без деления на ноль


def text_w(s, size):
    return font(size).getlength(s)


def text_box(s, size, x, y, align="center"):
    _, m, cy, pad = text_pair(s, size, max(2, size // 40))
    tw = m.shape[1] - 2 * pad
    x0 = {"left": x, "center": x - tw / 2, "right": x - tw}[align]
    return m, int(round(x0 - pad)), int(round(y - cy))


def write(ink, s, size, x, y, p, color=INK, align="center", opacity=0.97):
    """Надпись маркером; p — сколько уже написано слева направо."""
    p = clamp01(p)
    if p <= 0 or not s:
        return
    m, x0, y0 = text_box(s, size, x, y, align)
    if p < 1:
        soft = 0.45 * size
        m = m * np.clip(((m.shape[1] + soft) * p - np.arange(m.shape[1])) / soft, 0, 1)[None]
    ink.mask(m, x0, y0, color, opacity)


def bold(ink, s, size, x, y, fill, edge=INK):
    """Крупное слово: цветная заливка с тёмным контуром — жёлтое читается и на белой доске."""
    if not s:
        return
    sw = max(4, size // 14)
    f, o, cy, pad = text_pair(s, size, sw)
    x0, y0 = int(round(x - (o.shape[1] - 2 * pad) / 2 - pad)), int(round(y - cy))
    ink.mask(o, x0, y0, edge)
    ink.mask(f, x0, y0, fill, 1.0)


# ---------- губка ----------

WIPE_ROWS = (420, 680, 940, 1200)
WIPE_THICK = 300


def wipe_path():
    pts = []
    for k, y in enumerate(WIPE_ROWS):
        xs = (-220, W + 220) if k % 2 == 0 else (W + 220, -220)
        pts += [(xs[0], y), (xs[1], y)]
    return np.array(pts, float)


WIPE_PTS = wipe_path()


def swept(p):
    """Что губка уже прошла: маска по зигзагу сверху вниз; стрипа со счётом над ней не трогаем."""
    m = np.zeros((H, W), np.uint8)
    q = path_part(WIPE_PTS, clamp01(p))
    cv2.polylines(m, [np.round(q).astype(np.int32)], False, 255, WIPE_THICK, cv2.LINE_8)
    m[:262] = 0
    return cv2.GaussianBlur(m, (0, 0), 6).astype(np.float32) / 255


def draw_eraser(img, p):
    """Губка для белой доски на переднем крае стирания: войлок снизу, синяя спинка сверху, мягкая тень."""
    if not 0 < p < 1:
        return
    q = path_part(WIPE_PTS, p)
    c, d = q[-1], q[-1] - q[-2]
    ang = 8 * np.sign(d[0]) if abs(d[0]) > abs(d[1]) else 0.0
    centre, w, h = (float(c[0]), float(c[1])), 230, 300

    def rect(inset):
        return cv2.boxPoints((centre, (w - inset, h - inset), float(ang)))

    def fill(points, color, blur=0):
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.round(points).astype(np.int32)], 255, cv2.LINE_AA)
        a = (cv2.GaussianBlur(m, (0, 0), blur) if blur else m).astype(np.float32)[..., None] / 255
        return a, np.array(color, np.float32)

    a, _ = fill(rect(0) + (14, 20), (0, 0, 0), 14)
    img *= 1 - a * 0.3
    for points, color in ((rect(0), (176, 180, 184)), (rect(34), (178, 104, 44)), (rect(70), (205, 138, 76))):
        a, col = fill(points, color)                 # войлок, синяя спинка, светлая ручка
        img[:] = img * (1 - a) + col * a
