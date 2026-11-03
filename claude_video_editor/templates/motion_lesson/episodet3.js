"use strict";
// TikTok «Что такое ICO»: блестящая обёртка с ракетой, чертёж вместо дома, три коробки, пустая комната за обёрткой,
// замок на токенах команды, обещания рассыпаются. В конце обёртка захлопывается — кадр совпадает с первым, ролик идёт по кругу.

const END = D.dur, HALF = Math.PI / 2, NOTE = 64;
const BIG = {x: -1.1, y: 0, w: 2.2, d: 1.6, h: 2.2, t: .08};       // коробка проекта; передняя грань — обёртка на петле снизу
const LAUNCH = e("a_launch"), FLIP = e("d_flip"), G_BACK = e("g_back");

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
};
const MOOD_KEYS = [[e("b_pan"), .8, "blue"], [e("c_move"), .8, "calm"], [e("d_back"), .5, "warm"], [FLIP + .2, .8, "cold"],
  [e("e_wipe"), .001, "navy"], [e("f_glow"), .8, "green"], [e("g_wipe"), .001, "cold"], [G_BACK, END - G_BACK - .1, "warm"]];

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

const SHOT0 = [300, 8, 0, 1.1, 540, 1020];
const shotA = [[0, .001, ...SHOT0],
  [0, LAUNCH - .1, 312, 6, 0, 1.15, 540, 1025],
  [LAUNCH - .1, 1.2, 270, 5, .2, 1.6, 540, 1080],
  [e("a_ask") - .1, .9, 285, 10, .1, 1.5, 540, 1090],
  [e("b_pan"), 1, 260, 12, 4, .5, 540, 1080],
  [e("b_pan") + 1, e("c_move") - e("b_pan") - 1, 272, 7, 4.15, .5, 540, 1070],
  [e("c_move"), .9, 250, 9, 9.4, .5, 540, 930],
  [e("c_q"), 1.4, 262, 13, 9.6, .55, 530, 940],
  [e("d_back"), .55, 290, 8, 0, 1.1, 540, 1040],
  [FLIP - .1, .9, 300, 11, .05, .8, 540, 1030],
  [e("d_many"), 1, 200, 8, .2, .6, 540, 880],              // крупно, ряд уходит за края: «были тысячи»
  [e("d_empty") - .5, e("d_t2") - e("d_empty") + .7, 166, 4, .3, .6, 540, 905],   // отъезд: видно все десять
  [e("d_t2") + .4, e("e_wipe") - e("d_t2") - .4, 172, 3, .32, .6, 540, 900],
  [e("g_wipe"), .001, 262, 10, 0, .9, 540, 1120],
  [e("g_wipe") + .01, G_BACK - e("g_wipe") - .1, 276, 6, 0, .9, 540, 1130],
  [G_BACK, END - G_BACK, ...SHOT0]];
const shotB = [[0, .001, 370, 18, 0, .45, 540, 1080],
  [e("e_wipe"), e("e_lock") - e("e_wipe") + .6, 395, 4, 0, .45, 540, 1070],
  [e("f_move"), 1, 250, 8, 5.15, 1, 540, 1040],
  [e("f_move") + 1, e("g_wipe") - e("f_move") - 1, 262, 3, 5.25, 1, 540, 1035]];

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
  box(I, P.x, yb, 0, P.w, P.d, P.h, dim ? SHELL.map(c => blend(c, ROOM.back, dim)) : SHELL, {grain: .22});
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
  g.strokeStyle = rgba(C.white, .85);
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

function ticket(I, x, y, z, sc = 1, a = 1) {
  const w = TK.w * sc, h = TK.h * sc;
  g.globalAlpha = a;
  box(I, x, y, z, w, TK.d, h, [tone(C.amber, .3), C.amber, C.amber2], {grain: 0, edge: 0});
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
    if (b.ok && dt > .3) {                                  // из коробки выглядывает билетик
      const s = back(clamp((dt - .3) / .35));
      ticket(I, b.x + .5 - TK.w * s / 2, BY + .45, z + h, s);
    }
  }
}

// ---------- сцена 4: десять таких же коробок, восемь пустые ----------

const MINI = {w: .72, d: .54, h: .72, t: .03};
const GOOD = [2, 6];
const MINI_ORDER = [1, 3, 5, 7, 9, 0, 2, 4, 6, 8];         // два ряда в шахматку: сначала дальний, потом ближний

function minis(I, t) {
  const t0 = e("d_many"), t1 = e("d_empty"), t2 = e("d_t2");
  for (const k of MINI_ORDER) {
    const a = t0 + .06 * k;
    if (t < a) continue;
    const sc = back(clamp((t - a) / .3)), good = GOOD.includes(k), cx = -1.95 + .5 * k;
    const P = {x: cx - MINI.w * sc / 2, y: k % 2 ? 2.75 : 4.1, w: MINI.w * sc, d: MINI.d * sc, h: MINI.h * sc, t: MINI.t};
    const st = t1 + .07 * k, x = (t - st) / .22;
    const psi = x <= 0 ? 0 : x < 1 ? HALF * x * x : HALF - .15 * Math.abs(wob(t - st - .22, 3, 7));
    const dim = good ? 0 : .7 * eio(pg(t, t2, .4));
    drawPackage(I, P, psi, {lite: true, tw: t, dim, inside: good ? () => greenCore(I, P, t) : null});
    if (good && t >= t2) {
      const Q = (xx, z) => I.p(xx, P.y, z);
      g.save();
      g.shadowColor = C.rise;
      g.shadowBlur = 30;
      path([Q(P.x, 0), Q(P.x + P.w, 0), Q(P.x + P.w, P.h), Q(P.x, P.h)]);
      g.strokeStyle = rgba(C.rise, eio(pg(t, t2, .3)) * (.75 + .25 * Math.sin(t * 6)));
      g.lineWidth = 4;
      g.stroke();
      g.restore();
    }
  }
}

function greenCore(I, P, t) {
  g.save();
  g.shadowColor = C.rise;
  g.shadowBlur = 24;
  box(I, P.x + P.w * .28, P.y - P.d * .75, 0, P.w * .44, P.d * .5, P.h * .44, [tone(C.rise, .3), C.rise, tone(C.rise, -.3)], {grain: 0, edge: 0});
  g.restore();
}

// ---------- мир A: пол, коробка проекта, сцены 1–4 и 7 ----------

const PROPS_A = (() => {                                    // мелкие кубики на заднем плане: дают глубину на проездах
  const r = rng(41), out = [];
  for (let i = 0; i < 16; i++) out.push({x: -5 + i * 1.15 + r() * .6, y: -3.8 + r() * 1.2, w: .14 + r() * .24, d: .14 + r() * .24, h: .1 + r() * .5, col: [C.plate2, C.navy, C.coral, C.sky2, C.plate2, C.amber2][i % 6]});
  return out.sort((a, b) => a.y - b.y);
})();

function floorA(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-7, -9), P(13, -9), P(13, 6), P(-7, 6)], C.plate);
  g.globalAlpha = .09;
  for (let x = -7; x <= 13; x += .8) line(P(x, -9), P(x, 6), C.white, 1);
  for (let y = -8.6; y <= 6; y += .8) line(P(-7, y), P(13, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_A) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

function worldA(t, end) {
  const xHit = !end && t >= e("a_x100") ? Math.exp(-(t - e("a_x100")) * 4) : 0;
  const shake = end ? .8 * wob(t - G_BACK - .36, 6, 8) * (1 - pg(t, END - .3, .2))
    : 1.3 * wob(t - e("a_x100"), 5, 6) + .6 * wob(t - LAUNCH, 7, 6) + wob(t - FLIP - .34, 6, 7) + .8 * wob(t - e("d_t2"), 5, 6);
  const V = viewOf(shotA, t, shake), I = V.I;
  const burst = !end && t >= LAUNCH ? Math.exp(-(t - LAUNCH) * 1.5) : 0;
  sky(V, t, .28 * xHit + .2 * burst);
  floorA(I);
  const tw = loopT(t);
  drawPackage(I, BIG, end ? psiEnd(t) : psiBig(t), {
    tw, amp: engineAmp(t), flame: .3 + .7 * engineAmp(t) + .9 * burst,
    shine: end ? undefined : t < e("b_pan") ? pg(t, e("a_shine"), .6) : pg(t, e("d_back") + .45, .6),
    wink: end ? 0 : clamp((t - e("a_ask")) / .4), inside: () => roomInside(I, t)});
  if (!end) {
    if (t < e("d_back") + .6) {
      blueprint(I, t);
      houseLines(I, t);
      queue(I, t);
    }
    if (t >= e("c_b1") && t < e("d_back") + .6) crates(I, t);
    if (t >= e("d_many")) minis(I, t);
    smoke(I, t);
    launchArrow(I, t);
  }
  return V;
}

// Метки в мире поверх ближнего плана
function labelsA(I, t) {
  const k = I.s / 260;
  if (t >= e("c_b1") && t < e("d_back") + .6) {
    BOXES.forEach((b, i) => {
      const P = I.p(b.x + .5, BY + BS, 0);
      tag(b.label, P[0], P[1] + (22 + 62 * (i % 2)) * k, t, e(b.k) + .2, b.ok ? C.amber : C.white, {size: 42});   // средняя ниже: длинная надпись не налезает на соседей
    });
    if (t >= e("c_q")) {
      const dt = t - e("c_q"), P = I.p(BOXES[2].x + .5, BY + .5, BS + .62), q = back(clamp(dt / .35));
      g.save();
      g.translate(P[0], P[1] - 46 + Math.sin(dt * 3.2) * 10);
      g.scale(q, q);
      g.rotate(.08 * Math.sin(dt * 2.1));
      text("?", 8, 10, 230, rgba(C.ink, .5), {align: "center"});
      text("?", 0, 0, 230, C.amber, {align: "center"});
      g.restore();
    }
  }
  if (t >= e("d_folder") && t < e("d_many") + .3) {
    const P = I.p(.44, -.6, .04);
    g.save();
    g.globalAlpha = 1 - pg(t, e("d_many"), .25);
    tag(tx("d_folder"), P[0], P[1] - 66 - 22, t, e("d_folder"), C.white, {size: 44, tail: true});
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
  const offB = e("c_move") - .15;
  note("b_ico", NOTE, 400, 230, C.white, t, {off: offB, block: C.sky});
  note("b_sub", NOTE, 500, 68, C.sky, t, {off: offB, lh: 80, block: C.white});
  note("d_t1", NOTE, 300, 110, C.white, t, {off: e("d_many") - .15, block: C.amber, lh: 125});
  note("d_t2", NOTE, 330, 120, C.white, t, {block: C.fall, lh: 140});
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

// ---------- мир B: токены команды под замком, две карточки ----------

const STACK = {x: -.8, y: -.45, w: 1.6, d: .7, h: .055};
const STACK_T = (() => {
  const r = rng(53), out = [];
  const add = (t0, n) => { for (let i = 0; i < n; i++) out.push({t: t0 + .08 * i, dx: (r() - .5) * .14, dy: (r() - .5) * .1}); };
  add(-9, 3);
  add(e("e_q1") + .05, 4);
  add(e("e_q2") + .05, 4);
  add(e("e_q3") + .05, 3);
  return out;
})();
const LOCK = {x: -.33, y: .38, w: .66, d: .22, h: .52};
const T_LOCK = e("e_q3") + .45;
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
  const p = t >= e("e_lock") ? eio(pg(t, e("e_lock") + .1, 1.6)) : 0;   // после щелчка часы начинают отсчёт
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
  const shut = t >= e("e_lock") ? eo3(clamp((t - e("e_lock")) / .1)) : 0;
  const dz = .17 * (1 - shut) - (shut >= 1 ? .025 * wob(t - e("e_lock") - .1, 6, 9) : 0);
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
  const t0 = e("f_crumble"), cw = CW * 100 / 6, ch = CH * 100 / 8, list = [];
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
  if (t < e("f_move")) return;
  if (t < e("f_crumble")) {
    standCard(I, CARD_L, e("f_left"), t, [tone(C.amber, .35), C.amber, tone(C.coral, -.3)], () => wrapArt(CW * 100, CH * 100, t));
  } else {
    plinth(I, CARD_L);
    crumbled(I, t);
  }
  const glow = t >= e("f_glow") ? eio(pg(t, e("f_glow"), .4)) * (.82 + .18 * Math.sin(t * 5)) : 0;
  if (glow > 0) {
    onFloor(I, CARD_R - .6, -.9, 0, () => {
      const u = (CW + 1.2) * 50, rg = g.createRadialGradient(u, 90, 10, u, 90, 160);
      rg.addColorStop(0, rgba(C.rise, .4 * glow));
      rg.addColorStop(1, rgba(C.rise, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, u * 2, 200);
    });
  }
  standCard(I, CARD_R, e("f_right"), t, [tone(C.navy, .3), C.navy, C.navy2], () => productArt(CW * 100, CH * 100, t, glow));
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
      const u = ((t - e("f_glow")) * .45 + i / 7) % 1, P = I.p(CARD_R + .15 + (i * .37) % 1.3, .1, CB + .3 + u * 2.3);
      sparkle(P[0], P[1], 9 * (1 - u) * glow, rgba(C.rise, .9));
    }
  }
}

function sceneB(t) {
  const V = viewOf(shotB, t, 1.2 * wob(t - e("e_lock"), 6, 7)), I = V.I;
  sky(V, t, t >= e("f_glow") ? .2 * Math.exp(-(t - e("f_glow")) * 3) : 0);
  floorB(I);
  const top = stack(I, t);
  strap(I, t, top);
  padlock(I, t);
  cardsB(I, t);
  foreground(V.v, t, .4);
  resetCam();
  const off = e("f_move") - .15;
  note("e_q1", NOTE, 330, 70, C.white, t, {off, block: C.amber});
  note("e_q2", NOTE, 450, 70, C.white, t, {off, block: C.sky});
  note("e_q3", NOTE, 570, 70, C.white, t, {off, block: C.coral, lh: 84});
  note("f_left", NOTE, 440, 72, C.white, t, {block: C.coral, lh: 84});
  note("f_right", W - NOTE, 440, 72, C.rise, t, {block: C.white, lh: 84, align: "right"});
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

OVERLAYS.push(t => { chWipe(t, e("e_wipe")); chWipe(t, e("g_wipe")); });

function drawAll(t) {
  if (t < e("e_wipe")) sceneA(t);
  else if (t < e("g_wipe")) sceneB(t);
  else sceneEnd(t);
}

for (let k = 1; k <= 7; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_launch", -.05, .6, 6], ["b_pan", 0, 1, 4], ["c_move", 0, .9, 4], ["d_back", 0, .6, 8], ["d_flip", -.05, .5, 6],
  ["d_many", 0, 1, 4], ["e_wipe", -.26, .32, 10], ["f_move", 0, 1, 4], ["f_crumble", 0, 1, 3], ["g_wipe", -.26, .32, 10],
  ["g_back", 0, END - G_BACK, 8]);
