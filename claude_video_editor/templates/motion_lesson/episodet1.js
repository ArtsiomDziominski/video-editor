"use strict";
// TikTok «Отдали камеру»: один график в изометрии, камера отъезжает и наезжает, последний кадр сходится с первым.

const DY = .5, ZK = 24, BW = .3;      // шаг свечей, высота цены и толщина свечи в единицах мира
const NOTE = 64, ZOOM = .36;          // левый край надписей; влёт в малое окно

// ---------- графики ----------

function chartA(R0, RED) {
  const list = candlesOf([[0, .1], [10, .24], [14, .2], [26, .44], [30, .4], [42, .62], [46, .57], [56, .82], [58, .79], [R0, .96]], 41);
  const r = rng(7);
  let p = list[R0 - 1].c;
  for (let i = 0; i < RED; i++) {          // ровная красная лестница вниз
    const c = p - .024 - r() * .008;
    list.push({o: p, c, h: p + .004 + r() * .008, l: c - .004 - r() * .008});
    p = c;
  }
  return list.concat(candlesOf([[0, p], [6, p + .12], [9, p + .09], [18, p + .5]], 43));
}

function chartB(R0, RED) {
  const list = candlesOf([[0, 1.25], [8, 1.12], [11, 1.16], [23, .9], [26, .94], [R0, .68]], 45);
  const r = rng(9);
  let p = list[R0 - 1].c;
  for (let i = 0; i < RED; i++) {          // маленький отскок вверх
    const c = p + .024 + r() * .008;
    list.push({o: p, c, h: c + .004 + r() * .008, l: p - .004 - r() * .008});
    p = c;
  }
  return list.concat(candlesOf([[0, p], [9, p - .26], [12, p - .22], [34, p - .84]], 47));
}

const slamsOf = (key, n) => Array.from({length: n}, (_, i) => e(key + i));

const CA = {list: chartA(62, 12), along: "y", R0: 62, RED: 12, n0: 4, f0: 64.1, fW: 68, s0: 520, sW: 30, th0: 82, thW: 42, pC: [460, 940], pW: [730, 800],
  pull: e("a_pull"), pullD: 1.45, slams: slamsOf("a_c", 8), push: e("e_push"), next: e("a_next"), nextStep: .045, heat: "#3B0B1E", glow: C.fall, glowW: C.rise, hit: e("a_t1")};
const CB = {list: chartB(38, 10), along: "x", R0: 38, RED: 10, n0: 3, f0: 40, fW: 43, s0: 520, sW: 30, th0: 8, thW: 52, pC: [620, 1130], pW: [440, 840],
  pull: e("d_pull"), pullD: 1.1, slams: slamsOf("d_c", 7), arrive: e("d_zoom") + ZOOM, next: e("d_pull"), nextStep: .012, heat: "#0B3324", glow: C.rise, glowW: C.fall};

const posOf = (c, i) => c.along === "y" ? [0, -i * DY] : [i * DY, 0];

function zOf(c, f) {
  const n = c.list.length, i = Math.floor(clamp(f, 0, n - 1)), k = c.list[i];
  return lerp(k.o, k.c, clamp(f - i)) * ZK;
}

// Смешать два цвета #rrggbb
function blend(a, b, x) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = s => Math.round(lerp((A >> s) & 255, (B >> s) & 255, x)).toString(16).padStart(2, "0");
  return "#" + ch(16) + ch(8) + ch(0);
}

// ---------- камера ----------

function viewOf(c, t) {
  let df = 0, shake = 0;
  for (const tj of c.slams) {
    df += eio(pg(t, tj - .03, .24));
    shake += wob(t - tj, 6, 11);
  }
  if (c.hit) shake += 1.7 * wob(t - c.hit, 5, 7);
  const p = eio(pg(t, c.pull, c.pullD)), b = c.push ? eio(pg(t, c.push, D.dur - c.push)) : 0, wide = p * (1 - b);
  const both = (a, w) => lerp(lerp(a, w, p), a, b);
  const f = lerp(lerp(c.f0 + df, c.fW, p), c.f0, b);
  let s = Math.exp(both(Math.log(c.s0), Math.log(c.sW))) * (1 + wide * (.02 * Math.sin(t * .4) + .05 * Math.sin(t * .31 + 1)));
  if (c.arrive) s *= lerp(.5, 1, eo5(pg(t, c.arrive, .42)));
  const th = both(c.th0, c.thW) + wide * (Math.sin(t * .55) * 1.4 + Math.sin(t * .28) * 3.5);   // на общем плане камера медленно облетает вершину
  const I = new Iso(0, 0, s, th), [x, y] = posOf(c, f), P = I.p(x, y, zOf(c, f));
  I.ox = both(c.pC[0], c.pW[0]) - P[0];
  I.oy = both(c.pC[1], c.pW[1]) - P[1] + shake * 20 * (1 - p);
  return {I, f, s, wide, p, b, v: {x: 610 + f * 22, y: 540 + Math.log(s) * 240}};
}

// ---------- мир ----------

function heatOf(c, t) {
  const on = 1 - eio(pg(t, c.pull + .05, .7));
  return c.push ? Math.max(on, eio(pg(t, D.dur - .5, .5))) : on;
}

function qOf(c, i, t) {
  const r1 = c.R0 + c.RED;
  let q;
  if (i < c.R0) q = t >= c.pull ? 1 : 0;
  else if (i < r1) {
    const k = i - c.R0 - c.n0;
    q = k < 0 ? 1 : eo3(pg(t, c.slams[k], .13));
  } else q = eo3(pg(t, c.next + (i - r1) * c.nextStep, .12));
  if (c.push && i < c.R0) q *= 1 - pg(t, D.dur - .5, .4);          // кадр сходится с первым: лишние свечи убираются
  if (c.push && i >= c.R0 + c.n0) q *= 1 - pg(t, D.dur - .66, .3);
  return q;
}

function candle3D(I, c, i, q) {
  const k = c.list[i], rise = k.c >= k.o, main = rise ? C.rise : C.fall, [x, y] = posOf(c, i);
  const Pm = I.p(x, y, k.o * ZK);
  if (Pm[0] < -340 || Pm[0] > W + 340 || Pm[1] < -600 || Pm[1] > H + 600) return;
  const z0 = k.o * ZK, z1 = lerp(k.o, k.c, q) * ZK, lo = Math.min(z0, z1), hi = Math.max(z0, z1), d = BW / 2;
  const faces = c.along === "y" ? [tone(main, .22), tone(main, -.36), main] : [tone(main, .22), main, tone(main, -.36)];
  const wick = [tone(main, .1), tone(main, -.2), tone(main, -.2)], wl = lerp(lo, k.l * ZK, q), wh = lerp(hi, k.h * ZK, q);
  if (wl < lo) box(I, x - .02, y - .02, wl, .04, .04, lo - wl, wick, {grain: 0, edge: 0});
  box(I, x - d, y - d, lo, BW, BW, Math.max(hi - lo, .05), faces, {grain: .24, edge: tone(main, .42)});
  if (wh > hi) box(I, x - .02, y - .02, hi, .04, .04, wh - hi, wick, {grain: 0, edge: 0});
}

const CUBES = (() => {
  const r = rng(23), out = [];
  for (let i = 0; i < 26; i++) out.push({a: r(), b: 4 + r() * 9, w: .7 + r() * 1.6, d: .7 + r() * 1.6, h: .4 + r() * 2.4, col: [C.plate2, C.navy, C.plate, C.sky2, C.coral][i % 5]});
  return out;
})();

// Плита пола, сетка, цветное пятно и мелкие кубы вокруг: второй план при облёте
function floorOf(c, I, t) {
  const L = c.list.length * DY;
  const P = (u, v) => c.along === "y" ? I.p(v, -u) : I.p(u, -v);
  const R = c.along === "y" ? [-24, -L - 12, 44, L + 24] : [-12, -24, L + 24, 44];
  plate(I, R[0], R[1], R[2], R[3], C.plate, .6);
  g.globalAlpha = .1;
  for (let u = -12; u <= L + 12; u += 3) line(P(u, -24), P(u, 20), C.white, 1);
  for (let v = -24; v <= 20; v += 3) line(P(-12, v), P(L + 12, v), C.white, 1);
  g.globalAlpha = 1;
  const Q = c.along === "y" ? [6, -L * .72] : [L * .62, 6];
  pool(I, Q[0], Q[1], 9, rgba(c.glowW, .4), 3, t, {ry: 1.5});
  for (const k of CUBES) {
    const u = k.a * L, v = k.b, X = c.along === "y" ? v : u, Y = c.along === "y" ? -u : v;
    floorShadow(I, X, Y, k.w, k.d, .3);
    box(I, X, Y, 0, k.w, k.d, k.h, k.col, {grain: .2});
  }
}

// Сплошной склон под графиком: лицо и верхняя кромка, тень к полу — из него видно, куда идёт график
function massif(c, I, t, a) {
  if (a <= 0) return;
  const list = c.list;
  let last = list.length - 1;
  while (last > 0 && qOf(c, last, t) <= 0) last--;
  const P = (i, z, d) => c.along === "y" ? I.p(d, -i * DY, z) : I.p(i * DY, d, z);
  const top = [];
  for (let i = 0; i <= last; i++) top.push([i, Math.min(list[i].o, list[i].c) * ZK - 1.5]);
  const front = top.map(([i, z]) => P(i, z, -.5)), back_ = top.map(([i, z]) => P(i, z, -3.4));
  g.globalAlpha = a;
  poly(front.concat(back_.reverse()), C.plate2);
  const face = front.concat([P(last, 0, -.5), P(0, 0, -.5)]), mid = top[top.length >> 1];
  poly(face, tone(C.navy2, .1));
  shade(face, P(mid[0], mid[1], -.5), P(mid[0], 0, -.5), .42);
  g.beginPath();
  front.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.strokeStyle = rgba(c.glowW, .5);
  g.lineWidth = 2.5;
  g.stroke();
  const cap = c.along === "y" ? [P(0, 0, -.5), P(0, top[0][1], -.5), P(0, top[0][1], -3.4), P(0, 0, -3.4)]
    : [P(last, 0, -.5), P(last, top[last][1], -.5), P(last, top[last][1], -3.4), P(last, 0, -3.4)];
  poly(cap, tone(C.navy2, -.3));
  g.globalAlpha = 1;
}

// Большая объёмная стрелка вдоль графика, в плоскости перед ним
function ribbon(c, I, i0, z0, i1, z1, tip, col, o = {}) {
  if (tip <= 0) return;
  const hw = o.hw ?? .9, hh = o.hh ?? 2.4, hl = o.hl ?? 4.6, pl = o.plane ?? 2.2;
  const u0 = i0 * DY, u1 = lerp(u0, i1 * DY, tip), z2 = lerp(z0, z1, tip), L = Math.hypot(u1 - u0, z2 - z0), du = (u1 - u0) / L, dz = (z2 - z0) / L;
  const nu = -dz, nz = du, ub = u1 - du * hl, zb = z2 - dz * hl;
  const shape = [[u0 + nu * hw, z0 + nz * hw], [ub + nu * hw, zb + nz * hw], [ub + nu * hh, zb + nz * hh], [u1, z2],
    [ub - nu * hh, zb - nz * hh], [ub - nu * hw, zb - nz * hw], [u0 - nu * hw, z0 - nz * hw]];
  const P = (u, z, d) => c.along === "y" ? I.p(d, -u, z) : I.p(u, d, z);
  for (let k = 5; k > 0; k--) poly(shape.map(([u, z]) => P(u, z, pl - k * .16)), tone(col, -.42));
  const front = shape.map(([u, z]) => P(u, z, pl));
  poly(front, col);
  shade(front, P(u0, z0, pl), P(u1, z2, pl), .26);
}

function ringAt(cx, cy, rx, ry, p, col) {
  if (p <= 0) return;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, -.35, -1.3, -1.3 + p * 6.7);
  g.strokeStyle = col;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.stroke();
}

// Неподвижное зерно: без него плавный красный и зелёный фон при сжатии распадается на кольца
const FINE = (() => {
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

function world(c, t) {
  const V = viewOf(c, t), I = V.I, heat = heatOf(c, t), n = c.list.length;
  const pulse = c.hit ? .3 * Math.exp(-Math.max(0, t - c.hit) * 6) * (t >= c.hit ? 1 : 0) : 0;
  backdrop(V.v, t, blend(c.glowW, c.glow, heat), {bg: blend(C.bg, c.heat, heat), glow: lerp(.12, .62, heat) + pulse, cx: 540, cy: 880, r: lerp(980, 1320, heat)});
  dither();
  const a = eo3(pg(t, c.pull, .4)) * (c.push ? 1 - pg(t, D.dur - .34, .3) : 1);
  if (V.s < 130) floorOf(c, I, t);
  massif(c, I, t, a);
  const order = c.along === "y" ? Array.from({length: n}, (_, i) => n - 1 - i) : Array.from({length: n}, (_, i) => i);
  for (const i of order) {
    const q = qOf(c, i, t);
    if (q > 0) candle3D(I, c, i, q);
  }
  return V;
}

// ---------- сцены с большим графиком ----------

function sceneA(t) {
  const c = CA, V = world(c, t), I = V.I, n = c.list.length;
  if (t >= e("a_ring") && t < e("b_wipe")) {
    const P = I.p(...posOf(c, c.fW), zOf(c, c.fW));
    ringAt(P[0], P[1], 118, 150, eo3(pg(t, e("a_ring"), .5)), C.amber);
  }
  if (t >= e("a_arrow") && t < e("b_wipe")) {
    const tip = .74 * eio(pg(t, e("a_arrow"), .9)) + .26 * eio(pg(t, e("a_next"), .9));
    ribbon(c, I, 2, 1, n + 2, 1.12 * ZK - 8.5, tip, C.rise);
  }
  foreground(V.v, t, .4);
  resetCam();
  note("a_t1", W - NOTE, 290, 172, C.white, t, {align: "right", off: e("a_t2") - .1, block: C.fall});
  note("a_t2", NOTE, 350, 132, C.white, t, {off: e("a_t3") - .3, block: C.amber});
  const off = e("b_t0") - .32;
  note("a_t3", NOTE, 330, 118, C.white, t, {off, block: C.fall});
  note("a_t4", NOTE, 610, 96, C.amber, t, {off});
  note("b_t0", NOTE, 330, 88, C.white, t, {off: e("b_wipe") - .34, block: C.amber});
}

function sceneB(t) {
  const c = CB, V = world(c, t), I = V.I, n = c.list.length;
  if (t >= e("d_arrow")) ribbon(c, I, 3, 1.16 * ZK - 5.5, n - 2, .1 * ZK - 1.7, eio(pg(t, e("d_arrow"), .7)), C.fall);
  if (t >= e("d_tag")) {
    const P = I.p(...posOf(c, c.fW), zOf(c, c.fW));
    ringAt(P[0], P[1], 100, 128, eo3(pg(t, e("d_tag"), .4)), C.amber);
    tag(tx("d_tag"), P[0] + 40, P[1] - 210, t, e("d_tag"), C.amber, {size: 46});
  }
  foreground(V.v, t, .4);
  resetCam();
  note("d_t1", NOTE, 300, 172, C.white, t, {off: e("d_pull") + .1, block: C.rise});
}

function sceneEnd(t) {
  const V = world(CA, t);
  foreground(V.v, t, .4);
  resetCam();
  const off = e("e_push") - .12;
  note("e_t1", NOTE, 280, 100, C.white, t, {off, block: C.fall});
  note("e_t1b", NOTE, 510, 100, C.amber, t, {off});
  note("e_t2", NOTE, 625, 58, C.white, t, {off, lh: 72, block: C.coral});
}

// ---------- окна ----------

const SLOT = i => ({x: 60, y: 170 + i * 400, w: 960, h: 372});
const FULL = {x: -40, y: -60, w: W + 80, h: H + 120};
const SMALL = {x: 474, y: 960, w: 446, h: 380};

// В низком окне честная свеча выходит плоской: тело растягиваем вокруг середины
const chunky = (list, k) => list.map(c => {
  const m = (c.o + c.c) / 2, o = m + (c.o - m) * k, cl = m + (c.c - m) * k;
  return {o, c: cl, h: Math.max(o, cl) + .022, l: Math.min(o, cl) - .022};
});

const LM = chunky(candlesOf([[0, .95], [12, .12]], 21, .006, .6), 2.2);
const LH = candlesOf([[0, .5], [4, .62], [8, .42], [12, .6], [16, .46]], 22, .03);
const LD = chunky(candlesOf([[0, .08], [6, .26], [8, .2], [15, .52], [17, .46], [24, .86], [26, .78], [30, 1.06]], 23, .012), 1.7);
const LE = chunky(candlesOf([[0, .8], [6, .3], [8, .34], [15, .9]], 24, .008, .6), 1.8);

function slab(r, col) {
  const {x, y, w, h} = r, ex = 18, ey = 20;
  poly([[x, y + h], [x + w, y + h], [x + w - ex, y + h + ey], [x - ex, y + h + ey]], tone(C.plate2, -.3));
  poly([[x, y], [x, y + h], [x - ex, y + h + ey], [x - ex, y + ey]], tone(col, -.46));
}

function screen(r, col, fn) {
  g.save();
  g.beginPath();
  g.roundRect(r.x, r.y, r.w, r.h, 16);
  g.clip();
  g.fillStyle = C.ink;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.translate(r.x, r.y);
  g.strokeStyle = "rgba(255,255,255,.055)";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let x = 60; x < r.w; x += 80) { g.moveTo(x, 0); g.lineTo(x, r.h); }
  for (let y = 40; y < r.h; y += 80) { g.moveTo(0, y); g.lineTo(r.w, y); }
  g.stroke();
  fn(r.w, r.h);
  g.restore();
  g.beginPath();
  g.roundRect(r.x, r.y, r.w, r.h, 16);
  g.strokeStyle = rgba(col, .85);
  g.lineWidth = 4;
  g.stroke();
}

function staticBars(w, h, p, seed) {
  if (p >= 1) return;
  const r = rng(seed + Math.floor(p * 9));
  g.fillStyle = rgba(C.white, .6 * (1 - p));
  for (let i = 0; i < 16; i++) g.fillRect(0, r() * h, w, 2 + r() * 16);
}

function chartIn(list, w, h, pad, rev) {
  const lo = Math.min(...list.map(k => k.l)), hi = Math.max(...list.map(k => k.h));
  const dx = (w - pad[1] - pad[3]) / list.length, yOf = p => lerp(h - pad[2], pad[0], (p - lo) / (hi - lo));
  candles(list, pad[3], dx, yOf, rev, {w: Math.min(dx * .62, 40)});
  return {dx, yOf};
}

const PLAQUE = 54;

function plaque(s, x, y, col, dir) {     // подпись окна со значком направления
  const size = PLAQUE, pad = 20, wd = widthOf(s, size), hh = 80;
  g.fillStyle = col;
  g.beginPath();
  g.roundRect(x, y, wd + pad * 2 + (dir === undefined ? 0 : 62), hh, 10);
  g.fill();
  text(s, x + pad, y + 59, size, C.bg);
  const ix = x + wd + pad * 2 + 22, iy = y + hh / 2;
  if (dir === undefined) return;
  if (dir) arrowUp(ix, iy, 22, C.bg, dir);
  else {
    poly([[ix - 28, iy], [ix - 8, iy - 15], [ix - 8, iy + 15]], C.bg);
    poly([[ix + 28, iy], [ix + 8, iy - 15], [ix + 8, iy + 15]], C.bg);
    g.fillStyle = C.bg;
    g.fillRect(ix - 10, iy - 5, 20, 10);
  }
}

function arrow2D(a, b, hw, hh, hl, col, tip) {
  const x1 = lerp(a[0], b[0], tip), y1 = lerp(a[1], b[1], tip), L = Math.hypot(x1 - a[0], y1 - a[1]);
  if (L < 2) return;
  const dx = (x1 - a[0]) / L, dy = (y1 - a[1]) / L, nx = -dy, ny = dx, bx = x1 - dx * hl, by = y1 - dy * hl;
  const shape = [[a[0] + nx * hw, a[1] + ny * hw], [bx + nx * hw, by + ny * hw], [bx + nx * hh, by + ny * hh], [x1, y1],
    [bx - nx * hh, by - ny * hh], [bx - nx * hw, by - ny * hw], [a[0] - nx * hw, a[1] - ny * hw]];
  poly(shape.map(p => [p[0] - 10, p[1] + 13]), tone(col, -.5));
  poly(shape, col);
}

function windows(t) {
  const ge = eio(pg(t, e("c_grow"), .7)), z0 = e("d_zoom");
  backdrop({x: 610 + t * 9, y: 540 + t * 5}, t, C.coral, {cx: 540, cy: 900, r: 1200, glow: .08});
  resetCam();
  const k = Math.exp(Math.log(11) * ei3(pg(t, z0, ZOOM)));
  const FX = SMALL.x + SMALL.w * .72, FY = SMALL.y + SMALL.h * .45, sh = (-.042 + .012 * Math.sin(t * .8)) * (1 - ge);
  g.setTransform(k, sh * k, 0, k, FX * (1 - k), FY * (1 - k) - sh * 540 * k);
  const rows = [[LM, C.fall, 1, [26, 26, 24, 26], 16], [LH, C.amber, 0, [116, 26, 26, 26], 20], [LD, C.rise, -1, [26, 26, 24, 26], 28]];
  rows.forEach(([list, col, dir, pad, rate], i) => {
    const t0 = e(`b_w${i}`);
    if (t < t0) return;
    const p = eo5(pg(t, t0, .36)), s = SLOT(i);
    let r = {...s, x: s.x + (i % 2 ? -1 : 1) * (1 - p) * 1180};
    if (i === 2) r = {x: lerp(r.x, FULL.x, ge), y: lerp(r.y, FULL.y, ge), w: lerp(r.w, FULL.w, ge), h: lerp(r.h, FULL.h, ge)};
    else r.y -= ge * 1500;
    if (r.y + r.h < -40) return;
    slab(r, col);
    const pp = i === 2 ? [lerp(pad[0], 640, ge), lerp(pad[1], 110, ge), lerp(pad[2], 470, ge), lerp(pad[3], 120, ge)] : pad;
    screen(r, col, (w, h) => {
      chartIn(list, w, h, pp, (t - t0 - .08) * rate);
      if (i === 2 && t >= e("c_arrow")) arrow2D([130, 1360], [1030, 460], 19, 56, 92, C.rise, eio(pg(t, e("c_arrow"), .8)));
      staticBars(w, h, pg(t, t0, .24), 40 + i);
      plaque(tx(`b_l${i}`), i === 0 ? w - widthOf(tx("b_l0"), PLAQUE) - 130 : 26 + (i === 2 ? ge * 74 : 0), 22 + (i === 2 ? ge * 990 : 0), col, dir);
    });
  });
  if (t >= e("c_win")) {
    const p = eo5(pg(t, e("c_win"), .34)), r = {...SMALL, y: SMALL.y + (1 - p) * 900};
    slab(r, C.fall);
    screen(r, C.fall, (w, h) => {
      const {dx, yOf} = chartIn(LE, w, h, [100, 22, 108, 22], (t - e("c_win") - .05) * 26);
      staticBars(w, h, pg(t, e("c_win"), .22), 50);
      plaque(tx("b_l0"), 16, 14, C.fall);
      const ti = e("c_in");
      if (t >= ti) {
        const x = 22 + dx * 8.5, y = yOf(LE[8].l) + 6;
        ringAt(x, y, 46, 46, eo3(pg(t, ti, .4)), C.amber);
        arrow2D([x + 8, y - 40], [x + 120, y - 190], 7, 19, 30, C.rise, eio(pg(t, ti + .1, .5)));
        tag(tx("c_in_t"), x - 8, y + 44, t, ti, C.amber, {size: 30});
      }
    });
  }
  resetCam();
  const off = z0 - .2;
  note("c_t1", NOTE, 310, 100, C.white, t, {off, block: C.rise});
  note("c_t2", NOTE, 590, 100, C.amber, t, {off});
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

OVERLAYS.push(t => { chWipe(t, e("b_wipe")); chWipe(t, e("e_wipe")); });

function drawAll(t) {
  if (t < e("b_wipe")) sceneA(t);
  else if (t < e("d_zoom") + ZOOM) windows(t);
  else if (t < e("e_wipe")) sceneB(t);
  else sceneEnd(t);
}

for (let k = 1; k <= 7; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_pull", -.02, 1.5, 10], ["b_wipe", -.26, .32, 10], ["c_grow", 0, .72, 6], ["d_zoom", 0, ZOOM + .44, 16], ["d_pull", -.02, 1.14, 10],
  ["e_wipe", -.26, .32, 10], ["e_push", 0, .86, 12]);
