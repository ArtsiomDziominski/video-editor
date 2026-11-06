"use strict";
// TikTok «Пробил? Дождись возврата»: свеча пробивает уровень и закрывается выше, перемотка, возврат к уровню сверху,
// ретест с отскоком, правило в три шага, ловушка и уход без возврата; в конце время отматывается к первому кадру.

const DX = .46, BW = .32, WK = .045, LY = BW / 2 + .07;     // шаг свечей, толщина тела и тени, уровень стоит перед свечами
const ZL = 3, OPEN = 2.15, SHUT = 3.85, STOP = ZL - .2;      // мир A: уровень, первая свеча, линия стопа
const ZB = 2.6, GX = 9;                                      // мир B: уровень ловушки; третий пример стоит правее
const NOTE = 64;
const CX = 930, CY = 250, CR = 84;                           // часы в углу

const smooth = x => x * x * (3 - 2 * x);
const ein = x => x * x;
const STEP = 1 / 120;
const TURN = Math.PI * 2;

// Свеча по опорным точкам [время, цена, сглаживание]: тени — докуда цена успела дойти к этому моменту
function track(x, o, keys, wig = .025) {
  const a = keys[0][0], b = keys[keys.length - 1][0];
  const price = u => {
    if (u <= a) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (u > keys[i][0]) continue;
      const [ta, va] = keys[i - 1], [tb, vb, ease = smooth] = keys[i], q = (u - ta) / (tb - ta);
      return lerp(va, vb, ease(q)) + wig * Math.sin(q * Math.PI) * Math.sin(u * 41);
    }
    return keys[keys.length - 1][1];
  };
  const hi = [], lo = [];
  let H = o, L = o;
  for (let u = a; u <= b + STEP; u += STEP) {
    const v = price(u);
    H = Math.max(H, v);
    L = Math.min(L, v);
    hi.push(H);
    lo.push(L);
  }
  const fn = u => {
    if (u < a) return null;
    const j = clamp(Math.floor((u - a) / STEP), 0, hi.length - 1), c = price(u);
    return {x, o, c, h: Math.max(hi[j], c), l: Math.min(lo[j], c)};
  };
  fn.times = keys.map(k => k[0]);
  return fn;
}

// ---------- мир A: время событий ----------

const T0 = e("a_t1"), T1 = e("a_t1b"), R0 = e("a_rew"), R1 = e("a_ff"), RF = R1 - R0;
const F0 = e("a_fall"), TOUCH = e("a_touch");
const B4 = e("b_c4"), LOW4 = e("b_touch"), WICK4 = e("b_wick"), UP4 = e("b_bounce");
const BACK = e("e_back");

const HERO = track(0, OPEN, [[0, 2.72], [T0, ZL, ein], [lerp(T0, T1, .6), 3.98, eo3], [T1, SHUT]], .03);
const C1 = track(DX, SHUT, [[R0 + .02 * RF, SHUT], [R0 + .2 * RF, 4.14], [R0 + .36 * RF, 3.8], [R0 + .46 * RF, 3.9]], .04);
const C2 = track(2 * DX, 3.9, [[R0 + .52 * RF, 3.9], [R0 + .62 * RF, 3.96], [R0 + .9 * RF, 3.47], [R0 + .98 * RF, 3.52]], .04);
const C3 = track(3 * DX, 3.52, [[F0, 3.52], [F0 + .15, 3.57], [TOUCH, 3.03, ein], [TOUCH + 1.1, 3.16, eo3]], .02);
const C4 = track(4 * DX, 3.16, [[B4, 3.16], [LOW4, 2.92], [WICK4, 3.14], [UP4, 3.19], [UP4 + .4, 3.56, eo3], [UP4 + .75, 3.48]], .02);
const TRACKS = [HERO, C1, C2, C3, C4];
const UEND = UP4 + .75;
const heroAt = u => ({...HERO(u), l: OPEN - .1});          // нижняя тень была ещё до первого кадра

// Время графика: вперёд — как ролик; в конце отматывается к нулю, каждый отрезок между опорными точками за равное время
const KEYS_U = [...new Set([0, ...TRACKS.flatMap(f => f.times)])].sort((a, b) => a - b);

function uOf(t) {
  if (t < BACK) return Math.min(t, UEND);
  const r = eio(pg(t, BACK, D.dur - BACK)), q = (1 - r) * (KEYS_U.length - 1), i = Math.min(Math.floor(q), KEYS_U.length - 2);
  return lerp(KEYS_U[i], KEYS_U[i + 1], q - i);
}

const dustT = t => t < BACK ? t : BACK * (1 - eio(pg(t, BACK, D.dur - BACK)));   // пыль фона тоже отматывается

const atX = (list, x0 = 0) => list.map(([o, c, h, l], i) => ({x: x0 + (i - list.length) * DX, o, c, h, l}));
const PRIOR_A = atX([[2.05, 2.45, 2.6, 1.95], [2.45, 2.2, 2.55, 2.1], [2.2, 2.7, 2.98, 2.12], [2.7, 2.38, 2.78, 2.3],
  [2.38, 2.85, 3, 2.3], [2.85, 2.5, 2.96, 2.4], [2.5, 2.62, 2.72, 2.38], [2.62, OPEN, 2.7, 2.08]]);     // тени упираются в уровень снизу
const PRIOR_B = atX([[2.3, 1.95, 2.4, 1.85], [1.95, 2.35, 2.6, 1.9], [2.35, 2.05, 2.45, 1.98], [2.05, 2.4, 2.58, 2.0],
  [2.4, 2.15, 2.5, 2.05], [2.15, 2.5, 2.6, 2.1], [2.5, 2.3, 2.55, 2.2], [2.3, 2.0, 2.4, 1.92]]);
const PRIOR_C = atX([[2.0, 2.3, 2.45, 1.9], [2.3, 2.1, 2.4, 2.0], [2.1, 2.45, 2.6, 2.05], [2.45, 2.25, 2.5, 2.15],
  [2.25, 2.5, 2.58, 2.2], [2.5, 2.35, 2.6, 2.3], [2.35, 2.2, 2.42, 2.12], [2.2, 2.1, 2.3, 2.02]], GX);

// ---------- мир B: ловушка и уход без возврата ----------

const DF = e("d_fall"), DC = e("d_close"), GO = e("d_go");
const B0 = {x: 0, o: 2.0, c: 2.88, h: 2.97, l: 1.93};
const B1 = track(DX, 2.88, [[DF, 2.88], [DF + .25, 2.95], [lerp(DF + .25, DC, .5), 2.63], [lerp(DF + .25, DC, .7), 2.7],
  [DC, 2.22, ein], [DC + .3, 2.3, eo3]], .02);
const K0 = {x: GX, o: 2.1, c: 2.95, h: 3.04, l: 2.04};
const KK = [0, 1, 2].map(i => track(GX + (i + 1) * DX, 2.95 + i * .45, [[GO + i * .3, 2.95 + i * .45], [GO + i * .3 + .28, 3.4 + i * .45, eo3]], .03));

// Смешать два цвета #rrggbb
function blend(a, b, x) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = s => Math.round(lerp((A >> s) & 255, (B >> s) & 255, x)).toString(16).padStart(2, "0");
  return "#" + ch(16) + ch(8) + ch(0);
}

// ---------- камера: каждая точка — [когда, сколько едем, масштаб, поворот, x мира, z мира, x экрана, y экрана] ----------

const SHOT0 = [540, 8, 0, ZL, 620, 960];
const SHOT_A = [[0, .001, ...SHOT0],
  [T0 - .25, T1 - T0 + .6, 560, 6, 0, 3.35, 600, 980],              // вслед за свечой вверх
  [e("a_entry") - .1, .9, 630, 9, .05, 3.7, 560, 960],             // ближе к точке входа
  [e("a_wait"), .8, 480, 10, .4, 3.45, 600, 1010],                   // «не торопись» — шаг назад
  [R0, RF, 450, 6, 1.5 * DX, 3.5, 600, 990],                           // перемотка: едем вправо вдоль новых свечей
  [F0 - .1, 1.2, 470, 9, 1.5 * DX, 3.35, 560, 1010],                 // за падением
  [e("a_red"), 1.8, 510, 11, 1.2 * DX, 3.4, 560, 990],               // медленный наезд на красное
  [e("b_ceil") - .35, 1, 440, 7, -.9, 3.2, 540, 960],               // влево: тени снизу упирались в уровень
  [B4 - .25, 1, 560, 11, 4 * DX, 3.15, 600, 1180],                   // к свече ретеста
  [e("c_wide"), 1.1, 420, 8, 2 * DX, 3.35, 560, 1000],               // весь путь целиком
  [e("c_stop") - .2, .9, 520, 11, 4 * DX - .1, 3.15, 600, 1040],     // ближе к стопу
  [e("e_wipe"), .001, 410, 8, 1.8 * DX, 3.35, 560, 1080],            // финал: снова первый график
  [e("e_wipe") + .05, BACK - e("e_wipe"), 440, 10, 1.6 * DX, 3.35, 560, 1070],
  [BACK, D.dur - BACK, ...SHOT0]];
const SHOT_B = [[0, .001, 520, 8, .35, 2.7, 600, 1080],
  [DF, 1.4, 560, 11, DX, 2.6, 600, 1060],
  [DC - .15, .5, 500, 7, .5, 2.55, 590, 1060],
  [e("d_pan"), .9, 520, 9, GX + .1, 2.75, 600, 1120],
  [GO - .1, 1.4, 440, 10, GX + 2 * DX, 3.35, 560, 1080]];

function viewOf(keys, t, shake = 0) {
  let [, , s, th, fx, fz, px, py] = keys[0];
  for (const k of keys.slice(1)) {
    const x = eio(pg(t, k[0], k[1]));
    s = Math.exp(lerp(Math.log(s), Math.log(k[2]), x));
    th = lerp(th, k[3], x);
    fx = lerp(fx, k[4], x);
    fz = lerp(fz, k[5], x);
    px = lerp(px, k[6], x);
    py = lerp(py, k[7], x);
  }
  const live = pg(t, 0, .7) * (1 - pg(t, D.dur - 1.1, .6));   // камера не стоит на месте, но на стыке петли замирает
  s *= 1 + live * .02 * Math.sin(t * .47);
  th += live * 1.8 * Math.sin(t * .61);
  const I = new Iso(0, 0, s, th, .42), P = I.p(fx, 0, fz);
  I.ox = px - P[0];
  I.oy = py - P[1] + shake * 18;
  return {I, s, v: {x: 610 + fx * 60, y: 540 + fz * 40 + Math.log(s) * 240}};
}

// ---------- общие предметы ----------

const FINE = (() => {                                       // неподвижное зерно: плавный фон не распадается при сжатии
  const n = 256, cv = document.createElement("canvas"), r = rng(31);
  cv.width = cv.height = n;
  const x = cv.getContext("2d"), im = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    im.data.fill(255, 4 * i, 4 * i + 3);
    im.data[4 * i + 3] = Math.floor(r() * 9);
  }
  x.putImageData(im, 0, 0);
  return cv;
})();

function dither() {
  resetCam();
  g.fillStyle = g.createPattern(FINE, "repeat");
  g.fillRect(0, 0, W, H);
}

function sky(V, bt, red, pulse = 0) {                       // red: 0 — зелёный свет пробоя, 1 — тревожный красный
  const dip = 1 - .7 * Math.sin(Math.PI * red);            // в середине перехода свет гаснет, а не уходит в бурый
  backdrop(V.v, bt, blend(C.rise, C.fall, red), {bg: blend(C.bg, blend("#0B3324", "#3B0B1E", red), .85 * dip), glow: .48 * dip + pulse, cx: 540, cy: 880, r: 1250});
  dither();
}

function candle3D(I, k, o = {}) {
  const main = k.c >= k.o ? C.rise : C.fall, d = BW / 2, lo = Math.min(k.o, k.c), hi = Math.max(k.o, k.c);
  const faces = [tone(main, .22), main, tone(main, -.36)], wick = [tone(main, .1), tone(main, -.2), tone(main, -.2)], m = WK / 2;
  g.globalAlpha = o.a ?? 1;
  if (k.l < lo) box(I, k.x - m, -m, k.l, WK, WK, lo - k.l, wick, {grain: 0, edge: 0});
  box(I, k.x - d, -d, lo, BW, BW, Math.max(hi - lo, .04), faces, {grain: .24, edge: tone(main, .42)});
  if (k.h > hi) box(I, k.x - m, -m, hi, WK, WK, k.h - hi, wick, {grain: 0, edge: 0});
  g.globalAlpha = 1;
}

function beam(I, z, flash, x0 = -16, x1 = 9, col = C.sky) {
  const a = I.p(x0, LY, z), b = I.p(x1, LY, z);
  line(a, b, rgba(col, .2 + .5 * flash), 30 + 60 * flash, "butt");
  box(I, x0, LY - .03, z - .03, x1 - x0, .06, .06, [tone(col, .4 + .4 * flash), tone(col, flash * .6), tone(col, -.3)], {grain: 0, edge: 0});
}

const SPARKS = (() => {
  const r = rng(17), out = [];
  for (let i = 0; i < 18; i++) out.push({vx: (r() - .5) * 3.4, vy: r() * 1.2, vz: 1 + r() * 2.4, s: .03 + r() * .05, col: [C.sky, C.white, C.rise][i % 3]});
  return out;
})();

function sparks(I, dt, zc, x0 = 0) {
  if (dt <= 0 || dt > .9) return;
  g.globalAlpha = 1 - dt / .9;
  for (const k of SPARKS) box(I, x0 + k.vx * dt, LY + k.vy * dt, zc + k.vz * dt - 2.8 * dt * dt, k.s, k.s, k.s, k.col, {grain: 0, edge: 0});
  g.globalAlpha = 1;
}

function ringAt(cx, cy, rx, ry, p, col) {
  if (p <= 0) return;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, -.12, -1.3, -1.3 + p * 6.7);
  g.strokeStyle = col;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.stroke();
}

function bodyEdge(I, k, col, a) {                           // обводка передней грани тела
  if (a <= 0) return;
  const d = BW / 2, lo = Math.min(k.o, k.c), hi = Math.max(k.o, k.c);
  g.save();
  g.globalAlpha = a;
  g.shadowColor = col;
  g.shadowBlur = 34;
  path([I.p(k.x - d, d, lo), I.p(k.x + d, d, lo), I.p(k.x + d, d, hi), I.p(k.x - d, d, hi)]);
  g.strokeStyle = col;
  g.lineWidth = 8;
  g.stroke();
  g.restore();
}

// Точка входа: кружок со светом, кольцо пульсирует
function entryDot(P, q, col, hot = 0) {
  if (q <= 0) return;
  g.save();
  g.shadowColor = col;
  g.shadowBlur = 24 + 30 * hot;
  g.strokeStyle = col;
  g.lineWidth = 5;
  g.globalAlpha *= .5 + .5 * (1 - hot);
  g.beginPath();
  g.arc(P[0], P[1], (26 + 16 * hot) * q, 0, 7);
  g.stroke();
  g.restore();
  g.save();
  g.fillStyle = col;
  g.shadowColor = col;
  g.shadowBlur = 20;
  g.beginPath();
  g.arc(P[0], P[1], 14 * q, 0, 7);
  g.fill();
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(P[0], P[1], 5 * q, 0, 7);
  g.fill();
  g.restore();
}

function dashed(a, b, col, w = 5, phase = 0) {
  g.save();
  g.setLineDash([16, 12]);
  g.lineDashOffset = phase;
  line(a, b, col, w, "butt");
  g.restore();
}

// ---------- часы: без цифр, только риски, стрелка и заполненный сектор ----------

function clockAt(q, p, ang) {
  if (q <= 0) return;
  resetCam();
  g.save();
  g.translate(CX, CY);
  g.scale(q, q);
  g.fillStyle = "rgba(10,8,14,.55)";
  g.beginPath();
  g.arc(-7, 9, CR + 6, 0, 7);
  g.fill();
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(0, 0, CR, 0, 7);
  g.fill();
  if (p > 0) {
    g.fillStyle = rgba(C.amber, .9);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, CR - 12, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = C.white;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, 0, CR, 0, 7);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    line([Math.sin(a) * (CR - 16), -Math.cos(a) * (CR - 16)], [Math.sin(a) * (CR - 7), -Math.cos(a) * (CR - 7)], C.white, i % 3 ? 2.5 : 5);
  }
  line([0, 0], [Math.sin(ang) * (CR - 22), -Math.cos(ang) * (CR - 22)], C.white, 8);
  g.fillStyle = C.coral;
  g.beginPath();
  g.arc(0, 0, 11, 0, 7);
  g.fill();
  g.restore();
}

// ---------- мир A ----------

function redFill(I, t) {                                    // от входа до уровня всё заливается красным
  if (t < e("a_red") || t >= e("b_t1") + .5) return;
  const a = 1 - pg(t, e("b_t1"), .45), zb = lerp(SHUT, ZL, eo3(pg(t, e("a_red"), .55)));
  const pulse = .5 + .5 * Math.sin((t - e("a_red")) * TURN * 1.4);
  const y = -BW / 2 - .05, x0 = -BW / 2 - .08, x1 = 3 * DX + BW / 2 + .3;
  g.globalAlpha = a * (.34 + .18 * pulse);
  poly([I.p(x0, y, SHUT), I.p(x1, y, SHUT), I.p(x1, y, zb), I.p(x0, y, zb)], C.fall);
  g.globalAlpha = 1;
}

function worldA(t) {
  const u = uOf(t), live = t < BACK;
  const red = pg(u, TOUCH - .25, .4) * (1 - pg(u, e("b_t1") - .1, .7));
  const shake = live ? 1.4 * wob(t - T0, 5, 6) + wob(t - TOUCH, 5, 6) + .6 * wob(t - UP4, 4, 6) : 0;
  const V = viewOf(SHOT_A, t, shake), I = V.I;
  const hit = u >= T0 ? Math.exp(-(u - T0) * 4) : 0, hit2 = u >= TOUCH ? Math.exp(-(u - TOUCH) * 4) : 0;
  const alarm = t >= e("a_red") && t < e("b_t1") ? .12 * (.5 + .5 * Math.sin((t - e("a_red")) * TURN * 1.4)) : 0;
  sky(V, dustT(t), red, .3 * hit + alarm);
  redFill(I, t);
  for (const k of PRIOR_A) candle3D(I, k);
  candle3D(I, heroAt(u));
  for (const f of TRACKS.slice(1)) { const k = f(u); if (k) candle3D(I, k); }
  beam(I, ZL, Math.max(hit, .7 * hit2));
  sparks(I, u - T0, ZL);
  return V;
}

// Подпись уровня: «БЫЛ ПОТОЛОК» зачёркивается и переворачивается в «СТАЛ ПОЛОМ»
function levelSign(I, t) {
  const t0 = e("b_ceil");
  if (t < t0) return;
  const f = pg(t, e("b_floor") - .12, .3), old = f < .5, sy = old ? 1 - 2 * f : 2 * f - 1;
  const P = I.p(-1.25, LY, ZL), size = 54, y = P[1] - 136, hh = size * 1.5;
  g.save();
  g.translate(P[0], y + hh / 2);
  g.scale(1, Math.max(.001, sy));
  g.translate(-P[0], -y - hh / 2);
  if (old) {
    const s = tx("b_ceil");
    tag(s, P[0], y, t, t0, C.fall, {size, tail: true, tc: C.white});
    const p = eo3(pg(t, e("b_strike"), .25)), full = widthOf(s, size) + size * 1.1, a = P[0] - full / 2 - 10;
    if (p > 0) line([a, y + hh * .5], [a + (full + 20) * p, y + hh * .5], C.white, 7);
  } else tag(tx("b_floor"), P[0], y, t, t0 - 1, C.rise, {size, tail: true});
  g.restore();
}

function sceneA(t) {
  const V = worldA(t), I = V.I, u = uOf(t);
  foreground(V.v, t, .4);
  resetCam();
  // Вход на вершине первой свечи: сначала вопрос, потом подсвечен красным
  if (t >= e("a_entry") && t < e("b_t1") + .4) {
    const P = I.p(0, BW / 2, SHUT), fade = 1 - pg(t, e("b_t1"), .35), hot = t >= e("a_red") ? .5 + .5 * Math.sin((t - e("a_red")) * TURN * 1.4) : 0;
    g.globalAlpha = fade;
    if (t >= e("a_touch")) dashed(P, I.p(lerp(0, 3 * DX + .45, eo3(pg(t, e("a_touch"), .5))), BW / 2, SHUT), C.amber, 5, -t * 40);
    tag(tx("a_entry"), P[0], P[1] - 112, t, e("a_entry"), t >= e("a_red") ? C.fall : C.amber, {size: 46, tail: true, tc: t >= e("a_red") ? C.white : C.bg});
    entryDot(P, back(pg(t, e("a_entry"), .3)), t >= e("a_red") ? C.fall : C.amber, hot);
    g.globalAlpha = 1;
  }
  // «был потолком»: тени прошлых свечей упирались в уровень снизу
  if (t >= e("b_ceil") && t < e("b_ceil") + 1.4) {
    PRIOR_A.filter(k => k.h >= 2.95).forEach((k, i) => {
      const dt = t - e("b_ceil") - .1 * i, P = I.p(k.x, 0, k.h);
      if (dt <= 0 || dt > .7) return;
      g.globalAlpha = 1 - dt / .7;
      g.strokeStyle = C.amber;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(P[0], P[1], 10 + 40 * eo3(dt / .7), 0, 7);
      g.stroke();
      g.globalAlpha = 1;
    });
  }
  // «проверяют сверху»: стрелка опускается на уровень там, где будет ретест
  if (t >= e("b_check") && t < B4 + .4) {
    const P = I.p(4 * DX, LY, ZL + .5 - .16 * eio(pg(t, e("b_check"), .5)));
    g.globalAlpha = back(pg(t, e("b_check"), .3)) * (1 - pg(t, B4, .35));
    arrowUp(P[0], P[1], 46, C.amber, 1);
    g.globalAlpha = 1;
  }
  if (t < e("d_wipe")) levelSign(I, t);
  if (t >= e("b_wick") && t < e("c_wide") + .3) {          // внизу осталась тень: кольцо вокруг неё
    const k = C4(u), a = I.p(4 * DX, 0, k.l), b = I.p(4 * DX, 0, Math.min(k.o, k.c));
    g.globalAlpha = 1 - pg(t, e("c_wide"), .3);
    ringAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 74, (a[1] - b[1]) / 2 + 52, eo3(pg(t, e("b_wick"), .45)), C.amber);
    g.globalAlpha = 1;
  }
  // Правило: три шага подсвечивают свечи по очереди, потом вход на отскоке и стоп под уровнем
  if (t >= e("c_1")) {
    const fade = 1 - pg(t, e("d_wipe") - .3, .25);
    bodyEdge(I, heroAt(u), C.amber, fade * eio(pg(t, e("c_1"), .3)) * (1 - .65 * pg(t, e("c_2"), .3)));
    if (t >= e("c_2")) {
      const P = I.p(3 * DX, BW / 2, ZL + .02);
      g.globalAlpha = fade * (1 - .5 * pg(t, e("c_3"), .3));
      ringAt(P[0], P[1] - 6, 76, 46, eo3(pg(t, e("c_2"), .45)), C.amber);
      g.globalAlpha = 1;
    }
    if (t >= e("c_3")) {
      const k = C4(u), P = I.p(4 * DX, BW / 2, k.c);
      bodyEdge(I, k, C.rise, fade * eio(pg(t, e("c_3"), .3)));
      g.globalAlpha = fade;
      if (t >= e("c_in")) tag(tx("c_in"), P[0], P[1] - 112, t, e("c_in"), C.rise, {size: 46, tail: true});   // над точкой: не уходит за край
      entryDot(P, back(pg(t, e("c_3"), .3)), C.rise);
      g.globalAlpha = 1;
    }
    if (t >= e("c_stop")) {
      const p = eo3(pg(t, e("c_stop"), .35)), x0 = 4 * DX - .42, x1 = lerp(x0, 4 * DX + .62, p);
      g.globalAlpha = fade;
      box(I, x0, LY - .02, STOP - .025, x1 - x0, .05, .05, [tone(C.fall, .3), C.fall, tone(C.fall, -.3)], {grain: 0, edge: 0});
      const a = I.p(x0, LY, STOP), b = I.p(x1, LY, STOP);
      line(a, b, rgba(C.fall, .35), 16, "butt");
      if (p > .3) tag(tx("c_stop"), a[0] - 14, a[1] - 34, t, e("c_stop") + .1, C.fall, {size: 46, align: "right", tc: C.white});
      if (t >= e("c_near")) {                                 // скобка: вход и стоп рядом
        const q = eo3(pg(t, e("c_near"), .4)), k = C4(u), top = I.p(4 * DX - .32, LY, k.c), bot = I.p(4 * DX - .32, LY, STOP);
        const mid = lerp(top[1], bot[1], .5), h = (bot[1] - top[1]) / 2 * q;
        line([top[0], mid - h], [top[0], mid + h], C.amber, 6);
        line([top[0], mid - h], [top[0] + 18, mid - h], C.amber, 6);
        line([top[0], mid + h], [top[0] + 18, mid + h], C.amber, 6);
      }
      g.globalAlpha = 1;
    }
  }
  // Надписи
  note("a_t1", NOTE, 300, 112, C.white, t, {off: e("a_wait") - .1, block: C.rise});
  const b1 = note("a_t1b", NOTE, 420, 84, C.white, t, {off: e("a_wait") - .1, block: C.rise, lh: 96});
  if (t >= e("a_ok") && t < e("a_wait") + .2) {
    const last = tx("a_t1b").split("\n").pop();
    g.globalAlpha = 1 - pg(t, e("a_wait") - .1, .25);
    tick(NOTE + widthOf(last, 84) + 62, b1 - 30, 38, eo3(pg(t, e("a_ok"), .35)), C.rise, 12);
    g.globalAlpha = 1;
  }
  note("a_t2", NOTE, 300, 96, C.white, t, {off: R1 - .2, block: C.amber});
  note("a_t3", NOTE, 300, 96, C.white, t, {off: e("b_t1") - .25, block: C.fall, lh: 108});
  note("b_t1", NOTE, 300, 120, C.white, t, {off: e("c_wide") - .2, block: C.sky});
  const off = e("d_wipe") - .3;
  note("c_1", NOTE, 280, 66, C.white, t, {off, block: C.amber});
  note("c_2", NOTE, 380, 66, C.white, t, {off, block: C.amber});
  note("c_3", NOTE, 480, 66, C.white, t, {off, block: C.rise});
  // Часы: тикают, на перемотке стрелка несётся
  if (t >= e("a_clock") && t < R1 + .9) {
    const shown = back(pg(t, e("a_clock"), .3)) * (1 - eio(pg(t, R1 + .5, .3)));
    const slow = TURN * Math.floor((Math.min(t, R0) - e("a_clock")) * 5) / 60;
    clockAt(shown, pg(t, R0, RF), slow + lerp(0, TURN * 6, eio(pg(t, R0, RF))));
  }
}

// ---------- мир B: ловушка, затем третий пример ----------

function jawRow(I, gap, dir, shift, steel, a) {           // ряд зубьев капкана; dir 1 — верхняя челюсть, зубья вниз
  const n = 6, x0 = DX - .62, w = 1.24 / n, y = LY + .05, tip = ZB + dir * gap, root = tip + dir * .24;
  g.globalAlpha = a;
  line(I.p(x0 - .06, y, root + dir * .03), I.p(x0 + n * w + .06, y, root + dir * .03), tone(steel, -.35), 14, "round");
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + .5) * w + shift, pts = [I.p(x - w * .42, y, root), I.p(x + w * .42, y, root), I.p(x, y, tip)];
    poly(pts, steel);
    poly([pts[0], pts[2], I.p(x, y, root)], tone(steel, .3));
    path(pts);
    g.strokeStyle = tone(steel, -.5);
    g.lineWidth = 2.5;
    g.stroke();
  }
  g.globalAlpha = 1;
}

function jaws(I, t) {
  if (t < DC - .45 || t >= e("d_pan") + .5) return;
  const open = .5 * eo3(pg(t, DC - .45, .25)), shut = ein(pg(t, DC, .08)), gap = lerp(open, -.1, shut) + .03 * wob(t - DC - .08, 7, 9);
  const a = pg(t, DC - .45, .2) * (1 - pg(t, e("d_pan"), .4)), steel = blend("#D9D5E2", "#FF8FA8", .6 * pg(t, DC, .15));
  jawRow(I, gap, 1, 0, steel, a);
  jawRow(I, gap, -1, 1.24 / 12, steel, a);
}

function sceneB(t) {
  const shake = 1.6 * wob(t - DC, 6, 6), V = viewOf(SHOT_B, t, shake), I = V.I;
  const snapA = pg(t, DC, .2), red = snapA * (1 - pg(t, e("d_pan"), .6));
  sky(V, t, red, .35 * (t >= DC ? Math.exp(-(t - DC) * 3) : 0));
  for (const k of PRIOR_B) candle3D(I, k);
  candle3D(I, B0);
  const k1 = B1(t);
  if (k1) candle3D(I, k1);
  beam(I, ZB, t >= DC ? Math.exp(-(t - DC) * 4) : 0, -5, 2.4, blend(C.sky, C.fall, snapA));
  jaws(I, t);
  for (const k of PRIOR_C) candle3D(I, k);
  candle3D(I, K0);
  for (const f of KK) { const k = f(t); if (k) candle3D(I, k); }
  beam(I, ZB, 0, GX - 4.5, GX + 3.5);
  sparks(I, t - GO - .6, 4.3, GX + 3 * DX);
  foreground(V.v, t, .4);
  resetCam();
  if (t >= e("d_safe") && t < e("d_pan") + .3) {             // «ты просто не зашёл»: вход так и не случился
    const P = I.p(2 * DX + .05, LY, ZB + .5), q = back(pg(t, e("d_safe"), .3)) * 2.4;
    g.globalAlpha = 1 - pg(t, e("d_pan"), .3);
    g.save();
    g.setLineDash([12, 10]);
    g.strokeStyle = C.white;
    g.lineWidth = 6;
    path([[P[0], P[1] - 26 * q], [P[0] + 26 * q, P[1]], [P[0], P[1] + 26 * q], [P[0] - 26 * q, P[1]]]);
    g.stroke();
    g.restore();
    cross(P[0], P[1], 40, eo3(pg(t, e("d_safe") + .15, .3)), C.fall, 13);
    g.globalAlpha = 1;
  }
  note("d_t1", NOTE, 300, 92, C.white, t, {off: e("d_pan") - .1, block: C.fall, lh: 104});
  const off = e("e_wipe") - .3;
  note("d_t2", NOTE, 300, 76, C.white, t, {off, block: C.rise});
  note("d_t3", NOTE, 410, 112, C.rise, t, {off});
}

// ---------- финал и петля ----------

function sceneEnd(t) {
  const V = worldA(t);
  foreground(V.v, t, .4);
  resetCam();
  const off = BACK - .12;
  note("e_t1", NOTE, 280, 110, C.white, t, {off, block: C.amber});
  note("e_t1b", NOTE, 400, 110, C.white, t, {off, block: C.rise, lh: 122});
  note("e_t2", NOTE, 650, 64, C.amber, t, {off, block: C.coral});
  const x = pg(t, BACK, D.dur - BACK - .2);
  clockAt(back(pg(t, BACK - .06, .16)) * (1 - eio(pg(t, D.dur - .24, .2))), 1 - x, -TURN * 5 * eio(x));
}

// ---------- шторка без заставки ----------

function chWipe(t, c) {
  const inn = eio(pg(t, c - .24, .24)), out = eio(pg(t, c + .02, .28));
  if (inn <= 0 || out >= 1) return;
  resetCam();
  g.save();
  shutterPath({kind: 0, inn, out});
  g.clip();
  g.fillStyle = C.coral;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,.34)";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let x = 0; x < W; x += 180) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 90; y < H; y += 180) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.restore();
}

OVERLAYS.push(t => { chWipe(t, e("d_wipe")); chWipe(t, e("e_wipe")); });

function drawAll(t) {
  if (t < e("d_wipe")) sceneA(t);
  else if (t < e("e_wipe")) sceneB(t);
  else sceneEnd(t);
}

for (let k = 1; k <= 7; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_t1", -.1, .45, 4], ["a_rew", 0, RF + .4, 8], ["a_touch", -.3, .3, 6], ["b_bounce", 0, .5, 5], ["d_wipe", -.26, .32, 10],
  ["d_close", -.1, .25, 6], ["d_pan", 0, .9, 10], ["d_go", 0, 1, 6], ["e_wipe", -.26, .32, 10], ["e_back", 0, D.dur - e("e_back"), 12]);
