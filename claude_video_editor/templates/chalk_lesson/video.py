"""Шаблон «Урок на доске» (YouTube 16:9): мел рисует урок по главам, губка стирает доску между ними.

Проект — папка VPROJ_DIR (распакованный .vproj); рисунки и их тайминги — beats.py, надписи — project.json → texts.
python video.py                 — собрать MP4 в VPROJ_OUT
python video.py 12.5 80 ...     — кадры на эти секунды в build/sheet.png
python video.py --seq 23.0 0.3  — каждый кадр отрезка в build/seq.png
"""
import os
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np

import audio as A
import beats as B
from audio import LINES, VOICE_AT, norm
from kit import (BLUE, BOARD, DISS, GREEN, GREY, H, HATCH, RED, SHADE, STREAK, W, WHITE, YELLOW, Chalk, check,
                 clamp01, crop, cross, doodle_arrow, draw_dust, draw_sponge, ease_io, ease_out, ellipse_path, emitter,
                 fit, font, line, poly_mask, rrect_path, text_pair, text_w, wobbly, write, chalk_alpha, GRAIN, PRESS,
                 seed)

FPS = int(A.PROJECT.get("fps", 30))
VIDEO_OUT = os.environ.get("VPROJ_OUT", str(A.BUILD / "video.mp4"))
AUDIO = A.OUT + ".wav"
DURATION = round(A.DURATION * FPS) / FPS
OUT_W, OUT_H = W, H
LAND = True
TEXTS = {**B.TEXT_DEFAULTS, **A.PROJECT.get("texts", {})}
TEXT_TRACK = B.TEXT_TRACK
COL = {"white": WHITE, "yellow": YELLOW, "green": GREEN, "red": RED, "blue": BLUE, "grey": GREY}
DISSOLVE = 0.45


# ---------- элементы ----------

def candle(ch, e, p, t):
    p = clamp01(p)
    if p <= 0:
        return
    x, bw = e["x"], e["bw"]
    yc, color = e["yc"], COL[e["color"]]
    if "close_at" in e and t >= e["close_at"]:          # тело закрывается обратно — ловушка
        k = ease_out((t - e["close_at"]) / 0.3)
        yc = e["yc"] + (e["yc2"] - e["yc"]) * k
        if k > 0.5:
            color = COL[e.get("color2", e["color"])]
    yt, yb = sorted((e["yo"], yc))
    yb = max(yb, yt + 3)
    sd = seed("c", round(x), round(e["yo"]))
    thick = 5 if e.get("big") else 4
    line(ch, wobbly((x, e["yh"]), (x, yt), sd, 0.7, 6, 1), p / 0.2, WHITE, thick - 1, 0.85)
    line(ch, wobbly((x, yb), (x, e["yl"]), sd + 1, 0.7, 6, 1), p / 0.2, WHITE, thick - 1, 0.85)
    q = clamp01((p - 0.45) / 0.55)
    if q > 0 and yb - yt > 4:
        xa, ya, w, h = int(x - bw + 2), int(yt + 2), int(2 * bw - 3), int(yb - yt - 3)
        m = crop(HATCH, xa, ya, w, h).copy()
        rows = np.arange(h, dtype=np.float32)
        m *= np.clip((q * 1.15 - (h - rows) / h) / 0.15, 0, 1)[:, None]
        ch.mask(m, xa, ya, color, 0.8)
    corners = [(x - bw, yt), (x + bw, yt), (x + bw, yb), (x - bw, yb), (x - bw, yt)]
    pts = np.vstack([wobbly(a, b, sd + 3 + k, 0.8, 7, 2) for k, (a, b) in enumerate(zip(corners, corners[1:]))])
    line(ch, pts, (p - 0.15) / 0.5, color, thick)


def polyline(ch, e, p):
    pts = np.array(e["pts"], float)
    color, th, op = COL[e["color"]], e["thick"], e.get("opacity", 0.9)
    if e.get("dashed"):
        seg = [(a, b) for a, b in zip(pts, pts[1:])]
        total = sum(np.hypot(*(b - a)) for a, b in seg)
        n = max(3, int(total / 70))
        a, b = pts[0], pts[-1]
        for k in range(n):
            u0, u1 = k / n, (k + 0.62) / n
            q = clamp01((p - k / n) * n)
            if q > 0:
                line(ch, wobbly(a + (b - a) * u0, a + (b - a) * u1, seed("d", k, round(a[0])), 0.9, 6, 1), q, color, th, op)
        return
    if len(pts) == 2:
        pts = wobbly(pts[0], pts[1], seed("l", *map(round, pts[0])), 1.4, 10, 4)
    line(ch, pts, p, color, th, op)


def text_el(ch, e, p):
    s = TEXTS.get(e["key"], "")
    if not s.strip():
        return
    rows = s.split("\n")[:3]
    size = e["size"]
    maxw = B.RW if abs(e["x"] - B.RX) < 5 else (1120 if e["align"] != "left" else 1860 - e["x"])
    n = len(rows)
    for k, row in enumerate(rows):   # каждая строка вписывается по ширине сама: длинная строка не мельчит короткую
        q = clamp01(p * n - k) if n > 1 else p
        write(ch, row, fit(row, size, maxw), e["x"], e["y"] + (k - (n - 1) / 2) * size * 1.18, q, COL[e["color"]],
              e["align"])


def dot(ch, e, p):
    if p <= 0:
        return
    r = e["r"] * (0.5 + 0.5 * ease_out(p))
    a = np.linspace(0, 2 * np.pi, 18)
    m, x0, y0 = poly_mask(np.c_[e["x"] + r * np.cos(a), e["y"] + r * np.sin(a)], 1, fill=True)
    ch.mask(m, x0, y0, COL[e["color"]], 0.95)


def clock(ch, e, p, t):
    cx, cy, r = e["cx"], e["cy"], e["r"]
    line(ch, ellipse_path(cx, cy, r, r, seed("clk"), 1.04, 80), p, WHITE, 6)
    if p < 1:
        return
    for k in range(12):
        a = k * np.pi / 6
        line(ch, np.array([(cx + 0.82 * r * np.cos(a), cy + 0.82 * r * np.sin(a)),
                           (cx + 0.92 * r * np.cos(a), cy + 0.92 * r * np.sin(a))]), 1, WHITE, 4)
    sec = (t - e["t0"]) * 2 * np.pi / 6 - np.pi / 2          # стрелка идёт, пока говорят про терпение
    line(ch, np.array([(cx, cy), (cx + 0.72 * r * np.cos(sec), cy + 0.72 * r * np.sin(sec))]), 1, YELLOW, 6)
    line(ch, np.array([(cx, cy), (cx + 0.45 * r * np.cos(-1.2), cy + 0.45 * r * np.sin(-1.2))]), 1, WHITE, 8)


def swarm(ch, e, t):
    """Толпа маленьких стрелочек рвётся вверх за проколом, а на «ловушке» падает."""
    age = t - e["t0"]
    if age <= 0:
        return
    fall = t - e["fall"]
    rr = np.random.default_rng(5)
    for k in range(e["n"]):
        x = e["x"] + rr.uniform(-80, 80) + 30 * k % 120
        y0 = e["y"] + rr.uniform(-40, 60)
        up = 160 * ease_out(min(age, 0.8) / 0.8) * rr.uniform(0.7, 1.2)
        if fall > 0:
            y = y0 - up + 380 * ease_io(min(fall, 0.9) / 0.9)
            pts = [(x, y - 30), (x, y + 30)]
            op = 0.85 * clamp01(1 - (fall - 0.6) / 0.5)
        else:
            y = y0 - up
            pts = [(x, y + 30), (x, y - 30)]
            op = 0.85
        if op > 0:
            doodle_arrow(ch, np.array(pts, float), 1.0, RED if fall > 0 else GREEN, 4, 14, op)


def button(ch, e, p):
    if p <= 0:
        return
    cx, cy, w, h = e["cx"], e["cy"], e["w"], e["h"]
    pts = rrect_path(cx, cy, w, h, 30, seed("btn", e["key"]))
    m, x0, y0 = poly_mask(pts, 1, fill=True)
    m *= crop(HATCH, x0, y0, m.shape[1], m.shape[0])
    ch.mask(m * clamp01((p - 0.2) / 0.5), x0, y0, COL[e["color"]], 0.55)
    line(ch, pts, p / 0.5, COL[e["color"]], 6, 0.95)
    s = TEXTS.get(e["key"], "")
    write(ch, s, fit(s, 50, w - 40), cx, cy, (p - 0.45) / 0.55, WHITE)


def question(ch, e, p):
    write(ch, "?", e.get("size", 230), e["cx"], e["cy"], p, YELLOW)


def wave(ch, e, p, t):
    """Извилистая линия графика; с close_at сжимается по горизонтали в тень свечи."""
    pts = np.array(e["pts"], float)
    pts[:, 0] += (e["cx"] - pts[:, 0]) * ease_io((t - e["close_at"]) / e["settle"])
    line(ch, pts, p, COL[e["color"]], e["thick"])


def live(ch, e, t):
    """Свеча в реальном времени: keys — (время, y текущей точки); верх и низ остаются там, куда график успел сходить."""
    ts, ys = zip(*e["keys"])
    y = float(np.interp(t, ts, ys))
    seen = [v for u, v in e["keys"] if u <= t] + [y]
    candle(ch, dict(x=e["x"], bw=e["bw"], yh=min(seen), yo=e["yo"], yc=y, yl=max(seen),
                    color="green" if y <= e["yo"] else "red", big=True), 1, t)


def rope(ch, e, t):
    """Канат тянут две стрелки: keys — (время, сдвиг), вверх минус; мелкая дрожь — натяжение."""
    ts, off = zip(*e["keys"])
    dy = float(np.interp(t, ts, off)) + 5 * np.sin(t * 13) + 3 * np.sin(t * 23)
    p = clamp01((t - e["t0"]) / e["dur"])
    cx, top, bot = e["cx"], e["cy"] - e["half"] + dy, e["cy"] + e["half"] + dy
    u = np.linspace(0, 1, 80)
    yy = top + (bot - top) * u
    for phase in (0.0, np.pi):                  # две пряди — витой канат
        line(ch, np.c_[cx + 9 * np.sin(u * 42 + phase), yy], p, WHITE, 5)
    if p >= 1:
        line(ch, ellipse_path(cx, e["cy"] + dy, 26, 18, seed("knot"), 1.04, 40), 1, YELLOW, 6)
    doodle_arrow(ch, wobbly((cx, top), (cx, top - e["pull"]), seed("ru"), 1.2, 10, 0), (p - 0.5) / 0.5, GREEN, 10, 42)
    doodle_arrow(ch, wobbly((cx, bot), (cx, bot + e["pull"]), seed("rd"), 1.2, 10, 0), (p - 0.5) / 0.5, RED, 10, 42)


def falling_star(ch, e, t):
    """Звезда падает по тени и гаснет у тела."""
    u = clamp01((t - e["t0"]) / e["dur"])
    x, y = e["x"], e["y0"] + (e["y1"] - e["y0"]) * u * u
    a = -np.pi / 2 + 3.5 * u + np.arange(11) * np.pi / 5
    r = e["r"] * np.where(np.arange(11) % 2, 0.42, 1.0)
    line(ch, np.c_[x + r * np.cos(a), y + r * np.sin(a)], 1, YELLOW, 6)


def draw(ch, e, t):
    p = (t - e["t0"]) / max(e["dur"], 1e-3)
    if p <= 0 and e["kind"] != "swarm":
        return
    k = e["kind"]
    if k == "candle":
        candle(ch, e, p, t)
    elif k == "line":
        polyline(ch, e, p)
    elif k == "arrow":
        doodle_arrow(ch, wobbly(e["pts"][0], e["pts"][-1], seed("a", *map(round, e["pts"][0])), 1.5, 10, 0),
                     clamp01(p), COL[e["color"]], e["thick"], e["head"])
    elif k == "ellipse":
        line(ch, ellipse_path(e["cx"], e["cy"], e["rx"], e["ry"], seed("e", round(e["cx"]), round(e["cy"]))),
             p, COL[e["color"]], e["thick"])
    elif k == "check":
        check(ch, e["cx"], e["cy"], e["s"], clamp01(p), COL[e["color"]], max(6, int(e["s"] * 0.13)),
              seed("k", round(e["cx"]), round(e["cy"])))
    elif k == "band":
        x0, y0 = int(e["x0"]), int(e["y0"])
        m = crop(HATCH, x0, y0, int(e["x1"] - e["x0"]), int(e["y1"] - e["y0"])).copy()
        m *= np.clip(((m.shape[1] + 80) * clamp01(p) - np.arange(m.shape[1])) / 80, 0, 1)[None]
        ch.mask(m, x0, y0, COL[e["color"]], e["opacity"])
    elif k == "text":
        text_el(ch, e, clamp01(p))
    elif k == "dot":
        dot(ch, e, clamp01(p))
    elif k == "clock":
        clock(ch, e, clamp01(p), t)
    elif k == "swarm":
        swarm(ch, e, t)
    elif k == "button":
        button(ch, e, clamp01(p))
    elif k == "question":
        question(ch, e, clamp01(p))
    elif k == "wave":
        wave(ch, e, clamp01(p), t)
    elif k == "live":
        live(ch, e, t)
    elif k == "rope":
        rope(ch, e, t)
    elif k == "cross":
        cross(ch, e["cx"], e["cy"], e["s"], clamp01(p), COL[e["color"]], 8)
    elif k == "star":
        falling_star(ch, e, t)


# ---------- пыль с кончика мела ----------

def path_of(e):
    k = e["kind"]
    if k == "candle":
        return [(e["x"], e["yh"]), (e["x"], e["yl"])]
    if k in ("line", "arrow", "wave"):
        return e["pts"]
    if k == "ellipse":
        return ellipse_path(e["cx"], e["cy"], e["rx"], e["ry"], 1)
    if k == "text":
        s = TEXTS.get(e["key"], "") or " "
        w = min(text_w(s.split("\n")[0], e["size"]), 1100)
        x0 = e["x"] if e["align"] == "left" else e["x"] - w / 2
        return [(x0, e["y"] + e["size"] * 0.4), (x0 + w, e["y"] + e["size"] * 0.4)]
    return None


for _e in B.ELEMENTS:
    _p = path_of(_e)
    if _p is not None and _e["dur"] >= 0.2:
        emitter(_e["t0"], _e["dur"], _p, COL.get(_e.get("color"), WHITE) if _e["kind"] != "text" else COL[_e["color"]],
                1 if _e["kind"] == "candle" else 2)


# ---------- губка между главами ----------

class Wipe:
    """Губка одним махом по диагонали: стирает всё за передним краем, оставляет мокрый след и меловую дымку."""
    dur = 0.75

    def __init__(self, t0, w=W, h=H, u=(0.85, 0.53)):
        self.t0, self.w, self.h, self.u = t0, w, h, np.array(u)
        self.box = (0, 0, w, h)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        self.D = xx * self.u[0] + yy * self.u[1]
        self.dmin, self.dmax = -380.0, float(w * self.u[0] + h * self.u[1]) + 380
        grid = np.linspace(0, 1, 512)
        frac = np.clip((self.D - self.dmin) / (self.dmax - self.dmin), 0, 1)
        self.T_PASS = self.t0 + self.dur * np.interp(frac, grid * grid * (3 - 2 * grid), grid).astype(np.float32)

    def front(self, t):
        return self.dmin + (self.dmax - self.dmin) * ease_io((t - self.t0) / self.dur)

    def apply(self, layer, t):
        k = np.clip((self.front(t) - self.D) / 60, 0, 1)
        ghost = 0.08 * STREAK * np.clip(1 - (t - self.T_PASS) / 1.2, 0, 1)
        layer.scale(1 - k * (1 - ghost), self.box)

    def wet(self, t):
        age = t - self.T_PASS
        return np.where(age > 0, 0.22 * np.clip(1 - age / 1.4, 0, 1) ** 1.5 * (0.7 + 0.3 * STREAK), 0).astype(np.float32)


WIPES = {t0: None for t0 in B.WIPES}


def wipe_at(t0):
    if WIPES.get(t0) is None:
        WIPES[t0] = Wipe(t0)
    return WIPES[t0]


_cache = dict(names=[], chalk=None)


def finished(e, t):
    """Элемент дорисован и больше не меняется — его можно взять из кэша."""
    if e["kind"] in ("clock", "swarm", "rope") or t < e["t0"] + e["dur"]:
        return False
    return "close_at" not in e or t >= e["close_at"] + e.get("settle", 0.35)


def static_layer(done, t):
    """Готовые элементы рисуются один раз и копятся в кэше (по порядку появления); иначе — пересборка."""
    names = [e["name"] for e in done]
    old = _cache["names"]
    if _cache["chalk"] is None or names[:len(old)] != old:
        _cache["chalk"], old = Chalk(), []
    for e in done[len(old):]:
        draw(_cache["chalk"], e, t)
    _cache["names"] = names
    ch = Chalk.__new__(Chalk)
    ch.P, ch.A = _cache["chalk"].P.copy(), _cache["chalk"].A.copy()
    return ch


def render_board(t):
    dust = np.zeros((H, W), np.float32)
    leaving, active, done = {}, [], []
    for e in B.ELEMENTS:
        if t < e["t0"] - 1e-6:
            continue
        if t < e["end"]:
            (done if finished(e, t) else active).append(e)
            continue
        limit = DISSOLVE + 0.4 if e["end_mode"] == "dissolve" else Wipe.dur + 1.3
        if t < e["end"] + limit:
            leaving.setdefault((e["end"], e["end_mode"]), []).append(e)
    ch = static_layer(done, t)
    for e in active:
        draw(ch, e, t)
    wets = []
    for (t_end, mode), group in sorted(leaving.items()):
        layer = Chalk()
        for e in group:
            draw(layer, e, t_end - 1e-3)
        if mode == "dissolve":
            u = -0.12 + 1.24 * clamp01((t - t_end) / DISSOLVE)
            layer.scale(np.clip((DISS - u) / 0.12, 0, 1), (0, 0, W, H))
        else:
            wp = wipe_at(t_end)
            wp.apply(layer, t)
            wets.append(wp)
        ch.over(layer, (0, 0, W, H))
    draw_dust(dust, t)
    img = BOARD.copy()
    for wp in wets:
        img *= (1 - wp.wet(t))[..., None]
    img = img * (1 - ch.A[..., None]) + ch.P
    dust = np.clip(dust, 0, 1)
    img = img * (1 - dust[..., None]) + np.array(WHITE, np.float32) * dust[..., None]
    for t0 in WIPES:
        if t0 <= t <= t0 + Wipe.dur:
            draw_sponge(img, wipe_at(t0), t)
    return img


# ---------- камера: спокойный дрейф и лёгкие наезды ----------

def camera(img, t):
    s = 1.03 + 0.01 * np.sin(2 * np.pi * t / 37)
    cx = 960 + 14 * np.sin(2 * np.pi * t / 53)
    cy = 540 + 9 * np.sin(2 * np.pi * t / 41 + 1)
    rot = 0.25 * np.sin(2 * np.pi * t / 61)
    m = cv2.getRotationMatrix2D((cx, cy), rot, s)
    m[:, 2] += (960 - cx, 540 - cy)
    return cv2.warpAffine(img, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------- субтитры ----------

SUB_X, SUB_CY, SUB_W, SUB_SIZE, ROW = 960, 990, 1500, 50, 34
SUB_STEMS = [
    (GREEN, ("тело", "результат", "вверх", "наверх")),
    (YELLOW, ("тень", "тени", "попытк", "ловушк")),
    (RED, ("вниз",)),
    (BLUE, ("двойное", "двойная", "дно", "флаг", "шест", "вершина", "даблю")),
]


def word_color(w):
    n = norm(w)
    return next((col for col, stems in SUB_STEMS if n.startswith(stems)), WHITE)


def build_subs():
    chunks = []
    for li, ln in enumerate(LINES):
        disp = []
        for tok in ln["text"].split():
            if tok == "—" and disp:
                disp[-1] += " —"
            else:
                disp.append(tok)
        if len(disp) != len(ln["words"]):
            continue
        timed = []
        for d, (_, s, _) in zip(disp, ln["words"]):
            shown = d.replace("дабл-ю", "«W»")
            shown = "".join(c.lower() if i and c.isupper() and shown[i - 1].isalpha() and shown[i - 1].islower() else c
                            for i, c in enumerate(shown))
            timed.append(dict(word=shown, t=VOICE_AT[li] + s, color=word_color(d)))
        groups, rows = [], [[]]
        for tk in timed:
            row = rows[-1]
            if row and sum(len(x["word"]) + 1 for x in row) + len(tk["word"]) > ROW:
                if len(rows) == 2:
                    groups.append(rows)
                    rows = [[]]
                else:
                    rows.append([])
            rows[-1].append(tk)
            if tk["word"][-1] in ".?!…":
                groups.append(rows)
                rows = [[]]
        if rows[0]:
            groups.append(rows)
        for rows in groups:
            chunks.append(dict(line=li, start=rows[0][0]["t"] - 0.05, rows=rows, line_end=VOICE_AT[li] + ln["duration"]))
    for k, c in enumerate(chunks):
        nxt = chunks[k + 1] if k + 1 < len(chunks) else None
        c["end"] = nxt["start"] if nxt else c["line_end"] + 0.5
        if nxt and nxt["line"] != c["line"]:
            c["end"] = min(c["line_end"] + 0.35, nxt["start"])
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
    c = next((c for c in CHUNKS if c["start"] <= t < c["end"]), None)
    if c is None:
        return
    f = font(SUB_SIZE)
    widest = max(sum(f.getlength(tk["word"]) for tk in row) + f.getlength(" ") * (len(row) - 1) for row in c["rows"])
    fs = max(10, int(SUB_SIZE * min(1.0, SUB_W / widest)))
    stroke_w = max(3, int(fs * 0.13))
    f = font(fs)
    space, lh = f.getlength(" "), fs * 1.18
    for r, row in enumerate(c["rows"]):
        x = SUB_X - (sum(f.getlength(tk["word"]) for tk in row) + space * (len(row) - 1)) / 2
        cy = SUB_CY - lh * (len(c["rows"]) - 1) / 2 + lh * r
        for tk in row:
            fill, outline, mcy, pad = text_pair(tk["word"], fs, stroke_w)
            on = t >= tk["t"] - 0.03
            blit(frame, outline, x - pad, cy - mcy, SHADE, 0.9)
            blit(frame, fill, x - pad, cy - mcy, tk["color"] if on else (150, 170, 150), 1.0 if on else 0.8)
            x += f.getlength(tk["word"]) + space


# ---------- свои надписи из редактора ----------

CUSTOM = A.PROJECT.get("custom_texts", [])


def draw_custom(img, t):
    for c in CUSTOM:
        a0, dur = float(c.get("start", 0)), float(c.get("duration", 2.5))
        if not (a0 <= t < a0 + dur) or not c.get("text", "").strip():
            continue
        p, fade = clamp01((t - a0) / 0.4), clamp01((a0 + dur - t) / 0.3)
        rows = c["text"].split("\n")[:3]
        size = int(c.get("size", 90))
        cx, cy = float(c.get("x", 0.5)) * W, float(c.get("y", 0.2)) * H
        for r, s in enumerate(rows):
            from kit import text_box
            fs = fit(s, size, W * 0.86)
            m, x0, y0 = text_box(s, fs, cx, cy + (r - (len(rows) - 1) / 2) * fs * 1.2)
            if p < 1:
                m = m * np.clip(((m.shape[1] + 0.45 * fs) * p - np.arange(m.shape[1])) / (0.45 * fs), 0, 1)[None]
            a = chalk_alpha(m, x0, y0, 0.94) * fade
            h, w = a.shape
            X0, Y0, X1, Y1 = max(x0, 0), max(y0, 0), min(x0 + w, W), min(y0 + h, H)
            if X0 < X1 and Y0 < Y1:
                aa = a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
                img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - aa) + np.array(COL.get(c.get("color"), WHITE), np.float32) * aa


def render_frame(t):
    img = camera(render_board(t), t)
    draw_custom(img, t)
    if A.PROJECT.get("subtitles", True):
        draw_subs(img, t)
    return np.clip(img, 0, 255).astype(np.uint8)


# ---------- сборка ----------

def main():
    print("главы:", " | ".join(f"{a:.1f}" for a in A.CUTS[:-1]), f"→ {DURATION:.1f} с, элементов {len(B.ELEMENTS)}")
    out = A.BUILD
    if len(sys.argv) > 1 and sys.argv[1] == "--seq":
        t0, dur = float(sys.argv[2]), float(sys.argv[3])
        times = [t0 + k / FPS for k in range(int(round(dur * FPS)))]
        tiles = [cv2.resize(render_frame(tt), (384, 216), interpolation=cv2.INTER_AREA) for tt in times]
        for tile, tt in zip(tiles, times):
            cv2.putText(tile, f"{tt:.2f}", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 4)
        cv2.imwrite(str(out / "seq.png"), np.vstack([np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)]))
        return
    if len(sys.argv) > 1:
        tiles = [cv2.resize(render_frame(float(a)), (640, 360), interpolation=cv2.INTER_AREA) for a in sys.argv[1:]]
        for tile, a in zip(tiles, sys.argv[1:]):
            cv2.putText(tile, a, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 3)
        cv2.imwrite(str(out / "sheet.png"), np.vstack([np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)]))
        return
    total = round(DURATION * FPS)
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", AUDIO, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
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
