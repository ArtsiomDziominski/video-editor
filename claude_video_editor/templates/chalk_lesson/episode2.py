"""Выпуск 2 «Как читать свечи с нуля»: рисунки по главам. Выполняется внутри beats.py."""

NAMES = ("ДОДЖИ", "МОЛОТ", "ПАДАЮЩАЯ ЗВЕЗДА", "МАРУБОЗУ", "ПОГЛОЩЕНИЕ")
LIST_X, LIST_Y, LIST_DY = 1320, 240, 118


def smooth(pts, n=3):
    """Ломаная от руки → плавная линия (срез углов)."""
    pts = np.array(pts, float)
    for _ in range(n):
        a, b = pts[:-1], pts[1:]
        mid = np.empty((2 * len(a), 2))
        mid[::2], mid[1::2] = 0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b
        pts = np.vstack([pts[:1], mid, pts[-1:]])
    return pts


def cdl(ch, x, bw, yh, yo, yc, yl, color, t0, dur=0.45, **kw):
    return el("candle", ch, t0, dur, x=x, bw=bw, yh=yh, yo=yo, yc=yc, yl=yl, color=color, **kw)


def icon(ch, kind, x, y, t0, **kw):
    """Значок свечи в кружке шпаргалки."""
    if kind == 0:
        cdl(ch, x, 13, y - 24, y - 1, y + 1, y + 24, WHITE, t0, **kw)
    elif kind == 1:
        cdl(ch, x, 9, y - 22, y - 8, y - 22, y + 24, GREEN, t0, **kw)
    elif kind == 2:
        cdl(ch, x, 9, y - 24, y + 8, y + 22, y + 22, RED, t0, **kw)
    elif kind == 3:
        cdl(ch, x, 12, y - 22, y + 22, y - 22, y + 22, GREEN, t0, **kw)
    else:
        cdl(ch, x - 12, 6, y - 9, y - 9, y + 9, y + 9, RED, t0, **kw)
        cdl(ch, x + 9, 11, y - 22, y + 22, y - 22, y + 22, GREEN, t0, **kw)


def name_list(ch, prefix, t0, bright):
    for k, s in enumerate(NAMES):
        y = LIST_Y + LIST_DY * k
        col = WHITE if k in bright else GREY
        ring(ch, LIST_X, y, 34, 34, t0 + 0.22 * k, color=col, sound="tap", thick=4)
        txt(ch, f"{prefix}{k + 1}", s, LIST_X + 58, y, t0 + 0.22 * k + 0.08, size=38, color=col, align="left", sound=None,
            label=f"Список: {s}")


def mark_row(ch, k, t0, t1):
    """Пункт списка, про который сейчас говорят: жёлтая обводка, как в выпуске 1."""
    y = LIST_Y + LIST_DY * k
    half = 14.5 * len(NAMES[k])
    ring(ch, LIST_X + 58 + half, y, half + 24, 42, t0, color=YELLOW, thick=4, label=f"Подсветка: {NAMES[k]}", sound=None,
         end=t1, end_mode="dissolve")


def fall(ch, xs, bodies, t0, gap, color, bw=30, label=None, **kw):
    """Серия одинаковых свечей; bodies — (верх тела, низ тела)."""
    for k, (x, (top, bot)) in enumerate(zip(xs, bodies)):
        yo, yc = (top, bot) if color == RED else (bot, top)
        cdl(ch, x, bw, top - 18, yo, yc, bot + 18, color, t0 + gap * k, **kw)
    if label:
        SOUND_EVENTS.append((t0, "chalk_fast", gap * len(xs), label))


def answer_button(ch, key, text, cx, color, t0, label, **kw):
    el("button", ch, t0, 0.4, label=label, sound="chalk_fast", cx=cx, cy=420, w=240, h=96, key=key, color=color, **kw)
    TEXT_DEFAULTS[key] = text
    TEXT_TRACK.append((key, None, label, f"{ch}:{label}"))


# ---------- вступление ----------

ch = 1
r = np.random.default_rng(12)
chaos = list(np.clip(50 + np.cumsum(r.normal(0, 9, 62)), 8, 94))
C = Chart(96, 28, 170, 880, 0, 100)
data = ohlc_path(chaos, 50, 31, 3.5)
t0, t1 = 0.4, W_(1, "видишь")
tm = t0 + (t1 - t0) * 40 / 62
T_CLEAR = W_(1, "смотреть")
candles(ch, C, data[:40], 0, t0, tm, label="Хаотичный график", sound=None)
candles(ch, C, data[40:], 40, tm, t1, label="Хаос до края доски", sound=None, end=T_CLEAR, end_mode="dissolve")
chalk_run(t0, t1, "мел рисует график на всю доску")
wick_i = max(range(4, 38), key=lambda i: data[i][1] - max(data[i][0], data[i][3]))
body_i = max(range(4, 38), key=lambda i: abs(data[i][3] - data[i][0]))
ring(ch, C.x(wick_i), C.y((data[wick_i][1] + max(data[wick_i][0], data[wick_i][3])) / 2), 28, 62, W_(1, "палочки"),
     label="Палочка", end=T_CLEAR, end_mode="dissolve")
ring(ch, C.x(body_i), C.y((data[body_i][0] + data[body_i][3]) / 2), 34, 74, W_(1, "прямоугольники"),
     label="Прямоугольник", end=T_CLEAR, end_mode="dissolve")
txt(ch, "intro_title", "КАК ЧИТАТЬ СВЕЧИ\nС НУЛЯ", RX, 225, W_(1, "читать"), size=64, dur=1.2, label="Заголовок")
for k in range(6):
    y = 405 + 78 * k
    t = W_(1, "разберем", 0, 0.42 * k)
    ring(ch, 1345, y, 29, 29, t, color=WHITE, sound="tap", label=f"Кружок {k + 1}")
    line(ch, [(1400, y + 14), (1810, y + 14)], t + 0.1, 0.25, color=GREY, thick=3, sound=None, opacity=0.45)
txt(ch, "intro_riddle", "А В КОНЦЕ — ЗАГАДКА ?", RX, 908, W_(1, "загадка"), size=34, color=YELLOW,
    label="В конце загадка")

# ---------- глава 1: что такое свеча ----------

ch = 2
plate(ch, "plate1", "1 • ЧТО ТАКОЕ СВЕЧА")
CX = 400
path = smooth([(120, 570), (180, 430), (240, 520), (300, 290), (365, 220), (425, 480), (485, 745), (540, 560), (592, 650),
               (640, 345)])
T_SQ = W_(2, "сжимаем")
el("clock", ch, W_(2, "час"), 0.6, label="Часы: один час", sound="chalk", cx=760, cy=270, r=88, color=WHITE, end=T_SQ + 0.4,
   end_mode="dissolve")
wave(ch, path, W_(2, "ходит"), W_(2, "линия", 0, 0.4), T_SQ, CX, label="Извилистая линия за час")
SOUND_EVENTS.append((T_SQ, "whoosh", 0.6, "вжух: линия сжимается в свечу"))
big_candle(ch, CX, 66, path[:, 1].min(), path[0, 1], path[-1, 1], path[:, 1].max(), GREEN, T_SQ + 0.5,
           label="Свеча из линии", sound=None)
for k, (x, bw, yh, yo, yc, yl, stem, nth, key, s) in enumerate((
        (680, 32, 590, 720, 640, 745, "час", 2, "c1_h1", "1 ЧАС"),
        (900, 44, 430, 720, 510, 755, "четыре", 0, "c1_h4", "4 ЧАСА"),
        (1120, 60, 215, 730, 300, 790, "целый", 0, "c1_day", "ДЕНЬ"))):
    big_candle(ch, x, bw, yh, yo, yc, yl, GREEN, W_(2, stem, nth), label=f"Свеча «{s}»", sound="chalk")
    txt(ch, key, s, x, 850, W_(2, stem, nth, 0.25), size=42, label=s, sound="tap")
txt(ch, "c1_rule", "1 СВЕЧА =\n1 ОТРЕЗОК ВРЕМЕНИ", RX, 250, W_(2, "история"), size=46, label="Правило главы")
txt(ch, "c1_tf", "ТАЙМФРЕЙМ", RX, 420, W_(2, "таймфрейм"), size=56, color=BLUE, label="ТАЙМФРЕЙМ")
ring(ch, 680, 850, 96, 44, W_(2, "часовом"), label="На часовом", end=W_(2, "дневном"), end_mode="dissolve")
ring(ch, 1120, 850, 92, 44, W_(2, "дневном"), label="На дневном", end=W_(2, "читаются"), end_mode="dissolve")
txt(ch, "c1_same", "ЧИТАЮТСЯ ОДИНАКОВО", RX, 540, W_(2, "одинаково"), size=40, label="Читаются одинаково")
txt(ch, "c1_weight", "БОЛЬШЕ ОТРЕЗОК —\nБОЛЬШЕ ВЕСИТ", RX, 680, W_(2, "весит"), size=44, color=YELLOW, label="Больше весит")
ring(ch, 1120, 490, 118, 306, W_(2, "дневная"), color=YELLOW, label="Дневная весит больше")
txt(ch, "c1_older", "НОВИЧКАМ —\nСТАРШИЕ ГРАФИКИ", RX, 840, W_(2, "старших"), size=40, label="Старшие графики")

# ---------- глава 2: тело и тени ----------

ch = 3
plate(ch, "plate2", "2 • ТЕЛО И ТЕНИ")
GX, RDX, BW = 470, 990, 84
HI, TOP, BOT, LO = 170, 310, 630, 790
big_candle(ch, GX, BW, HI, BOT, TOP, LO, GREEN, W_(3, "разберем"), label="Зелёная свеча")
for key, s, y, stem in (("c2_open", "ОТКРЫТИЕ", BOT, "открытие"), ("c2_close", "ЗАКРЫТИЕ", TOP, "закрытие"),
                        ("c2_high", "ВЕРХ", HI, "верх"), ("c2_low", "НИЗ", LO, "низ")):
    t = W_(3, stem)
    txt(ch, key, s, 330, y, t, size=36, align="right", label=f"Подпись «{s}»", sound="tap")
    line(ch, [(342, y), (GX - BW - 6 if y in (TOP, BOT) else GX - 8, y)], t + 0.15, 0.2, color=GREY, thick=3, sound=None)
bracket = [(GX + BW + 14, TOP), (GX + BW + 40, TOP + 14), (GX + BW + 40, 458), (GX + BW + 58, 470), (GX + BW + 40, 482),
           (GX + BW + 40, BOT - 14), (GX + BW + 14, BOT)]
line(ch, bracket, W_(3, "прямоугольник"), 0.8, color=GREEN, thick=5, label="Прямоугольник обводится")
txt(ch, "c2_body", "ТЕЛО", GX + BW + 72, 470, W_(3, "тело"), size=58, color=GREEN, align="left", label="Подпись «тело»",
    sound="tap")
for k, y in enumerate(((HI + TOP) / 2, (BOT + LO) / 2)):
    t = W_(3, "тени", 0, 0.35 * k)
    arrow(ch, [(GX + 118, y), (GX + 16, y)], t, color=YELLOW, thick=5, head=22, sound=None)
    txt(ch, f"c2_wick{k + 1}", "ТЕНЬ", GX + 130, y, t, size=46, color=YELLOW, align="left", label=f"Подпись «тень» {k + 1}",
        sound="tap")
txt(ch, "c2_fuse", "(ФИТИЛЬ)", GX + 188, (HI + TOP) / 2 + 46, W_(3, "фитилями"), size=28, color=GREY, label="Фитиль")
arrow(ch, [(GX, BOT - 26), (GX, TOP + 26)], W_(3, "зеленая"), color=WHITE, thick=8, label="Закрылась выше")
txt(ch, "c2_green", "ЗЕЛЁНАЯ —", 1650, 330, W_(3, "зеленая"), size=56, color=GREEN, label="ЗЕЛЁНАЯ")
txt(ch, "c2_green2", "ЗАКРЫЛАСЬ ВЫШЕ", 1640, 404, W_(3, "вырос"), size=34, label="Закрылась выше: надпись")
big_candle(ch, RDX, BW, HI, TOP, BOT, LO, RED, W_(3, "ниже"), label="Красная свеча")
for key, s, y in (("c2_ropen", "ОТКРЫТИЕ", TOP), ("c2_rclose", "ЗАКРЫТИЕ", BOT)):
    t = W_(3, "красная", 0, 0.1 if y == TOP else 0.45)
    line(ch, [(RDX + BW + 6, y), (RDX + BW + 40, y)], t, 0.15, color=GREY, thick=3, sound=None)
    txt(ch, key, s, RDX + BW + 52, y, t + 0.1, size=36, align="left", label=f"Красная: {s}", sound="tap")
arrow(ch, [(RDX, TOP + 26), (RDX, BOT - 26)], W_(3, "красная", 0, 0.6), color=WHITE, thick=8, sound=None)
txt(ch, "c2_red", "КРАСНАЯ —", 1650, 580, W_(3, "красная"), size=56, color=RED, label="КРАСНАЯ")
txt(ch, "c2_red2", "НИЖЕ", 1650, 654, W_(3, "снизился"), size=38, label="Ниже: надпись")
T_COLOR = W_(3, "цвет", 1)
for k, (cx, cy, rx, stem, nth, name) in enumerate(((215, BOT, 128, "открытие", 2, "открытие внизу"),
                                                   (215, TOP, 128, "закрытие", 2, "закрытие вверху"),
                                                   (1242, TOP, 128, "наоборот", 0, "у красной наоборот"),
                                                   (1242, BOT, 128, "наоборот", 0, ""))):
    ring(ch, cx, cy, rx, 36, W_(3, stem, nth, 0.5 if k == 3 else 0), label=name or None, end=T_COLOR, end_mode="dissolve")
txt(ch, "c2_how", "ЦВЕТ — ЧЕМ\nЗАКОНЧИЛОСЬ,\nТЕЛО И ТЕНИ — КАК", 1630, 820, W_(3, "рассказывают"), size=32,
    label="Цвет, тело и тени")

# ---------- глава 3: перетягивание каната ----------

ch = 4
plate(ch, "plate3", "3 • ПЕРЕТЯГИВАНИЕ КАНАТА")
T_ROPE = W_(4, "представить")
T_G, T_R, T_N, endA = W_(4, "большое"), W_(4, "большое", 1), W_(4, "крошечное"), W_(4, "цвет", 0, -0.7)
keys = [(T_ROPE, 0), (T_ROPE + 0.9, 0)]
u, s = T_ROPE + 1.5, -1
while u < T_G:
    keys.append((u, s * 44))
    SOUND_EVENTS.append((u - 0.6, "creak", 1.2, "натяжение каната" if len(keys) == 3 else ""))
    u, s = u + 1.5, -s
keys += [(T_G + 0.9, -100), (T_R, -100), (T_R + 0.9, 100), (T_N, 100), (T_N + 0.8, 0)]
SOUND_EVENTS.append((T_G, "creak", 1.4, ""))
SOUND_EVENTS.append((T_R, "creak", 1.4, ""))
u, s = T_N + 1.5, -1
while u < endA:
    keys.append((u, s * 10))
    u, s = u + 1.1, -s
rope(ch, 250, 520, 160, 95, T_ROPE, keys, label="Канат", end=endA, end_mode="dissolve")
line(ch, [(130, 520), (370, 520)], T_ROPE + 0.6, 0.4, color=GREY, thick=3, dashed=True, sound=None, end=endA,
     end_mode="dissolve")
big_candle(ch, 610, 78, 230, 720, 230, 720, GREEN, T_G, label="Большое зелёное тело", sound="whoosh", end=endA,
           end_mode="dissolve")
txt(ch, "c3_up", "УВЕРЕННО\nВВЕРХ", 610, 810, W_(4, "перетянула"), size=34, color=GREEN, label="Уверенно вверх", end=endA,
    end_mode="dissolve")
big_candle(ch, 870, 78, 230, 230, 720, 720, RED, T_R, label="Большое красное тело", sound="whoosh", end=endA,
           end_mode="dissolve")
txt(ch, "c3_down", "УВЕРЕННО\nВНИЗ", 870, 810, W_(4, "победили"), size=34, color=RED, label="Уверенно вниз", end=endA,
    end_mode="dissolve")
big_candle(ch, 1100, 62, 455, 472, 484, 500, WHITE, T_N, label="Крошечное тело", sound="whoosh", end=endA,
           end_mode="dissolve")
txt(ch, "c3_draw", "НИЧЬЯ", 1100, 810, W_(4, "ничья"), size=46, color=YELLOW, label="Ничья", end=endA, end_mode="dissolve")
txt(ch, "c3_rule", "ТЕЛО =\nНАСКОЛЬКО УВЕРЕННО", RX, 250, W_(4, "насколько"), size=48, label="Правило главы")
for k, (x, top, bot) in enumerate(((170, 240, 420), (290, 410, 580), (410, 570, 740))):
    big_candle(ch, x, 50, top - 18, top, bot, bot + 16, RED, W_(4, "размер", 1, 0.4 * k), label=f"Красная {k + 1}",
               sound="chalk")
big_candle(ch, 530, 50, 690, 744, 712, 760, GREEN, W_(4, "маленькая"), label="Маленькая зелёная")
txt(ch, "c3_pause", "ПЕРЕДЫШКА", 530, 840, W_(4, "передышка"), size=40, color=YELLOW, label="Передышка")
txt(ch, "c3_size", "НЕ ТОЛЬКО ЦВЕТ,\nНО И РАЗМЕР", RX, 450, W_(4, "цвет"), size=44, label="Цвет и размер")
txt(ch, "c3_notyet", "ЕЩЁ НЕ РАЗВОРОТ", RX, 590, W_(4, "разворот"), size=40, color=YELLOW, label="Ещё не разворот")
for k, (top, bot) in enumerate(((610, 760), (480, 625), (350, 495), (220, 365))):
    big_candle(ch, 700 + 120 * k, 50, top - 14, bot, top, bot + 14, GREEN, W_(4, "несколько", 0, 0.32 * k),
               label=f"Напор {k + 1}", sound="whoosh" if k == 0 else "chalk")
txt(ch, "c3_push", "НАПОР", 880, 840, W_(4, "напор", 0, -0.8), size=56, color=GREEN, label="Напор")

# ---------- глава 4: тень — это попытка ----------

ch = 5
plate(ch, "plate4", "4 • ТЕНЬ — ЭТО ПОПЫТКА")
txt(ch, "c4_best", "ТЕНИ — САМОЕ\nИНТЕРЕСНОЕ", 640, 480, W_(5, "интересное", 0, -0.4), size=62, label="Самое интересное",
    end=W_(5, "смотри", 0, -0.3), end_mode="dissolve")
txt(ch, "c4_rule", "ТЕНЬ — ПОПЫТКА,\nТЕЛО — РЕЗУЛЬТАТ", RX, 250, W_(5, "тень"), size=50, dur=2.6, label="Правило главы")
AX, A_OPEN, A_TOP, A_CLOSE = 330, 700, 240, 610
t_up, t_top = W_(5, "успел"), W_(5, "верх")
t_hold, t_fall = W_(5, "удержаться"), W_(5, "вниз")
live(ch, AX, 72, A_OPEN, [(W_(5, "смотри"), A_OPEN), (t_up, A_OPEN - 30), (t_top, A_TOP), (t_hold, A_TOP + 24),
                          (t_fall + 0.15, A_CLOSE)], label="Свеча с длинной верхней тенью")
SOUND_EVENTS.append((t_up, "whoosh", 0.7, "вжух вверх"))
SOUND_EVENTS.append((t_fall, "boom", 0, "бум вниз"))
T_A = W_(5, "длинная")
ring(ch, AX, (A_TOP + A_CLOSE) / 2, 46, 192, T_A, label="Тень обводится")
txt(ch, "c4_try1", "ПОПЫТКА", AX + 196, 400, T_A + 0.2, size=42, color=YELLOW, label="ПОПЫТКА")
ring(ch, AX, (A_CLOSE + A_OPEN) / 2, 108, 74, T_A + 0.9, color=GREEN, label="Тело обводится")
txt(ch, "c4_res1", "РЕЗУЛЬТАТ", AX, 800, T_A + 1.1, size=42, color=GREEN, label="РЕЗУЛЬТАТ")
arrow(ch, [(AX + 150, 150), (AX + 26, 226)], W_(5, "сверху"), color=RED, thick=8, label="Сверху сидит кто-то сильный")
BX, B_OPEN, B_LOW, B_CLOSE = 860, 440, 870, 360
t_dn, t_deep = W_(5, "опустили"), W_(5, "глубоко", 0, 0.4)
t_back, t_out = W_(5, "вытащили"), W_(5, "обратно", 0, 0.3)
live(ch, BX, 72, B_OPEN, [(W_(5, "наоборот"), B_OPEN), (t_dn, B_OPEN + 20), (t_deep, B_LOW), (t_back, B_LOW - 24),
                          (t_out, B_CLOSE)], label="Свеча с длинной нижней тенью")
SOUND_EVENTS.append((t_deep - 0.2, "boom", 0, "бум вниз"))
SOUND_EVENTS.append((t_back, "whoosh", 0.6, "вжух вверх"))
T_B = W_(5, "снизу")
ring(ch, BX, (B_OPEN + B_LOW) / 2, 46, 228, T_B, label="Нижняя тень обводится")
txt(ch, "c4_try2", "ПОПЫТКА", BX + 196, 660, T_B + 0.2, size=42, color=YELLOW, label="ПОПЫТКА (низ)")
ring(ch, BX, (B_CLOSE + B_OPEN) / 2, 108, 74, T_B + 0.7, color=GREEN, label="Тело обводится (низ)")
txt(ch, "c4_res2", "РЕЗУЛЬТАТ", BX, 262, T_B + 0.9, size=42, color=GREEN, label="РЕЗУЛЬТАТ (низ)")
txt(ch, "c4_trace", "ТЕНЬ — СЛЕД\nПРОИГРАННОЙ АТАКИ", RX, 480, W_(5, "след"), size=42, label="След атаки")
txt(ch, "c4_longer", "ДЛИННЕЕ ТЕНЬ —\nСИЛЬНЕЕ ОТБИЛИ", RX, 640, W_(5, "длиннее"), size=42, label="Длиннее тень")
txt(ch, "c4_wait", "ДОЖДИСЬ ЗАКРЫТИЯ", RX, 810, W_(5, "дожидайся"), size=48, color=YELLOW, label="Дождись закрытия")

# ---------- глава 5: пять свечей, часть первая ----------

ch = 6
plate(ch, "plate5", "5 • ПЯТЬ СВЕЧЕЙ ПО ИМЕНАМ: ЧАСТЬ 1")
name_list(ch, "c5_n", W_(6, "познакомимся"), (0, 1, 2))
T1, T2, T3 = W_(6, "первая"), W_(6, "вторая"), W_(6, "третья")
T_END = W_(6, "запомни", 0, -0.2)
mark_row(ch, 0, T1, T2)
mark_row(ch, 1, T2, T3)
mark_row(ch, 2, T3, T_END)
for k, t in enumerate((T1, T2, T3)):
    icon(ch, k, LIST_X, LIST_Y + LIST_DY * k, t + 0.1)
e1, e2 = T2 - 0.3, T3 - 0.3
DJ = dict(end=e1, end_mode="dissolve")
big_candle(ch, 620, 150, 220, 497, 503, 790, WHITE, W_(6, "додж"), label="Доджи", **DJ)
txt(ch, "c5_doji", "ДОДЖИ", 620, 875, W_(6, "додж", 0, 0.2), size=72, color=BLUE, label="Название: доджи", sound="tap", **DJ)
arrow(ch, [(240, 400), (452, 490)], W_(6, "черточку"), color=GREEN, thick=6, head=26, sound=None, **DJ)
txt(ch, "c5_dash", "ТЕЛО-ЧЕРТА", 240, 350, W_(6, "черточку"), size=38, color=GREEN, label="Тело-черта", **DJ)
arrow(ch, [(830, 300), (636, 340)], W_(6, "тени"), color=YELLOW, thick=6, head=26, sound=None, **DJ)
txt(ch, "c5_shadows", "ТЕНИ", 900, 296, W_(6, "тени"), size=44, color=YELLOW, label="Тени у доджи", **DJ)
txt(ch, "c5_cross", "КРЕСТИК", 240, 640, W_(6, "крестик"), size=40, color=GREY, label="Крестик", **DJ)
txt(ch, "c5_tie", "НИЧЬЯ", 960, 520, W_(6, "ничья"), size=64, color=YELLOW, label="Ничья", **DJ)
txt(ch, "c5_doubt", "СОМНЕНИЕ", 960, 640, W_(6, "сомнение"), size=46, label="Сомнение", **DJ)
HX = 760
HM = dict(end=e2, end_mode="dissolve")
big_candle(ch, HX, 42, 476, 540, 488, 790, GREEN, W_(6, "молот"), label="Молот", **HM)
txt(ch, "c5_hammer", "МОЛОТ", HX, 870, W_(6, "молот", 0, 0.2), size=66, color=BLUE, label="Название: молот", sound="tap", **HM)
txt(ch, "c5_small", "МАЛЕНЬКОЕ ТЕЛО", 1030, 500, W_(6, "маленькое"), size=30, color=GREEN, label="Маленькое тело", **HM)
ring(ch, HX, 660, 50, 142, W_(6, "длинная"), label="Длинная тень снизу", **HM)
txt(ch, "c5_long", "ДЛИННАЯ ТЕНЬ", 1000, 660, W_(6, "длинная", 0, 0.2), size=30, color=YELLOW, label="Длинная тень", **HM)
fall(ch, [130 + 100 * k for k in range(6)], [(152, 220), (214, 292), (280, 340), (332, 408), (396, 460), (454, 516)],
     W_(6, "красных", 0, -0.5), 0.2, RED, bw=32, label="после серии красных свечей", **HM)
arrow(ch, [(HX - 74, 500), (HX - 74, 770)], W_(6, "уронили"), color=RED, thick=7, label="График уронили", **HM)
arrow(ch, [(HX + 74, 770), (HX + 74, 500)], W_(6, "вытащили"), color=GREEN, thick=7, label="Вытащили наверх", **HM)
txt(ch, "c5_nope", "СНИЗУ НЕ ПУСТИЛИ", 340, 720, W_(6, "снизу", 1), size=46, color=YELLOW, label="Снизу не пустили", **HM)
arrow(ch, [(1235, 800), (1235, 420)], W_(6, "разворота"), color=GREEN, thick=9, label="Первый знак разворота", **HM)
ST = dict(end=T_END, end_mode="dissolve")
big_candle(ch, HX, 42, 200, 560, 612, 624, RED, W_(6, "падающая"), label="Падающая звезда", **ST)
txt(ch, "c5_star", "ПАДАЮЩАЯ ЗВЕЗДА", 870, 800, W_(6, "падающая", 0, 0.3), size=54, color=BLUE, label="Название: звезда",
    sound="tap", **ST)
txt(ch, "c5_small2", "МАЛЕНЬКОЕ ТЕЛО", 1010, 590, W_(6, "маленькое", 1), size=30, color=GREEN, label="Маленькое тело (звезда)", **ST)
ring(ch, HX, 375, 50, 180, W_(6, "длинная", 1), label="Длинная тень сверху", **ST)
txt(ch, "c5_long2", "ДЛИННАЯ ТЕНЬ", 1010, 360, W_(6, "длинная", 1, 0.2), size=30, color=YELLOW, label="Длинная тень (звезда)", **ST)
fall(ch, [130 + 100 * k for k in range(6)], [(790, 856), (726, 800), (668, 736), (636, 690), (580, 648), (556, 610)],
     W_(6, "роста", 0, -0.5), 0.2, GREEN, bw=32, label="после серии зелёных свечей", **ST)
arrow(ch, [(HX - 74, 540), (HX - 74, 230)], W_(6, "подбросили"), color=GREEN, thick=7, label="График подбросили", **ST)
arrow(ch, [(HX + 74, 230), (HX + 74, 540)], W_(6, "уронили", 1), color=RED, thick=7, label="Тут же уронили", **ST)
txt(ch, "c5_nope2", "СВЕРХУ НЕ ПУСТИЛИ", 350, 260, W_(6, "сверху", 1), size=46, color=YELLOW, label="Сверху не пустили", **ST)
el("star", ch, W_(6, "упала", 0, -0.45), 0.9, label="Звезда упала", sound="whoosh", sound_arg=0.7, x=HX, y0=190, y1=540, r=34,
   end=W_(6, "упала", 0, 0.9), end_mode="dissolve")
txt(ch, "c5_not", "НЕ «ТОЧНО РАЗВЕРНЁТСЯ»", 640, 360, W_(6, "точно"), size=52, color=GREY, label="Не точно развернётся")
line(ch, [(250, 368), (1030, 352)], W_(6, "меняется", 0, -0.4), 0.45, color=RED, thick=7, label="Зачёркнуто")
txt(ch, "c5_but", "А «ЗДЕСЬ ЧТО-ТО МЕНЯЕТСЯ»", 640, 500, W_(6, "меняется", 0, -0.2), size=52, color=YELLOW,
    label="Здесь что-то меняется")
txt(ch, "c5_look", "ПОВОД ПРИСМОТРЕТЬСЯ,\nА НЕ ДЕЙСТВОВАТЬ", 640, 700, W_(6, "присмотреться"), size=46,
    label="Повод присмотреться")

# ---------- глава 6: пять свечей, часть вторая ----------

ch = 7
plate(ch, "plate6", "6 • ПЯТЬ СВЕЧЕЙ ПО ИМЕНАМ: ЧАСТЬ 2")
name_list(ch, "c6_n", start(7) + 0.5, (3, 4))
for k in range(3):
    icon(ch, k, LIST_X, LIST_Y + LIST_DY * k, start(7) + 0.65 + 0.22 * k)
T4, T5, T_ALL = W_(7, "четвертая"), W_(7, "пятая"), W_(7, "вся")
mark_row(ch, 3, T4, T5)
mark_row(ch, 4, T5, T_ALL)
for k, t in ((3, W_(7, "марубозу")), (4, W_(7, "поглощение"))):
    icon(ch, k, LIST_X, LIST_Y + LIST_DY * k, t)
endM = T5 + 0.1
MB = dict(end=endM, end_mode="dissolve")
MX, MR = 430, 660
big_candle(ch, MX, 88, 210, 760, 210, 760, GREEN, W_(7, "марубозу"), label="Марубозу зелёная", sound="whoosh", **MB)
txt(ch, "c6_name", "МАРУБОЗУ", 140, 860, W_(7, "марубозу", 0, 0.2), size=62, color=BLUE, align="left", label="Название: марубозу",
    sound="tap", **MB)
txt(ch, "c6_bald", "«ЛЫСАЯ»", 980, 270, W_(7, "лысая"), size=54, color=YELLOW, label="Лысая", **MB)
txt(ch, "c6_shaved", "«БРИТАЯ»", 980, 370, W_(7, "бритая"), size=54, color=YELLOW, label="Бритая", **MB)
txt(ch, "c6_nowick", "БЕЗ ТЕНЕЙ", 980, 500, W_(7, "теней"), size=44, label="Без теней", **MB)
big_candle(ch, MR, 88, 210, 210, 760, 760, RED, W_(7, "одно"), label="Марубозу красная", sound="whoosh", **MB)
for key, s, y, stem in (("c6_o", "ОТКРЫЛИСЬ", 760, "открылись"), ("c6_c", "ЗАКРЫЛИСЬ", 210, "закрылись")):
    txt(ch, key, s, 322, y, W_(7, stem), size=34, align="right", label=s, **MB)
txt(ch, "c6_force", "— ЧИСТАЯ СИЛА", 500, 860, W_(7, "чистая", 0, -0.4), size=52, align="left", label="Чистая сила", **MB)
EX, EG = 310, 490
cdl(ch, EX, 52, 420, 440, 560, 582, RED, W_(7, "сначала"), 0.6, big=True, label="Маленькая красная", sound="chalk")
cdl(ch, EG, 82, 300, 680, 320, 700, GREEN, W_(7, "следом"), 0.7, big=True, label="Большая зелёная", sound="whoosh")
line(ch, [(EX - 74, 320), (EG - 90, 320)], W_(7, "накрывает"), 0.35, color=YELLOW, thick=5, dashed=True, label="Накрывает сверху")
line(ch, [(EX - 74, 680), (EG - 90, 680)], W_(7, "накрывает", 0, 0.3), 0.35, color=YELLOW, thick=5, dashed=True, sound=None)
ring(ch, (EX + EG) / 2, 520, 280, 280, W_(7, "съела", 0, -0.2), label="Большая съела маленькую", sound="chalk_fast")
SOUND_EVENTS.append((W_(7, "съела"), "crunch", 0, "хрум: поглощение"))
txt(ch, "c6_eng", "ПОГЛОЩЕНИЕ", 130, 860, W_(7, "поглощение"), size=60, color=BLUE, align="left", label="Название: поглощение",
    sound="tap")
txt(ch, "c6_yesterday", "ВЧЕРА", EX, 370, W_(7, "вчера"), size=30, color=RED, label="Вчера")
txt(ch, "c6_today", "СЕГОДНЯ", EG, 735, W_(7, "сегодня"), size=30, label="Сегодня")
txt(ch, "c6_change", "— СМЕНА СИЛЫ", 680, 860, W_(7, "власть"), size=50, align="left", label="Смена силы")
cdl(ch, 850, 44, 450, 560, 450, 572, GREEN, W_(7, "маленькая", 1), 0.6, big=True, label="Маленькая зелёная", sound="chalk")
cdl(ch, 1010, 72, 318, 334, 672, 690, RED, W_(7, "большая", 2), 0.7, big=True, label="Большая красная", sound="whoosh")
arrow(ch, [(1150, 350), (1150, 690)], W_(7, "смена"), color=RED, thick=8, label="Смена вниз")
txt(ch, "c6_sheet", "ШПАРГАЛКА", RX, 150, W_(7, "шпаргалка"), size=46, color=YELLOW, label="Шпаргалка")

# ---------- глава 7: важно не что, а где ----------

ch = 8
plate(ch, "plate7", "7 • ВАЖНО НЕ ЧТО, А ГДЕ")
txt(ch, "c7_where", "ВАЖНО НЕ ЧТО,\nА ГДЕ", RX, 250, W_(8, "важно"), size=60, color=YELLOW, label="Важно не что, а где")
T_SHOW = W_(8, "смотри", 0, -0.2)
txt(ch, "c7_secret", "ГЛАВНЫЙ СЕКРЕТ", 640, 500, W_(8, "секрет"), size=66, label="Главный секрет", end=W_(8, "свеча", 0, -0.2),
    end_mode="dissolve")
big_candle(ch, 640, 62, 300, 620, 460, 800, GREEN, W_(8, "свеча"), label="Свеча сама по себе", end=T_SHOW, end_mode="dissolve")
C = Chart(110, 30, 170, 860, 0, 100)
LV = 20
pathA = [72, 62, 50, 38, 28, 21, 33, 45, 54, 44, 33, 21.2, 34, 44, 52, 41, 31]
dA = [(o, h, max(lo, LV + 0.3), c) for o, h, lo, c in ohlc_path(pathA, 80, 41, 1.6)]
line(ch, [(100, C.y(LV)), (690, C.y(LV))], W_(8, "уровень"), 0.6, color=BLUE, thick=7, label="Линия уровня")
candles(ch, C, dA, 0, W_(8, "линия"), W_(8, "отскакивал", 0, 0.4), label="График отскакивает от уровня", sound=None)
chalk_run(W_(8, "линия"), W_(8, "отскакивал", 0, 0.4))
for k, i in enumerate((5, 11)):
    ring(ch, C.x(i), C.y(LV), 30, 26, W_(8, "отскакивал", 0, 0.5 + 0.35 * k), sound="tap")
HA = C.x(17) + 8
big_candle(ch, HA, 26, C.y(36), C.y(31), C.y(36), C.y(LV), GREEN, W_(8, "появляется"), label="Молот на уровне")
txt(ch, "c7_h1", "МОЛОТ", HA, C.y(LV) + 56, W_(8, "молот"), size=40, color=BLUE, label="Молот", sound="tap")
tick_mark(ch, HA + 84, C.y(52), 86, W_(8, "сильный"), label="Зелёная галочка")
SOUND_EVENTS.append((W_(8, "сильный", 0, 0.15), "ding", 0, "динь на галочке"))
C2 = Chart(730, 24, 170, 860, 0, 100)
pathB = [72, 64, 68, 60, 64, 57, 61, 54, 58, 51, 55, 49, 53]
dB = ohlc_path(pathB, 76, 42, 1.3)
candles(ch, C2, dB, 0, W_(8, "тот"), W_(8, "тот", 0, 1.6), label="График без уровня", sound=None)
chalk_run(W_(8, "тот"), W_(8, "тот", 0, 1.6))
HB = C2.x(14) + 10
big_candle(ch, HB, 26, C2.y(54), C2.y(49), C2.y(54), C2.y(38), GREEN, W_(8, "пустого"), label="Молот посреди пустоты")
txt(ch, "c7_h2", "МОЛОТ", HB, C2.y(38) + 52, W_(8, "пустого", 0, 0.2), size=40, color=BLUE, label="Тот же молот", sound="tap")
el("question", ch, W_(8, "почти"), 0.3, label="Жёлтый вопрос", sound="pop", sound_arg=0, cx=HB + 88, cy=C2.y(66), size=150)
txt(ch, "c7_map", "СНАЧАЛА КАРТА,\nПОТОМ СВЕЧИ", RX, 480, W_(8, "карту"), size=46, label="Сначала карта")
txt(ch, "c7_rule", "СВЕЧА + УРОВЕНЬ\n= СИГНАЛ", RX, 680, W_(8, "формулу"), size=52, color=GREEN, label="Свеча + уровень = сигнал")

# ---------- глава 8: три ошибки новичка ----------

ch = 9
plate(ch, "plate8", "8 • ТРИ ОШИБКИ НОВИЧКА")
ROWS = (("c8_e1", "НЕЗАКРЫТАЯ СВЕЧА", 300), ("c8_e2", "ОДНА СВЕЧА", 470), ("c8_e3", "ЗАБЫТЫЙ ТАЙМФРЕЙМ", 640))
OKS = (W_(9, "решение"), W_(9, "контекст"), W_(9, "решение", 1))
for k, ((key, s, y), t_ok) in enumerate(zip(ROWS, OKS)):
    t_err = W_(9, "ошибка", k)
    cross_mark(ch, 1330, y, 34, t_err, label=f"Крестик {k + 1}", end=t_ok, end_mode="dissolve")
    txt(ch, key, s, 1395, y, t_err + 0.15, size=32, align="left", label=f"Ошибка {k + 1}", sound=None)
    tick_mark(ch, 1330, y, 78, t_ok + 0.2, label=f"Галочка {k + 1}")
    SOUND_EVENTS.append((t_ok + 0.3, "ding", 0, "динь: ошибка закрыта"))
e1, e2 = W_(9, "ошибка", 1, 0.1), W_(9, "ошибка", 2, -0.3)
E1 = dict(end=e1, end_mode="dissolve")
OP = 430
ts = [W_(9, "читать"), W_(9, "пока"), W_(9, "пока", 0, 1.0), W_(9, "свеча", 0, 0.7), W_(9, "красивый"), W_(9, "молот"),
      W_(9, "минуту"), W_(9, "превратиться"), W_(9, "обычную", 0, 0.3)]
live(ch, 400, 86, OP, list(zip(ts, (OP, OP - 90, OP + 70, OP - 40, OP - 30, 800, 350, 350, 650))),
     label="Свеча растёт в реальном времени", **E1)
for k in range(5):
    SOUND_EVENTS.append((W_(9, "пока", 0, k * 0.9), "chalk_fast", 0.5, ""))
el("clock", ch, W_(9, "отрезок"), 0.6, label="Часы", sound="chalk", cx=860, cy=300, r=108, color=WHITE, **E1)
for k in range(5):
    SOUND_EVENTS.append((W_(9, "отрезок", 0, 0.8 + k), "tick", 0, "тиканье часов" if k == 0 else ""))
txt(ch, "c8_wait", "ЖДИ ЗАКРЫТИЯ", 860, 600, W_(9, "жди"), size=64, color=YELLOW, label="Жди закрытия", **E1)
txt(ch, "c8_always", "ВСЕГДА", 860, 710, W_(9, "жди", 0, 0.5), size=46, label="Всегда", **E1)
E2 = dict(end=e2, end_mode="dissolve")
C = Chart(120, 40, 190, 860, 0, 100)
drop = [92, 88, 80, 76, 68, 62, 58, 52, 46, 42, 37, 41, 34, 30, 25, 21, 16, 12]
dF = ohlc_path(drop, 96, 43, 1.2)
candles(ch, C, dF, 0, W_(9, "верить"), W_(9, "посреди", 0, 0.6), label="Долгое падение", sound=None, **E2)
chalk_run(W_(9, "верить"), W_(9, "посреди", 0, 0.6))
ring(ch, C.x(11), C.y(39), 42, 66, W_(9, "зеленая"), label="Одна зелёная свеча", **E2)
txt(ch, "c8_one", "ОДНА СВЕЧА ≠ РАЗВОРОТ", 830, 250, W_(9, "разворот"), size=46, color=YELLOW, label="Одна свеча ≠ разворот", **E2)
txt(ch, "c8_ctx", "НУЖЕН КОНТЕКСТ:\nУРОВЕНЬ, СВЕЧИ ПОДРЯД,\nПОДТВЕРЖДЕНИЕ", 400, 730, W_(9, "контекст"), size=34,
    label="Нужен контекст", **E2)
C = Chart(130, 34, 310, 790, 0, 100)
rise5 = [18, 26, 24, 36, 44, 42, 56, 66, 64, 78, 90]
txt(ch, "c8_5m", "5 МИНУТ", 300, 215, W_(9, "пятиминутке"), size=46, label="5 минут")
candles(ch, C, ohlc_path(rise5, 10, 44, 1.2), 0, W_(9, "пятиминутке", 0, 0.1), W_(9, "мощный", 0, 0.5), label="Мощный рост",
        sound="whoosh")
txt(ch, "c8_day", "ДЕНЬ", 880, 215, W_(9, "дневном"), size=46, label="День")
big_candle(ch, 880, 96, 290, 362, 790, 830, RED, W_(9, "большой"), label="Большая красная свеча")
ring(ch, 880, 326, 56, 58, W_(9, "крошечная"), label="Крошечная тень")
line(ch, [(820, 326), (530, 326)], W_(9, "тень"), 0.5, color=YELLOW, thick=4, dashed=True, label="Та же область")
txt(ch, "c8_old", "СТАРШИЙ ГРАФИК ВАЖНЕЕ", 620, 900, W_(9, "старший"), size=50, color=YELLOW, label="Старший график важнее")

# ---------- итог: чек-лист ----------

ch = 10
plate(ch, "plate9", "ИТОГ • ЧЕК-ЛИСТ")
txt(ch, "c9_save", "СОХРАНИ ЧЕК-ЛИСТ", RX, 230, W_(10, "сохранить"), size=50, color=YELLOW, label="Сохрани чек-лист")
names = ["СВЕЧА = ОТРЕЗОК ВРЕМЕНИ", "ТЕЛО — РЕЗУЛЬТАТ", "ТЕНЬ — ПОПЫТКА", "5 СВЕЧЕЙ ПО ИМЕНАМ", "ВАЖНО, ГДЕ СВЕЧА", "ЖДИ ЗАКРЫТИЯ"]
stems = ["первое", "второе", "третье", "четвертое", "пятое", "шестое"]
for k in range(6):
    y = 205 + 125 * k
    ring(ch, 190, y, 40, 40, start(10) + 0.5 + 0.22 * k, color=WHITE, sound="tap")
    txt(ch, f"c9_i{k + 1}", names[k], 270, y, W_(10, stems[k]), size=48, align="left", label=f"Пункт {k + 1}", sound="tap")
    tick_mark(ch, 190, y, 74, W_(10, stems[k], 0, 1.1), label=f"Галочка {k + 1}")
    SOUND_EVENTS.append((W_(10, stems[k], 0, 1.25), "ding", 0, ""))
txt(ch, "c9_magic", "НЕ МАГИЯ,\nА ПОДСКАЗКИ", RX, 560, W_(10, "магия"), size=50, label="Не магия, а подсказки")
txt(ch, "c9_more", "БОЛЬШЕ ПОДСКАЗОК —\nУВЕРЕННЕЕ ЧТЕНИЕ", RX, 760, W_(10, "сходится"), size=36, label="Больше подсказок")

# ---------- финал: загадка с ответом и завершение серии ----------

ch = 11
T_ANS = W_(11, "молот")
T_W = W_(11, "этом", 0, -0.75)
UP = dict(end=T_W)
OUT = dict(end=T_ANS, end_mode="dissolve")
C = Chart(130, 36, 200, 860, 0, 100)
LV = 22
pathZ = [70, 60, 48, 36, 23.5, 38, 50, 58, 46, 35, 23.6, 39, 47, 38, 31]
dZ = [(o, h, max(lo, LV + 0.3), c) for o, h, lo, c in ohlc_path(pathZ, 78, 45, 1.4)]
line(ch, [(100, C.y(LV)), (1190, C.y(LV))], W_(11, "загадка"), 0.6, color=BLUE, thick=7, label="Уровень загадки", **UP)
candles(ch, C, dZ, 0, W_(11, "график"), W_(11, "появляется"), label="График дважды отскакивает", sound=None, **UP)
chalk_run(W_(11, "график"), W_(11, "появляется"))
HZ = C.x(15)
big_candle(ch, HZ, 15, C.y(36), C.y(32), C.y(36), C.y(LV + 0.3), GREEN, W_(11, "появляется", 0, 0.3), label="Свеча загадки", **UP)
txt(ch, "c10_q", "КАК НАЗЫВАЕТСЯ\nЭТА СВЕЧА?", RX, 230, W_(11, "называется"), size=48, color=YELLOW, label="Как называется?", **UP)
answer_button(ch, "c10_up", "ВВЕРХ ↑", RX - 135, GREEN, W_(11, "куда"), "Кнопка «вверх»", **UP)
answer_button(ch, "c10_down", "ВНИЗ ↓", RX + 135, RED, W_(11, "куда", 0, 0.3), "Кнопка «вниз»", **UP)
el("question", ch, W_(11, "вопроса"), 0.45, label="Жёлтый вопрос", sound="pop", sound_arg=0, cx=HZ + 130, cy=C.y(58), **OUT)
for k, c in enumerate(A.COUNTS):
    txt(ch, f"c10_cnt{k + 1}", f"{3 - k}…", RX - 160 + 160 * k, 640, c, size=110, color=YELLOW if k == 2 else WHITE, dur=0.25,
        label=f"Отсчёт {3 - k}", sound="tick", **OUT)
txt(ch, "c10_ans", "МОЛОТ", HZ, C.y(LV) + 60, T_ANS, size=64, color=BLUE, label="Ответ: молот", sound="chalk", **UP)
SOUND_EVENTS.append((T_ANS, "ding_bass", 0, "динь с басом на ответе"))
ring(ch, RX - 135, 420, 134, 66, W_(11, "вверх"), color=GREEN, thick=7, label="Обводка кнопки «вверх»", **UP)
T_NEXT = W_(11, "закроется")
cdl(ch, C.x(16), C.bw, C.y(46), C.y(34), C.y(44), C.y(33), GREEN, T_NEXT, 0.5, label="Закрылась выше молота", sound="chalk", **UP)
tick_mark(ch, C.x(16) - 50, C.y(60), 76, W_(11, "подтверждение"), label="Галочка подтверждения", **UP)
SOUND_EVENTS.append((W_(11, "подтверждение", 0, 0.15), "ding", 0, ""))
up = ohlc_path([52, 60, 68, 76, 84, 92], 44, 46, 1.3)
candles(ch, C, up, 17, W_(11, "подтверждение", 0, 0.5), W_(11, "подтверждение", 0, 1.8), label="График идёт вверх", sound="whoosh", **UP)
txt(ch, "c10_three", "СВЕЧА + УРОВЕНЬ\n+ ЗАКРЫТИЕ", RX, 640, W_(11, "сложилось", 0, 0.4), size=46, color=YELLOW, label="Три подсказки", **UP)
SOUND_EVENTS.append((T_W, "sponge", 0, "губка стирает доску"))
EXTRA_WIPES.append(T_W)
COLS = ((510, "c10_e1", "ВЫПУСК 1", ("СВЕЧА", "УРОВНИ", "НАПРАВЛЕНИЕ", "ПРОБОЙ", "ФИГУРЫ"), "первом",
         ("свечу", "уровни", "направление", "прабой", "фигуры")),
        (1410, "c10_e2", "ВЫПУСК 2", ("ТЕЛО", "ТЕНИ", "5 СВЕЧЕЙ", "ГДЕ СВЕЧА", "ЗАКРЫТИЕ"), "втором", None))
for x, key, title, items, stem, marks in COLS:
    t = W_(11, stem)
    txt(ch, key, title, x, 170, t, size=60, color=BLUE, label=title, sound="tap")
    for k, s in enumerate(items):
        t_i = W_(11, marks[k]) if marks else t + 0.45 * k
        txt(ch, f"{key}_{k + 1}", s, x, 280 + 92 * k, t_i, size=48, label=f"{title}: {s}", sound="tap")
txt(ch, "c10_end", "ТЕПЕРЬ ТЫ ЧИТАЕШЬ ГРАФИК", 960, 860, W_(11, "достаточно"), size=70, color=YELLOW, label="Теперь ты читаешь график")
