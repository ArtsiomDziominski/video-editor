"use strict";
// TikTok «Подожди закрытия»: свеча растёт сквозь уровень, часы перематывают время, в конце ролик отматывается к первому кадру.

const DX = .46, BW = .32, WK = .045, LY = BW / 2 + .07;       // шаг свечей, толщина тела и тени, уровень стоит перед свечами
const ZL = 3, OPEN = 2.35, TOP = 4.05, SHUT = 2.18;         // первая свеча: уровень, открытие, куда летит, закрытие
const ZB = 2.4, OPB = 3.2, DIP = 1.25, SHUTB = 3.36;        // свеча-молот: уровень, открытие, куда падает, закрытие
const RIGHT = {x: 1.25, o: 3.1, c: 3.95, h: 4.25, l: 3.04};  // свеча с телом над уровнем
const NOTE = 64;
const CX = 930, CY = 250, CR = 84;                          // часы в углу

const T0 = e("a_t1"), T1 = e("a_top"), R0 = e("a_rew"), R1 = e("a_close");
const F0 = e("d_t1"), S0 = e("d_rew"), S1 = e("d_close");

// ---------- цена во времени ----------

const smooth = x => x * x * (3 - 2 * x);

function priceA(u) {
  if (u <= T0) return lerp(OPEN + .1, ZL, (u / T0) ** 1.7);
  if (u <= T1) return lerp(ZL, TOP, eo3((u - T0) / (T1 - T0)));
  if (u <= R0) return TOP + .05 * Math.sin((u - T1) * 8);
  if (u >= R1) return SHUT;
  const x = (u - R0) / (R1 - R0);                           // ускоренное время: дёргается вверх-вниз и сходит к закрытию
  return Math.max(SHUT - .02, lerp(TOP, SHUT, smooth(x)) + (1 - x) ** .6 * x ** .3 * (.62 * Math.sin(x * 31) + .34 * Math.sin(x * 73 + 1)));
}

function priceB(t) {
  if (t <= F0 - .3) return OPB - .04;
  if (t <= F0) return lerp(OPB - .04, ZB, ei3((t - F0 + .3) / .3));
  if (t <= F0 + .7) return lerp(ZB, DIP, eo3((t - F0) / .7));
  if (t <= S0) return DIP + .04 * Math.sin((t - F0) * 8);
  if (t >= S1) return SHUTB;
  const x = (t - S0) / (S1 - S0);
  return Math.min(SHUTB + .02, lerp(DIP, SHUTB, smooth(x)) + (1 - x) ** .6 * x ** .3 * (.42 * Math.sin(x * 27) + .24 * Math.sin(x * 61 + 2)));
}

// Тень свечи: сколько цена успела пройти к этому моменту
const STEP = 1 / 120;

function extremes(fn, a, b, pick) {
  const out = [];
  let v = fn(a);
  for (let u = a; u <= b + STEP; u += STEP) { v = pick(v, fn(u)); out.push(v); }
  return u => out[clamp(Math.floor((u - a) / STEP), 0, out.length - 1)];
}

const HIGH_A = extremes(priceA, 0, R1, Math.max), LOW_B = extremes(priceB, F0 - .4, S1, Math.min);
const rewound = (t, top) => top * (1 - eio(pg(t, e("e_back"), D.dur - e("e_back"))));
const uOf = t => t < e("e_back") ? Math.min(t, R1) : rewound(t, R1);
const heroA = u => {                                        // первая свеча обрастает тенями, в первом кадре их нет
  const c = priceA(u), wick = smooth(pg(u, 0, T0));
  return {x: 0, o: OPEN, c, h: HIGH_A(u) + .16 * wick, l: Math.min(OPEN - .12 * wick, c)};
};
const heroB = t => { const c = priceB(t); return {x: 0, o: OPB, c, h: Math.max(OPB + .05, c + .04), l: LOW_B(t)}; };

const atX = list => list.map(([o, c, h, l], i) => ({x: (i - list.length) * DX, o, c, h, l}));
const PRIOR_A = atX([[2.05, 2.45, 2.6, 1.95], [2.45, 2.2, 2.55, 2.1], [2.2, 2.7, 2.98, 2.12], [2.7, 2.38, 2.78, 2.3],
  [2.38, 2.85, 3, 2.3], [2.85, 2.5, 2.96, 2.4], [2.5, 2.62, 2.72, 2.38], [2.62, OPEN, 2.7, 2.28]]);     // тени упираются в уровень снизу
const PRIOR_B = atX([[3.55, 3.1, 3.7, 3], [3.1, 3.4, 3.5, 2.95], [3.4, 2.85, 3.5, 2.72], [2.85, 3.25, 3.35, 2.6],
  [3.25, 2.72, 3.3, 2.45], [2.72, 3.15, 3.25, 2.42], [3.15, 2.9, 3.2, 2.44], [2.9, OPB, 3.3, 2.8]]);     // а здесь сверху

// Смешать два цвета #rrggbb
function blend(a, b, x) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = s => Math.round(lerp((A >> s) & 255, (B >> s) & 255, x)).toString(16).padStart(2, "0");
  return "#" + ch(16) + ch(8) + ch(0);
}

// ---------- камера: каждая точка — [когда, сколько едем, масштаб, поворот, x мира, z мира, x экрана, y экрана] ----------

const shotA0 = [520, 8, 0, ZL, 640, 1030];
const shotA = [[0, .001, ...shotA0],
  [T0 - .2, T1 - T0 + .5, 560, 7, 0, 3.2, 640, 900],
  [R0, .8, 520, 10, 0, 3.2, 640, 880],
  [R1 - .15, .7, 440, 11, .1, 3.1, 720, 880],
  [e("b_wide"), 1, 430, 7, RIGHT.x / 2, ZL, 540, 900],
  [e("c_move"), .9, 540, 12, RIGHT.x, 3.4, 700, 1060],
  [e("e_wipe"), .001, 400, 11, .1, 3.1, 780, 1020],
  [e("e_back"), D.dur - e("e_back"), ...shotA0]];
const shotB = [[0, .001, 520, 8, 0, ZB, 760, 700],
  [S1 - .1, .7, 470, 10, 0, 2.2, 760, 840]];

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

// ---------- мир ----------

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

function sky(V, t, hot, cool, heat, deep, pulse = 0) {
  backdrop(V.v, t, blend(cool, hot, heat), {bg: blend(C.bg, deep, heat), glow: lerp(.2, .62, heat) + pulse, cx: 540, cy: 880, r: lerp(980, 1320, heat)});
  dither();
}

function candle3D(I, k, o = {}) {
  const main = k.c >= k.o ? C.rise : C.fall, d = BW / 2, lo = Math.min(k.o, k.c), hi = Math.max(k.o, k.c);
  const faces = [tone(main, .22), main, tone(main, -.36)], wick = [tone(main, .1), tone(main, -.2), tone(main, -.2)], m = WK / 2;
  g.globalAlpha = o.a ?? 1;
  if (k.l < lo) box(I, k.x - m, -m, k.l, WK, WK, lo - k.l, wick, {grain: 0, edge: 0});
  box(I, k.x - d, -d, lo, BW, BW, Math.max(hi - lo, .04), faces, {grain: .24, edge: tone(main, .42)});
  if (k.h > hi) {
    g.globalAlpha = (o.a ?? 1) * (o.wick ?? 1);
    box(I, k.x - m, -m, hi, WK, WK, k.h - hi, wick, {grain: 0, edge: 0});
  }
  g.globalAlpha = 1;
}

function beam(I, z, flash) {
  const a = I.p(-16, LY, z), b = I.p(9, LY, z);
  line(a, b, rgba(C.sky, .2 + .5 * flash), 30 + 60 * flash, "butt");
  box(I, -16, LY - .03, z - .03, 25, .06, .06, [tone(C.sky, .4 + .4 * flash), tone(C.sky, flash * .6), tone(C.sky, -.3)], {grain: 0, edge: 0});
}

const SPARKS = (() => {
  const r = rng(17), out = [];
  for (let i = 0; i < 18; i++) out.push({vx: (r() - .5) * 3.4, vy: r() * 1.2, vz: 1 + r() * 2.4, s: .03 + r() * .05, col: [C.sky, C.white, C.rise][i % 3]});
  return out;
})();

function sparks(I, dt, zc) {
  if (dt <= 0 || dt > .9) return;
  g.globalAlpha = 1 - dt / .9;
  for (const k of SPARKS) box(I, k.vx * dt, LY + k.vy * dt, zc + k.vz * dt - 2.8 * dt * dt, k.s, k.s, k.s, k.col, {grain: 0, edge: 0});
  g.globalAlpha = 1;
}

function floorOf(I, a, t) {
  if (a <= 0) return;
  const z = .9, P = (x, y) => I.p(x, y, z);
  g.globalAlpha = a;
  poly([P(-16, -1.4), P(9, -1.4), P(9, 2.6), P(-16, 2.6)], C.plate);
  g.globalAlpha = a * .1;
  for (let x = -16; x <= 9; x += .8) line(P(x, -1.4), P(x, 2.6), C.white, 1);
  for (let y = -1.4; y <= 2.6; y += .8) line(P(-16, y), P(9, y), C.white, 1);
  g.globalAlpha = a;
  for (const k of CUBES) box(I, k.x, k.y, z, k.w, k.d, k.h, k.col, {grain: .2});
  g.globalAlpha = 1;
}

const CUBES = (() => {
  const r = rng(29), out = [];
  for (let i = 0; i < 12; i++) out.push({x: -3 + r() * 6, y: .9 + r() * 1.1, w: .12 + r() * .2, d: .12 + r() * .2, h: .08 + r() * .34, col: [C.plate2, C.navy, C.sky2, C.coral, C.plate2][i % 5]});
  return out.sort((a, b) => a.y - b.y);
})();

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

const TURN = Math.PI * 2;
const handRun = (t, a, b, laps) => lerp(0, TURN * laps, eio(pg(t, a, b - a)));

// ---------- сцены ----------

function worldA(t) {
  const u = uOf(t), heat = 1 - pg(u, R0, R1 - R0) ** 2, cross = t >= e("e_back") ? 0 : wob(t - T0, 5, 6), shut = t >= e("e_back") ? 0 : wob(t - R1, 6, 6);
  const V = viewOf(shotA, t, 1.4 * cross + shut), I = V.I, hero = heroA(u);
  const hit = u >= T0 ? Math.exp(-(u - T0) * 4) : 0;
  sky(V, t < e("e_back") ? t : rewound(t, e("e_back")), C.rise, C.fall, heat, "#0B3324", .3 * hit);   // пыль отматывается вместе со свечой
  const fade = pg(t, R1, .7) * (1 - pg(t, e("e_back"), .4));
  floorOf(I, fade, t);
  const dim = t < e("d_wipe") ? lerp(1, .32, pg(t, e("b_wide"), .6)) : 1;
  for (const k of PRIOR_A) candle3D(I, k, {a: dim});
  if (t >= e("a_ghost") && t < e("b_wide")) {               // пока свеча открыта, тело могло быть каким угодно
    const x = pg(t, e("a_ghost"), 2.1), hi = lerp(OPEN, TOP, Math.sin(x * Math.PI * 3) ** 2);
    if (x < 1) candle3D(I, {x: 0, o: OPEN, c: hi, h: hi, l: OPEN}, {a: .22});
  }
  const wide = t >= e("d_wipe") ? 0 : pg(t, e("c_move"), .6);
  candle3D(I, hero, {a: lerp(1, .5, wide)});
  if (t >= e("b_new") && t < e("d_wipe")) {
    const p = eo3(pg(t, e("b_new"), .5)), k = {...RIGHT, c: lerp(RIGHT.o, RIGHT.c, p), h: lerp(RIGHT.o, RIGHT.h, p)};
    candle3D(I, k, {wick: lerp(1, .35, eio(pg(t, e("c_glow"), .5)))});
  }
  beam(I, ZL, hit);
  sparks(I, u - T0, ZL);
  if (t >= e("c_glow") && t < e("d_wipe")) bodyEdge(I, RIGHT, C.amber, eio(pg(t, e("c_glow"), .3)) * (.8 + .2 * Math.sin(t * 7)));
  if (t >= e("a_ring") && t < e("b_wide") + .6) {
    const a = I.p(0, 0, ZL), b = I.p(0, 0, hero.h);
    g.globalAlpha = 1 - pg(t, e("b_wide"), .5);
    ringAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 104, (a[1] - b[1]) / 2 + 70, eo3(pg(t, e("a_ring"), .5)), C.amber);
    g.globalAlpha = 1;
  }
  if (t >= e("b_up") && t < e("b_new")) {                   // шарик: сходил наверх и вылетел обратно
    const top = Math.max(hero.o, hero.c), up = eio(pg(t, e("b_up"), .7)), dn = pg(t, e("b_down"), .42);
    const P = I.p(0, LY, lerp(lerp(top, hero.h, up), top, dn * dn));
    g.globalAlpha = 1 - pg(t, e("b_down") + .3, .25);
    g.fillStyle = C.amber;
    g.beginPath();
    g.arc(P[0], P[1], 30, 0, 7);
    g.fill();
    g.globalAlpha = 1;
  }
  return V;
}

function sceneA(t) {
  const V = worldA(t), I = V.I, hero = heroA(uOf(t));
  foreground(V.v, t, .4);
  if (t >= e("a_tag") && t < e("b_wide")) {
    const P = I.p(BW / 2, BW / 2, SHUT);
    g.globalAlpha = 1 - pg(t, e("b_wide") - .2, .2);
    line([P[0], P[1]], [P[0] + 44, P[1]], C.amber, 5);
    tag(tx("a_tag"), P[0] + 44, P[1] - 33, t, e("a_tag"), C.amber, {size: 44, align: "left"});
    g.globalAlpha = 1;
  }
  resetCam();
  note("a_t1", NOTE, 300, 172, C.white, t, {off: e("a_wait") - .1, block: C.rise});
  note("a_t2", NOTE, 270, 100, C.white, t, {off: R1 - .3, block: C.amber});
  note("a_t3", NOTE, 330, 110, C.white, t, {off: e("b_wide") - .2, block: C.fall});
  const off = e("c_move") - .1;
  note("b_c1", NOTE, 240, 74, C.amber, t, {off, lh: 88});
  note("b_c2", 590, 240, 74, C.rise, t, {off, lh: 88});
  const offR = e("d_wipe") - .3;
  note("c_t1", NOTE, 300, 100, C.white, t, {off: offR, block: C.rise});
  note("c_t2", NOTE, 590, 100, C.amber, t, {off: offR});
  const shown = back(pg(t, e("a_clock"), .3)) * (1 - eio(pg(t, R1 + .9, .3)));
  const slow = TURN * Math.floor((t - e("a_clock")) * 5) / 60;
  if (t < R1 + 1.3) clockAt(shown, pg(t, R0, R1 - R0), (t < R0 ? slow : lerp(TURN * Math.floor((R0 - e("a_clock")) * 5) / 60, TURN * 7, eio(pg(t, R0, R1 - R0)))));
  if (t >= e("c_t1") && t < e("c_glow") + .6) {
    clockAt(back(pg(t, e("c_t1"), .3)) * (1 - eio(pg(t, e("c_glow"), .4))), pg(t, e("c_t1"), 1.1), handRun(t, e("c_t1"), e("c_t1") + 1.1, 3));
  }
}

function sceneB(t) {
  const shutB = wob(t - S1, 6, 6), fall = wob(t - F0, 5, 6), hero = heroB(t);
  const V = viewOf(shotB, t, 1.4 * fall + shutB), I = V.I, heat = 1 - pg(t, S0, S1 - S0) ** 2, hit = t >= F0 ? Math.exp(-(t - F0) * 4) : 0;
  sky(V, t, C.fall, C.rise, heat, "#3B0B1E", .3 * hit);
  for (const k of PRIOR_B) candle3D(I, k);
  candle3D(I, hero);
  beam(I, ZB, hit);
  if (t >= e("d_ring")) {
    const a = I.p(0, 0, ZB), b = I.p(0, 0, hero.l);
    ringAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 104, (b[1] - a[1]) / 2 + 70, eo3(pg(t, e("d_ring"), .5)), C.amber);
  }
  foreground(V.v, t, .4);
  resetCam();
  note("d_t1", NOTE, 1090, 132, C.white, t, {off: S0 - .1, block: C.fall});
  note("d_t2", NOTE, 1160, 170, C.amber, t, {block: C.rise});
  clockAt(back(pg(t, e("d_clock"), .3)) * (1 - eio(pg(t, e("d_t2") - .1, .3))), pg(t, S0, S1 - S0), handRun(t, S0, S1, 5));
}

function sceneEnd(t) {
  const V = worldA(t);
  foreground(V.v, t, .4);
  resetCam();
  const off = e("e_back") - .12;
  note("e_t1", NOTE, 280, 100, C.white, t, {off, block: C.fall});
  note("e_t1b", NOTE, 400, 100, C.amber, t, {off});
  note("e_t2", NOTE, 625, 66, C.white, t, {off, lh: 80, block: C.coral});
  const b = e("e_back"), x = pg(t, b, D.dur - b - .2);
  clockAt(back(pg(t, b - .06, .16)) * (1 - eio(pg(t, D.dur - .24, .2))), 1 - x, -TURN * 5 * eio(x));
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

BLUR_EV.push(["a_t1", -.1, .5, 4], ["a_rew", 0, R1 - R0 + .75, 8], ["b_wide", 0, 1, 4], ["c_move", 0, .9, 4], ["d_wipe", -.26, .32, 10], ["d_t1", -.3, .7, 6],
  ["d_rew", 0, S1 - S0 + .7, 8], ["e_wipe", -.26, .32, 10], ["e_back", 0, D.dur - e("e_back"), 12]);
