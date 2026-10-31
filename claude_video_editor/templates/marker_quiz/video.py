"""Шаблон «Блиц на белой доске»: три графика подряд, отсчёт, ответ, счёт в трёх квадратиках.

Проект — папка VPROJ_DIR (распакованный .vproj); тексты на экране — project.json → texts.
python video.py                 — собрать MP4 в VPROJ_OUT
python video.py 0.5 4.2 ...     — кадры на эти секунды в build/sheet.png
python video.py --seq 23.0 0.3  — каждый кадр отрезка в build/seq.png
"""
import os
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np

import audio as A
from audio import LINES, VOICE_AT, norm
from marker_kit import (BLUE, GHOST, GREEN, GREY, H, INK, PAPER, PAPER_WHITE, RED, W, YELLOW, Ink, bold, chain, check,
                        clamp01, doodle_arrow, draw_eraser, ease_io, ease_out, ellipse_path, fit, font, line, poly_mask,
                        rrect_path, seed, swept, text_box, text_pair, wobbly, write)

FPS = int(A.PROJECT.get("fps", 60))
VIDEO_OUT = os.environ.get("VPROJ_OUT", str(A.BUILD / "video.mp4"))
AUDIO = A.OUT + ".wav"
DURATION = round(A.DURATION * FPS) / FPS
OUT_W, OUT_H = W, H
TEXT_DEFAULTS = {"title": "УГАДАЙ СВЕЧУ #4", "final": "ФИНАЛ", "btn_up": "ВВЕРХ ↑", "btn_down": "ВНИЗ ↓",
                 "word1": "ЛОВУШКА", "word2": "ДВОЙНОЕ ДНО", "word3": "ФЛАГ",
                 "ask": "СКОЛЬКО ИЗ 3?", "end": "СЕРИЯ ЗАВЕРШЕНА"}
TEXTS = {**TEXT_DEFAULTS, **A.PROJECT.get("texts", {})}
# дорожка «Тексты на экране» в редакторе: ключ, номер в списке, подпись, событие появления (None — с начала)
TEXT_TRACK = [("title", None, "Заголовок", None), ("final", None, "«Финал»", "T_FINAL"),
              ("btn_up", None, "Кнопка «вверх»", "T_BTN1"), ("btn_down", None, "Кнопка «вниз»", "T_BTN1"),
              ("word1", None, "Слово ответа 1", "T_WORD1"), ("word2", None, "Слово ответа 2", "T_WORD2"),
              ("word3", None, "Слово ответа 3", "T_WORD3"), ("ask", None, "Вопрос в конце", "T_ASK"),
              ("end", None, "Конец серии", "T_END")]

# безопасная зона TikTok: сверху 10%, снизу 20%, справа 15%
MID_X = 485
WIPE = A.WIPE_DUR


# ---------- квадратики со счётом ----------

SMALL_S, SMALL_Y, SMALL_DX = 84, 226, 124      # полоса над графиком
BIG_S, HOOK_Y, FINAL_Y, BIG_DX = 200, 830, 700, 270
ANSWER = (("down", RED), ("up", GREEN), ("up", GREEN))


def box_state(k, t):
    """Положение и размер квадратика: крупно на крючке, мелко над графиками, снова крупно в финале."""
    to_small = ease_io((t - A.T_BOARD[0]) / 0.6)
    to_big = ease_io((t - A.T_BOARD[3] - 0.1) / 0.6)
    small = (MID_X + (k - 1) * SMALL_DX, SMALL_Y, SMALL_S)
    hook = (MID_X + (k - 1) * BIG_DX, HOOK_Y, BIG_S)
    big = (MID_X + (k - 1) * BIG_DX, FINAL_Y, BIG_S)
    a = tuple(h + (s - h) * to_small for h, s in zip(hook, small))
    cx, cy, s = tuple(u + (b - u) * to_big for u, b in zip(a, big))
    if t >= A.T_TAPS[k]:                       # стук: квадратик подпрыгивает
        s *= 1 + 0.14 * np.sin(np.pi * clamp01((t - A.T_TAPS[k]) / 0.26))
    return cx, cy, s


def g_boxes(ink, t):
    for k in range(3):
        p = (t - A.BOXES[k]) / 0.16
        if p <= 0:
            continue
        cx, cy, s = box_state(k, t)
        line(ink, rrect_path(cx, cy, s, s, s * 0.09, seed("box", k)), p, INK, max(5, s * 0.035))
        q = (t - A.ANS[k]) / 0.28
        if q > 0:
            way, col = ANSWER[k]
            top, bottom = (cx, cy - 0.3 * s), (cx, cy + 0.3 * s)
            pts = wobbly(*((top, bottom) if way == "down" else (bottom, top)), seed("ans", k), 0.02 * s, 6, 0)
            doodle_arrow(ink, pts, q, col, max(7, s * 0.075), 0.25 * s)
        else:
            size = int(s * 0.56)
            write(ink, str(k + 1), size, cx, cy, (p - 0.5) * 2, GREY)


# ---------- кнопки и отсчёт ----------

BTN_Y, BTN_W, BTN_H = 1252, 380, 118
BTN_X = {"up": 262, "down": 698}
BTN_COL = {"up": GREEN, "down": RED}
COUNT_X, COUNT_Y = (215, 485, 755), 1092


def g_buttons(ink, t, t0, idx):
    """Кнопки появляются перед отсчётом; на ответе верная обводится, другая гаснет."""
    right = ANSWER[idx][0]
    for key in ("up", "down"):
        p = (t - t0 - (0.12 if key == "down" else 0)) / 0.22
        if p <= 0:
            continue
        x, col = BTN_X[key], BTN_COL[key]
        fade = 1.0 if key == right or t < A.ANS[idx] else max(0.28, 1 - (t - A.ANS[idx]) / 0.2)
        line(ink, rrect_path(x, BTN_Y, BTN_W, BTN_H, 24, seed("btn", key, idx)), p, col, 7, fade)
        text = TEXTS["btn_" + key]
        write(ink, text, fit(text, 62, BTN_W - 50), x, BTN_Y, p, col, opacity=fade)
    q = (t - A.ANS[idx] - 0.04) / 0.3
    if q > 0:
        line(ink, ellipse_path(BTN_X[right], BTN_Y, BTN_W * 0.54, BTN_H * 0.72, seed("ring", idx)), q, BTN_COL[right], 9)


def g_count(ink, t, idx):
    for k in range(3):
        c = A.COUNTS[idx * 3 + k]
        fade = 1 - clamp01((t - A.ANS[idx]) / 0.18)
        if fade > 0:
            write(ink, f"{3 - k}…", 136, COUNT_X[k], COUNT_Y, (t - c) / 0.2, RED if k == 2 else INK, opacity=fade)


# ---------- свечи ----------

def candle(ink, x, o, h, l, c, bw, p, sd, color=None, thick=4):
    """Свеча маркером: тени, тело, контур. Значения уже в пикселях (меньше — выше)."""
    p = clamp01(p)
    if p <= 0:
        return
    color = color or (GREEN if c <= o else RED)
    yt, yb = sorted((o, c))
    yb = max(yb, yt + 5)
    if h < yt:
        line(ink, wobbly((x, h), (x, yt), sd, 0.6, 6, 1), p / 0.3, INK, thick)
    if l > yb:
        line(ink, wobbly((x, yb), (x, l), sd + 1, 0.6, 6, 1), p / 0.3, INK, thick)
    q = clamp01((p - 0.2) / 0.8)
    if q > 0:
        m, x0, y0 = poly_mask(np.array([(x - bw, yt), (x + bw, yt), (x + bw, yb), (x - bw, yb)]), 1, fill=True)
        rows = np.arange(m.shape[0], dtype=np.float32) / m.shape[0]
        m = m * np.clip((q * 1.15 - (rows if c > o else 1 - rows)) / 0.15, 0, 1)[:, None]
        ink.mask(m, x0, y0, color, 0.94)
        line(ink, chain([(x - bw, yt), (x + bw, yt), (x + bw, yb), (x - bw, yb), (x - bw, yt)], sd + 2, 0.7), q, INK, thick + 1)


def run(ink, t, candles, xs, t0, step, dur, bw, name):
    for i, (o, h, l, c) in enumerate(candles):
        candle(ink, xs[i], o, h, l, c, bw, (t - t0 - i * step) / dur, seed(name, i))


# ---------- график 1: ловушка ----------

LEVEL1 = 540
P1 = [(880, 806, 900, 822), (822, 752, 838, 766), (766, 700, 780, 712), (712, 640, 724, 650), (650, 582, 662, 594),
      (594, LEVEL1, 640, 626), (626, 612, 712, 700), (700, 688, 770, 758), (758, 672, 770, 684), (684, 610, 696, 622),
      (622, LEVEL1, 650, 632), (632, 620, 700, 690), (690, 610, 700, 622)]
X1 = [96 + 44 * i for i in range(14)]
TRAP_O, TRAP_H, TRAP_C = 620, 372, 664       # тень прокалывает уровень, тело закрывается под ним
DROP1 = [(664, 654, 762, 750), (750, 740, 848, 836), (836, 826, 934, 922), (922, 912, 1004, 994)]
XD1 = [X1[-1] + 44 * (k + 1) for k in range(4)]
BOUNCE1 = (X1[5], X1[10])


def trap_candle(ink, t):
    """Голос говорит «тень проколола» — поэтому сначала растёт тонкая тень, а тело решается только на закрытии."""
    a, b = ease_out((t - A.T_PIERCE) / 0.5), ease_io((t - A.T_CLOSE1) / 0.42)
    if t < A.T_PIERCE - 0.12:
        return
    h = TRAP_O + (TRAP_H - TRAP_O) * a
    c = TRAP_O - 22 + (TRAP_C - TRAP_O + 22) * b
    candle(ink, X1[13], TRAP_O, h, TRAP_C + 14, c, 17, 1.0, seed("trap"), RED if c > TRAP_O else GREEN)


def page1(ink, t):
    step = max(0.03, (A.T_PIERCE - 0.15 - A.T_DRAW1 - 0.2) / len(P1))
    run(ink, t, P1, X1, A.T_DRAW1, step, 0.2, 17, "p1")
    line(ink, wobbly((60, LEVEL1), (880, LEVEL1 - 3), seed("lvl1"), 1.6, 12), (t - A.T_LEVEL1) / 0.35, BLUE, 8)
    for k, x in enumerate(BOUNCE1):
        line(ink, ellipse_path(x, LEVEL1 + 18, 40, 44, seed("b1", k)), (t - A.T_LEVEL1 - 0.3 - 0.25 * k) / 0.22, BLUE, 5)
    trap_candle(ink, t)
    run(ink, t, DROP1, XD1, A.ANS[0] + 0.12, 0.16, 0.2, 17, "d1")
    g_buttons(ink, t, A.T_BTN1, 0)
    g_count(ink, t, 0)
    if t >= A.T_WORD1:
        k = 1 + 0.5 * (1 - ease_out((t - A.T_WORD1) / 0.14))
        text = TEXTS["word1"]
        bold(ink, text, int(fit(text, 124, 570) * k), 345, 430, YELLOW)
    line(ink, ellipse_path(X1[13], TRAP_C, 42, 44, seed("close1")), (t - A.T_TAIL1) / 0.25, RED, 7)


# ---------- график 2: двойное дно ----------

W2 = [(92, 410), (232, 880), (372, 618), (512, 880), (636, 628)]
LEVEL2, NECK = 884, 614
CANDLE2 = 676
LAST2 = (690, 546, 700, 560)
RISE2 = [(560, 480, 570, 490), (490, 410, 500, 420), (420, 338, 430, 350)]
XR2 = [730, 784, 838]


def w_part(t):
    """Доля пути W к моменту t: перо доходит до дна точно на звук касания."""
    seg = np.hypot(*np.diff(np.array(W2, float), axis=0).T)
    keys = [A.T_DRAW2, A.T_TOUCH[0], (A.T_TOUCH[0] + A.T_TOUCH[1]) / 2, A.T_TOUCH[1], A.T_NECK + 0.15]
    return np.interp(t, keys, np.r_[0, np.cumsum(seg)] / seg.sum())


def page2(ink, t):
    line(ink, wobbly((60, LEVEL2), (880, LEVEL2 - 2), seed("lvl2"), 1.6, 12), (t - A.T_DRAW2) / 0.35, BLUE, 8)
    pts = chain(W2, seed("w"), 1.6)
    line(ink, pts, w_part(t), INK, 11)
    for k, x in enumerate((W2[1][0], W2[3][0])):
        q = (t - A.T_TOUCH[k]) / 0.25
        line(ink, ellipse_path(x, LEVEL2 - 4, 44, 40, seed("t2", k)), q, BLUE, 6)
    p = (t - A.T_NECK) / 0.5
    if p > 0:
        for j in range(int(np.ceil(13 * clamp01(p)))):     # пунктир рисуется штрих за штрихом
            x = 70 + j * 62
            line(ink, wobbly((x, NECK), (x + 36, NECK), seed("dash", j), 0.8, 8, 0), 1.0, BLUE, 7)
    o, h, l, c = LAST2
    a = ease_out((t - A.T_CLOSE2) / 0.42)
    cc = o + (c - o) * a
    candle(ink, CANDLE2, o, min(h + (o - h) * (1 - a), cc), l, cc, 19, 1.0 if t >= A.T_CLOSE2 else 0, seed("last2"))
    run(ink, t, RISE2, XR2, A.ANS[1] + 0.18, 0.15, 0.2, 19, "r2")
    g_buttons(ink, t, A.T_BTN2, 1)
    g_count(ink, t, 1)
    if t >= A.T_WORD2:
        k = 1 + 0.25 * (1 - ease_out((t - A.T_WORD2) / 0.16))
        text = TEXTS["word2"]
        bold(ink, text, int(fit(text, 104, 790) * k), MID_X, 1030, BLUE, PAPER_WHITE)


# ---------- график 3: флаг ----------

POLE_LOW, POLE_TOP = 1010, 668                                    # рывок; ответ поднимается ровно на столько же
POLE = [(POLE_LOW, 886, 1022, 896), (896, 782, 906, 790), (790, POLE_TOP, 800, 680)]
XP = [190, 238, 286]
BASE3 = [(1016, 1004, 1030, 1008), (1008, 1000, 1024, 1014), (1014, 1002, 1028, 1010)]   # ровное начало перед рывком
XB = [88, 116, 144]
SLIP = [(684, 678, 734, 720), (720, 690, 740, 696), (696, 690, 762, 746), (746, 718, 766, 726),
        (726, 718, 786, 772), (772, 744, 794, 752)]
XS = [344, 386, 428, 470, 512, 554]
UP_A, UP_B = ((316, 654), (606, 716)), ((316, 764), (606, 826))   # коридор: верхняя и нижняя линии
BREAK = (606, 788, 646, 660, 798)                                  # x, открытие, макс, закрытие, мин
RISE_TOP = BREAK[3] - (POLE_LOW - POLE_TOP)
RISE3 = [(660, 540, 670, 548), (548, 430, 558, 438), (438, RISE_TOP, 448, RISE_TOP + 10)]
XR3 = [664, 722, 780]


def channel(t):
    a, b = t - A.T_CHANNEL, t - A.T_CHANNEL - 0.3
    return clamp01(a / 0.3), clamp01(b / 0.3)


def page3(ink, t):
    run(ink, t, BASE3, XB, A.T_DRAW3, 0.08, 0.14, 10, "base")
    run(ink, t, POLE, XP, A.T_POLE, max(0.06, (A.T_RISE - A.T_POLE - 0.16) / len(POLE)), 0.16, 21, "pole")
    step = max(0.06, (A.T_CLOSE3 - A.T_SLIDE - 0.34) / len(SLIP))
    run(ink, t, SLIP, XS, A.T_SLIDE, step, 0.18, 13, "slip")
    p, q = channel(t)
    line(ink, wobbly(*UP_A, seed("ch", 0), 1.2, 10), p, BLUE, 6)
    line(ink, wobbly(*UP_B, seed("ch", 1), 1.2, 10), q, BLUE, 6)
    if q >= 1:                    # контур флажка: лёгкая штриховка между линиями и короткое замыкание
        line(ink, wobbly(UP_A[1], UP_B[1], seed("ch", 2), 1.0, 8), (t - A.T_CHANNEL - 0.6) / 0.2, BLUE, 5)
        line(ink, wobbly(UP_A[0], UP_B[0], seed("ch", 3), 1.0, 8), (t - A.T_CHANNEL - 0.8) / 0.2, BLUE, 5)
    x, o, h, c, l = BREAK
    a = ease_out((t - A.T_CLOSE3) / 0.42)
    cc = o + (c - o) * a
    if t >= A.T_CLOSE3:
        candle(ink, x, o, min(o, cc) - 10, l, cc, 19, 1.0, seed("brk"))
    run(ink, t, RISE3, XR3, A.ANS[2] + 0.18, 0.16, 0.2, 26, "r3")
    g_buttons(ink, t, A.T_BTN3, 2)
    g_count(ink, t, 2)
    if t >= A.T_WORD3:
        k = 1 + 0.3 * (1 - ease_out((t - A.T_WORD3) / 0.16))
        text = TEXTS["word3"]
        bold(ink, text, int(fit(text, 128, 420) * k), 610, 940, GREEN, PAPER_WHITE)
        for (x0, y0, y1, sd) in ((62, POLE_LOW, POLE_TOP, "m0"), (838, BREAK[3], RISE_TOP, "m1")):   # две равные высоты
            pts = wobbly((x0, y0), (x0, y1), seed(sd), 1.2, 10, 0)
            doodle_arrow(ink, pts, (t - A.T_WORD3 - 0.15) / 0.3, GREY, 6, 20)


# ---------- крючок и финал ----------

def page0(ink, t):
    write(ink, TEXTS["title"], fit(TEXTS["title"], 92, 800), MID_X, 345, 0.5 + t / 0.3)   # первый кадр уже читается
    if t >= A.T_FINAL:
        k = 1 + 0.35 * (1 - ease_out((t - A.T_FINAL) / 0.14))
        text = TEXTS["final"]
        bold(ink, text, int(fit(text, 150, 620) * k), MID_X, 520, RED, PAPER_WHITE)


def page4(ink, t):
    if t >= A.T_ASK:
        write(ink, TEXTS["ask"], fit(TEXTS["ask"], 104, 800), MID_X, 960, (t - A.T_ASK) / 0.45)
    p = (t - A.T_END) / 0.65
    text = TEXTS["end"]
    size = fit(text, 74, 650)
    write(ink, text, size, MID_X - 45, 1140, p, GREEN)
    cx = MID_X - 45 + font(size).getlength(text) / 2 + 58
    check(ink, cx, 1136, 88, (t - A.T_TICK) / 0.25, GREEN, 12, seed("tick"))


PAGES = [(0.0, A.T_BOARD[0], page0), (A.T_BOARD[0], A.T_BOARD[1], page1), (A.T_BOARD[1], A.T_BOARD[2], page2),
         (A.T_BOARD[2], A.T_BOARD[3], page3), (A.T_BOARD[3], 1e9, page4)]


def render_board(t):
    img = PAPER.copy()
    eraser = 0.0
    for t0, t1, page in PAGES:
        if t < t0 or t > t1 + WIPE + 0.7:
            continue
        ink = Ink()
        page(ink, t)
        if t > t1:
            p = ease_io((t - t1) / WIPE)
            ghost = 0.05 * GHOST * clamp01(1 - (t - t1 - WIPE) / 0.7)
            ink.scale(1 - swept(p) * (1 - ghost))
            eraser = p
        ink.onto(img)
    top = Ink()
    g_boxes(top, t)
    top.onto(img)
    draw_eraser(img, eraser)
    return img


# ---------- камера ----------

def camera(img, t):
    """Медленное дыхание камеры без рывков на склейках и толчок на ответах; масштаб ≥ 1, края не видны."""
    k = 1.0 + 0.008 * (1 - np.cos(2 * np.pi * t / 9))
    dy = 0.0
    for ta in (*A.ANS, A.T_WORD1):
        a = t - ta
        if 0 <= a < 0.3:
            k += 0.022 * (1 - a / 0.3)
            dy += 7 * np.sin(a * 62) * (1 - a / 0.3)
    m = cv2.getRotationMatrix2D((MID_X, 800), 0, k)
    m[1, 2] += dy
    return cv2.warpAffine(img, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


# ---------- субтитры ----------

SUB_X, SUB_CY, SUB_W, SUB_SIZE, ROW = MID_X, 1438, 830, 72, 20
SUB_STEMS = [
    (GREEN, ("вверх", "взлет", "закрытие")),
    (RED, ("вниз", "ложный", "ловушк", "пробой")),
    (BLUE, ("уровень", "дна", "двойное", "дно", "коридор", "флаг", "пунктир")),
]
SHOWN_GREY = (165, 165, 165)


def word_color(w):
    n = norm(w)
    return next((col for col, stems in SUB_STEMS if n.startswith(stems)), INK)


def tail(row):
    """Сколько слов с конца строки лучше унести дальше: всё после запятой или висячий предлог."""
    comma = next((k for k in range(len(row) - 2, -1, -1) if row[k]["word"][-1] == ","), None)
    if comma is not None:
        return len(row) - 1 - comma
    return 1 if len(row) > 1 and len(row[-1]["word"]) <= 2 else 0


def build_subs():
    chunks = []
    for li, ln in enumerate(LINES):
        if ln["emotion"] == "count":    # отсчёт и так крупно на доске
            continue
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
            shown = "".join(c.lower() if i and c.isupper() and d[i - 1].isalpha() and d[i - 1].islower() else c
                            for i, c in enumerate(d))
            timed.append(dict(word=shown, t=VOICE_AT[li] + s, color=word_color(d)))
        groups, rows = [], [[]]
        for tk in timed:
            row = rows[-1]
            if row and sum(len(x["word"]) + 1 for x in row) + len(tk["word"]) > ROW:
                n = tail(row)
                moved = row[len(row) - n:]
                del row[len(row) - n:]
                if len(rows) == 2:
                    groups.append(rows)
                    rows = [moved]
                else:
                    rows.append(moved)
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
            c["end"] = min(c["line_end"] + 0.3, nxt["start"])
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
    if not A.PROJECT.get("subtitles", True):
        return
    c = next((c for c in CHUNKS if c["start"] <= t < c["end"]), None)
    if c is None:
        return
    f = font(SUB_SIZE)
    widest = max(sum(f.getlength(tk["word"]) for tk in row) + f.getlength(" ") * (len(row) - 1) for row in c["rows"])
    fs = max(10, int(SUB_SIZE * min(1.0, SUB_W / widest)))
    stroke_w = max(4, int(fs * 0.13))
    f = font(fs)
    space, lh = f.getlength(" "), fs * 1.2
    for r, row in enumerate(c["rows"]):
        x = SUB_X - (sum(f.getlength(tk["word"]) for tk in row) + space * (len(row) - 1)) / 2
        cy = SUB_CY - lh * (len(c["rows"]) - 1) / 2 + lh * r
        for tk in row:
            fill, outline, mcy, pad = text_pair(tk["word"], fs, stroke_w)
            on = t >= tk["t"] - 0.03
            blit(frame, outline, x - pad, cy - mcy, PAPER_WHITE, 0.92)
            blit(frame, fill, x - pad, cy - mcy, tk["color"] if on else SHOWN_GREY, 1.0)
            x += f.getlength(tk["word"]) + space


# ---------- свои надписи из редактора ----------

CUSTOM = A.PROJECT.get("custom_texts", [])
COL = {"white": PAPER_WHITE, "yellow": YELLOW, "green": GREEN, "red": RED, "blue": BLUE, "grey": GREY, "ink": INK}


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
            fs = fit(s, size, W * 0.8)
            m, x0, y0 = text_box(s, fs, cx, cy + (r - (len(rows) - 1) / 2) * fs * 1.2)
            if p < 1:
                m = m * np.clip(((m.shape[1] + 0.45 * fs) * p - np.arange(m.shape[1])) / (0.45 * fs), 0, 1)[None]
            blit(img, m, x0, y0, COL.get(c.get("color"), INK), fade)


def render_frame(t):
    img = camera(render_board(t), t)
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
        tiles = [cv2.resize(render_frame(tt), (216, 384), interpolation=cv2.INTER_AREA) for tt in times]
        for tile, tt in zip(tiles, times):
            cv2.putText(tile, f"{tt:.3f}", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 6)
        cv2.imwrite(str(out / "seq.png"), np.vstack([np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles), 6)]))
        return
    if len(sys.argv) > 1:
        tiles = [cv2.resize(render_frame(float(a)), (360, 640), interpolation=cv2.INTER_AREA) for a in sys.argv[1:]]
        for tile, a in zip(tiles, sys.argv[1:]):
            cv2.putText(tile, a, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 4)
        cv2.imwrite(str(out / "sheet.png"), np.vstack([np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)]))
        return
    total = round(DURATION * FPS)
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
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
