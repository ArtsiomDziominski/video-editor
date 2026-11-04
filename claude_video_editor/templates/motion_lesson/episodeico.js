"use strict";
// TikTok «Что такое ICO» — полная версия. Мир A: блестящая обёртка с ракетой, чертёж, три коробки, билетик 2014 года
// вырастает в огромный, поле из сотни коробок 2017 года — восемь из десяти пустые. Мир C: ворота CoinList с проверкой
// и лотереей, карточки с иксами, Algorand падает, песочные часы «это пики». Мир B: три вопроса и замок на токенах,
// обещания рассыпаются. В конце обёртка захлопывается — кадр совпадает с первым, ролик идёт по кругу.

const END = D.dur, HALF = Math.PI / 2, NOTE = 64;
const BIG = {x: -1.1, y: 0, w: 2.2, d: 1.6, h: 2.2, t: .08};       // коробка проекта; передняя грань — обёртка на петле снизу
const LAUNCH = e("a_launch"), FLIP = e("k_flip"), G_BACK = e("g_back");

// Смешать два цвета: #rrggbb или rgb(...) из tone()
const rgbOf = c => c[0] === "#" ? [16, 8, 0].map(s => (parseInt(c.slice(1), 16) >> s) & 255) : c.match(/\d+/g).slice(0, 3).map(Number);

function blend(a, b, x) {
  const A = rgbOf(a), B = rgbOf(b);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], x)).toString(16).padStart(2, "0")).join("");
}

// Фон, блики и звёзды в последнюю секунду отматываются к первому кадру
const loopT = t => t < G_BACK ? t : G_BACK * (1 - eio(pg(t, G_BACK, END - G_BACK)));

// Рокот двигателя идёт из конца ролика в начало и обрывается на взлёте: ракета на обёртке дрожит вместе с ним
function engineAmp(t) {
  const tau = t >= END - 1 ? t - (END - 1) : t < LAUNCH ? t + 1 : -1;
  return tau < 0 ? 0 : (tau / (1 + LAUNCH)) ** 1.4;
}

// ---------- настроение сцены: свечение фона и его цвет ----------

const MOODS = {
  warm: ["#FF9A3C", "#2A1A1D", .55], blue: [C.sky, "#0F1A30", .42], calm: [C.teal, "#1B1C25", .26],
  cold: ["#7C8BB0", "#121219", .16], navy: [C.sky2, "#101A2C", .4], green: [C.rise, "#0E2219", .46],
  gold: ["#FFC34D", "#221A12", .5], hot: ["#FF6A4D", "#26161B", .5], teal: ["#3FC1C9", "#0F1D24", .36], red: [C.fall, "#1F1219", .32],
};
const MOOD_KEYS = [[e("b_pan"), .8, "blue"], [e("c_move"), .8, "calm"], [e("d_go"), 1, "gold"], [e("k_move"), .6, "hot"],
  [FLIP + .2, .8, "cold"], [e("m_wipe"), .001, "teal"], [e("n_move"), .8, "gold"], [e("p_move"), .6, "red"], [e("p_back"), .8, "cold"],
  [e("q_wipe"), .001, "navy"], [e("r_glow"), .8, "green"], [e("g_wipe"), .001, "cold"], [G_BACK, END - G_BACK - .1, "warm"]];

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

function sky(V, t, pulse = 0) {
  let [glow, bg, amt] = MOODS.warm;
  for (const [a, d, k] of MOOD_KEYS) {
    const x = eio(pg(t, a, d)), m = MOODS[k];
    if (x <= 0) continue;
    glow = blend(glow, m[0], x);
    bg = blend(bg, m[1], x);
    amt = lerp(amt, m[2], x);
  }
  backdrop(V.v, loopT(t), glow, {bg, glow: amt + pulse, cx: 540, cy: 900, r: 1250});
  resetCam();
  g.fillStyle = g.createPattern(FINE, "repeat");
  g.fillRect(0, 0, W, H);
}

// ---------- камера: каждая точка — [когда, сколько едем, масштаб, поворот, x мира, z мира, x экрана, y экрана] ----------

const ST = {x: 14.6, y: -.95, w: 1, d: 1, h: .5};           // постамент 2014 года, x — середина
const SHOT0 = [300, 8, 0, 1.1, 540, 1020];
const shotA = [[0, .001, ...SHOT0],
  [0, LAUNCH - .1, 312, 6, 0, 1.15, 540, 1025],
  [LAUNCH - .1, 1.2, 270, 5, .2, 1.6, 540, 1080],
  [e("a_ask") - .1, .9, 285, 10, .1, 1.5, 540, 1090],
  [e("b_pan"), 1, 260, 12, 4, .5, 540, 1080],
  [e("b_pan") + 1, e("c_move") - e("b_pan") - 1, 272, 7, 4.15, .5, 540, 1070],
  [e("c_move"), .9, 250, 9, 9.4, .5, 540, 930],
  [e("c_q"), 1.2, 262, 13, 9.6, .55, 530, 940],
  [e("c_up"), 1, 236, 9, 10.3, 1.9, 540, 960],               // следим за взлетевшим билетиком
  [e("d_go"), 1.1, 300, 8, ST.x, 1.05, 540, 1060],           // перелёт к 2014 году
  [e("d_grow") - .2, e("d_hit") - e("d_grow") + .5, 160, 5, ST.x, 2.2, 540, 1000],   // билетик растёт — камера отъезжает
  [e("d_hit") + .3, e("k_move") - e("d_hit") - .3, 168, 3, ST.x + .1, 2.2, 540, 995],
  [e("k_move"), .7, 130, 8, .2, .3, 540, 900],              // назад к коробке: вокруг поле 2017 года
  [e("k_move") + .7, e("k_push") - e("k_move") - .7, 137, 4, .3, .3, 540, 905],
  [e("k_push"), .9, 300, 11, .05, .8, 540, 1030],
  [e("k_back"), 1.1, 138, 8, 0, .4, 540, 880],
  [e("k_back") + 1.1, e("m_wipe") - e("k_back") - 1.1, 145, 5, .1, .4, 540, 875],
  [e("g_wipe"), .001, 262, 10, 0, .9, 540, 1120],
  [e("g_wipe") + .01, G_BACK - e("g_wipe") - .1, 276, 6, 0, .9, 540, 1130],
  [G_BACK, END - G_BACK, ...SHOT0]];

const G1 = 2.6, G2 = -.6, G3 = -4.4;                       // мир C: проверка, лотерея, площадка — вдоль дорожки вглубь
const CW2 = 1.9, CH2 = 2.4, PODIUM = {xl: 4.2, xr: 6.4, yb: -1.2, yf: 1.6, hb: 1.2, hf: .14};
const ALGO = {x: 8.9, y: PODIUM.yf}, HGP = {x: 8.85, y: PODIUM.yb, w: 1.2};
const shotC = [[0, .001, 200, 5, 0, .4, 340, 880],
  [e("m_wipe"), e("n_move") - e("m_wipe"), 214, 3, 0, .4, 340, 875],   // медленный наезд вдоль очереди
  [e("n_move"), 1.1, 205, 5, 6.3, 1.3, 540, 1010],
  [e("n_move") + 1.1, e("p_move") - e("n_move") - 1.1, 212, 3, 6.35, 1.3, 540, 1005],
  [e("p_move"), .9, 255, 6, ALGO.x + CW2 / 2, 1.3, 540, 790],
  [e("p_back"), 1.1, 150, 5, 7.5, 1.4, 540, 950],
  [e("p_back") + 1.1, e("q_wipe") - e("p_back") - 1.1, 156, 3, 7.55, 1.4, 540, 948]];
const shotB = [[0, .001, 370, 18, 0, .45, 540, 1080],
  [e("q_wipe"), e("q_lock") - e("q_wipe") + .6, 395, 4, 0, .45, 540, 1070],
  [e("r_move"), 1, 250, 8, 5.15, 1, 540, 1040],
  [e("r_move") + 1, e("g_wipe") - e("r_move") - 1, 262, 3, 5.25, 1, 540, 1035]];

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



// ---------- обёртка: глянцевая карточка с ракетой ----------

const STARS = [[.17, .17, .055, 0], [.82, .14, .045, 1.7], [.87, .6, .035, 3], [.13, .66, .032, 4.4], [.3, .38, .022, 2.2], [.7, .86, .026, 5.1]];

function sparkle(x, y, r, col) {
  const q = r * .22;
  poly([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]], col);
}

function rocketShape(L) {
  g.beginPath();
  g.moveTo(0, -L * .5);
  g.quadraticCurveTo(L * .2, -L * .3, L * .17, 0);
  g.lineTo(L * .14, L * .3);
  g.lineTo(-L * .14, L * .3);
  g.lineTo(-L * .17, 0);
  g.quadraticCurveTo(-L * .2, -L * .3, 0, -L * .5);
  g.closePath();
}

function flameShape(L, w, len) {
  const y0 = L * .32;
  g.beginPath();
  g.moveTo(-L * w, y0);
  g.quadraticCurveTo(-L * w * 1.15, y0 + len * .55, 0, y0 + len);
  g.quadraticCurveTo(L * w * 1.15, y0 + len * .55, L * w, y0);
  g.closePath();
}

// Ракета носом вверх, центр в начале координат
function rocket(L, flame, tw) {
  const f = (.5 + .7 * flame) * (1 + .14 * Math.sin(tw * 37) + .08 * Math.sin(tw * 23 + 1));
  flameShape(L, .11, L * .42 * f);
  g.fillStyle = rgba(C.white, .92);
  g.fill();
  flameShape(L, .06, L * .26 * f);
  g.fillStyle = C.coral;
  g.fill();
  for (const sx of [-1, 1]) poly([[sx * L * .15, L * .02], [sx * L * .33, L * .28], [sx * L * .31, L * .38], [sx * L * .13, L * .3]], C.navy);
  g.fillStyle = C.plate2;
  g.fillRect(-L * .1, L * .29, L * .2, L * .06);
  rocketShape(L);
  g.fillStyle = C.white;
  g.fill();
  g.save();
  rocketShape(L);
  g.clip();
  g.fillStyle = "#E2DAD2";
  g.fillRect(L * .05, -L * .6, L * .3, L * 1.2);
  g.fillStyle = C.coral;
  g.fillRect(-L * .3, -L * .6, L * .6, L * .3);
  g.restore();
  g.fillStyle = C.navy2;
  g.fillRect(-L * .025, L * .1, L * .05, L * .26);
  g.fillStyle = C.navy;
  g.beginPath();
  g.arc(0, -L * .07, L * .09, 0, 7);
  g.fill();
  g.fillStyle = C.sky;
  g.beginPath();
  g.arc(0, -L * .07, L * .062, 0, 7);
  g.fill();
  g.fillStyle = rgba(C.white, .8);
  g.beginPath();
  g.arc(-L * .022, -L * .092, L * .02, 0, 7);
  g.fill();
}

// Рисунок обёртки в своих единицах: w × h, верхний левый угол в начале координат
function wrapArt(w, h, tw, o = {}) {
  const m = Math.min(w, h), r = m * .06, cx = w * .5, cy = h * .56, L = m * .46;
  g.save();
  g.beginPath();
  g.roundRect(0, 0, w, h, r);
  g.clip();
  const lg = g.createLinearGradient(0, 0, w, h);
  lg.addColorStop(0, "#FFD25A");
  lg.addColorStop(.5, "#FF9A3C");
  lg.addColorStop(1, C.coral);
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  if (!o.lite) {
    g.fillStyle = rgba(C.white, .1);                         // лучи от ракеты
    for (let i = 0; i < 12; i += 2) {
      const a0 = i / 12 * Math.PI * 2 + tw * .15;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, m * 1.3, a0, a0 + Math.PI / 12);
      g.closePath();
      g.fill();
    }
    STARS.forEach(([sx, sy, sr, ph], i) => {
      const big = i === 0 && o.wink > 0 && o.wink < 1 ? 1 + 1.6 * Math.sin(Math.PI * o.wink) : 1;
      sparkle(sx * w, sy * h, sr * m * (.75 + .25 * Math.sin(tw * 2.3 + ph)) * big, rgba(C.white, .9));
    });
  }
  const a = o.amp ?? 0;
  g.save();
  g.translate(cx + Math.sin(tw * 53) * a * L * .035, cy + Math.cos(tw * 47) * a * L * .035);
  g.rotate(Math.PI / 6);
  if (!o.lite) for (const k of [-1, 0, 1]) line([k * L * .09, L * .7], [k * L * .09, L * (.86 + .1 * k * k)], rgba(C.white, .5), m * .012);
  rocket(L, o.flame ?? .3, tw);
  g.restore();
  if (o.shine > 0 && o.shine < 1) {                          // блик пробегает по глянцу
    g.save();
    g.translate(lerp(-w * .5, w * 1.5, eio(o.shine)), 0);
    g.transform(1, 0, -.45, 1, 0, 0);
    const sg = g.createLinearGradient(-m * .16, 0, m * .16, 0);
    sg.addColorStop(0, rgba(C.white, 0));
    sg.addColorStop(.5, rgba(C.white, .62));
    sg.addColorStop(1, rgba(C.white, 0));
    g.fillStyle = sg;
    g.fillRect(-m * .16, -h, m * .32, h * 3);
    g.restore();
  }
  const hl = g.createLinearGradient(0, 0, 0, h * .5);        // глянец сверху
  hl.addColorStop(0, rgba(C.white, .22));
  hl.addColorStop(1, rgba(C.white, 0));
  g.fillStyle = hl;
  g.fillRect(0, 0, w, h * .5);
  g.restore();
  g.strokeStyle = rgba(C.white, .7);
  g.lineWidth = m * .016;
  g.beginPath();
  g.roundRect(m * .05, m * .05, w - m * .1, h - m * .1, r * .6);
  g.stroke();
}

// ---------- коробка проекта ----------

const SHELL = [tone(C.plate2, .1), C.plate, tone(C.plate, -.3)];
const ROOM = {back: "#17151D", side: "#221F2A", floor: "#2B2834"};

// Обёртка на петле снизу; psi — на сколько откинута вперёд (0 — закрыта, HALF — лежит на полу)
function drawFlap(I, P, psi, o) {
  const s = Math.sin(psi), c = Math.cos(psi), n1 = c, n2 = -s, h2 = P.t / 2;
  const base = [[P.x, P.y, 0], [P.x + P.w, P.y, 0], [P.x + P.w, P.y + P.h * s, P.h * c], [P.x, P.y + P.h * s, P.h * c]];
  const F = base.map(p => I.p(p[0], p[1] + n1 * h2, p[2] + n2 * h2)), B = base.map(p => I.p(p[0], p[1] - n1 * h2, p[2] - n2 * h2));
  const dim = o.dim ?? 0;
  poly([F[1], F[2], B[2], B[1]], blend(tone(C.amber2, -.35), ROOM.back, dim));   // правый торец
  poly([F[3], F[2], B[2], B[3]], blend(tone(C.amber, .4), ROOM.side, dim));      // свободный торец
  if (n1 * I.cos + n2 * I.k / I.c > 0) {
    poly(F, tone(C.amber2, -.15));
    const A = I.p(P.x, P.y + P.h * s + n1 * h2, P.h * c + n2 * h2);
    const U = I.p(P.x + .01, P.y + P.h * s + n1 * h2, P.h * c + n2 * h2);
    const V = I.p(P.x, P.y + P.h * s + n1 * h2 - .01 * s, P.h * c + n2 * h2 - .01 * c);
    g.save();
    g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
    wrapArt(P.w * 100, P.h * 100, o.tw ?? 0, o);
    g.restore();
  } else {
    poly(B, blend(C.tan2, ROOM.side, dim));                 // изнанка — простой картон
    shade(B, B[3], B[0], .3);
  }
}

function drawPackage(I, P, psi, o = {}) {
  const Q = (x, y, z) => I.p(x, y, z), x1 = P.x + P.w, yb = P.y - P.d, dim = o.dim ?? 0;
  floorShadow(I, P.x, yb, P.w, P.d, .32, .12, .1);
  box(I, P.x, yb, 0, P.w, P.d, P.h, dim ? SHELL.map(c => blend(c, ROOM.back, dim)) : SHELL, {grain: o.grain ?? .22});
  if (psi > .001) {                                         // внутри видно только через проём
    g.save();
    path([Q(P.x, P.y, 0), Q(x1, P.y, 0), Q(x1, P.y, P.h), Q(P.x, P.y, P.h)]);
    g.clip();
    const back = [Q(P.x, yb, 0), Q(x1, yb, 0), Q(x1, yb, P.h), Q(P.x, yb, P.h)];
    poly(back, ROOM.back);
    shade(back, Q(P.x, yb, 0), Q(P.x, yb, P.h), .45);
    poly([Q(P.x, yb, 0), Q(P.x, P.y, 0), Q(P.x, P.y, P.h), Q(P.x, yb, P.h)], ROOM.side);
    poly([Q(P.x, yb, 0), Q(x1, yb, 0), Q(x1, P.y, 0), Q(P.x, P.y, 0)], ROOM.floor);
    if (o.inside) o.inside();
    g.restore();
  }
  drawFlap(I, P, psi, o);
}

function psiBig(t) {
  if (t < FLIP) return 0;
  const x = (t - FLIP) / .34;                               // падает с ускорением и подпрыгивает от удара
  return x < 1 ? HALF * x * x : HALF - .12 * Math.abs(wob(t - FLIP - .34, 2.6, 6));
}

function psiEnd(t) {
  if (t < G_BACK) return HALF;
  const x = pg(t, G_BACK, .36), u = t - G_BACK - .36;       // поднимается и захлопывается
  if (x < 1) return HALF * (1 - x * x);
  return .06 * Math.abs(wob(u, 3, 8)) * (1 - pg(u, .25, .2));
}

// Пустая комната: лампа на шнуре, пятно света, одна тонкая папка
function roomInside(I, t) {
  const P = BIG, cy = -P.d * .5, open = t - FLIP, k = I.s / 300;
  const on = open < .5 ? 0 : open < .85 ? (Math.sin(open * 90) > -.2 ? 1 : .25) : 1;
  const sway = .35 * wob(open - .34, .9, 1.3) + .05 * Math.sin(t * 1.9);
  const bulb = [.55 * Math.sin(sway), cy, P.h - .55 * Math.cos(sway)];
  if (on > 0) {
    onFloor(I, P.x, P.y - P.d, 0, () => {
      const u = (bulb[0] - P.x) * 100, v = (cy - P.y + P.d) * 100, rg = g.createRadialGradient(u, v, 4, u, v, 110);
      rg.addColorStop(0, rgba("#FFE2A8", .34 * on));
      rg.addColorStop(1, rgba("#FFE2A8", 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, P.w * 100, P.d * 100);
    });
  }
  box(I, .12, -.82, 0, .64, .46, .035, [tone(C.tan, .1), C.tan2, tone(C.tan2, -.3)], {grain: 0, edge: 0});
  onFloor(I, .12, -.82, .035, () => {
    g.fillStyle = rgba(C.white, .55);
    g.fillRect(8, 10, 30, 3);
    g.fillRect(8, 18, 44, 3);
  });
  const top = I.p(0, cy, P.h), B = I.p(...bulb);
  line(top, B, "#0E0D13", 3 * k);
  if (on > 0) {
    const rg = g.createRadialGradient(B[0], B[1], 2, B[0], B[1], 130 * k);
    rg.addColorStop(0, rgba("#FFE2A8", .5 * on));
    rg.addColorStop(1, rgba("#FFE2A8", 0));
    g.fillStyle = rg;
    g.fillRect(B[0] - 130 * k, B[1] - 130 * k, 260 * k, 260 * k);
  }
  g.fillStyle = on > 0 ? "#FFF1CF" : "#55525E";
  g.beginPath();
  g.arc(B[0], B[1] + 8 * k, 13 * k, 0, 7);
  g.fill();
}

// ---------- взлёт: стрелка из носа ракеты, дым из сопла ----------

const ARROW = [[.25, .12, 1.41], [.66, .2, 2.08], [.46, .22, 2.42], [1.04, .28, 3.06], [.86, .3, 3.32], [1.5, .32, 3.95]];
const NOZZLE = [-.18, .12, .66];
const PUFFS = (() => {
  const r = rng(73), out = [];
  for (let i = 0; i < 12; i++) out.push({a: Math.PI * (.15 + r() * .7), v: .3 + r() * .7, s: .5 + r() * .7, d: r() * .25});
  return out;
})();

function smoke(I, t) {
  const dt = t - LAUNCH;
  if (dt < 0 || dt > 1.7) return;
  const B = I.p(...NOZZLE), k = I.s / 300;
  g.fillStyle = C.white;
  for (const p of PUFFS) {
    const u = dt - p.d;
    if (u <= 0) continue;
    const x = clamp(u / 1.3), q = eo3(x);
    g.globalAlpha = .5 * (1 - x);
    g.beginPath();
    g.arc(B[0] + Math.cos(p.a) * p.v * 150 * k * q, B[1] + Math.sin(p.a) * p.v * 70 * k * q + 40 * k * x, (16 + 70 * p.s * q) * k, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
}

function launchArrow(I, t) {
  const dt = t - LAUNCH;
  if (dt < 0 || t > e("b_pan") + 1.1) return;
  const pts = ARROW.map(p => I.p(...p)), len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const want = len[len.length - 1] * eo3(clamp(dt / .5)), shown = [pts[0]];
  let dir = [0, -1];
  for (let i = 1; i < pts.length; i++) {
    const seg = len[i] - len[i - 1], f = clamp((want - len[i - 1]) / seg);
    if (f <= 0) break;
    shown.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]);
    dir = [(pts[i][0] - pts[i - 1][0]) / seg, (pts[i][1] - pts[i - 1][1]) / seg];
    if (f < 1) break;
  }
  const k = I.s / 300, tip = shown[shown.length - 1], n = [-dir[1], dir[0]], hs = 64 * k;
  const stroke = (col, wd) => {
    g.beginPath();
    g.moveTo(shown[0][0], shown[0][1]);
    for (const p of shown.slice(1)) g.lineTo(p[0], p[1]);
    g.strokeStyle = col;
    g.lineWidth = wd;
    g.stroke();
  };
  g.save();
  g.globalAlpha = 1 - pg(t, e("b_pan") + .5, .5);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.shadowColor = C.amber;
  g.shadowBlur = 50 * k;
  stroke(C.amber, 30 * k);
  poly([[tip[0] + dir[0] * hs, tip[1] + dir[1] * hs], [tip[0] + n[0] * hs * .62, tip[1] + n[1] * hs * .62], [tip[0] - n[0] * hs * .62, tip[1] - n[1] * hs * .62]], C.amber);
  g.shadowBlur = 0;
  stroke(C.white, 11 * k);
  poly([[tip[0] + dir[0] * hs * .6, tip[1] + dir[1] * hs * .6], [tip[0] + n[0] * hs * .25, tip[1] + n[1] * hs * .25], [tip[0] - n[0] * hs * .25, tip[1] - n[1] * hs * .25]], C.white);
  const hit = t - e("a_x100");                              // удар «×100»: кольцо от кончика стрелки
  if (hit > 0 && hit < .6) {
    g.globalAlpha *= 1 - hit / .6;
    g.strokeStyle = C.amber;
    g.lineWidth = 7 * k;
    g.beginPath();
    g.arc(tip[0], tip[1], (40 + 220 * eo3(hit / .6)) * k, 0, 7);
    g.stroke();
  }
  g.restore();
}

// ---------- сцена 2: чертёж недостроенного дома и очередь билетиков ----------

const BP = {x: 3.4, y: -1.5, w: 2.4, d: 2.1};
const HOUSE = {x: 3.95, y: -1.05, w: 1.3, d: 1.1, h: .95, roof: .6};
const H_EDGES = (() => {
  const {x, y, w, d, h, roof} = HOUSE, x1 = x + w, y1 = y + d, z0 = .11, z1 = z0 + h, ym = y + d / 2, zr = z1 + roof;
  return [[[x1, y, z0], [x1, y, z1]], [[x, y, z0], [x, y, z1]], [[x1, y1, z0], [x1, y1, z1]], [[x, y1, z0], [x, y1, z1]],
    [[x, y, z1], [x1, y, z1]], [[x1, y, z1], [x1, y1, z1]], [[x1, y1, z1], [x, y1, z1]], [[x, y1, z1], [x, y, z1]],
    [[x, y, z1], [x, ym, zr]], [[x, y1, z1], [x, ym, zr]], [[x1, y, z1], [x1, ym, zr]], [[x1, y1, z1], [x1, ym, zr]], [[x, ym, zr], [x1, ym, zr]],
    [[x + w * .58, y1, z0], [x + w * .58, y1, z0 + .5]], [[x + w * .58, y1, z0 + .5], [x + w * .8, y1, z0 + .5]], [[x + w * .8, y1, z0 + .5], [x + w * .8, y1, z0]]];
})();
const TK = {w: .34, d: .035, h: .52};
const QX = 2.6, QN = 6, QGAP = .24;
const NEST = [HOUSE.x + HOUSE.w / 2 - TK.w / 2, HOUSE.y + HOUSE.d / 2, .55];

function blueprint(I, t) {
  const {x, y, w, d} = BP;
  box(I, x, y, 0, w, d, .03, [C.navy, C.navy2, tone(C.navy2, -.3)], {grain: 0, edge: 0});
  onFloor(I, x, y, .03, () => {
    g.strokeStyle = rgba(C.white, .18);
    g.lineWidth = 1.2;
    g.beginPath();
    for (let u = 10; u < w * 100; u += 15) { g.moveTo(u, 4); g.lineTo(u, d * 100 - 4); }
    for (let v = 10; v < d * 100; v += 15) { g.moveTo(4, v); g.lineTo(w * 100 - 4, v); }
    g.stroke();
    g.strokeStyle = rgba(C.white, .7);
    g.lineWidth = 2.5;
    g.strokeRect(5, 5, w * 100 - 10, d * 100 - 10);
    g.strokeStyle = rgba(C.sky, .9);
    g.lineWidth = 2;
    g.strokeRect((HOUSE.x - x) * 100, (HOUSE.y - y) * 100, HOUSE.w * 100, HOUSE.d * 100);
  });
  const {x: hx, y: hy, w: hw, d: hd} = HOUSE;
  box(I, hx - .06, hy - .06, .03, hw + .12, hd + .12, .08, [tone(C.sky2, .2), C.sky2, C.navy], {grain: 0});
  for (const [bx, bz] of [[0, 0], [.25, 0], [0, .2]]) {     // начали строить: три кирпича в углу
    box(I, hx + bx, hy + hd - .24, .11 + bz, .24, .24, .2, [tone(C.coral, .2), C.coral, tone(C.coral, -.35)], {grain: .2});
  }
}

function houseLines(I, t) {
  const t0 = e("b_house"), k = I.s / 260;
  g.save();
  g.setLineDash([10 * k, 8 * k]);
  g.lineCap = "butt";
  g.strokeStyle = rgba(C.white, .85 * (1 - pg(t, e("b_build") + .9, .5)));   // дом достроен — пунктир гаснет
  g.lineWidth = 3.2 * k;
  H_EDGES.forEach(([a, b], i) => {
    const p = eio(pg(t, t0 + .05 * i, .3));
    if (p <= 0) return;
    const A = I.p(...a), B = I.p(...b);
    g.beginPath();
    g.moveTo(A[0], A[1]);
    g.lineTo(lerp(A[0], B[0], p), lerp(A[1], B[1], p));
    g.stroke();
  });
  g.restore();
}

function ticket(I, x, y, z, sc = 1, a = 1, cols = null) {
  const w = TK.w * sc, h = TK.h * sc;
  g.globalAlpha = a;
  box(I, x, y, z, w, TK.d, h, cols || [tone(C.amber, .3), C.amber, C.amber2], {grain: 0, edge: 0});
  onWallY(I, x, y + TK.d, z + h, () => {
    const ww = w * 100, hh = h * 100;
    g.strokeStyle = rgba(C.ink, .45);
    g.lineWidth = 1.6 * sc;
    g.setLineDash([4 * sc, 4 * sc]);
    g.beginPath();
    g.moveTo(3, hh * .3);
    g.lineTo(ww - 3, hh * .3);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = rgba(C.ink, .32);
    g.fillRect(ww * .2, hh * .5, ww * .6, 3 * sc);
    g.fillRect(ww * .2, hh * .63, ww * .4, 3 * sc);
    sparkle(ww * .5, hh * .15, 6 * sc, rgba(C.white, .85));
  });
  g.globalAlpha = 1;
}

function queue(I, t) {
  const t0 = e("b_tickets"), list = [];
  for (let k = 0; k < QN; k++) {
    const dep = t0 + QGAP * k;
    if (t < dep) {                                          // стоит в очереди и подвигается вперёд, когда передний улетел
      let slot = k;
      for (let j = 0; j < k; j++) slot -= eio(pg(t, t0 + QGAP * j + .05, .18));
      list.push({x: QX, y: .55 - slot * .42, z: 0, sc: 1, a: 1});
      continue;
    }
    const x = pg(t, dep, .7);
    if (x >= 1) continue;
    const q = eio(x);
    list.push({x: lerp(QX, NEST[0], q), y: lerp(.55, NEST[1], q), z: lerp(0, NEST[2], q) + 1.3 * Math.sin(Math.PI * q), sc: 1 - .55 * q, a: 1 - pg(x, .8, .2), fly: true});
  }
  list.sort((p, q) => (p.fly ? 1 : 0) - (q.fly ? 1 : 0) || p.y - q.y);
  for (const k of list) ticket(I, k.x, k.y, k.z, k.sc, k.a);
  for (let k = 0; k < QN; k++) {                            // вспышка, когда билетик ушёл в чертёж
    const u = t - (t0 + QGAP * k + .7);
    if (u < 0 || u > .3) continue;
    const P = I.p(NEST[0] + TK.w / 4, NEST[1], NEST[2] + .1);
    sparkle(P[0], P[1], (14 + 40 * u) * I.s / 260 * (1 - u / .3), rgba(C.amber, .9));
  }
}

// ---------- сцена 3: три коробки ----------

const BOXES = [{x: 7.6, k: "c_b1", label: "ТОВАР", ok: false}, {x: 8.9, k: "c_b2", label: "ДОЛЯ В КОМПАНИИ", ok: false},
  {x: 10.2, k: "c_b3", label: "ТОКЕН", ok: true}];
const BS = 1, BY = -.5;

function crates(I, t) {
  for (const b of BOXES) {
    const dt = t - e(b.k);
    if (dt < 0) continue;
    const fall = clamp(dt / .3), z = 2.6 * (1 - fall * fall), sq = dt > .3 ? wob(dt - .3, 3, 7) * .08 : 0;
    const h = BS * (1 - sq), w = BS * (1 + sq * .5), x = b.x - (w - BS) / 2;
    floorShadow(I, b.x, BY, BS, BS, .35 * fall, .1, .1);
    box(I, x, BY, z, w, BS, h, [C.tan, tone(C.tan2, .05), tone(C.tan2, -.25)], {grain: .3});
    onFloor(I, x, BY, z + h, () => {                        // лента на крышке
      g.fillStyle = rgba(C.amber2, .5);
      g.fillRect(w * 100 * .42, 0, w * 100 * .16, BS * 100);
    });
    const p = clamp((dt - .32) / .25);
    if (p > 0) {
      onWallY(I, x, BY + BS, z + h, () => {
        if (b.ok) tick(w * 50, h * 50, 44, p, C.rise, 13);
        else cross(w * 50, h * 50, 26, p, C.fall, 13);
      });
    }
    if (b.ok && dt > .3 && t < e("c_up")) {               // из коробки выглядывает билетик, пока не взлетел
      const s = back(clamp((dt - .3) / .35));
      ticket(I, b.x + .5 - TK.w * s / 2, BY + .45, z + h, s);
    }
  }
}

// На собранное вырастает дом: стены поднимаются внутри пунктира, потом садится крыша
function houseBuild(I, t) {
  const p = eio(pg(t, e("b_build"), 1));
  if (p <= 0) return;
  const {x, y, w, d, h, roof} = HOUSE, z0 = .11, hh = h * p, x1 = x + w, y1 = y + d;
  box(I, x, y, z0, w, d, hh, [tone(C.tan, .2), C.tan, tone(C.tan2, -.12)], {grain: .2});
  if (p > .7) {
    onWallY(I, x, y1, z0 + hh, () => {
      g.globalAlpha = clamp((p - .7) / .3);
      g.fillStyle = C.navy2;
      g.fillRect(w * 58, hh * 100 - 50, w * 22, 50);         // дверь
      g.fillStyle = rgba(C.amber, .85);
      g.fillRect(w * 14, hh * 100 - 62, w * 24, 24);          // окно
      g.globalAlpha = 1;
    });
  }
  const r = back(clamp((t - e("b_build") - .85) / .35));
  if (r <= 0) return;
  const z1 = z0 + h, ym = y + d / 2, zr = z1 + roof * r;
  poly([I.p(x, y, z1), I.p(x1, y, z1), I.p(x1, ym, zr), I.p(x, ym, zr)], tone(C.coral, -.3));
  poly([I.p(x1, y, z1), I.p(x1, y1, z1), I.p(x1, ym, zr)], tone(C.tan2, -.2));
  poly([I.p(x, y1, z1), I.p(x1, y1, z1), I.p(x1, ym, zr), I.p(x, ym, zr)], C.coral);
}

// ---------- сцены 3–4: билетик из третьей коробки взлетает и летит к 2014 году ----------

function flyTicket(I, t) {
  const t0 = e("c_up");
  if (t < t0) return;
  const x0 = BOXES[2].x + .5 - TK.w / 2, y0 = BY + .45, up = eo3(pg(t, t0, .7));
  const hov = Math.sin((t - t0) * 3.4) * .07 * up * (1 - pg(t, e("d_go"), .3));
  const f = pg(t, e("d_go"), 1), q = eio(f);
  const t1 = e("d_grow"), t2 = e("d_hit");
  let sc = 1;
  if (t >= t1) sc = t < t2 ? 1 + 5.6 * pg(t, t1, t2 - t1) ** 2.2 : 6.6 * (1 + .05 * wob(t - t2, 3, 5));
  const cx = lerp(x0 + TK.w / 2, ST.x, q), y = lerp(y0, ST.y + ST.d / 2, q);
  const z = lerp(BS + 1.6 * up + hov, ST.h, q) + 1.1 * Math.sin(Math.PI * q);
  if (t >= t2) {                                            // сияние за огромным билетиком
    const P = I.p(ST.x, y, ST.h + TK.h * sc * .55), k = I.s / 160, u = t - t2, r = (520 + 60 * Math.sin(u * 2)) * k;
    const rg = g.createRadialGradient(P[0], P[1], 20 * k, P[0], P[1], r);
    rg.addColorStop(0, rgba(C.amber, .42 * (.6 + .4 * Math.exp(-u * 2))));
    rg.addColorStop(1, rgba(C.amber, 0));
    g.fillStyle = rg;
    g.fillRect(P[0] - r, P[1] - r, r * 2, r * 2);
    g.fillStyle = rgba(C.white, .07);
    for (let i = 0; i < 12; i += 2) {
      const a0 = i / 12 * Math.PI * 2 + u * .25;
      g.beginPath();
      g.moveTo(P[0], P[1]);
      g.arc(P[0], P[1], r * 1.3, a0, a0 + Math.PI / 12);
      g.closePath();
      g.fill();
    }
  }
  if (f > 0 && f < 1) {                                     // искры за билетиком в полёте
    for (let i = 1; i <= 5; i++) {
      const qq = eio(clamp(f - i * .045)), P = I.p(lerp(x0 + TK.w / 2, ST.x, qq), lerp(y0, ST.y + ST.d / 2, qq), lerp(BS + 1.6, ST.h, qq) + 1.1 * Math.sin(Math.PI * qq) + .3);
      sparkle(P[0], P[1], (14 - i * 2) * I.s / 260, rgba(C.amber, .8 - i * .13));
    }
  }
  ticket(I, cx - TK.w * sc / 2, y, z, sc);
  const land = t - e("d_go") - 1;
  if (land > 0 && land < .35) {                             // приземлился на постамент
    const P = I.p(ST.x, ST.y + ST.d / 2, ST.h + .05);
    sparkle(P[0], P[1], (20 + 70 * land) * I.s / 300 * (1 - land / .35), rgba(C.amber, .9));
  }
}

const PROPS_ST = (() => {                                   // кубики вокруг постамента 2014 года: не пустое поле
  const r = rng(47), out = [];
  for (let i = 0; i < 14; i++) out.push({x: 11.2 + i * .55 + r() * .3, y: i % 2 ? -3.6 + r() * 1.2 : 1.6 + r() * 1.4, w: .14 + r() * .22, d: .14 + r() * .22,
    h: .1 + r() * .45, col: [C.amber2, C.plate2, C.navy, C.coral][i % 4]});
  return out.sort((a, b) => a.y - b.y);
})();

function station(I, t) {
  floorShadow(I, ST.x - ST.w / 2, ST.y, ST.w, ST.d, .3, .1, .08);
  box(I, ST.x - ST.w / 2, ST.y, 0, ST.w, ST.d, ST.h, [tone(C.amber, .35), C.amber2, tone(C.amber2, -.35)], {grain: .2});
  onFloor(I, ST.x - ST.w / 2, ST.y, ST.h, () => {
    g.strokeStyle = rgba(C.white, .45);
    g.lineWidth = 3;
    g.strokeRect(8, 8, ST.w * 100 - 16, ST.d * 100 - 16);
  });
}

// Счётчик множителя: цифры крутятся, пока билетик растёт, и встают на «×10 000+» с ударом
function counterText(t) {
  const t0 = e("d_grow"), t1 = e("d_hit"), off = e("k_move") - .15;
  if (t < t0 || t > off + .3) return;
  let s, q = 1;
  if (t < t1) {
    const v = Math.max(1, Math.round(Math.exp(Math.log(10000) * pg(t, t0, t1 - t0) ** 1.7)));
    s = "×" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  } else {
    s = tx("d_x");
    q = 1 + .3 * Math.exp(-(t - t1) * 7);
  }
  g.save();
  g.globalAlpha = 1 - pg(t, off, .3);
  g.translate(NOTE, 600);
  g.scale(q, q);
  text(s, 6, 8, 150, rgba(C.ink, .5));
  text(s, 0, 0, 150, C.amber);
  g.restore();
}

// ---------- сцена 5: поле из сотни одинаковых коробок 2017 года, восемь из десяти пустые ----------

const MS = {w: .56, d: .42, h: .56, t: .03};
const FIELD = (() => {
  const r = rng(83), out = [];
  for (let j = 0; j < 12; j++) {
    for (let i = 0; i < 14; i++) {
      const x = -5.6 + .8 * i + (j % 2) * .4 + (r() - .5) * .1, y = -4.6 + .75 * j + (r() - .5) * .08;
      if (Math.abs(x) < 1.75 && y > -2.3) continue;           // коридор перед большой коробкой
      if (x > 2.9 && x < 6.3 && y > -1.6 && y < 1.15) continue;   // здесь лежит чертёж
      out.push({x, y, dist: Math.hypot(x, y * 1.2), j: r(), good: false});
    }
  }
  let b = 0;
  out.forEach((m, i) => { if (Math.hypot(m.x - 2.6, m.y - 2.2) < Math.hypot(out[b].x - 2.6, out[b].y - 2.2)) b = i; });
  out[b].bnb = true;
  const order = out.map((m, i) => [r(), i]).sort((p, q) => p[0] - q[0]);
  order.slice(0, Math.round(out.length * .2)).forEach(([, i]) => { out[i].good = true; });
  out[b].good = true;
  return out.sort((p, q) => p.y - q.y);
})();
const BNB = FIELD.find(m => m.bnb);

function greenCore(I, P, t) {
  g.save();
  g.shadowColor = C.rise;
  g.shadowBlur = 24;
  box(I, P.x + P.w * .28, P.y - P.d * .75, 0, P.w * .44, P.d * .5, P.h * .44, [tone(C.rise, .3), C.rise, tone(C.rise, -.3)], {grain: 0, edge: 0});
  g.restore();
}

function outlineFront(I, P, col, a, wd = 4) {
  const Q = (xx, z) => I.p(xx, P.y, z);
  g.save();
  g.shadowColor = col;
  g.shadowBlur = 30;
  path([Q(P.x, 0), Q(P.x + P.w, 0), Q(P.x + P.w, P.h), Q(P.x, P.h)]);
  g.strokeStyle = rgba(col, a);
  g.lineWidth = wd;
  g.stroke();
  g.restore();
}

// Поле рисуется от дальних рядов к ближним; большая коробка и чертёж встают на своё место в этом порядке
function field(I, t, middle) {
  const t0 = e("k_field"), tm = e("k_mass"), t2 = e("k_t2");
  let done = false;
  for (const m of FIELD) {
    if (!done && m.y > -2.3) { middle(); done = true; }
    const a = t0 + m.dist * .2 + m.j * .25;
    if (t < a) continue;
    const sc = back(clamp((t - a) / .3));
    const P = {x: m.x - MS.w * sc / 2, y: m.y, w: MS.w * sc, d: MS.d * sc, h: MS.h * sc, t: MS.t};
    const st = tm + m.dist * .13 + m.j * .12, x = (t - st) / .22;
    const psi = x <= 0 ? 0 : x < 1 ? HALF * x * x : HALF - .15 * Math.abs(wob(t - st - .22, 3, 7));
    const dim = m.good ? 0 : .7 * eio(pg(t, t2, .4));
    drawPackage(I, P, psi, {lite: true, tw: t + m.j * 9, dim, grain: 0, inside: m.good ? () => greenCore(I, P, t) : null});
    if (m.bnb && t >= e("k_bnb") && t < e("k_push") + .4) {
      outlineFront(I, P, C.amber, eio(pg(t, e("k_bnb"), .3)) * (1 - pg(t, e("k_push"), .4)) * (.75 + .25 * Math.sin(t * 6)), 5);
    }
    if (m.good && t >= t2) outlineFront(I, P, C.rise, eio(pg(t, t2, .3)) * (.75 + .25 * Math.sin(t * 6 + m.j * 5)));
  }
  if (!done) middle();
}



// ---------- мир A: пол, коробка проекта, сцены 1–4 и 7 ----------

const PROPS_A = (() => {                                    // мелкие кубики на заднем плане: дают глубину на проездах
  const r = rng(41), out = [];
  for (let i = 0; i < 16; i++) out.push({x: -5 + i * 1.15 + r() * .6, y: -3.8 + r() * 1.2, w: .14 + r() * .24, d: .14 + r() * .24, h: .1 + r() * .5, col: [C.plate2, C.navy, C.coral, C.sky2, C.plate2, C.amber2][i % 6]});
  return out.sort((a, b) => a.y - b.y);
})();

function floorA(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-24.6, -9), P(30, -9), P(30, 24), P(-24.6, 24)], C.plate);   // дальний край — горизонт; ближний и боковые с запасом
  g.globalAlpha = .09;
  for (let x = -24.6; x <= 30; x += .8) line(P(x, -9), P(x, 24), C.white, 1);
  for (let y = -8.6; y <= 24; y += .8) line(P(-24.6, y), P(30, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_A) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
  for (const k of PROPS_ST) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

function worldA(t, end) {
  const xHit = !end && t >= e("a_x100") ? Math.exp(-(t - e("a_x100")) * 4) : 0;
  const dHit = !end && t >= e("d_hit") ? Math.exp(-(t - e("d_hit")) * 3) : 0;
  const shake = end ? .8 * wob(t - G_BACK - .36, 6, 8) * (1 - pg(t, END - .3, .2))
    : 1.3 * wob(t - e("a_x100"), 5, 6) + .6 * wob(t - LAUNCH, 7, 6) + 1.5 * wob(t - e("d_hit"), 5, 6) + wob(t - FLIP - .34, 6, 7) + .8 * wob(t - e("k_t2"), 5, 6);
  const V = viewOf(shotA, t, shake), I = V.I;
  const burst = !end && t >= LAUNCH ? Math.exp(-(t - LAUNCH) * 1.5) : 0;
  sky(V, t, .28 * xHit + .2 * burst + .3 * dHit);
  floorA(I);
  const tw = loopT(t);
  const middle = () => {
    drawPackage(I, BIG, end ? psiEnd(t) : psiBig(t), {
      tw, amp: engineAmp(t), flame: .3 + .7 * engineAmp(t) + .9 * burst,
      shine: end ? undefined : t < e("b_pan") ? pg(t, e("a_shine"), .6) : pg(t, e("k_push") + .45, .6),
      wink: end ? 0 : clamp((t - e("a_ask")) / .4), inside: () => roomInside(I, t)});
    if (end) return;
    blueprint(I, t);
    houseBuild(I, t);
    houseLines(I, t);
    queue(I, t);
  };
  if (!end && t >= e("k_field")) field(I, t, middle);
  else middle();
  if (!end) {
    if (t >= e("c_b1")) crates(I, t);
    station(I, t);
    flyTicket(I, t);
    smoke(I, t);
    launchArrow(I, t);
  }
  return V;
}

// Метки в мире поверх ближнего плана
function labelsA(I, t) {
  const k = I.s / 260;
  if (t >= e("c_b1") && t < e("d_go") + .4) {
    g.save();
    g.globalAlpha = 1 - pg(t, e("d_go"), .3);
    BOXES.forEach((b, i) => {
      const P = I.p(b.x + .5, BY + BS, 0);
      tag(b.label, P[0], P[1] + (22 + 62 * (i % 2)) * k, t, e(b.k) + .2, b.ok ? C.amber : C.white, {size: 42});   // средняя ниже: длинная надпись не налезает на соседей
    });
    if (t >= e("c_q")) {
      const dt = t - e("c_q"), P = I.p(BOXES[2].x + .5, BY + .5, BS + .62), q = back(clamp(dt / .35)) * (1 - eio(pg(t, e("c_up"), .3)));
      g.save();
      g.translate(P[0], P[1] - 46 + Math.sin(dt * 3.2) * 10);
      g.scale(q, q);
      g.rotate(.08 * Math.sin(dt * 2.1));
      text("?", 8, 10, 230, rgba(C.ink, .5), {align: "center"});
      text("?", 0, 0, 230, C.amber, {align: "center"});
      g.restore();
    }
    g.restore();
  }
  if (t >= e("k_bnb") && t < e("k_push") + .4) {            // подсвеченная коробка BNB
    const P = I.p(BNB.x, BNB.y - MS.d / 2, MS.h + .1);
    g.save();
    g.globalAlpha = 1 - pg(t, e("k_push"), .3);
    tag(tx("k_bnb"), P[0], P[1] - 66 - 22 - (t >= e("k_bnbx") ? 76 : 0), t, e("k_bnb"), C.white, {size: 44, tail: t < e("k_bnbx")});
    tag(tx("k_bnbx"), P[0], P[1] - 66 - 22, t, e("k_bnbx"), C.amber, {size: 44, tail: true});
    g.restore();
  }
  if (t >= e("k_folder") && t < e("k_back") + .3) {
    const P = I.p(.44, -.6, .04);
    g.save();
    g.globalAlpha = 1 - pg(t, e("k_back"), .25);
    tag(tx("k_folder"), P[0], P[1] - 66 - 22, t, e("k_folder"), C.white, {size: 44, tail: true});
    g.restore();
  }
}

function sceneA(t) {
  const V = worldA(t, false);
  foreground(V.v, t, .4);
  resetCam();
  labelsA(V.I, t);
  reveal(tx("a_hook"), NOTE, 290, 116, C.white, t, -10, {off: e("b_pan") - .15, block: C.coral, lh: 135});
  note("a_x100", NOTE, 650, 150, C.amber, t, {off: e("b_pan") - .15, block: C.white});
  const offB = e("c_move") - .15, offD = e("k_move") - .15;
  note("b_ico", NOTE, 400, 230, C.white, t, {off: offB, block: C.sky});
  note("b_sub", NOTE, 500, 68, C.sky, t, {off: offB, lh: 80, block: C.white});
  note("d_year", NOTE, 300, 190, C.white, t, {off: offD, block: C.amber});
  note("d_name", NOTE, 405, 76, C.sky, t, {off: offD, block: C.white});
  counterText(t);
  note("k_year", NOTE, 300, 190, C.white, t, {off: e("k_t1") - .15, block: C.coral});
  note("k_t1", NOTE, 300, 110, C.white, t, {off: e("k_back") - .15, block: C.amber, lh: 125});
  note("k_t2", NOTE, 330, 120, C.white, t, {block: C.fall, lh: 140});
}

function sceneEnd(t) {
  const V = worldA(t, true);
  foreground(V.v, t, .4);
  resetCam();
  const off = G_BACK - .05;
  note("g_t1", NOTE, 250, 84, C.white, t, {off, block: C.amber, lh: 96});
  note("g_t2", NOTE, 445, 62, C.amber, t, {off, block: C.coral, lh: 74});
  note("g_note", W / 2, 1655, 34, C.grey, t, {off, align: "center", block: C.grey, w: 560});
  reveal(tx("a_hook"), NOTE, 290, 116, C.white, t, G_BACK + .22, {block: C.coral, lh: 135});
}



// ---------- мир C: площадка CoinList — проверка, лотерея, токены до запуска; потом карточки с иксами ----------

const PROPS_C = (() => {
  const r = rng(91), out = [];
  for (let i = 0; i < 20; i++) out.push({x: -4.5 + i * .95 + r() * .5, y: -8 + r() * 1.6, w: .14 + r() * .22, d: .14 + r() * .22, h: .1 + r() * .5, col: [C.navy, C.teal, C.plate2, C.sky2][i % 4]});
  for (let i = 0; i < 6; i++) out.push({x: -3.6 - r() * 1.4, y: -3 + i * 1.6 + r() * .4, w: .14 + r() * .2, d: .14 + r() * .2, h: .1 + r() * .4, col: [C.teal, C.navy, C.sky2][i % 3]});
  return out.sort((a, b) => a.y - b.y);
})();
const GREYS = [tone(C.grey, .2), C.grey, tone(C.grey, -.35)];

function floorC(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-16, -18), P(26, -18), P(26, 18), P(-16, 18)], "#172431");    // с запасом: на общих планах края не видно
  g.globalAlpha = .1;
  for (let x = -16; x <= 26; x += .8) line(P(x, -18), P(x, 18), C.white, 1);
  for (let y = -17.6; y <= 18; y += .8) line(P(-16, y), P(26, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_C) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
  poly([P(-.8, G3 - 1.4), P(.8, G3 - 1.4), P(.8, 12), P(-.8, 12)], "#1E3244");   // дорожка
  onFloor(I, -.03, G3 - 1.3, 0, () => {
    g.strokeStyle = rgba(C.teal, .35);
    g.lineWidth = 6;
    g.setLineDash([40, 34]);
    g.beginPath();
    g.moveTo(3, 0);
    g.lineTo(3, (12 - G3 + 1.3) * 100);
    g.stroke();
    g.setLineDash([]);
  });
}

// Очередь билетиков: стоит, по слову трогается, проходит рамку проверки и уходит в барабан; выходят из него немногие
const CQ = {n: 12, gap: .5, v: 2.4, y0: G1 + 1};
const WIN = [1, 5, 9];
const DRUM = {y: G2, z: .8, R: .62, L: .9};                  // ось барабана вдоль дорожки: к зрителю смотрит торец со спицами
const MOUTH = DRUM.y + DRUM.L / 2;

function cTicket(k, t) {
  const T0 = e("m_go"), yk = CQ.y0 + CQ.gap * k, y = t < T0 ? yk : yk - CQ.v * (t - T0);
  const tin = T0 + (yk - MOUTH) / CQ.v;
  if (t < tin) {
    const lift = .45 * eio(clamp((MOUTH + .9 - y) / .9));    // перед барабаном билетик поднимается к горловине
    return {x: -TK.w / 2, y, z: lift + (t < T0 ? .03 * Math.abs(Math.sin(t * 3 + k)) : 0), scan: Math.abs(y - G1) < .2};
  }
  const u = t - tin, w = WIN.indexOf(k);
  if (u < .4) return null;                                  // внутри барабана
  if (w >= 0) {                                             // повезло: выходит сзади и садится на площадку
    const q = eio(clamp((u - .4) / .8));
    return {x: lerp(-TK.w / 2, -.55 + .55 * w - TK.w / 2, q), y: lerp(DRUM.y - DRUM.L / 2, G3 - .45, q),
      z: lerp(.45, .3, q) + 1.1 * Math.sin(Math.PI * q), win: q >= 1};
  }
  const q = clamp((u - .4) / .7), px = -1.12 - .14 * (k % 3), py = DRUM.y + .25 + .2 * (k % 4);
  if (q >= 1) return {flat: true, x: px, y: py};           // не повезло: вылетает сверху и ложится в серую кучку
  return {x: lerp(-TK.w / 2, px, eo3(q)), y: lerp(DRUM.y + .5, py, q), z: lerp(DRUM.z + DRUM.R, 0, q * q) + .5 * Math.sin(Math.PI * q), lose: q};
}

function scanner(I, t, flash) {
  const y = G1, h = 1.05, cols = [tone(C.teal, .15), C.teal, tone(C.teal, -.4)];
  box(I, -.95, y - .12, 0, .2, .24, h, cols, {grain: .15});
  box(I, .75, y - .12, 0, .2, .24, h, cols, {grain: .15});
  const live = pg(t, e("m_s1") - .2, .3), col = flash > 0 ? C.rise : C.sky;
  poly([I.p(-.75, y, 0), I.p(.75, y, 0), I.p(.75, y, h), I.p(-.75, y, h)], rgba(col, .08 + .1 * live + .25 * flash));
  const zs = h * (.5 + .45 * Math.sin(t * 3.1));
  line(I.p(-.75, y, zs), I.p(.75, y, zs), rgba(col, .4 + .5 * live), 4 * I.s / 200);
  box(I, -.95, y - .12, h, 1.9, .24, .16, [tone(C.teal, .3), tone(C.teal, .1), tone(C.teal, -.3)], {grain: 0});
  const L = I.p(0, y + .12, h + .08);                       // лампочка на перекладине
  g.fillStyle = flash > 0 ? C.rise : rgba(C.sky, .5 + .5 * live);
  g.beginPath();
  g.arc(L[0], L[1], 9 * I.s / 200, 0, 7);
  g.fill();
}

function drumSpin(t) {
  const ramp = (u, d) => u <= 0 ? 0 : u < d ? u * u / (2 * d) : u - d / 2;
  return .3 * t + 2.2 * ramp(t - e("m_go"), .6) + 3.4 * ramp(t - e("m_s2"), .5);
}

function drum(I, t) {
  const {y, z, R, L} = DRUM, a = drumSpin(t), N = 12, y0 = y - L / 2, y1 = y + L / 2;
  const Q = (yy, th) => I.p(R * Math.cos(th), yy, z + R * Math.sin(th));
  const stand = [tone(C.plate2, .2), C.plate2, C.plate];
  box(I, -.7, y - .2, 0, .14, .4, z, stand, {grain: 0});
  box(I, .56, y - .2, 0, .14, .4, z, stand, {grain: 0});
  for (let i = 0; i < N; i++) {                              // боковые грани, только видимые
    const a0 = i * 2 * Math.PI / N, a1 = a0 + 2 * Math.PI / N, m = (a0 + a1) / 2;
    if (Math.cos(m) * I.sin + Math.sin(m) * I.k / I.c <= 0) continue;
    poly([Q(y0, a0), Q(y1, a0), Q(y1, a1), Q(y0, a1)], blend(tone(C.amber2, -.15), C.white, .18 * (.5 + .5 * Math.sin(m))));
  }
  const rim = [], hub = I.p(0, y1, z), k = I.s / 200;
  for (let i = 0; i < N; i++) rim.push(Q(y1, i * 2 * Math.PI / N));
  poly(rim, C.amber);
  g.strokeStyle = tone(C.amber2, -.3);
  g.lineWidth = 6 * k;
  path(rim);
  g.closePath();
  g.stroke();
  g.strokeStyle = rgba(C.ink, .55);                          // спицы крутятся, с розыгрышем быстрее
  g.lineWidth = 5 * k;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const p = Q(y1, a + i * Math.PI / 3);
    g.moveTo(hub[0], hub[1]);
    g.lineTo(p[0], p[1]);
  }
  g.stroke();
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(hub[0], hub[1], 12 * k, 0, 7);
  g.fill();
  const mouth = I.p(0, y1, z - R * .45);                    // горловина, куда заходят билетики
  g.fillStyle = C.navy2;
  g.beginPath();
  g.ellipse(mouth[0], mouth[1], 34 * k, 16 * k, 0, 0, 7);
  g.fill();
}

function platform(I, t) {
  box(I, -1.05, G3 - .9, 0, 2.1, .9, .3, [tone(C.teal, .05), C.sky2, C.navy], {grain: .2});
  const on = eio(pg(t, e("m_s3"), .4));
  if (on > 0) {
    onFloor(I, -1.05, G3 - .9, .3, () => {
      g.strokeStyle = rgba(C.rise, .8 * on);
      g.lineWidth = 5;
      g.strokeRect(6, 6, 198, 78);
    });
  }
}

function gatesC(I, t) {
  const items = [{y: G3 - .9, draw: () => platform(I, t)}, {y: DRUM.y, draw: () => drum(I, t)}];
  let flash = 0;
  for (let k = 0; k < CQ.n; k++) {
    const s = cTicket(k, t);
    if (!s) continue;
    if (s.scan && t > e("m_go")) flash = 1;
    if (s.flat) items.push({y: s.y, draw: () => box(I, s.x, s.y, 0, TK.w, TK.h * .8, .03, GREYS, {grain: 0, edge: 0})});
    else {
      const lose = s.lose !== undefined;
      items.push({y: s.y, draw: () => {
        ticket(I, s.x, s.y, s.z, 1, lose ? 1 - .2 * s.lose : 1, lose ? GREYS : null);
        if (s.win) {
          const P = I.p(s.x + TK.w / 2, s.y, s.z + TK.h + .12);
          sparkle(P[0], P[1], (9 + 3 * Math.sin(t * 6 + k)) * I.s / 200, rgba(C.rise, .9));
        }
      }});
    }
  }
  items.push({y: G1, draw: () => scanner(I, t, flash)});
  items.sort((p, q) => p.y - q.y);
  for (const it of items) it.draw();
}

// Подписи схемы справа от рамки, барабана и площадки; стрелки ведут от одной к другой
function labelsC(I, t) {
  if (t > e("n_move") + .5) return;
  g.save();
  g.globalAlpha = 1 - pg(t, e("n_move"), .4);
  const S = 42, spots = [["m_s1", 1.05, G1, .6, C.white], ["m_s2", 1.05, G2, .95, C.amber], ["m_s3", 1.15, G3 - .45, .35, C.rise]];
  let prev = null;
  for (const [k, x, y, z, col] of spots) {
    const P = I.p(x, y, z), wd = widthOf(tx(k), S) + 1.1 * S, X = Math.min(P[0], 1040 - wd), Y = P[1] - S * .75;
    if (prev && t >= e(k)) {
      const p = eo3(clamp((t - e(k)) / .3)), ax = prev[0] + 40, y0 = prev[1] - 10, y1 = lerp(y0, Y + 1.5 * S + 12, p);
      line([ax, y0], [ax, y1], C.teal, 5);
      if (p > .9) poly([[ax, y1 - 15], [ax + 12, y1 + 5], [ax - 12, y1 + 5]], C.teal);
    }
    tag(tx(k), X, Y, t, e(k), col, {size: S, align: "left"});
    prev = [X, Y];
  }
  g.restore();
}

// ---------- карточки с иксами: график без осей, множитель вспыхивает ----------

const RESULTS = [
  {k: "n_1", mx: "n_1x", x: PODIUM.xl, y: PODIUM.yb, h: PODIUM.hb, year: "2020", name: "SOLANA", mult: "×1 000+",
    pts: [[0, .04], [.22, .1], [.4, .26], [.55, .22], [.74, .7], [.86, 1]], slide: [[.93, .62], [1, .5]]},
  {k: "n_2", mx: "n_2x", x: PODIUM.xr, y: PODIUM.yb, h: PODIUM.hb, year: "2020", name: "FLOW", mult: "×400",
    pts: [[0, .04], [.3, .14], [.5, .42], [.66, 1]], slide: [[.82, .45], [1, .32]]},
  {k: "n_3", mx: "n_3x", x: PODIUM.xl, y: PODIUM.yf, h: PODIUM.hf, year: "2020", name: "NEAR", mult: "×50",
    pts: [[0, .04], [.35, .24], [.6, .5], [.88, .86]]},
  {k: "n_4", mx: "n_4x", x: PODIUM.xr, y: PODIUM.yf, h: PODIUM.hf, year: "2021", name: "IMMUTABLE X", mult: "×90",
    pts: [[0, .04], [.3, .2], [.55, .36], [.85, .9]]},
  {k: "p_card", mx: "p_drop", x: ALGO.x, y: ALGO.y, h: PODIUM.hf, year: "2019", name: "ALGORAND", mult: "÷20", down: true,
    pts: [[0, .56], [.16, .72], [.26, .68]], slide: [[.42, .1], [.68, .06], [1, .04]]},
];

function chartPath(pts, w, p) {
  const P = pts.map(([u, v]) => [18 + u * (w - 36), 182 - v * 96]), len = [0];
  for (let i = 1; i < P.length; i++) len.push(len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const want = len[len.length - 1] * p, out = [P[0]];
  let dir = [1, 0];
  for (let i = 1; i < P.length; i++) {
    const seg = len[i] - len[i - 1], f = clamp((want - len[i - 1]) / seg);
    if (f <= 0) break;
    out.push([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]);
    dir = [(P[i][0] - P[i - 1][0]) / seg, (P[i][1] - P[i - 1][1]) / seg];
    if (f < 1) break;
  }
  return {out, dir};
}

function strokeChart(c, col, wd) {
  if (c.out.length < 2) return;
  g.beginPath();
  g.moveTo(c.out[0][0], c.out[0][1]);
  for (const p of c.out.slice(1)) g.lineTo(p[0], p[1]);
  g.strokeStyle = col;
  g.lineWidth = wd;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.stroke();
}

function arrowHead(c, col, s) {
  const tip = c.out[c.out.length - 1], d = c.dir, n = [-d[1], d[0]];
  poly([[tip[0] + d[0] * s, tip[1] + d[1] * s], [tip[0] + n[0] * s * .6, tip[1] + n[1] * s * .6], [tip[0] - n[0] * s * .6, tip[1] - n[1] * s * .6]], col);
}

function resultArt(w, h, t, R) {
  const t0 = e(R.k), t1 = e(R.mx), flash = t >= t1 ? Math.exp(-(t - t1) * 5) : 0, bad = R.down ? eio(pg(t, t1, .4)) : 0;
  g.save();
  g.beginPath();
  g.roundRect(0, 0, w, h, 10);
  g.clip();
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, blend("#1F3E66", "#5A1F33", bad));
  lg.addColorStop(1, blend(C.navy2, "#2A1220", bad));
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = rgba(C.white, .05);
  g.fillRect(0, 0, w, h * .4);
  text(R.year, 18, 36, 24, rgba(C.white, .7));
  text(R.name, 18, 72, Math.min(30, (w - 36) / (R.name.length * .62)), C.white);
  const rise = R.down ? eio(pg(t, t0 + .3, .7)) : eio(pg(t, t0 + .3, Math.max(.4, t1 - t0 - .3)));
  const up = R.down ? C.amber : C.rise;
  const c1 = chartPath(R.pts, w, rise);
  g.save();
  g.shadowColor = up;
  g.shadowBlur = 12;
  strokeChart(c1, up, 6);
  g.restore();
  let tipC = c1, tipCol = up;
  const sk = R.down ? R.mx : "p_slide", sp = R.slide && t >= e(sk) ? eio(pg(t, e(sk), R.down ? .8 : 1.4)) : 0;
  if (sp > 0) {
    const c2 = chartPath([R.pts[R.pts.length - 1], ...R.slide], w, sp);
    g.save();
    g.shadowColor = C.fall;
    g.shadowBlur = 12;
    strokeChart(c2, C.fall, 6);
    g.restore();
    tipC = c2;
    tipCol = C.fall;
  }
  if (rise > .05) arrowHead(tipC, tipCol, 15);
  if (t >= t1) {
    const q = back(clamp((t - t1) / .3));
    g.save();
    g.translate(18, 226);
    g.scale(q, q);
    text(R.mult, 0, 0, 40, R.down ? C.fall : C.amber);
    g.restore();
  }
  if (flash > 0) {
    g.fillStyle = rgba(C.white, .55 * flash);
    g.fillRect(0, 0, w, h);
  }
  g.restore();
  g.strokeStyle = rgba(R.down ? C.fall : C.amber, .35 + .65 * flash + .3 * bad);
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 8);
  g.stroke();
}

function podiumPlinth(I, x, y, h, w = CW2) {
  floorShadow(I, x - .12, y - .38, w + .24, .62, .3, .1, .08);
  box(I, x - .12, y - .38, 0, w + .24, .62, h, [tone(C.plate2, .12), C.plate, tone(C.plate, -.3)], {grain: .2});
}

function resultCard(I, R, t) {
  podiumPlinth(I, R.x, R.y, R.h);
  const q = back(clamp((t - e(R.k)) / .35));
  if (q <= 0) return;
  const hh = CH2 * q;
  box(I, R.x, R.y - .06, R.h, CW2, .08, hh, [tone(C.navy, .3), C.navy, C.navy2], {grain: .2});
  onWallY(I, R.x, R.y + .02, R.h + hh, () => {
    g.scale(1, q);
    resultArt(CW2 * 100, CH2 * 100, t, R);
  });
  const t1 = e(R.mx);
  if (t >= t1 && t < t1 + .6) {                             // вспышка множителя: кольцо от карточки
    const P = I.p(R.x + CW2 / 2, R.y, R.h + CH2 * .5), u = (t - t1) / .6, k = I.s / 200;
    g.strokeStyle = rgba(R.down ? C.fall : C.amber, 1 - u);
    g.lineWidth = 7 * k;
    g.beginPath();
    g.arc(P[0], P[1], (120 + 260 * eo3(u)) * k, 0, 7);
    g.stroke();
  }
}

// Песочные часы на пустом постаменте: песок сыплется, пока звучит «это пики»
function hourglass(I, t) {
  const t0 = e("p_peak"), q = back(clamp((t - t0) / .35));
  if (t < t0 - .3) return;                                 // постамент выезжает вместе с надписью
  podiumPlinth(I, HGP.x, HGP.y, PODIUM.hb * clamp((t - t0 + .3) / .3), HGP.w);
  if (q <= 0) return;
  const P = I.p(HGP.x + HGP.w / 2, HGP.y - .1, PODIUM.hb), k = I.s / 150 * q;
  const s = clamp((t - t0 - .2) / Math.max(.5, e("p_few") - t0 - .2)), Hh = 250 * k, Wd = 130 * k, cx = P[0], by = P[1], ty = by - Hh, ny = by - Hh / 2;
  const glass = () => {
    g.beginPath();
    g.moveTo(cx - Wd / 2, ty + 16 * k);
    g.quadraticCurveTo(cx - Wd / 2, ny - 20 * k, cx - 7 * k, ny);
    g.quadraticCurveTo(cx - Wd / 2, ny + 20 * k, cx - Wd / 2, by - 16 * k);
    g.lineTo(cx + Wd / 2, by - 16 * k);
    g.quadraticCurveTo(cx + Wd / 2, ny + 20 * k, cx + 7 * k, ny);
    g.quadraticCurveTo(cx + Wd / 2, ny - 20 * k, cx + Wd / 2, ty + 16 * k);
    g.closePath();
  };
  g.fillStyle = "#4A3426";
  g.fillRect(cx - Wd * .64, ty, 9 * k, Hh);
  g.fillRect(cx + Wd * .64 - 9 * k, ty, 9 * k, Hh);
  glass();
  g.fillStyle = rgba(C.white, .1);
  g.fill();
  g.save();
  glass();
  g.clip();
  g.fillStyle = C.amber;
  const topY = lerp(ty + 34 * k, ny, s);
  g.fillRect(cx - Wd, topY, Wd * 2, ny - topY);
  const pile = (Hh / 2 - 24 * k) * s, floorY = by - 16 * k;
  g.beginPath();
  g.moveTo(cx - Wd, floorY);
  g.lineTo(cx - Wd, floorY - pile * .4);
  g.quadraticCurveTo(cx, floorY - pile * 1.5, cx + Wd, floorY - pile * .4);
  g.lineTo(cx + Wd, floorY);
  g.closePath();
  g.fill();
  if (s > 0 && s < 1) g.fillRect(cx - 2.5 * k, ny, 5 * k, floorY - pile * 1.1 - ny);
  g.restore();
  glass();
  g.strokeStyle = rgba(C.white, .7);
  g.lineWidth = 3 * k;
  g.stroke();
  g.fillStyle = "#6B4A34";
  g.beginPath();
  g.roundRect(cx - Wd * .72, ty - 4 * k, Wd * 1.44, 20 * k, 5 * k);
  g.roundRect(cx - Wd * .72, by - 16 * k, Wd * 1.44, 20 * k, 5 * k);
  g.fill();
}

function podiumC(I, t) {
  const items = RESULTS.map(R => ({y: R.y, draw: () => resultCard(I, R, t)}));
  items.push({y: HGP.y + .01, draw: () => hourglass(I, t)});
  items.sort((p, q) => p.y - q.y);
  for (const it of items) it.draw();
}

function sceneC(t) {
  const hits = RESULTS.reduce((a, R) => a + (t >= e(R.mx) ? Math.exp(-(t - e(R.mx)) * 4) : 0), 0);
  const shake = 1.2 * wob(t - e("n_1x"), 5, 6) + .7 * wob(t - e("p_drop") - .85, 5, 6);
  const V = viewOf(shotC, t, shake), I = V.I;
  sky(V, t, .18 * hits);
  floorC(I);
  if (t < e("n_move") + 1.2) gatesC(I, t);
  podiumC(I, t);
  foreground(V.v, t, .4);
  resetCam();
  labelsC(I, t);
  note("m_name", NOTE, 290, 130, C.white, t, {off: e("n_move") - .15, block: C.teal});
  note("p_peak", NOTE, 300, 150, C.white, t, {block: C.fall});
}



// ---------- мир B: токены команды под замком, две карточки ----------

const STACK = {x: -.8, y: -.45, w: 1.6, d: .7, h: .055};
const STACK_T = (() => {
  const r = rng(53), out = [];
  const add = (t0, n) => { for (let i = 0; i < n; i++) out.push({t: t0 + .08 * i, dx: (r() - .5) * .14, dy: (r() - .5) * .1}); };
  add(-9, 3);
  add(e("q_1") + .05, 4);
  add(e("q_2") + .05, 4);
  add(e("q_3") + .05, 3);
  return out;
})();
const LOCK = {x: -.33, y: .38, w: .66, d: .22, h: .52};
const T_LOCK = e("q_3") + .45;
const CW = 1.5, CH = 2.1, CB = .14, CARD_L = 3.3, CARD_R = 5.5;

const PROPS_B = (() => {
  const r = rng(47), out = [];
  for (let i = 0; i < 12; i++) out.push({x: -3.5 + i * 1.1 + r() * .5, y: -3.6 + r() * 1.1, w: .14 + r() * .22, d: .14 + r() * .22, h: .1 + r() * .45, col: [C.navy, C.sky2, C.plate2, C.teal][i % 4]});
  return out.sort((a, b) => a.y - b.y);
})();

function floorB(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-6, -8), P(11, -8), P(11, 6), P(-6, 6)], "#1A2338");
  g.globalAlpha = .1;
  for (let x = -6; x <= 11; x += .8) line(P(x, -8), P(x, 6), C.white, 1);
  for (let y = -7.6; y <= 6; y += .8) line(P(-6, y), P(11, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_B) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

function stack(I, t) {
  let z = 0;
  floorShadow(I, STACK.x, STACK.y, STACK.w, STACK.d, .3, .1, .08);
  for (const k of STACK_T) {
    const dt = t - k.t;
    if (dt < 0) break;
    const f = clamp(dt / .16), zz = z + .45 * (1 - f * f);
    box(I, STACK.x + k.dx, STACK.y + k.dy, zz, STACK.w, STACK.d, STACK.h, [tone(C.amber, .25), C.amber2, tone(C.amber2, -.3)], {grain: 0, edge: tone(C.amber, .5)});
    onFloor(I, STACK.x + k.dx, STACK.y + k.dy, zz + STACK.h, () => {
      g.strokeStyle = rgba(C.ink, .35);
      g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.beginPath();
      g.moveTo(STACK.w * 30, 4);
      g.lineTo(STACK.w * 30, STACK.d * 100 - 4);
      g.stroke();
      g.setLineDash([]);
    });
    z += .062;
  }
  return z;
}

function strap(I, t, top) {
  const p = eio(pg(t, T_LOCK, .3));
  if (p <= 0) return;
  const sx = -.08, sw = .16, yb = STACK.y - .05, yf = STACK.y + STACK.d + .055, a = clamp(p * 2), b = clamp(p * 2 - 1);
  poly([I.p(sx, yb, top + .005), I.p(sx + sw, yb, top + .005), I.p(sx + sw, lerp(yb, yf, a), top + .005), I.p(sx, lerp(yb, yf, a), top + .005)], C.navy2);
  if (b > 0) poly([I.p(sx, yf, top), I.p(sx + sw, yf, top), I.p(sx + sw, yf, lerp(top, 0, b)), I.p(sx, yf, lerp(top, 0, b))], tone(C.navy2, .18));
}

function lockClock(cx, cy, r, t) {
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(cx, cy, r + 3, 0, 7);
  g.fill();
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(cx, cy, r, 0, 7);
  g.fill();
  const p = t >= e("q_lock") ? eio(pg(t, e("q_clock"), 1.6)) : 0;   // после щелчка часы начинают отсчёт
  if (p > 0) {
    g.fillStyle = rgba(C.coral, .85);
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r - 3, -HALF, -HALF + p * Math.PI * 2);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = C.ink;
  g.lineCap = "round";
  g.lineWidth = 1.6;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * (r - 5), cy - Math.cos(a) * (r - 5));
    g.lineTo(cx + Math.sin(a) * (r - 1.5), cy - Math.cos(a) * (r - 1.5));
    g.stroke();
  }
  const ang = (t - T_LOCK) * 2.4;
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.sin(ang) * (r - 6), cy - Math.cos(ang) * (r - 6));
  g.stroke();
  g.fillStyle = C.coral;
  g.beginPath();
  g.arc(cx, cy, 2.6, 0, 7);
  g.fill();
}

function padlock(I, t) {
  if (t < T_LOCK) return;
  const f = clamp((t - T_LOCK) / .25), z = 1.6 * (1 - f * f) + (f >= 1 ? .04 * Math.abs(wob(t - T_LOCK - .25, 3, 8)) : 0);
  const shut = t >= e("q_lock") ? eo3(clamp((t - e("q_lock")) / .1)) : 0;
  const dz = .17 * (1 - shut) - (shut >= 1 ? .025 * wob(t - e("q_lock") - .1, 6, 9) : 0);
  const {x, y, w, d, h} = LOCK, top = z + h, cy = y + d / 2, R = (w - .28) / 2, mid = x + w / 2, zr = top + .2 + dz;
  floorShadow(I, x, y, w, d, .35 * f, .08, .06);
  const pts = [I.p(x + .14, cy, top - .05)];                // дужка: левая нога, дуга, правая нога
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI - Math.PI * i / 18;
    pts.push(I.p(mid + R * Math.cos(a), cy, zr + R * Math.sin(a)));
  }
  pts.push(I.p(x + w - .14, cy, top + dz - .05));
  for (const [col, wd] of [["#4F5361", .09], ["#C9CED8", .05], [rgba(C.white, .7), .014]]) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.strokeStyle = col;
    g.lineWidth = wd * I.s;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke();
  }
  box(I, x, y, z, w, d, h, [tone(C.amber, .3), C.amber, C.amber2], {grain: .25});
  onWallY(I, x, y + d, z + h, () => lockClock(w * 50, h * 50, 19, t));
}

function plinth(I, x) {
  box(I, x - .12, -.38, 0, CW + .24, .62, CB, [tone(C.plate2, .1), C.plate, tone(C.plate, -.3)], {grain: .2});
}

function productArt(w, h, t, glow) {
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, "#1E4A6E");
  lg.addColorStop(1, C.navy2);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, w, h, 8);
  g.clip();
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  const R = w * .26;
  g.save();
  g.translate(w / 2, h * .42);
  g.rotate(t * .9);
  g.fillStyle = C.rise;
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate(i * Math.PI / 4);
    g.fillRect(-R * .17, -R * 1.25, R * .34, R * .4);
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, R, 0, 7);
  g.fill();
  g.fillStyle = "#1E4A6E";
  g.beginPath();
  g.arc(0, 0, R * .42, 0, 7);
  g.fill();
  g.restore();
  for (let i = 0; i < 3; i++) {                             // огоньки «работает»
    g.fillStyle = rgba(C.rise, .35 + .65 * (.5 + .5 * Math.sin(t * 4 - i * .9)));
    g.beginPath();
    g.roundRect(w * .22 + i * w * .2, h * .76, w * .16, h * .045, 3);
    g.fill();
  }
  g.restore();
  g.strokeStyle = rgba(C.rise, .45 + .55 * glow);
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 6);
  g.stroke();
}

const TILES = (() => {
  const r = rng(61), out = [], nx = 6, ny = 8;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const dist = Math.hypot(i + .5 - nx / 2, (j + .5 - ny / 2) * .8);
      out.push({i, j, nx, ny, d: dist * .05 + r() * .14, vx: (r() - .5) * .9, vy: .3 + r() * .9, sp: (r() - .5) * 9, up: r() * .8});
    }
  }
  return out;
})();
const DUST = (() => {
  const r = rng(67), out = [];
  for (let i = 0; i < 60; i++) out.push({x: r() * CW, d: .3 + r() * .9, vx: (r() - .5) * 1.4, vy: r() * 1.2, vz: .3 + r() * .7, s: 3 + r() * 6, c: [C.amber, C.coral, C.tan, C.white][i % 4]});
  return out;
})();

function crumbled(I, t) {
  const t0 = e("r_crumble"), cw = CW * 100 / 6, ch = CH * 100 / 8, list = [];
  for (const p of TILES) {
    const u = t - t0 - p.d, x0 = CARD_L + p.i * CW / p.nx, z0 = CB + CH - p.j * CH / p.ny;
    if (u <= 0) {
      const j = .006 * Math.sin(t * 70 + p.i * 3 + p.j);    // трещит перед тем как рассыпаться
      list.push({p, x: x0 + j, y: .02, z: z0, rot: 0, sc: 1});
      continue;
    }
    const z = z0 + p.up * u - 4.2 * u * u;
    if (z < CB - .3 || u > 1.3) continue;
    list.push({p, x: x0 + p.vx * u, y: .02 + p.vy * u, z, rot: p.sp * u, sc: 1 - .6 * clamp(u / 1.1), a: 1 - pg(u, .7, .5)});
  }
  list.sort((a, b) => a.y - b.y);
  for (const k of list) {
    g.globalAlpha = k.a ?? 1;
    onWallY(I, k.x, k.y, k.z, () => {
      g.translate(cw / 2, ch / 2);
      g.rotate(k.rot);
      g.scale(k.sc, k.sc);
      g.translate(-cw / 2, -ch / 2);
      g.beginPath();
      g.rect(0, 0, cw + .5, ch + .5);
      g.clip();
      g.translate(-k.p.i * cw, -k.p.j * ch);
      wrapArt(CW * 100, CH * 100, t);
    });
  }
  g.globalAlpha = 1;
  for (const p of DUST) {                                   // пыль у подножия
    const u = t - t0 - p.d;
    if (u <= 0 || u > 1.6) continue;
    const P = I.p(CARD_L + p.x + p.vx * u, .1 + p.vy * u, CB + p.vz * u * (1 - u / 1.6) * 1.2);
    g.globalAlpha = .7 * (1 - u / 1.6);
    g.fillStyle = p.c;
    g.fillRect(P[0], P[1], p.s, p.s);
  }
  g.globalAlpha = 1;
}

function standCard(I, x, t0, t, cols, art) {
  plinth(I, x);
  const q = back(clamp((t - t0) / .35));
  if (q <= 0) return;
  const h = CH * q;
  box(I, x, -.06, CB, CW, .08, h, cols, {grain: .2});
  onWallY(I, x, .02, CB + h, () => {
    g.scale(1, q);
    art();
  });
}

function cardsB(I, t) {
  if (t < e("r_move")) return;
  if (t < e("r_crumble")) {
    standCard(I, CARD_L, e("r_left"), t, [tone(C.amber, .35), C.amber, tone(C.coral, -.3)], () => wrapArt(CW * 100, CH * 100, t));
  } else {
    plinth(I, CARD_L);
    crumbled(I, t);
  }
  const glow = t >= e("r_glow") ? eio(pg(t, e("r_glow"), .4)) * (.82 + .18 * Math.sin(t * 5)) : 0;
  if (glow > 0) {
    onFloor(I, CARD_R - .6, -.9, 0, () => {
      const u = (CW + 1.2) * 50, rg = g.createRadialGradient(u, 90, 10, u, 90, 160);
      rg.addColorStop(0, rgba(C.rise, .4 * glow));
      rg.addColorStop(1, rgba(C.rise, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, u * 2, 200);
    });
  }
  standCard(I, CARD_R, e("r_right"), t, [tone(C.navy, .3), C.navy, C.navy2], () => productArt(CW * 100, CH * 100, t, glow));
  if (glow > 0) {
    const Q = (x, z) => I.p(x, .02, z);
    g.save();
    g.shadowColor = C.rise;
    g.shadowBlur = 60;
    path([Q(CARD_R, CB), Q(CARD_R + CW, CB), Q(CARD_R + CW, CB + CH), Q(CARD_R, CB + CH)]);
    g.strokeStyle = rgba(C.rise, glow);
    g.lineWidth = 6;
    g.stroke();
    g.restore();
    for (let i = 0; i < 7; i++) {                           // искры поднимаются от светящейся карточки
      const u = ((t - e("r_glow")) * .45 + i / 7) % 1, P = I.p(CARD_R + .15 + (i * .37) % 1.3, .1, CB + .3 + u * 2.3);
      sparkle(P[0], P[1], 9 * (1 - u) * glow, rgba(C.rise, .9));
    }
  }
}

function sceneB(t) {
  const V = viewOf(shotB, t, 1.2 * wob(t - e("q_lock"), 6, 7)), I = V.I;
  sky(V, t, t >= e("r_glow") ? .2 * Math.exp(-(t - e("r_glow")) * 3) : 0);
  floorB(I);
  const top = stack(I, t);
  strap(I, t, top);
  padlock(I, t);
  cardsB(I, t);
  foreground(V.v, t, .4);
  resetCam();
  const off = e("r_move") - .15;
  note("q_1", NOTE, 330, 70, C.white, t, {off, block: C.amber});
  note("q_2", NOTE, 450, 70, C.white, t, {off, block: C.sky});
  note("q_3", NOTE, 570, 70, C.white, t, {off, block: C.coral, lh: 84});
  note("r_left", NOTE, 440, 72, C.white, t, {block: C.coral, lh: 84});
  note("r_right", W - NOTE, 440, 72, C.rise, t, {block: C.white, lh: 84, align: "right"});
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

OVERLAYS.push(t => { chWipe(t, e("m_wipe")); chWipe(t, e("q_wipe")); chWipe(t, e("g_wipe")); });

function drawAll(t) {
  if (t < e("m_wipe")) sceneA(t);
  else if (t < e("q_wipe")) sceneC(t);
  else if (t < e("g_wipe")) sceneB(t);
  else sceneEnd(t);
}

for (let k = 1; k <= 10; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_launch", -.05, .6, 6], ["b_pan", 0, 1, 4], ["c_move", 0, .9, 4], ["c_up", 0, .7, 4], ["d_go", 0, 1.1, 6],
  ["d_hit", -.05, .4, 4], ["k_move", 0, .7, 8], ["k_push", 0, .9, 4], ["k_flip", -.05, .5, 6], ["k_back", 0, 1.1, 4],
  ["m_wipe", -.26, .32, 10], ["n_move", 0, 1.1, 5], ["p_move", 0, .9, 4], ["p_back", 0, 1.1, 4], ["q_wipe", -.26, .32, 10],
  ["r_move", 0, 1, 4], ["r_crumble", 0, 1, 3], ["g_wipe", -.26, .32, 10], ["g_back", 0, END - G_BACK, 8]);
