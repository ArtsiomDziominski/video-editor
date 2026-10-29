"""Рисунки урока по главам: что, где и когда рисует мел. Общие для звука (audio.py) и видео (video.py).

Каждый элемент привязан к слову озвучки (word_t) — если фраза изменится, рисунок поедет за словом.
Подписанные элементы попадают в редактор: их можно сдвигать по времени, а надписи — править.
Кадр 1920×1080: рисунок слева (x 90…1210, y 150…880), колонка надписей справа (x 1280…1840), субтитры внизу.
"""
import numpy as np

import audio as A
from audio import at, start, word_t

ELEMENTS = []       # элементы рисунка
SOUND_EVENTS = []   # (время, звук, параметр, что происходит)
TEXT_DEFAULTS = {}  # ключ надписи → текст по умолчанию (в проекте можно переписать)
TEXT_TRACK = []     # дорожка «Тексты на экране» в редакторе
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


def ema(xs, n):
    out, e = [], xs[0]
    a = 2 / (n + 1)
    for x in xs:
        e = e + a * (x - e)
        out.append(e)
    return out


# ---------- вступление ----------

ch = 1
r = np.random.default_rng(3)
chaos = list(np.clip(50 + np.cumsum(r.normal(0, 9, 40)), 8, 94))
C = Chart(110, 28, 170, 850, 0, 100)
candles(ch, C, ohlc_path(chaos, 50, 1, 3.5), 0, 0.4, W_(1, "шум", 0, 0.2), label="Хаотичный график")
txt(ch, "intro_title", "5 ВЕЩЕЙ\nНА ЛЮБОМ ГРАФИКЕ", RX, 250, W_(1, "пять"), size=64, label="Заголовок")
for k in range(5):
    y = 450 + 95 * k
    ring(ch, 1350, y, 34, 34, W_(1, "повторяются", 0, 0.35 * k), color=WHITE, sound="tap")
    txt(ch, f"intro_num{k + 1}", str(k + 1), 1350, y, W_(1, "повторяются", 0, 0.35 * k + 0.15), size=40,
        sound=None, label=f"Кружок {k + 1}")
txt(ch, "intro_riddle", "А В КОНЦЕ — ЗАГАДКА ?", RX + 40, 950 - 80, W_(1, "загадка"), size=40, color=YELLOW,
    label="В конце загадка")

# ---------- глава 1: свеча ----------

ch = 2
plate(ch, "plate1", "1 • СВЕЧА: ТЕЛО И ТЕНИ")
big_candle(ch, 400, 70, 230, 620, 360, 770, GREEN, W_(2, "свеча"), label="Зелёная свеча")
txt(ch, "c1_body", "ТЕЛО", 175, 490, W_(2, "тело"), size=46, label="Подпись «тело»")
arrow(ch, [(250, 490), (318, 490)], W_(2, "тело", 0, 0.3), sound=None)
txt(ch, "c1_wick", "ТЕНЬ", 175, 280, W_(2, "тени"), size=46, label="Подпись «тень»")
arrow(ch, [(250, 285), (385, 290)], W_(2, "тени", 0, 0.3), sound=None)
arrow(ch, [(250, 720), (385, 715)], W_(2, "тени", 0, 0.5), sound=None)
big_candle(ch, 610, 60, 300, 380, 600, 700, RED, W_(2, "красная"), label="Красная свеча")
ring(ch, 400, 295, 42, 78, W_(2, "попытка"), color=YELLOW, label="Тень — попытка")
txt(ch, "c1_try", "ПОПЫТКА", 400, 182, W_(2, "попытка", 0, 0.2), size=40, color=YELLOW, label="ПОПЫТКА")
ring(ch, 400, 490, 90, 155, W_(2, "результат"), color=GREEN, label="Тело — результат")
txt(ch, "c1_result", "РЕЗУЛЬТАТ", 400, 830, W_(2, "результат", 0, 0.2), size=40, color=GREEN, label="РЕЗУЛЬТАТ")
txt(ch, "c1_rule", "ТЕНЬ — ПОПЫТКА,\nТЕЛО — РЕЗУЛЬТАТ", RX, 250, W_(2, "результат", 0, 0.8), size=50,
    label="Правило главы")
big_candle(ch, 820, 50, 200, 640, 570, 690, GREEN, W_(2, "сверху"), label="Длинная тень сверху", sound="whoosh")
arrow(ch, [(880, 210), (880, 330)], W_(2, "смогли"), color=RED, thick=6, head=24)
big_candle(ch, 1010, 50, 300, 340, 410, 770, RED, W_(2, "снизу"), label="Длинная тень снизу")
arrow(ch, [(1070, 760), (1070, 640)], W_(2, "дали"), color=GREEN, thick=6, head=24)
big_candle(ch, 1400, 60, 470, 480, 760, 770, GREEN, W_(2, "большое"), label="Большое тело")
txt(ch, "c1_strong", "ОДНА СТОРОНА\nПОБЕДИЛА", 1400, 860, W_(2, "победила"), size=30, label="Победила")
big_candle(ch, 1720, 50, 430, 600, 620, 810, GREY, W_(2, "крошечное"), label="Нерешительность")
txt(ch, "c1_doji", "НИКТО НЕ\nПОБЕДИЛ", 1720, 880, W_(2, "никто"), size=30, label="Никто не победил")

# ---------- глава 2: уровни ----------

ch = 3
plate(ch, "plate2", "2 • УРОВНИ")
C = Chart(120, 32, 230, 860, 30, 100)
LV = 85
path = [40, 48, 55, 66, 76, 84.5, 78, 70, 63, 69, 77, 84.6, 76, 67, 60, 66, 74, 80, 84.4, 75, 68, 62, 67, 72, 76, 79]
data = ohlc_path(path, 34, 2, 1.4)
data = [(o, min(h, LV + (0.4 if abs(c - 84.5) < 0.3 else -0.6)), lo, c) for o, h, lo, c in data]
candles(ch, C, data, 0, start(3) + 0.6, W_(3, "отскакивает", 0, 0.3), label="График целиком")
for k, i in enumerate((5, 11, 18)):
    ring(ch, C.x(i), C.y(LV), 30, 26, W_(3, "высоту", 0, 0.35 * k), color=YELLOW, sound="tap")
line(ch, [(100, C.y(LV)), (1190, C.y(LV))], W_(3, "горизонтальную"), 0.7, color=BLUE, thick=7, label="Линия уровня")
band(ch, 100, 1190, C.y(LV) - 22, C.y(LV) + 22, W_(3, "зона"), label="Зона")
txt(ch, "c2_zone", "ЗОНА, А НЕ ЛИНИЯ", RX, 250, W_(3, "зона", 0, 0.3), size=46, label="Зона, а не линия")
txt(ch, "c2_older", "СТАРШИЕ ГРАФИКИ\nСИЛЬНЕЕ", RX, 360, W_(3, "старших"), size=40, label="Старшие графики")
txt(ch, "c2_few", "ДВА-ТРИ УРОВНЯ\nДОСТАТОЧНО", RX, 480, W_(3, "очевидных"), size=40, label="Два-три уровня")
up = ohlc_path([90, 97], 79, 3, 1.0)
back = ohlc_path([93, 88.5, 86], 97, 4, 1.0)
back = [(o, h, min(lo, LV - 0.3) if k == 2 else lo, c) for k, (o, h, lo, c) in enumerate(back)]
bounce = ohlc_path([92, 98, 99], 86, 5, 1.0)
candles(ch, C, up, 26, W_(3, "пробивают"), W_(3, "пробивают", 0, 0.6), label="Пробой уровня", sound="whoosh")
candles(ch, C, back, 28, W_(3, "возвращается"), W_(3, "возвращается", 0, 0.9), label="Возврат к уровню")
candles(ch, C, bounce, 31, W_(3, "отталкивается"), W_(3, "отталкивается", 0, 0.7), label="Отскок вверх")
ring(ch, C.x(30), C.y(LV), 34, 30, W_(3, "касается"), color=GREEN, label="Касание сверху")
SOUND_EVENTS.append((W_(3, "отталкивается", 0, 0.2), "ding", 0, "отскок сверху"))
txt(ch, "c2_flip", "ПОТОЛОК → ПОЛ", RX, 640, W_(3, "потолком"), size=60, color=YELLOW, label="Потолок → пол")
line(ch, [(RX - 230, 690), (RX + 230, 692)], W_(3, "потолок"), 0.4, color=YELLOW, thick=6)

# ---------- глава 3: направление и боковик ----------

ch = 4
plate(ch, "plate3", "3 • НАПРАВЛЕНИЕ И БОКОВИК")
endA = W_(4, "второй", 0, -0.4)
upz = [(120, 780), (200, 640), (270, 700), (350, 540), (420, 610), (500, 440), (570, 520), (640, 340)]
line(ch, upz, W_(4, "направление", 0, 0.3), 2.5, color=WHITE, thick=6, label="Зигзаг вверх", end=endA, end_mode="dissolve")
dots(ch, upz[1:], W_(4, "вершина", 1), 0.25, color=GREEN, label="Вершины выше", end=endA, end_mode="dissolve")
arrow(ch, [(150, 840), (620, 300)], W_(4, "вверх"), 0.5, color=GREEN, thick=10, head=46, label="Стрелка вверх",
      end=endA, end_mode="dissolve", sound="whoosh")
dnz = [(700, 330), (780, 470), (850, 410), (930, 570), (1000, 500), (1080, 680), (1150, 610), (1200, 790)]
line(ch, dnz, W_(4, "наоборот"), 1.0, color=WHITE, thick=6, label="Зигзаг вниз", end=endA, end_mode="dissolve")
dots(ch, dnz[1:], W_(4, "снижаются"), 0.2, color=RED, end=endA, end_mode="dissolve")
arrow(ch, [(720, 280), (1190, 840)], W_(4, "вниз"), 0.5, color=RED, thick=10, head=46, label="Стрелка вниз",
      end=endA, end_mode="dissolve", sound="whoosh")
txt(ch, "c3_peaks", "ВЕРШИНЫ ВЫШЕ\n= ВВЕРХ", RX, 250, W_(4, "вверх", 0, 0.4), size=48, label="Вершины выше = вверх",
    end=endA, end_mode="dissolve")
endB = W_(4, "боковик", 0, -0.4)
C = Chart(120, 33, 200, 860)
r = np.random.default_rng(7)
trend = list(np.r_[np.linspace(70, 35, 13), np.linspace(36, 82, 19)] + r.normal(0, 2.2, 32))
data = ohlc_path(trend, 72, 8, 2.0)
closes = [c for _, _, _, c in data]
candles(ch, C, data, 0, W_(4, "второй", 0, 0.1), W_(4, "сглаженный"), label="Свечи со средними",
        end=endB, end_mode="dissolve")
slow, fast = ema(closes, 12), ema(closes, 4)
line(ch, [(C.x(i), C.y(v)) for i, v in enumerate(slow)], W_(4, "медленная"), 1.2, color=WHITE, thick=9,
     label="Медленная линия", end=endB, end_mode="dissolve")
line(ch, [(C.x(i), C.y(v)) for i, v in enumerate(fast)], W_(4, "быстрая"), 1.2, color=BLUE, thick=4,
     label="Быстрая линия", end=endB, end_mode="dissolve")
txt(ch, "c3_fast", "БЫСТРАЯ", C.x(31) - 40, C.y(fast[-1]) - 60, W_(4, "быстрая", 0, 0.9), size=34, color=BLUE,
    label="Подпись «быстрая»", end=endB, end_mode="dissolve")
txt(ch, "c3_slow", "МЕДЛЕННАЯ", C.x(31) - 60, C.y(slow[-1]) + 70, W_(4, "медленная", 0, 0.9), size=34,
    label="Подпись «медленная»", end=endB, end_mode="dissolve")
cross_i = next(i for i in range(14, 32) if fast[i] > slow[i])
ring(ch, C.x(cross_i), C.y(slow[cross_i]), 48, 40, W_(4, "пересекаются"), color=GREEN, label="Пересечение",
     end=endB, end_mode="dissolve")
band(ch, C.x(cross_i), 1200, 200, 860, W_(4, "пересекаются", 0, 0.3), color=GREEN, opacity=0.12,
     end=endB, end_mode="dissolve")
txt(ch, "c3_ma", "БЫСТРАЯ ВЫШЕ\nМЕДЛЕННОЙ", RX, 250, W_(4, "медленной"), size=46, label="Быстрая выше медленной",
    end=endB, end_mode="dissolve")
txt(ch, "c3_tf", "СТАРШИЙ — КУДА,\nМЛАДШИЙ — КОГДА", RX, 420, W_(4, "старшем"), size=40, label="Старший и младший",
    end=endB, end_mode="dissolve")
C = Chart(120, 34, 380, 640)
line(ch, [(100, 410), (1190, 410)], W_(4, "боковик", 0, 0.1), 0.6, color=GREY, thick=5, label="Коридор боковика")
line(ch, [(100, 620), (1190, 620)], W_(4, "боковик", 0, 0.4), 0.6, color=GREY, thick=5, sound=None)
side = list(50 + 32 * np.sin(np.arange(30) * 0.9) * np.random.default_rng(9).uniform(0.5, 1, 30))
candles(ch, C, ohlc_path(side, 50, 10, 4), 0, W_(4, "боковик", 0, 0.6), W_(4, "коридоре", 0, 0.8), label="Свечи в боковике")
xs = np.linspace(110, 1180, 40)
line(ch, [(x, 515 + 28 * np.sin(x / 47)) for x in xs], W_(4, "переплетаются"), 1.0, color=BLUE, thick=4,
     label="Переплетённые линии")
line(ch, [(x, 515 + 22 * np.sin(x / 61 + 1.3)) for x in xs], W_(4, "переплетаются", 0, 0.3), 1.0, thick=8, sound=None)
txt(ch, "c3_side", "БОКОВИК — ЖДЁМ", RX, 260, W_(4, "ничего"), size=50, color=YELLOW, label="Боковик — ждём")
el("clock", ch, W_(4, "ничего", 0, 0.4), 0.6, label="Часы", sound="chalk", cx=RX, cy=560, r=110, color=WHITE)
for k in range(6):
    SOUND_EVENTS.append((W_(4, "ничего", 0, 1.0 + k), "tick", 0, "тиканье часов" if k == 0 else ""))
txt(ch, "c3_patience", "ТЕРПЕНИЕ — НАВЫК", RX, 760, W_(4, "терпение"), size=40, label="Терпение — навык")

# ---------- глава 4: пробой и ловушка ----------

ch = 5
plate(ch, "plate4", "4 • ПРОБОЙ И ЛОВУШКА")
endA = W_(5, "проколола", 1, -0.5)
C = Chart(130, 48, 200, 860, 20, 100)
LV = 72
line(ch, [(100, C.y(LV)), (1190, C.y(LV))], W_(5, "помнишь"), 0.6, color=BLUE, thick=7, label="Уровень",
     end=endA, end_mode="dissolve")
appr = [38, 46, 41, 52, 60, 55, 63, 70.5, 64, 68, 71]
d1 = ohlc_path(appr, 32, 11, 1.4)
d1 = [(o, min(h, LV - 0.3), lo, c) for o, h, lo, c in d1]
candles(ch, C, d1, 0, W_(5, "пробивают", 0, -0.6), W_(5, "пробивают", 0, 1.4), label="Подход к уровню",
        end=endA, end_mode="dissolve")
SOUND_EVENTS.append((W_(5, "закрылась", 0, -0.8), "riser", 0.8, "нарастающий вжух"))
brk = [(71, 84, 70, 83), (83, 88, 79, 86)]
candles(ch, C, brk[:1], 11, W_(5, "закрылась"), W_(5, "закрылась", 0, 0.4), label="Закрытие над уровнем",
        end=endA, end_mode="dissolve", sound="whoosh")
candles(ch, C, brk[1:], 12, W_(5, "следующая"), W_(5, "следующая", 0, 0.4), label="Следующая выше",
        end=endA, end_mode="dissolve")
tick_mark(ch, C.x(12) + 60, C.y(92), 90, W_(5, "настоящий"), label="Галочка пробоя", end=endA, end_mode="dissolve")
SOUND_EVENTS.append((W_(5, "настоящий", 0, 0.15), "ding", 0, "динь на галочке"))
txt(ch, "c4_close", "ЗАКРЫТИЕ = ПРОБОЙ", RX, 250, W_(5, "настоящий", 0, 0.3), size=46, color=GREEN,
    label="Закрытие = пробой", end=endA, end_mode="dissolve")
rt = ohlc_path([79, 74.5, 80, 87, 93], 86, 12, 1.0)
rt = [(o, h, max(lo, LV - 0.5) if k == 1 else lo, c) for k, (o, h, lo, c) in enumerate(rt)]
candles(ch, C, rt[:2], 13, W_(5, "вернётся"), W_(5, "вернётся", 0, 0.6), label="Возврат сверху",
        end=endA, end_mode="dissolve")
candles(ch, C, rt[2:], 15, W_(5, "оттолкнётся"), W_(5, "оттолкнётся", 0, 0.6), label="Отталкивается",
        end=endA, end_mode="dissolve")
SOUND_EVENTS.append((W_(5, "оттолкнётся", 0, 0.1), "boing", 0, ""))
C = Chart(130, 52, 200, 860, 15, 95)
LV, LO = 70, 22
line(ch, [(100, C.y(LV)), (1190, C.y(LV))], endA + 0.6, 0.6, color=BLUE, thick=7, label="Новый уровень")
line(ch, [(100, C.y(LO)), (1190, C.y(LO))], endA + 0.9, 0.6, color=GREY, thick=4, dashed=True,
     label="Нижний край коридора")
rng2 = [40, 52, 46, 58, 64, 57, 63, 68]
d2 = ohlc_path(rng2, 32, 13, 1.4)
d2 = [(o, min(h, LV - 0.4), lo, c) for o, h, lo, c in d2]
candles(ch, C, d2, 0, endA + 1.0, W_(5, "проколола", 1, -0.1), label="Подход ко второму уровню")
trap = el("candle", ch, W_(5, "проколола", 1), 0.5, label="Прокол тенью", sound="chalk", x=C.x(8), bw=C.bw,
          yh=C.y(86), yo=C.y(67), yc=C.y(73), yl=C.y(63), color=GREEN, close_at=W_(5, "обратно"), yc2=C.y(64.5),
          color2=RED)
el("swarm", ch, W_(5, "толпа"), 0.6, label="Толпа рванула", sound="whoosh", x=C.x(8) + 90, y=C.y(60), n=9,
   fall=W_(5, "ловушка", 1))
txt(ch, "c4_trap", "ЛОВУШКА!", 760, 230, W_(5, "ловушка", 1), size=86, color=YELLOW, label="ЛОВУШКА", sound="snap",
    dur=0.3, flash=True)
down = ohlc_path([58, 48, 37, 29, 24], 64, 14, 1.5)
candles(ch, C, down, 9, W_(5, "обратную"), W_(5, "краю", 0, 0.3), label="Уход к нижнему краю")
big_candle(ch, 1420, 55, 470, 760, 520, 790, GREEN, W_(5, "силу"), label="Сильная свеча")
txt(ch, "c4_strong", "СИЛА", 1420, 860, W_(5, "силу", 0, 0.5), size=40, color=GREEN, label="СИЛА")
big_candle(ch, 1690, 45, 430, 740, 700, 780, RED, W_(5, "ловушка", 2), label="Свеча-ловушка")
txt(ch, "c4_trap2", "ЛОВУШКА", 1690, 860, W_(5, "ловушка", 2, 0.5), size=40, color=YELLOW, label="Подпись «ловушка»")
txt(ch, "c4_rule", "СМОТРИ НА ЗАКРЫТИЕ,\nА НЕ НА ТЕНЬ", RX, 260, W_(5, "правило"), size=44, label="Правило главы")

# ---------- глава 5: фигуры ----------

ch = 6
plate(ch, "plate5", "5 • ФИГУРЫ: ДВОЙНОЕ ДНО И ФЛАГ")
endA = W_(6, "вторая", 0, -0.4)
C = Chart(130, 46, 200, 860, 15, 90)
LV, NECK = 24, 52
wpath = [74, 66, 57, 46, 35, 25.5, 36, 45, 51.5, 44, 35, 25.4, 34, 42, 49]
dW = ohlc_path(wpath, 80, 15, 1.3)
dW = [(o, h, max(lo, LV) if abs(c - 25.5) < 0.3 else lo, c) for o, h, lo, c in dW]
line(ch, [(100, C.y(LV)), (720, C.y(LV))], W_(6, "падает"), 0.5, color=BLUE, thick=6, label="Уровень дна",
     end=endA, end_mode="dissolve")
candles(ch, C, dW, 0, W_(6, "падает", 0, 0.2), W_(6, "буква", 0, -0.2), label="Буква W", end=endA, end_mode="dissolve")
for k in range(2):
    SOUND_EVENTS.append((W_(6, "отскакивает", k), "boing", 0, "отскок" if k == 0 else ""))
    ring(ch, C.x(5 + 6 * k), C.y(LV), 34, 28, W_(6, "получается", 0, 0.3 * k), color=RED, end=endA, end_mode="dissolve")
line(ch, [(C.x(2), C.y(NECK)), (C.x(18), C.y(NECK))], W_(6, "пунктирная"), 0.6, color=BLUE, thick=5, dashed=True,
     label="Пунктир через вершину", end=endA, end_mode="dissolve")
upW = ohlc_path([57, 66, 74, 80], 49, 16, 1.2)
candles(ch, C, upW, 15, W_(6, "закрылась", 1), W_(6, "закрылась", 1, 0.8), label="Закрытие над пунктиром",
        end=endA, end_mode="dissolve", sound="whoosh")
arrow(ch, [(C.x(19) + 50, C.y(50)), (C.x(19) + 50, C.y(82))], W_(6, "закрылась", 1, 0.9), color=GREEN, thick=9,
      label="Стрелка вверх", end=endA, end_mode="dissolve")
txt(ch, "c5_dd", "ДВОЙНОЕ ДНО", RX, 250, W_(6, "закрылась", 1, 0.6), size=56, color=BLUE, label="ДВОЙНОЕ ДНО",
    end=endA, end_mode="dissolve")
mz = [(RX - 150, 640), (RX - 75, 470), (RX, 560), (RX + 75, 470), (RX + 150, 640)]
line(ch, mz, W_(6, "зеркальная"), 0.7, color=WHITE, thick=6, label="Буква М", end=endA, end_mode="dissolve")
txt(ch, "c5_dt", "ДВОЙНАЯ ВЕРШИНА", RX, 720, W_(6, "вершина"), size=40, color=BLUE, label="Двойная вершина",
    end=endA, end_mode="dissolve")
C = Chart(170, 54, 200, 860, 15, 120)
pole = ohlc_path([30, 42, 54, 66, 76], 20, 17, 1.2)
candles(ch, C, pole, 0, W_(6, "резкий"), W_(6, "рост", 0, 0.6), label="Шест")
txt(ch, "c5_pole", "ШЕСТ", C.x(3) + 110, C.y(32), W_(6, "шест"), size=44, label="Подпись «шест»")
flagp = [73.5, 71, 72.5, 69, 70.5, 67.5]
dF = ohlc_path(flagp, 76, 18, 0.8)
ch_up = lambda i: 78 - 1.6 * (i - 5)
line(ch, [(C.x(4.6), C.y(ch_up(4.6))), (C.x(11.4), C.y(ch_up(11.4)))], W_(6, "коридоре"), 0.5, color=YELLOW, thick=5,
     label="Коридор флага", sound="taps")
line(ch, [(C.x(4.6), C.y(ch_up(4.6) - 9)), (C.x(11.4), C.y(ch_up(11.4) - 9))], W_(6, "коридоре", 0, 0.4), 0.5,
     color=YELLOW, thick=5, sound=None)
candles(ch, C, dF, 5, W_(6, "откат"), W_(6, "маленькими", 0, 0.8), label="Маленькие свечи отката")
fl = [(C.x(4.3), C.y(82)), (C.x(11.8), C.y(70)), (C.x(11.8), C.y(57)), (C.x(4.3), C.y(66)), (C.x(4.3), C.y(82))]
line(ch, fl, W_(6, "флаг", 1), 0.7, color=WHITE, thick=3, label="Контур флажка", opacity=0.6)
txt(ch, "c5_flag", "ФЛАГ", RX, 250, W_(6, "флаг", 1, 0.3), size=60, color=BLUE, label="ФЛАГ")
line(ch, [(C.x(12.4), C.y(60)), (C.x(12.4), C.y(40))], W_(6, "разворот"), 0.4, color=RED, thick=5, dashed=True,
     label="Ожидание разворота")
shoot = ohlc_path([80, 90, 101, 111], 67.5, 19, 1.2)
candles(ch, C, shoot, 11, W_(6, "закрытия"), W_(6, "закрытия", 0, 0.8), label="Рост на высоту шеста", sound="whoosh")
arrow(ch, [(C.x(0) - 55, C.y(28)), (C.x(0) - 55, C.y(76))], W_(6, "высоту", 1), 0.4, color=WHITE, thick=6, head=26,
      label="Мера шеста")
arrow(ch, [(C.x(15) + 60, C.y(68)), (C.x(15) + 60, C.y(116))], W_(6, "высоту", 1, 0.5), 0.4, color=GREEN, thick=6,
      head=26, label="Та же длина")
txt(ch, "c5_good", "ОТКАТ СПОКОЙНЫЙ\nИ НЕГЛУБОКИЙ", RX, 420, W_(6, "главный"), size=42, label="Признак флага")

# ---------- глава 6: всё вместе ----------

ch = 7
plate(ch, "plate6", "6 • ВСЁ ВМЕСТЕ НА ОДНОМ ГРАФИКЕ")
C = Chart(120, 31, 200, 860)
LV = 80
seg1 = [24, 32, 27, 37, 45, 39, 48, 56, 50, 58, 66, 60, 67, 74]
seg2 = [79.4, 73, 68, 74, 79.5, 72]
seg3 = [74.5, 72.5, 75, 73, 76]
d1 = ohlc_path(seg1, 20, 21, 1.4)
d2 = [(o, min(h, LV - (0.2 if abs(c - 79.5) < 0.2 else 0.8)), lo, c) for o, h, lo, c in ohlc_path(seg2, 74, 22, 1.2)]
d3 = ohlc_path(seg3, 72, 23, 0.7)
candles(ch, C, d1, 0, W_(7, "направление"), W_(7, "растут"), label="Течение вверх")
pk = [(C.x(i), C.y(seg1[i])) for i in (1, 2, 4, 5, 7, 8, 10, 11, 13)]
dots(ch, pk, W_(7, "вершины"), 0.2, color=GREEN, label="Вершины и впадины")
arrow(ch, [(C.x(1), C.y(14)), (C.x(13), C.y(64))], W_(7, "течение"), color=GREEN, thick=8, label="Направление вверх")
txt(ch, "c6_up", "НАПРАВЛЕНИЕ ВВЕРХ", C.x(7), C.y(95), W_(7, "течение", 0, 0.4), size=36, color=GREEN,
    label="Надпись «направление вверх»")
candles(ch, C, d2, 14, W_(7, "уровень"), W_(7, "откатился"), label="Два касания")
line(ch, [(C.x(12), C.y(LV)), (1190, C.y(LV))], W_(7, "проводим"), 0.6, color=BLUE, thick=7, label="Уровень-потолок")
txt(ch, "c6_level", "УРОВЕНЬ", C.x(7), C.y(LV) - 40, W_(7, "потолок"), size=36, color=BLUE, label="Подпись «уровень»")
candles(ch, C, d3, 20, W_(7, "фигура"), W_(7, "узкий"), label="Флаг под потолком")
fl = [(C.x(19.6), C.y(79)), (C.x(24.4), C.y(77.5)), (C.x(24.4), C.y(70)), (C.x(19.6), C.y(71.5)), (C.x(19.6), C.y(79))]
line(ch, fl, W_(7, "флаг"), 0.6, color=WHITE, thick=3, label="Контур флага", opacity=0.6)
el("candle", ch, W_(7, "прокалывает"), 0.5, label="Прокол потолка", sound="chalk", x=C.x(25), bw=C.bw,
   yh=C.y(87), yo=C.y(75.5), yc=C.y(81), yl=C.y(74.5), color=GREEN, close_at=W_(7, "обратно"), yc2=C.y(78), color2=GREEN)
SOUND_EVENTS.append((W_(7, "обратно"), "snap", 0, "закрылась обратно — щелчок"))
txt(ch, "c6_wait", "ЖДЁМ", C.x(22), C.y(96), W_(7, "ждём"), size=44, color=YELLOW, label="ЖДЁМ")
candles(ch, C, [(78, 93, 77.5, 92)], 26, W_(7, "следующая"), W_(7, "следующая", 0, 0.4), label="Большая свеча выше",
        sound="whoosh")
tick_mark(ch, C.x(26) + 50, C.y(101), 80, W_(7, "настоящий"), label="Галочка")
SOUND_EVENTS.append((W_(7, "настоящий", 0, 0.1), "ding", 0, "динь"))
rt = ohlc_path([88, 82.5, 87, 94, 99], 92, 24, 1.0)
rt = [(o, h, max(lo, LV - 0.4) if k == 1 else lo, c) for k, (o, h, lo, c) in enumerate(rt)]
candles(ch, C, rt[:2], 27, W_(7, "возвращается"), W_(7, "касается", 0, 0.3), label="Возврат к уровню")
candles(ch, C, rt[2:], 29, W_(7, "отскакивает"), W_(7, "отскакивает", 0, 0.6), label="Отскок от пола")
SOUND_EVENTS.append((W_(7, "отскакивает", 0, 0.05), "boing", 0, ""))
txt(ch, "c6_flip", "ПОТОЛОК → ПОЛ", C.x(28), C.y(66), W_(7, "полом"), size=38, color=YELLOW, label="Потолок → пол")
items = ["СВЕЧА", "УРОВНИ", "НАПРАВЛЕНИЕ", "ЗАКРЫТИЕ", "ФИГУРЫ"]
for k, s in enumerate(items):
    y = 230 + 95 * k
    txt(ch, f"c6_n{k + 1}", f"{k + 1}. {s}", 1320, y, start(7) + 0.6 + 0.25 * k, size=40, align="left",
        label=f"Пункт {k + 1}", sound="tap" if k else "chalk")
marks = [(2, "направление"), (1, "уровень"), (4, "фигура"), (3, "прокалывает"), (0, "большая")]
times = [W_(7, stem, 0, 0.2) for _, stem in marks]
for (k, _), t0, t1 in zip(marks, times, times[1:] + [None]):   # светится только тот пункт, про который говорят
    ring(ch, 1320 + 150, 230 + 95 * k, 175, 38, t0, color=YELLOW, thick=4, label=f"Подсветка пункта {k + 1}",
         **(dict(end=t1, end_mode="dissolve") if t1 else {}))

# ---------- итог: чек-лист ----------

ch = 8
plate(ch, "plate7", "ИТОГ • ЧЕК-ЛИСТ")
txt(ch, "c7_save", "СОХРАНИ ЧЕК-ЛИСТ", RX, 230, W_(8, "сохранить"), size=50, color=YELLOW, label="Сохрани чек-лист")
names = ["СВЕЧА: ТЕНЬ И ТЕЛО", "УРОВНИ", "НАПРАВЛЕНИЕ", "ЗАКРЫТИЕ, А НЕ ТЕНЬ", "ДВОЙНОЕ ДНО И ФЛАГ"]
stems = ["первое", "второе", "третье", "четвертое", "пятое"]
for k in range(5):
    y = 230 + 130 * k
    ring(ch, 200, y, 40, 40, start(8) + 0.5 + 0.25 * k, color=WHITE, sound="tap")
    txt(ch, f"c7_n{k + 1}", str(k + 1), 200, y, start(8) + 0.6 + 0.25 * k, size=44, sound=None, label=f"Номер {k + 1}")
    txt(ch, f"c7_i{k + 1}", names[k], 280, y, W_(8, stems[k]), size=54, align="left", label=f"Пункт {k + 1}")
    tick_mark(ch, 200, y, 74, W_(8, stems[k], 0, 1.4), label=f"Галочка {k + 1}")
    SOUND_EVENTS.append((W_(8, stems[k], 0, 1.55), "ding", 0, ""))
txt(ch, "c7_prob", "НЕ МАГИЯ,\nА ВЕРОЯТНОСТЬ", RX, 560, W_(8, "магия"), size=48, label="Не магия, а вероятность")
txt(ch, "c7_err", "ОШИБАТЬСЯ — НОРМАЛЬНО,\nПО-КРУПНОМУ — НЕТ", RX, 760, W_(8, "ошибаться"), size=34,
    label="Ошибаться нормально")

# ---------- финал: загадка ----------

ch = 9
T_WIPE9 = A.COUNTS[-1] + 1.0 if A.COUNTS else start(9) + 8
C = Chart(130, 36, 200, 860)
LV = 70
line(ch, [(100, C.y(LV)), (1190, C.y(LV))], start(9) + 0.6, 0.6, color=BLUE, thick=7, label="Уровень загадки",
     end=T_WIPE9)
d9 = [(o, min(h, LV - 0.4), lo, c) for o, h, lo, c in ohlc_path([40, 50, 45, 56, 62, 57, 64, 68], 32, 25, 1.4)]
candles(ch, C, d9, 0, start(9) + 0.9, W_(9, "проколола", 0, -0.1), label="Подход к уровню", end=T_WIPE9)
q = el("candle", ch, W_(9, "проколола"), 0.5, label="Прокол и закрытие обратно", sound="chalk", x=C.x(8), bw=C.bw,
       yh=C.y(85), yo=C.y(66), yc=C.y(72), yl=C.y(63), color=GREEN, end=T_WIPE9, close_at=W_(9, "обратно"),
       yc2=C.y(64.5), color2=RED)
txt(ch, "c8_q", "ВВЕРХ ИЛИ ВНИЗ?", RX, 230, W_(9, "вверх", 1), size=54, color=YELLOW, label="Вверх или вниз?",
    end=T_WIPE9)
el("button", ch, W_(9, "вверх", 1, 0.2), 0.4, label="Кнопка «вверх»", sound="chalk_fast", cx=RX - 135, cy=420,
   w=240, h=96, key="c8_up", color=GREEN, end=T_WIPE9)
TEXT_DEFAULTS["c8_up"] = "ВВЕРХ ↑"
TEXT_TRACK.append(("c8_up", None, "Кнопка «вверх»", "9:Кнопка «вверх»"))
el("button", ch, W_(9, "вниз", 0, 0.2), 0.4, label="Кнопка «вниз»", sound="chalk_fast", cx=RX + 135, cy=420,
   w=240, h=96, key="c8_down", color=RED, end=T_WIPE9)
TEXT_DEFAULTS["c8_down"] = "ВНИЗ ↓"
TEXT_TRACK.append(("c8_down", None, "Кнопка «вниз»", "9:Кнопка «вниз»"))
el("question", ch, W_(9, "комменты"), 0.45, label="Жёлтый вопрос", sound="chalk", cx=C.x(8) + 170, cy=C.y(78),
   end=T_WIPE9)
for k, c in enumerate(A.COUNTS):
    txt(ch, f"c8_cnt{k + 1}", f"{3 - k}…", RX - 160 + 160 * k, 640, c, size=110, color=YELLOW if k == 2 else WHITE,
        dur=0.25, label=f"Отсчёт {3 - k}", sound="tick", end=T_WIPE9)
SOUND_EVENTS.append((T_WIPE9, "sponge", 0, "губка стирает доску"))
txt(ch, "c8_answer", "ОТВЕТ —\nВ КОММЕНТАРИЯХ", 960, 380, W_(9, "правильный"), size=84, color=YELLOW,
    label="Ответ — в комментариях")
txt(ch, "c8_sub", "ПОДПИШИСЬ НА СЕРИЮ", 960, 640, W_(9, "подписывайся"), size=56, label="Подпишись на серию")
txt(ch, "c8_next", "ДАЛЬШЕ: ДОДЖИ, МОЛОТ И ДРУГИЕ", 960, 740, W_(9, "доджи"), size=40, color=GREY, label="Анонс")

# смена главы — губка стирает доску; рассыпание части рисунка — пыль
for s in range(2, A.N_SCENES + 1):
    SOUND_EVENTS.append((start(s), "sponge", 0, f"губка — глава {s - 1}"))
for t_end in sorted({e["end"] for e in ELEMENTS if e["end_mode"] == "dissolve"}):
    SOUND_EVENTS.append((t_end, "dust", 0, "часть рисунка рассыпается"))
WIPES = sorted({start(s) for s in range(2, A.N_SCENES + 1)} | {T_WIPE9})
