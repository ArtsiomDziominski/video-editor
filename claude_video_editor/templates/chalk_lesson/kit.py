"""Меловой набор для шаблона «Урок на доске» (16:9): доска, мел, штрихи, текст, пыль, губка.

Взято из проверенного шаблона chalk_quiz и перенесено на горизонтальную доску 1920×1080.
"""
import zlib
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 30
FONT = "C:/Windows/Fonts/segoeprb.ttf"   # рукописный, с кириллицей и стрелками

# мел, BGR
WHITE = (232, 238, 236)
YELLOW = (95, 214, 247)
GREEN = (125, 222, 140)
RED = (105, 112, 240)
BLUE = (235, 190, 120)
GREY = (175, 182, 176)
SHADE = (22, 34, 18)


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ease_out(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_io(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seed(*parts):
    return zlib.crc32(repr(parts).encode())


# ---------- текстуры ----------

def noise(sigma, shape=(H, W), sd=0):
    r = np.random.default_rng(sd).normal(0, 1, shape).astype(np.float32)
    if sigma:
        r = cv2.GaussianBlur(r, (0, 0), sigma)
    return r / (r.std() + 1e-6)


def make_board(W=W, H=H, light_x=1500):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.array((50, 70, 33), np.float32) + (cv2.resize(noise(6, (H // 8, W // 8), 1), (W, H)) * 3.0
                                                + noise(0.6, (H, W), sd=2) * 2.2)[..., None]
    haze = np.zeros((H, W), np.float32)                  # разводы стёртого мела — дуги губки
    r = np.random.default_rng(4)
    for _ in range(9):
        a0 = r.uniform(0, 360)
        cv2.ellipse(haze, (int(r.uniform(0, W)), int(r.uniform(0, H))),
                    (int(r.uniform(180, 520)), int(r.uniform(90, 400))), r.uniform(0, 180), a0, a0 + r.uniform(60, 160),
                    1.0, int(r.uniform(30, 90)), cv2.LINE_AA)
    haze = cv2.GaussianBlur(haze, (0, 0), 18) * (0.6 + 0.4 * np.clip(noise(3, (H, W), sd=5) * 0.5 + 0.5, 0, 1))
    img += haze[..., None] * np.array((9, 11, 9), np.float32)
    light = np.exp(-(((xx - light_x) / 900) ** 2 + ((yy - 250) / 1300) ** 2))   # тёплый свет из окна справа сверху
    img += light[..., None] * np.array((8, 24, 40), np.float32)
    vig = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
    img *= (1 - 0.35 * np.clip(vig - 0.35, 0, 1))[..., None]
    return img


BOARD = make_board()
GRAIN = np.clip(0.55 + 0.30 * noise(0.5, sd=7) + 0.18 * noise(1.5, sd=8), 0, 1)      # зерно мела
PRESS = np.clip(0.88 + 0.12 * noise(14, sd=9), 0.6, 1).astype(np.float32)           # нажим
DISS = np.clip(0.5 + 0.22 * noise(2.5, sd=10) + 0.1 * noise(0.8, sd=11), 0, 1)      # порядок рассыпания в пыль
STREAK = np.clip(0.5 + 0.5 * cv2.GaussianBlur(noise(0, sd=12), (0, 0), sigmaX=2.0, sigmaY=30) * 2.5, 0, 1)
_hatch = np.zeros((H, W), np.uint8)
for _c in range(-H, W + H, 9):                              # штриховка мелом под 45°, привязана к доске
    cv2.line(_hatch, (_c, H), (_c + H, 0), 255, 3, cv2.LINE_AA)
HATCH = _hatch.astype(np.float32) / 255



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
    w = font(size).getlength(s)
    return size if w <= 0 else max(10, int(size * min(1.0, max_w / w)))   # пустая надпись — без деления на ноль


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


