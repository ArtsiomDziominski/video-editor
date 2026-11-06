"use strict";
// TikTok «Спот: купил — значит твоё». Один длинный мир вдоль оси x, камера едет от места к месту:
// A — две кнопки «КУПИТЬ» (спот и с плечом), лента и коробка; B — пустая коробка и серая «ПРОДАТЬ»;
// C — стакан заявок и табло курса; D — две дорожки поставки; E — стена с тремя дверями; F — три карточки; G — весы.
// Петля: в конце коробка «ТВОЁ» закрывается, лента увозит её, приезжает новая открытая — как в первом кадре.

const END = D.dur, NOTE = 64, TURN = Math.PI * 2, HALF = Math.PI / 2;
const BACK = e("j_back"), WIPE = e("j_wipe");

// ---------- цвет ----------

function rgbOf(c) {
  if (c[0] === "#") {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return c.match(/[\d.]+/g).slice(0, 3).map(Number);
}

function blend(a, b, x) {                                   // понимает и #hex, и rgb(...) из tone()
  const A = rgbOf(a), B = rgbOf(b), q = clamp(x);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], q)).toString(16).padStart(2, "0")).join("");
}

// ---------- настроение мест: свечение фона и его цвет ----------

const MOODS = {
  warm: ["#FF9A3C", "#2A1A1D", .5], grey: ["#A99BB5", "#1E1B24", .3], blue: [C.sky, "#0F1A30", .42],
  teal: ["#3FC1C9", "#0F1D24", .38], gold: ["#FFC34D", "#231A12", .5], navy: [C.sky2, "#101A2C", .4],
  red: [C.fall, "#24121A", .42], green: [C.rise, "#0E2219", .42],
};
const MOOD_KEYS = [[e("c_move"), .9, "grey"], [e("d_move"), .9, "blue"], [e("f_move"), .9, "teal"], [e("g_move"), 1, "gold"],
  [e("h_move"), 1, "navy"], [e("h_liq"), .25, "red"], [e("i_move"), 1, "green"], [WIPE, .001, "warm"]];
const loopT = t => t < BACK ? t : BACK * (1 - eio(pg(t, BACK, END - BACK)));   // пыль фона отматывается к первому кадру

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
  backdrop(V.v, loopT(t), glow, {bg, glow: amt + pulse, cx: 540 + (V.v.x - 610) * .4, cy: 820 + (V.v.y - 540) * .4, r: 1300});   // свечение стоит на экране, пока камера едет вдоль мира
  resetCam();
  g.fillStyle = g.createPattern(FINE, "repeat");
  g.fillRect(0, 0, W, H);
}

// ---------- места мира ----------

const PED = {w: .86, d: .86, h: .95}, CAP = {r: .29, h: .12};   // тумба и кнопка
const BL = -1.05, BRX = 1.05, SLOT = 3.2;                  // кнопки «КУПИТЬ»: слева спот, справа с плечом; шаг коробок на ленте
const BELT = {y: .8, d: .92, h: .12};
const BOX = {w: .8, d: .66, h: .5};
const BOXY = BELT.y + (BELT.d - BOX.d) / 2;                // задняя грань коробки на ленте
const TOK = "#3ED3C4", TR = .24;                            // жетон: шестигранник, не монета
const IN1 = [BL - .14, BOXY + .44], IN2 = [BL + .15, BOXY + .2];
const XB = 5.4, XC = 10.8, XD = 16.8, DOORS = [22.2, 24.6, 27.0], XF = 34.2, XG = 40.6;
const CARDS = [XF - 1.65, XF, XF + 1.65];

// ---------- камера: [когда, сколько едем, масштаб, поворот, x мира, z мира, x экрана, y экрана] ----------

const S0 = [305, 6, -.14, 0, 540, 1120];   // коробка слева и правая тумба справа помещаются с запасом
const SHOTS = [[0, .001, ...S0],
  [e("a_press") - .3, .9, 340, 6, -.45, 0, 540, 1130],      // ближе к левой кнопке
  [e("a_chain") - .25, .8, 336, 10, .55, 0, 540, 1130],     // к цепи справа
  [e("a_spot") - .25, .7, 360, 6, -.6, 0, 540, 1150],      // «это спот» — к левой табличке
  [e("b_t1") - .1, .9, 400, 7, -.45, 0, 540, 1120],         // коробка и полоска оплаты
  [e("c_move"), .95, 300, 9, XB + .45, 0, 540, 1150],
  [e("c_move") + .95, e("d_move") - e("c_move") - .95, 312, 6, XB + .5, 0, 540, 1150],
  [e("d_move"), .95, 280, 8, XC, 0, 540, 1170],
  [e("d_move") + .95, e("e_move") - e("d_move") - .95, 292, 10, XC + .05, 0, 540, 1170],
  [e("e_move"), .8, 290, 5, XC, 0, 540, 1330],             // табло целиком
  [e("f_move"), .95, 285, 8, XD + .05, 0, 540, 1170],
  [e("f_move") + .95, e("g_move") - e("f_move") - .95, 296, 6, XD + .12, 0, 540, 1175],
  [e("g_move"), 1, 155, 12, DOORS[1], 0, 540, 1160],        // три двери целиком
  [e("g_d1") - .25, .8, 300, 6, DOORS[0], 0, 540, 1150],
  [e("g_d1") + .55, e("g_m2") - e("g_d1") - .55, 318, 9, DOORS[0] + .05, 0, 540, 1150],
  [e("g_m2"), .75, 300, 6, DOORS[1], 0, 540, 1150],
  [e("g_m2") + .75, e("g_m3") - e("g_m2") - .75, 318, 9, DOORS[1] + .05, 0, 540, 1150],
  [e("g_m3"), .75, 300, 6, DOORS[2], 0, 540, 1150],
  [e("g_m3") + .75, e("h_move") - e("g_m3") - .75, 318, 9, DOORS[2] + .05, 0, 540, 1150],
  [e("h_move"), 1, 210, 8, XF, 0, 540, 1160],               // три карточки
  [e("h_f"), .8, 370, 6, CARDS[1], 0, 540, 1200],
  [e("h_m"), .8, 370, 9, CARDS[2], 0, 540, 1200],
  [e("i_move"), 1, 232, 6, XG, 0, 520, 1300],               // весы
  [e("i_move") + 1, WIPE - e("i_move") - 1, 242, 9, XG + .05, 0, 520, 1300],
  [WIPE, .001, 460, 6, BL - .2, 0, 540, 1040],                   // финал: снова коробка «ТВОЁ»
  [WIPE + .01, e("j_debt") - WIPE, 480, 9, BL - .15, 0, 540, 1040],
  [e("j_debt"), .9, 360, 10, .25, 0, 540, 1060],            // «всё остальное — в долг»: правая кнопка с цепью
  [BACK, END - BACK, ...S0]];

function viewOf(keys, t, shake = 0) {
  let [, , s, th, fx, fz, px, py] = keys[0];
  for (const k of keys.slice(1)) {
    const x = eio(pg(t, k[0], Math.max(.05, k[1])));
    s = Math.exp(lerp(Math.log(s), Math.log(k[2]), x));
    th = lerp(th, k[3], x);
    fx = lerp(fx, k[4], x);
    fz = lerp(fz, k[5], x);
    px = lerp(px, k[6], x);
    py = lerp(py, k[7], x);
  }
  const live = pg(t, 0, .7) * (1 - pg(t, END - 1.1, .6));  // камера живая, но на стыке петли замирает
  s *= 1 + live * .02 * Math.sin(t * .47);
  th += live * 1.8 * Math.sin(t * .61);
  const I = new Iso(0, 0, s, th, .42), P = I.p(fx, 0, fz);
  I.ox = px - P[0];
  I.oy = py - P[1] + shake * 18;
  return {I, s, fx, v: {x: 610 + fx * 60, y: 540 + fz * 40 + Math.log(s) * 240}};
}

// ---------- пол ----------

const PROPS = (() => {                                      // кубики на дальнем плане: глубина на проездах
  const r = rng(43), out = [], cols = [C.plate2, C.navy, C.coral, C.sky2, C.plate2, C.amber2, C.teal];
  for (let i = 0; i < 50; i++) {
    out.push({x: -9 + i * 1.12 + r() * .6, y: -4.3 + r() * .8, w: .1 + r() * .2, d: .1 + r() * .2, h: .08 + r() * .38, col: blend(cols[i % 7], C.plate, .45)});
  }
  return out.sort((a, b) => a.y - b.y);
})();

function floorW(I, cx, s) {
  const span = 700 / s + 4, x0 = cx - span, x1 = cx + span, P = (x, y) => I.p(x, y, 0);
  poly([P(x0, -4.6), P(x1, -4.6), P(x1, 16), P(x0, 16)], C.plate);   // дальний край — горизонт
  g.globalAlpha = .08;
  for (let x = Math.ceil(x0 / .8) * .8; x <= x1; x += .8) line(P(x, -4.6), P(x, 16), C.white, 1);
  for (let y = -4.4; y <= 16; y += .8) line(P(x0, y), P(x1, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS) if (Math.abs(k.x - cx) < span) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

// ---------- общие предметы ----------

function onPlane(I, o, u, v, fn) {                          // плоскость в мире: o — угол, u и v — единичные направления осей
  const A = I.p(...o), U = I.p(o[0] + u[0] * .01, o[1] + u[1] * .01, o[2] + u[2] * .01), V = I.p(o[0] + v[0] * .01, o[1] + v[1] * .01, o[2] + v[2] * .01);
  g.save();
  g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
  fn();
  g.restore();
}

// Повёрнутый вокруг вертикали брусок: видимые грани по обходу, свет слева спереди
function slab(I, cx, cy, z, w, d, h, ang, col, o = {}) {
  const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2;
  const base = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
  const B = base.map(p => I.p(p[0], p[1], z)), T = base.map(p => I.p(p[0], p[1], z + h));
  const norms = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([u, v]) => [u * c - v * s, u * s + v * c]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const cr = (B[j][0] - B[i][0]) * (T[i][1] - B[i][1]) - (B[j][1] - B[i][1]) * (T[i][0] - B[i][0]);
    if (cr <= 0 || h <= 0) continue;
    const lit = clamp(.5 + .5 * (norms[i][1] * .85 - norms[i][0] * .5));
    poly([B[i], B[j], T[j], T[i]], blend(tone(col, -.38), col, lit));
  }
  poly(T, o.top ?? tone(col, .16));
  return T;
}

// Цилиндр стоймя: боковина по видимой половине, сверху — крышка
function cylinder(I, x, y, z, r, h, top, side) {
  const n = 40, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TURN;
    A.push(I.p(x + r * Math.cos(a), y + r * Math.sin(a), z));
    B.push(I.p(x + r * Math.cos(a), y + r * Math.sin(a), z + h));
  }
  if (h > 0) {
    let iL = 0, iR = 0;
    for (let i = 0; i < n; i++) {
      if (A[i][0] < A[iL][0]) iL = i;
      if (A[i][0] > A[iR][0]) iR = i;
    }
    const arc = dir => {
      const out = [];
      for (let i = iL; ; i = (i + dir + n) % n) {
        out.push(i);
        if (i === iR) break;
      }
      return out;
    };
    const a1 = arc(1), a2 = arc(-1), mean = ix => ix.reduce((s, i) => s + A[i][1], 0) / ix.length;
    const front = mean(a1) > mean(a2) ? a1 : a2;
    const pts = front.map(i => A[i]).concat(front.slice().reverse().map(i => B[i]));
    poly(pts, side);
    shade(pts, A[iL], A[iR], .4);
  }
  poly(B, top);
  return B;
}

// Жетон: стоячий шестигранник с ромбом — не круглая монета
function hexToken(I, x, y, z, r, rot = 0, o = {}) {
  const col = o.col ?? TOK, th = .07, F = [], Bk = [];
  for (let k = 0; k < 6; k++) {
    const a = rot + k * Math.PI / 3 + Math.PI / 6;
    F.push(I.p(x + r * Math.cos(a), y, z + r + r * Math.sin(a)));
    Bk.push(I.p(x + r * Math.cos(a), y - th, z + r + r * Math.sin(a)));
  }
  const Cn = I.p(x, y, z + r);
  if (o.glow) {
    g.save();
    g.shadowColor = col;
    g.shadowBlur = 40 * o.glow;
    poly(F, col);
    g.restore();
  }
  for (let k = 0; k < 6; k++) poly([F[k], F[(k + 1) % 6], Bk[(k + 1) % 6], Bk[k]], tone(col, -.4));
  poly(F, col);
  poly(F.map(p => [lerp(Cn[0], p[0], .74), lerp(Cn[1], p[1], .74)]), tone(col, .22));
  const R = r * I.s * .3;
  g.save();
  g.translate(Cn[0], Cn[1]);
  g.rotate(rot);
  g.strokeStyle = tone(col, -.5);
  g.lineWidth = Math.max(2, R * .28);
  g.beginPath();
  g.moveTo(0, -R * 1.2); g.lineTo(R * .85, 0); g.lineTo(0, R * 1.2); g.lineTo(-R * .85, 0); g.closePath();
  g.stroke();
  g.restore();
}

function hex2d(x, y, r, col, rot = 0) {                     // плоский жетон на табло
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = rot + k * Math.PI / 3 + Math.PI / 6;
    pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
  }
  poly(pts, col);
  poly(pts.map(p => [lerp(x, p[0], .7), lerp(y, p[1], .7)]), tone(col, .25));
}

// ---------- картонная коробка с двумя клапанами ----------

const CART = [tone(C.tan, .14), C.tan, C.tan2];

function sticker(I, x0, y1, zt, P, q, label) {
  if (q <= 0) return;
  onWallY(I, x0, y1 + .003, zt, () => {
    const k = Math.min(1, P.w / .8), w = 58 * k, h = 27 * k;
    g.translate(P.w * 50, P.h * 52);
    g.rotate(-.07);
    g.scale(q, q);
    g.fillStyle = C.white;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, 4 * k);
    g.fill();
    g.strokeStyle = C.amber2;
    g.lineWidth = 2.6 * k;
    g.stroke();
    text(label, 0, 6.5 * k, 17 * k, C.ink, {align: "center", w: 800});
  });
}

function carton(I, cx, yb, z0, P, open, o = {}) {
  const x0 = cx - P.w / 2, x1 = cx + P.w / 2, y1 = yb + P.d, zt = z0 + P.h, Q = (x, y, z) => I.p(x, y, z);
  floorShadow(I, x0, yb, P.w, P.d, .3, .1, .08);
  if (open > .02) {
    poly([Q(x0, yb, z0), Q(x1, yb, z0), Q(x1, yb, zt), Q(x0, yb, zt)], tone(C.tan2, -.45));   // стенки изнутри
    poly([Q(x0, yb, z0), Q(x0, y1, z0), Q(x0, y1, zt), Q(x0, yb, zt)], tone(C.tan2, -.3));
    poly([Q(x0, yb, z0 + .01), Q(x1, yb, z0 + .01), Q(x1, y1, z0 + .01), Q(x0, y1, z0 + .01)], tone(C.tan2, -.55));
    if (o.glow > 0) {
      const M = Q(cx, yb + P.d / 2, zt), rg = g.createRadialGradient(M[0], M[1], 4, M[0], M[1], P.w * I.s * .9);
      rg.addColorStop(0, rgba(TOK, .45 * o.glow));
      rg.addColorStop(1, rgba(TOK, 0));
      g.fillStyle = rg;
      g.fillRect(M[0] - P.w * I.s, M[1] - P.w * I.s, 2 * P.w * I.s, 2 * P.w * I.s);
    }
    if (o.inside) o.inside();
    const front = [Q(x0, y1, z0), Q(x1, y1, z0), Q(x1, y1, zt), Q(x0, y1, zt)];
    poly(front, CART[1]);
    shade(front, Q(x0, y1, zt), Q(x0, y1, z0), .22);
    const right = [Q(x1, yb, z0), Q(x1, y1, z0), Q(x1, y1, zt), Q(x1, yb, zt)];
    poly(right, CART[2]);
    shade(right, Q(x1, yb, zt), Q(x1, yb, z0), .22);
    g.globalAlpha = .6;
    line(Q(x0, y1, zt), Q(x1, y1, zt), tone(C.tan, .4), 2);
    line(Q(x1, yb, zt), Q(x1, y1, zt), tone(C.tan, .2), 2);
    g.globalAlpha = 1;
  } else {
    box(I, x0, yb, z0, P.w, P.d, P.h, CART, {grain: .22});
    const tw = P.w * .09, tape = rgba("#F6E7C8", .6);
    poly([Q(cx - tw, yb, zt + .002), Q(cx + tw, yb, zt + .002), Q(cx + tw, y1, zt + .002), Q(cx - tw, y1, zt + .002)], tape);
    poly([Q(cx - tw, y1 + .002, zt), Q(cx + tw, y1 + .002, zt), Q(cx + tw, y1 + .002, zt - P.h * .26), Q(cx - tw, y1 + .002, zt - P.h * .26)], tape);
  }
  if (o.sticker > 0) sticker(I, x0, y1, zt, P, o.sticker, o.label ?? "ТВОЁ");
  if (open > .02) {                                         // клапаны на шарнирах вдоль левого и правого края
    const a = open * 2.05, hw = P.w / 2, c = Math.cos(a), s = Math.sin(a), col = a < HALF ? tone(C.tan, .06) : tone(C.tan2, -.12);
    poly([Q(x0, yb, zt), Q(x0, y1, zt), Q(x0 + hw * c, y1, zt + hw * s), Q(x0 + hw * c, yb, zt + hw * s)], col);
    poly([Q(x1, yb, zt), Q(x1, y1, zt), Q(x1 - hw * c, y1, zt + hw * s), Q(x1 - hw * c, yb, zt + hw * s)], blend(col, C.tan2, .25));
  }
}

// ---------- место A: две кнопки, лента, коробка ----------

function pedestal(I, x, y, label, cap, press, o = {}) {
  const {w, d, h} = PED, x0 = x - w / 2, y0 = y - d / 2, body = o.body ?? C.plate2;
  floorShadow(I, x0, y0, w, d, .32, .1, .08);
  box(I, x0, y0, 0, w, d, h, [tone(body, .12), body, tone(body, -.32)], {grain: .22});
  onWallY(I, x0, y0 + d, h, () => {
    g.fillStyle = cap;
    g.fillRect(0, 0, w * 100, 6);
    text(label, w * 50, 32, 17, C.white, {align: "center", w: 800});
  });
  cylinder(I, x, y, h, CAP.r + .06, .035, tone(C.ink, .25), C.ink);
  const ch = CAP.h * (1 - .72 * press);
  cylinder(I, x, y, h + .035, CAP.r, ch, tone(cap, .3), tone(cap, -.2));
  return h + .035 + ch;
}

const CANDLES_A = candlesOf([[0, .3], [5, .45], [9, .36], [15, .62], [20, .55], [26, .78]], 61, .035, 1.4);

function boardA(I) {                                        // экран со свечами за кнопками: тема видна с первого кадра
  const B = {x: -2.3, y: -2.0, w: 4.6, z: .55, h: 1.65};
  for (const px of [B.x + .5, B.x + B.w - .6]) box(I, px, B.y - .04, 0, .1, .1, B.z, tri(C.plate2), {grain: 0, edge: 0});
  box(I, B.x, B.y - .06, B.z, B.w, .1, B.h, [tone(C.plate, .1), C.plate, tone(C.plate, -.35)], {grain: .2});
  onWallY(I, B.x, B.y + .04, B.z + B.h, () => {
    const w = B.w * 100, h = B.h * 100, yOf = v => h - 22 - v * (h - 44);
    g.fillStyle = "#121019";
    g.beginPath();
    g.roundRect(7, 7, w - 14, h - 14, 6);
    g.fill();
    g.strokeStyle = rgba(C.white, .06);
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(14, 8 + k * (h - 16) / 4);
      g.lineTo(w - 14, 8 + k * (h - 16) / 4);
      g.stroke();
    }
    g.globalAlpha = .85;
    candles(CANDLES_A, 16, (w - 32) / CANDLES_A.length, yOf, 1e9, {w: 9});
    g.globalAlpha = 1;
  });
}

function belt(I, x0, x1, y, d, h, phase, col = "#2A2833") {
  box(I, x0, y, 0, x1 - x0, d, h, [tone(col, .12), col, tone(col, -.3)], {grain: 0, edge: 0});
  const st = .4, ph = ((phase % st) + st) % st;
  g.globalAlpha = .3;
  for (let x = Math.ceil((x0 - ph) / st) * st + ph; x < x1; x += st) line(I.p(x, y + .05, h), I.p(x, y + d - .05, h), C.white, 1.5);
  g.globalAlpha = .5;
  line(I.p(x0, y + d, h), I.p(x1, y + d, h), tone(col, .35), 2);
  g.globalAlpha = 1;
}

function pressA(t) {
  const dt = t - e("a_press");
  if (dt < 0) return 0;
  return dt < .06 ? dt / .06 : Math.max(0, 1 - spring(dt - .06, 1.8, 7));
}

function heroOpen(t) {
  if (t >= WIPE) return 1 - eio(pg(t, e("j_close"), .28));
  const fly = e("b_fly");
  if (t >= fly - .12) return .8 * eo3(pg(t, fly - .12, .14)) * (1 - eio(pg(t, fly + .5, .24)));
  return 1 - eio(pg(t, e("a_close"), .26));
}

function flights(t) {                                       // жетоны в полёте: из кнопки и из полоски оплаты
  const out = [], add = (t0, t1, a, b, h) => { if (t >= t0 && t < t1) out.push({p: (t - t0) / (t1 - t0), a, b, h}); };
  add(e("a_drop"), e("a_land"), [BL, .05, PED.h + CAP.h + .04], [IN1[0], IN1[1], BELT.h + .02], 1.0);
  add(e("b_fly"), e("b_fly") + .45, [-.3, BOXY + .3, BELT.h + .24], [IN2[0], IN2[1], BELT.h + .02], .7);
  return out;
}

function tokenFlight(I, f) {
  const p = f.p, z = lerp(f.a[2], f.b[2], p * p) + f.h * Math.sin(Math.PI * p);
  hexToken(I, lerp(f.a[0], f.b[0], p), lerp(f.a[1], f.b[1], p), z, TR, (1 - p) * 2.6);
}

function heroBox(I, t, cx) {
  const open = heroOpen(t), n = t >= e("b_fly") + .45 ? 2 : t >= e("a_land") ? 1 : 0, dx = cx - BL;
  const fl = flights(t);
  carton(I, cx, BOXY, BELT.h, BOX, open, {
    sticker: t >= e("a_mine") ? back(pg(t, e("a_mine"), .3)) : 0, label: tx("a_mine"),
    glow: t >= WIPE ? .6 + .4 * Math.sin(t * 3) : n ? .5 * Math.exp(-(t - e(n > 1 ? "b_fly" : "a_land")) * 2) : 0,
    inside: () => {
      if (n >= 2) hexToken(I, IN2[0] + dx, IN2[1], BELT.h + .02, TR, 0);
      if (n >= 1) hexToken(I, IN1[0] + dx, IN1[1], BELT.h + .02, TR, 0);
      for (const f of fl) if (f.p > .8) tokenFlight(I, f);
    }});
  for (const f of fl) if (f.p <= .8) tokenFlight(I, f);
}

function payBar(I, t) {                                     // «заплатил полностью»: полоска заполняется, потом превращается в жетон
  const t0 = e("b_bar"), fly = e("b_fly");
  if (t < t0 - .3 || t > fly + .7) return;
  const a = eo3(pg(t, t0 - .3, .3)) * (1 - pg(t, fly + .4, .3));
  const x0 = -.42, x1 = .66, y = BOXY + .12, d = .38, z = BELT.h, h = .2, L = x1 - x0 - .08;
  const fill = eio(pg(t, t0, .7)) * (1 - eio(pg(t, fly - .05, .3)));
  g.globalAlpha = a;
  box(I, x0, y, z, x1 - x0, d, h, [tone(C.ink, .3), C.ink, tone(C.ink, .12)], {grain: 0, edge: tone(C.plate2, .3)});
  if (fill > .01) box(I, x0 + .04, y + .05, z + h, L * fill, d - .1, .05, [tone(C.amber, .3), C.amber, C.amber2], {grain: 0, edge: 0});
  g.globalAlpha = 1;
}

function chainLock(I, t) {                                  // цепь с замком на правой тумбе: «в долг»
  const t0 = e("a_chain");
  if (t < t0) return;
  const dt = t - t0, fall = dt < .28 ? 1 - eo3(dt / .28) : 0, sway = .05 * wob(dt - .28, 1.8, 2.6);
  const gone = pg(t, BACK, .55), drop = 1.6 * ei3(gone);
  if (gone >= 1) return;
  const y = PED.d / 2 + .05, x0 = BRX - PED.w / 2 + .02, x1 = BRX + PED.w / 2 - .02, top = PED.h - .02 + 1.3 * fall - drop, sag = .5;
  const n = 14, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(I.p(lerp(x0, x1, u) + sway * Math.sin(Math.PI * u), y, top - sag * Math.sin(Math.PI * u)));
  }
  g.save();
  g.globalAlpha = 1 - gone;
  for (let i = 0; i < n; i++) {
    const A = pts[i], B = pts[i + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    g.save();
    g.translate((A[0] + B[0]) / 2, (A[1] + B[1]) / 2);
    g.rotate(Math.atan2(B[1] - A[1], B[0] - A[0]));
    for (const [col, wd] of [["#3A3D48", .034], [i % 2 ? "#A9AFBD" : "#E1E5EE", .018]]) {
      g.strokeStyle = col;
      g.lineWidth = wd * I.s;
      g.beginPath();
      g.ellipse(0, 0, len * .62, (i % 2 ? .012 : .045) * I.s, 0, 0, TURN);
      g.stroke();
    }
    g.restore();
  }
  const shut = eo3(pg(t, e("a_debt"), .1)), lz = top - sag - .06, hot = t >= e("j_debt") ? .5 + .5 * Math.sin((t - e("j_debt")) * 9) : 0;
  const arc = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * i / 14;
    arc.push(I.p(BRX + .085 * Math.cos(a), y, lz - .1 + .1 * (1 - shut) + .1 * Math.sin(a)));
  }
  g.beginPath();
  g.moveTo(arc[0][0], arc[0][1]);
  for (const p of arc) g.lineTo(p[0], p[1]);
  g.strokeStyle = "#C9CED8";
  g.lineWidth = .03 * I.s;
  g.lineCap = "round";
  g.stroke();
  if (hot > 0) {
    g.shadowColor = C.fall;
    g.shadowBlur = 40 * hot;
  }
  box(I, BRX - .13, y - .04, lz - .32, .26, .08, .22, [tone(C.amber, .3), C.amber, C.amber2], {grain: .2});
  g.shadowBlur = 0;
  const K = I.p(BRX, y + .04, lz - .2);
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(K[0], K[1], .022 * I.s, 0, TURN);
  g.fill();
  g.fillRect(K[0] - .008 * I.s, K[1], .016 * I.s, .04 * I.s);
  g.restore();
}

function stationA(I, t) {
  boardA(I);
  pedestal(I, BL, 0, "КУПИТЬ", C.rise, pressA(t));
  pedestal(I, BRX, 0, "КУПИТЬ", C.rise, 0);
  const sh = eio(pg(t, BACK + .1, 1.25));
  belt(I, -4.7, 2.7, BELT.y, BELT.d, BELT.h, -SLOT * sh);   // хватает на уход коробки влево и приезд новой справа
  chainLock(I, t);
  payBar(I, t);
  heroBox(I, t, BL - SLOT * sh);
  if (sh > 0) carton(I, BL + SLOT * (1 - sh), BOXY, BELT.h, BOX, 1);   // следующая открытая коробка
}

function labelsA(I, t) {
  const da = t - e("a_spot"), sp = da > 0 ? .38 * Math.sin(Math.PI * clamp(da / .5)) : 0;
  const L = I.p(BL, 0, PED.h + .62), R = I.p(BRX, 0, PED.h + .62);
  g.save();
  g.translate(L[0], L[1] + 40);
  g.scale(1 + sp, 1 + sp);
  g.translate(-L[0], -L[1] - 40);
  if (sp > 0) {
    g.shadowColor = C.amber;
    g.shadowBlur = 90 * sp;
  }
  tag("СПОТ", L[0], L[1], t, -1, C.amber, {size: 52, tail: true});
  g.restore();
  tag("С ПЛЕЧОМ", R[0], R[1], t, -1, C.coral, {size: 52, tail: true, tc: C.white});
  if (t >= e("a_debt") && t < BACK + .3) {
    const P = I.p(BRX, PED.d / 2 + .05, .1);
    g.globalAlpha = 1 - pg(t, BACK, .3);
    tag(tx("a_debt"), P[0], P[1] + 18, t, e("a_debt"), C.fall, {size: 46, tc: C.white});
    g.globalAlpha = 1;
  }
  if (t >= e("b_pin") - .3 && t < e("c_move") + .4) {      // метка «здесь»: spot = на месте
    const t0 = e("b_pin"), P = I.p(BL, BOXY + BOX.d / 2, BELT.h + BOX.h + .02);
    const f = clamp((t - t0 + .3) / .3), lift = (1 - f * f) * 520 + (f >= 1 ? 28 * Math.abs(wob(t - t0, 3, 7)) : 0), k = I.s / 400;
    g.globalAlpha = 1 - pg(t, e("c_move"), .3);
    g.fillStyle = rgba(C.ink, .35 * f);
    g.beginPath();
    g.ellipse(P[0], P[1], 34 * k, 11 * k, 0, 0, TURN);
    g.fill();
    const tip = [P[0], P[1] - lift], hy = tip[1] - 120 * k, r = 46 * k;
    g.fillStyle = C.coral;
    g.beginPath();
    g.moveTo(tip[0], tip[1]);
    g.bezierCurveTo(tip[0] - r * 1.1, hy + r * .6, tip[0] - r, hy - r * .1, tip[0] - r, hy);
    g.arc(tip[0], hy, r, Math.PI, 0);
    g.bezierCurveTo(tip[0] + r, hy - r * .1, tip[0] + r * 1.1, hy + r * .6, tip[0], tip[1]);
    g.fill();
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(tip[0], hy, r * .42, 0, TURN);
    g.fill();
    g.globalAlpha = 1;
  }
}

// ---------- место B: пустая коробка и серая «ПРОДАТЬ» ----------

const SIGN_B = {x: XB - .25, y: -1.6, w: 2.3, z: .95, h: .8};

function signB(I, t) {
  const t0 = e("c_sign");
  if (t < t0 - .3) return;
  const f = clamp((t - t0 + .3) / .3), dz = 2 * (1 - f * f) + (f >= 1 ? .05 * Math.abs(wob(t - t0, 3, 7)) : 0), S = SIGN_B;
  g.globalAlpha = .82 * Math.min(1, f * 2);
  for (const px of [S.x + .35, S.x + S.w - .45]) box(I, px, S.y + .02, dz, .08, .08, S.z, tri("#6E6A78"), {grain: 0, edge: 0});
  box(I, S.x, S.y - .04, S.z + dz, S.w, .08, S.h, tri("#8D8998"), {grain: .2});
  onWallY(I, S.x, S.y + .04, S.z + dz + S.h, () => {
    tx("c_sign").split("\n").forEach((r, i) => text(r, S.w * 50, 34 + i * 26, 18, rgba(C.white, .92), {align: "center", w: 700}));
  });
  g.globalAlpha = 1;
}

function stationB(I, t) {
  signB(I, t);
  const grey = eio(pg(t, e("c_grey"), .35)), dt = t - e("c_try");
  const dip = dt > 0 && dt < .45 ? .22 * Math.sin(Math.PI * clamp(dt / .18)) : 0, jit = dt > .1 ? .03 * wob(dt - .1, 9, 9) : 0;
  pedestal(I, XB + .6 + jit, -.2, "ПРОДАТЬ", blend(C.fall, "#77737F", grey), dip, {body: blend(C.plate2, "#5A5764", grey)});
  carton(I, XB - .72, .12, 0, BOX, 1);
}

function labelsB(I, t) {
  if (t < e("c_try") || t > e("d_move") + .4) return;
  const P = I.p(XB + .6, -.2, PED.h + .45);
  g.globalAlpha = 1 - pg(t, e("d_move"), .3);
  g.save();
  g.shadowColor = C.ink;
  g.shadowBlur = 12;
  cross(P[0], P[1], 34, eo3(pg(t, e("c_try"), .3)), C.fall, 13);
  g.restore();
  g.globalAlpha = 1;
}

// ---------- место C: стакан заявок и табло курса ----------

const CTR = {x0: XC - 1.55, y: -.25, d: 1.15, h: .32};
const SL = {w: .6, d: .46, h: .1, g: .03}, TN = 6, TP = .5, TWX = .66, TWY = .1;
const HIST = [.36, .42, .38, .47, .44, .5, .46, .4, .45, .52, .49, .43, .47, .5];
const STEPS = (() => {                                      // курс дёргается раз в полсекунды; на «сдвинулся» — заметный скачок
  const out = [], t1 = e("e_move") - .2, jump = e("d_jump"), r = rng(77);
  let v = HIST[HIST.length - 1], jumped = false;
  for (let tt = e("d_board"); tt < t1; tt += TP) {
    v = clamp(v + (r() - .5) * .2, .22, .66);
    if (!jumped && tt >= jump - .2) {
      v = Math.min(.84, v + .2);
      jumped = true;
    }
    out.push({t: tt, v});
  }
  return out;
})();
const VALS = [...HIST, ...STEPS.map(s => s.v)];
const MATCH = STEPS.filter(s => s.t - .28 >= e("d_flow")).map(s => s.t - .28);   // столкновение заявок совпадает со скачком

function matchAt(t) {
  for (const m of MATCH) if (t >= m && t < m + .5) return m;
  return null;
}

function tower(I, x, col, t, side, keep) {
  const z0 = CTR.h, hh = SL.h + SL.g, m = matchAt(t), cols = [tone(col, .25), col, tone(col, -.32)];
  const ph = m === null ? 1 : t - m, slide = eio(clamp(ph / .28)), rise = m === null ? 0 : eio(clamp((ph - .3) / .2));
  for (let j = 0; j < TN; j++) {
    const top = j === TN - 1;
    let a = 1;
    if (keep !== undefined && j >= keep) {
      a = 1 - pg(t, e("e_thin") + .06 * (TN - j), .18);
      if (a <= 0) continue;
    }
    if (top && m !== null && ph >= .28) continue;           // верхняя ушла в обмен
    const zz = z0 + j * hh + (m !== null && !top ? rise * hh : 0), xx = x + (top && m !== null ? side * slide * (TWX - SL.w / 2) : 0);
    g.globalAlpha = a;
    box(I, xx - SL.w / 2, TWY, zz + (1 - a) * .4, SL.w, SL.d, SL.h, cols, {grain: 0, edge: tone(col, .45)});
    g.globalAlpha = 1;
  }
  if (m !== null && rise > 0) box(I, x - SL.w / 2, TWY, z0, SL.w, SL.d, SL.h * rise, cols, {grain: 0, edge: 0});
}

const BC = {x: XC - 1.65, y: -1.45, w: 3.3, z: .85, h: 1.6}, XR = 225, DXL = 15;

function curIndex(t) {
  let n = HIST.length - 1;
  for (const s of STEPS) if (t >= s.t) n++;
  return n;
}

function boardArt(t) {
  const w = BC.w * 100, h = BC.h * 100, yOf = v => h - 18 - v * (h - 36), cur = curIndex(t);
  const st = STEPS[cur - HIST.length], f = st ? eio(clamp((t - st.t) / .18)) : 1;
  g.fillStyle = "#101119";
  g.beginPath();
  g.roundRect(6, 6, w - 12, h - 12, 6);
  g.fill();
  g.strokeStyle = rgba(C.white, .06);
  g.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(12, 8 + k * (h - 16) / 4);
    g.lineTo(w - 12, 8 + k * (h - 16) / 4);
    g.stroke();
  }
  g.save();
  g.beginPath();
  g.rect(10, 8, XR + 4, h - 16);
  g.clip();
  const xi = i => XR - (cur - i) * DXL + (1 - f) * DXL, i0 = Math.max(0, cur - 16);
  g.beginPath();
  g.moveTo(xi(i0), yOf(VALS[i0]));
  for (let i = i0 + 1; i <= cur; i++) {
    g.lineTo(xi(i), yOf(VALS[i - 1]));
    g.lineTo(xi(i), yOf(VALS[i]));
  }
  g.strokeStyle = C.sky;
  g.lineWidth = 3.4;
  g.lineJoin = "round";
  g.shadowColor = C.sky;
  g.shadowBlur = 10;
  g.stroke();
  g.restore();
  const vEnd = f < 1 ? VALS[cur - 1] : VALS[cur], yEnd = yOf(vEnd);
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(XR, yEnd, 5, 0, TURN);
  g.fill();
  // проскальзывание: видел одно значение, купил чуть выше
  const vSeen = VALS[VALS.length - 1], ys = yOf(vSeen), yb = yOf(vSeen + .14);
  if (t >= e("e_seen")) {
    const q = eo3(pg(t, e("e_seen"), .4));
    g.save();
    g.setLineDash([9, 7]);
    g.strokeStyle = rgba(C.white, .85);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(14, ys);
    g.lineTo(14 + (XR + 70 - 14) * q, ys);
    g.stroke();
    g.restore();
    g.globalAlpha = q;                                      // глаз: «видел»
    g.strokeStyle = C.white;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(22, ys - 14);
    g.quadraticCurveTo(34, ys - 26, 46, ys - 14);
    g.quadraticCurveTo(34, ys - 2, 22, ys - 14);
    g.stroke();
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(34, ys - 14, 3.6, 0, TURN);
    g.fill();
    g.globalAlpha = 1;
  }
  if (t >= e("e_gap")) {
    const q = eo3(pg(t, e("e_gap"), .3)), pulse = .45 + .2 * Math.sin((t - e("e_gap")) * 7);
    g.fillStyle = rgba(C.amber, pulse * q);
    g.fillRect(XR + 8, yb, 62, (ys - yb) * q);
    g.strokeStyle = C.amber;
    g.lineWidth = 2.5;
    g.strokeRect(XR + 8, yb, 62, (ys - yb) * q);
  }
  if (t >= e("e_fill")) {
    const q = back(pg(t, e("e_fill"), .3));
    g.strokeStyle = C.amber;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(XR + 8, yb);
    g.lineTo(XR + 70, yb);
    g.stroke();
    g.save();
    g.translate(XR + 39, yb);
    g.scale(q, q);
    hex2d(0, 0, 13, TOK);
    g.restore();
  }
}

function stationC(I, t) {
  for (const px of [BC.x + .4, BC.x + BC.w - .5]) box(I, px, BC.y - .04, 0, .1, .1, BC.z, tri(C.plate2), {grain: 0, edge: 0});
  box(I, BC.x, BC.y - .06, BC.z, BC.w, .1, BC.h, [tone(C.plate, .1), C.plate, tone(C.plate, -.35)], {grain: .2});
  onWallY(I, BC.x, BC.y + .04, BC.z + BC.h, () => boardArt(t));
  box(I, CTR.x0, CTR.y, 0, 3.1, CTR.d, CTR.h, [tone(C.plate2, .12), C.plate2, tone(C.plate2, -.32)], {grain: .22});
  line(I.p(XC, CTR.y + .05, CTR.h + .002), I.p(XC, CTR.y + CTR.d - .05, CTR.h + .002), rgba(C.white, .35), 2);
  tower(I, XC - TWX, C.rise, t, 1);
  tower(I, XC + TWX, C.fall, t, -1, t >= e("e_thin") ? 2 : undefined);
  const m = matchAt(t);                                     // вспышка встречи по центру
  if (m !== null && t >= m + .28 && t < m + .62) {
    const q = (t - m - .28) / .34, P = I.p(XC, TWY + SL.d / 2, CTR.h + (TN - 1) * (SL.h + SL.g) + SL.h / 2);
    g.save();
    g.globalAlpha = 1 - q;
    g.strokeStyle = C.white;
    g.lineWidth = 6 * (1 - q) + 1;
    g.shadowColor = C.amber;
    g.shadowBlur = 24;
    g.beginPath();
    g.ellipse(P[0], P[1], 20 + 90 * eo3(q), 8 + 36 * eo3(q), 0, 0, TURN);
    g.stroke();
    for (let k = 0; k < 8; k++) {                            // искры встречи
      const a = k / 8 * TURN + .2, r0 = 24 + 60 * eo3(q), r1 = r0 + 26 * (1 - q);
      line([P[0] + Math.cos(a) * r0, P[1] + Math.sin(a) * r0 * .45], [P[0] + Math.cos(a) * r1, P[1] + Math.sin(a) * r1 * .45], C.amber, 4 * (1 - q) + 1);
    }
    g.restore();
  }
}

function labelsC(I, t) {
  if (t > e("f_move") + .4) return;
  const a = 1 - pg(t, e("f_move"), .3), z = CTR.h + TN * (SL.h + SL.g) + .22;
  g.globalAlpha = a * (1 - .6 * pg(t, e("e_move"), .4));
  const L = I.p(XC - TWX, TWY + SL.d / 2, z), R = I.p(XC + TWX, TWY + SL.d / 2, z);
  tag(tx("d_buy"), L[0], L[1] - 80, t, e("d_buy"), C.rise, {size: 44, tail: true});
  tag(tx("d_sell"), R[0], R[1] - 80, t, e("d_sell"), C.fall, {size: 44, tail: true, tc: C.white});
  g.globalAlpha = a;
  if (t >= e("e_t1")) {                                     // подпись щели: над табло, линия к щели
    const vSeen = VALS[VALS.length - 1], yb = BC.h * 100 - 18 - (vSeen + .07) * (BC.h * 100 - 36);
    const P = I.p(BC.x + (XR + 39) / 100, BC.y + .04, BC.z + BC.h - yb / 100), q = eo3(pg(t, e("e_t1"), .3));
    const T = I.p(BC.x + (XR + 39) / 100, BC.y + .04, BC.z + BC.h);
    const s = tx("e_t1"), size = 64, full = widthOf(s, size) + size * 1.1, cx = clamp(P[0], full / 2 + 40, W - full / 2 - 40), y = T[1] - size * 1.5 - 46;
    g.save();
    g.setLineDash([8, 7]);
    g.globalAlpha = a * q;
    line([P[0], P[1] - 20], [P[0], y + size * 1.5], C.amber, 3, "butt");
    g.restore();
    g.globalAlpha = a;
    tag(s, cx, y, t, e("e_t1"), C.amber, {size});
  }
  g.globalAlpha = 1;
}

// ---------- место D: две дорожки поставки ----------

const LANE1 = {x0: XD - 1.95, x1: XD + 1.95, y: -1.05, d: .62}, LANE2 = {x0: XD - 1.95, x1: XD + 1.95, y: .45, d: .62};
const PARCEL = {w: .46, d: .4, h: .36};

function sunMoon(P, p, k) {                                 // день проходит: солнце садится, луна, солнце встаёт
  const R = 70 * k;
  g.save();
  g.globalAlpha *= .9;
  g.fillStyle = rgba(C.ink, .55);
  g.beginPath();
  g.ellipse(P[0], P[1] + 6 * k, R + 36 * k, R * .62 + 30 * k, 0, Math.PI, 0);
  g.fill();
  g.setLineDash([6 * k, 6 * k]);
  g.strokeStyle = rgba(C.white, .4);
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(P[0], P[1], R, R * .62, 0, Math.PI, 0);
  g.stroke();
  g.setLineDash([]);
  line([P[0] - R - 30 * k, P[1]], [P[0] + R + 30 * k, P[1]], rgba(C.white, .5), 2);
  let th, moon;
  if (p < .25) { th = lerp(HALF, 0, p / .25); moon = false; }
  else if (p < .75) { th = lerp(Math.PI, 0, (p - .25) / .5); moon = true; }
  else { th = lerp(Math.PI, HALF, (p - .75) / .25); moon = false; }
  const x = P[0] + R * Math.cos(th), y = P[1] - R * .62 * Math.sin(th), r = 17 * k;
  if (moon) {
    g.fillStyle = "#E9ECF5";
    g.beginPath();
    g.arc(x, y, r, 0, TURN);
    g.fill();
    g.fillStyle = rgba(C.ink, 1);
    g.beginPath();
    g.arc(x + r * .45, y - r * .25, r * .85, 0, TURN);
    g.fill();
  } else {
    g.fillStyle = C.amber;
    g.shadowColor = C.amber;
    g.shadowBlur = 16;
    g.beginPath();
    g.arc(x, y, r, 0, TURN);
    g.fill();
  }
  g.restore();
}

function stationD(I, t) {
  const L1 = e("f_lane1"), slow = pg(t, L1, e("f_lane2") - L1), zip = e("f_zip");
  belt(I, LANE1.x0, LANE1.x1, LANE1.y, LANE1.d, .16, slow * 1.3, "#2B3140");
  const px = lerp(LANE1.x0 + .35, LANE1.x0 + 1.55, eio(slow));
  carton(I, px, LANE1.y + .11, .16, PARCEL, 0);
  belt(I, LANE2.x0, LANE2.x1, LANE2.y, LANE2.d, .16, 5 * eo5(pg(t, zip, .3)), "#203A3A");
  const q = eo5(pg(t, zip, .3)), tx_ = lerp(LANE2.x0 + .4, LANE2.x1 - .4, q), ty = LANE2.y + .36;
  if (q > 0 && q < 1) {                                     // след мгновенного перелёта
    g.globalAlpha = .55 * (1 - q);
    for (let k = 1; k <= 5; k++) {
      const a = I.p(tx_ - .25 - k * .18, ty, .16 + TR), b = I.p(tx_ - .25 - k * .18 - .5 * (1 - q), ty, .16 + TR);
      line(a, b, TOK, 6 - k * .8);
    }
    g.globalAlpha = 1;
  }
  if (t >= L1 - .2) hexToken(I, tx_, ty, .16, TR * .9, q < 1 ? q * 3 : 0, {glow: t >= zip ? Math.exp(-(t - zip - .3) * 2.5) : 0});
}

function labelsD(I, t) {
  if (t < e("f_move") || t > e("g_move") + .4) return;
  g.globalAlpha = 1 - pg(t, e("g_move"), .3);
  const A = I.p(LANE1.x0 + .95, LANE1.y, .62), B = I.p(LANE2.x0 + 2.0, LANE2.y, .16);   // B — задний край нижней дорожки
  tag(tx("f_lane1"), A[0], A[1] - 84, t, e("f_lane1"), C.sky, {size: 52, tail: true, tc: C.white});
  tag(tx("f_lane2"), B[0], B[1] - 52 * 1.5 - 14, t, e("f_lane2"), TOK, {size: 52, tail: true});
  if (t >= e("f_t1")) sunMoon(I.p(LANE1.x1 - .75, LANE1.y, .95), eio(pg(t, e("f_t1"), 1.8)), I.s / 260);
  if (t >= e("f_t2")) {
    const P = I.p(LANE2.x1 - .4, LANE2.y + .36, .16 + 2 * TR + .1);
    tag(tx("f_t2"), P[0], P[1] - 96, t, e("f_t2"), C.rise, {size: 58, tail: true});
  }
  g.globalAlpha = 1;
}

// ---------- место E: стена с тремя дверями ----------

const WALL = {x0: 20.4, x1: 28.8, y: -.3, d: .3, h: 2.35}, DW = 1.12, DH = 1.8;
const DOOR_COL = [C.navy, "#127A75", C.amber2], WALL_C = "#3A3746";

function doorAngle(t, k) {
  const t0 = e(`g_d${k + 1}`);
  return t < t0 ? 0 : 1.62 * back(pg(t, t0, .55));
}

function doorLight(I, k, phi) {
  if (phi <= 0) return;
  const x0 = DOORS[k] - DW / 2, x1 = DOORS[k] + DW / 2, q = clamp(phi / 1.2);
  const pts = [I.p(x0, 0, 0), I.p(x1, 0, 0), I.p(x1, 0, DH), I.p(x0, 0, DH)];
  const lg = g.createLinearGradient(pts[3][0], pts[3][1], pts[0][0], pts[0][1]);
  lg.addColorStop(0, blend("#2A2430", "#FFE6B8", q));
  lg.addColorStop(1, blend("#2A2430", "#FFC97A", q));
  poly(pts, lg);
  g.globalAlpha = .2 * q;                                   // свет на полу перед дверью
  poly([I.p(x0, 0, 0), I.p(x1, 0, 0), I.p(x1 + .5, 1.9, 0), I.p(x0 - .5, 1.9, 0)], "#FFE2A8");
  g.globalAlpha = 1;
}

function doorLeaf(I, k, phi, t) {
  const xh = DOORS[k] - DW / 2, c = Math.cos(phi), s = Math.sin(phi), xf = xh + DW * c, yf = DW * s;
  const pts = [I.p(xh, 0, 0), I.p(xf, yf, 0), I.p(xf, yf, DH), I.p(xh, 0, DH)];
  const cr = (pts[1][0] - pts[0][0]) * (pts[3][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[3][0] - pts[0][0]);
  const outer = cr < 0, col = DOOR_COL[k];
  poly(pts, outer ? col : tone(col, -.35));
  const hl = t >= e(`g_n${k + 1}`) ? Math.exp(-(t - e(`g_n${k + 1}`)) * 2.2) : 0;
  if (outer) {
    onPlane(I, [xh, 0, DH], [c, s, 0], [0, 0, -1], () => {
      g.strokeStyle = rgba(C.white, .22);
      g.lineWidth = 3;
      g.strokeRect(14, 14, DW * 100 - 28, DH * 100 * .42);
      g.strokeRect(14, DH * 100 * .5, DW * 100 - 28, DH * 100 * .42);
      g.fillStyle = C.amber;
      g.beginPath();
      g.arc(DW * 100 - 18, DH * 50, 6, 0, TURN);
      g.fill();
    });
  }
  if (hl > .01) {
    g.save();
    g.globalAlpha = hl;
    g.strokeStyle = C.amber;
    g.lineWidth = 7;
    g.shadowColor = C.amber;
    g.shadowBlur = 30;
    path(pts);
    g.stroke();
    g.restore();
  }
}

function wallE(I) {
  let x = WALL.x0;
  const segs = [];
  for (const dx of DOORS) {
    segs.push([x, dx - DW / 2, 0]);
    segs.push([dx - DW / 2, dx + DW / 2, DH]);
    x = dx + DW / 2;
  }
  segs.push([x, WALL.x1, 0]);
  for (const [a, b, z0] of segs) box(I, a, WALL.y, z0, b - a, WALL.d, WALL.h - z0, [tone(WALL_C, .14), WALL_C, tone(WALL_C, -.3)], {grain: .2});
}

function pop(t, k, d = .3) { return t >= e(k) ? back(pg(t, e(k), d)) : 0; }

function room1(I, t) {                                      // централизованная площадка: сейф, стакан, проверка личности
  const D1 = DOORS[0], open = pg(t, e("g_d1") + .15, .35);
  if (open <= 0) return;
  const q = back(open), sx = D1 - 1.05, sy = .3;           // левее створки: она открывается к зрителю у левого косяка
  box(I, sx - .3, sy, 0, .6, .5, .66 * q, [tone("#5B6070", .15), "#5B6070", tone("#5B6070", -.3)], {grain: .2});
  if (q > .9) {
    onWallY(I, sx - .3, sy + .5, .66, () => {
      const sp = t >= e("g_safe") ? eio(pg(t, e("g_safe"), .4)) * TURN * 1.5 : 0;
      g.fillStyle = "#3D414D";
      g.fillRect(6, 6, 48, 54);
      g.strokeStyle = "#8C93A3";
      g.lineWidth = 2;
      g.strokeRect(6, 6, 48, 54);
      g.save();
      g.translate(30, 30);
      g.rotate(sp);
      g.fillStyle = "#C9CED8";
      g.beginPath();
      g.arc(0, 0, 12, 0, TURN);
      g.fill();
      g.strokeStyle = C.ink;
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TURN;
        g.beginPath();
        g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        g.stroke();
      }
      g.restore();
      g.fillStyle = C.amber;
      g.fillRect(44, 24, 4, 14);
    });
  }
  if (t >= e("g_in") && t < e("g_in") + .6) {               // средства уходят в сейф
    const p = eio(pg(t, e("g_in"), .5));
    g.globalAlpha = 1 - pg(t, e("g_in") + .4, .15);
    box(I, lerp(D1 + .3, sx - .17, p), lerp(1.7, sy + .4, p), lerp(.05, .25, p), .34, .22, .08, [tone(C.amber, .3), C.amber, C.amber2], {grain: 0, edge: 0});
    g.globalAlpha = 1;
  }
  const b = pop(t, "g_book");
  if (b > 0) {
    for (const [dx, col] of [[-.14, C.rise], [.14, C.fall]]) {
      for (let j = 0; j < 3; j++) box(I, D1 + .55 + dx - .12, .45, j * .09 * b, .24, .24, .07 * b, tri(col), {grain: 0, edge: tone(col, .4)});
    }
  }
  const c = pop(t, "g_id");
  if (c > 0) {                                              // карточка проверки: полоски и галочка, без лица
    box(I, D1 - .02, 1.2, 0, .5, .14, .06, tri(C.plate2), {grain: 0, edge: 0});
    onPlane(I, [D1 - .25 + .25 * (1 - c), 1.27, .06 + .36 * c], [c, 0, 0], [0, 0, -c], () => {
      g.fillStyle = C.white;
      g.beginPath();
      g.roundRect(0, 0, 50, 36, 4);
      g.fill();
      g.fillStyle = C.sky2;
      g.fillRect(0, 0, 50, 8);
      g.fillStyle = "#B9B6C2";
      g.fillRect(6, 14, 22, 3.5);
      g.fillRect(6, 21, 16, 3.5);
      g.fillRect(6, 28, 20, 3.5);
      g.fillStyle = C.rise;
      g.beginPath();
      g.arc(38, 24, 8, 0, TURN);
      g.fill();
      g.strokeStyle = C.white;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(34, 24); g.lineTo(37, 27); g.lineTo(42, 20);
      g.stroke();
    });
  }
}

function gear(x, y, r, n, rot, col) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * TURN, rr = i % 2 ? r : r * 1.22, a2 = (i + 1) / (n * 2) * TURN;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    g.lineTo(Math.cos(a2 - .08) * rr, Math.sin(a2 - .08) * rr);
  }
  g.closePath();
  g.fill();
  g.fillStyle = "#FFE6B8";
  g.beginPath();
  g.arc(0, 0, r * .38, 0, TURN);
  g.fill();
  g.restore();
}

function room2(I, t) {                                      // DEX: шестерёнки смарт-контракта, свой кошелёк, пул
  const D2 = DOORS[1], open = pg(t, e("g_d2") + .1, .4);
  if (open <= 0) return;
  const spin = t < e("g_gear") ? (t - e("g_d2")) * .3 : (e("g_gear") - e("g_d2")) * .3 + (t - e("g_gear")) * 2.4;
  onWallY(I, D2 - DW / 2, -.04, DH, () => {
    g.globalAlpha = clamp(open * 2);
    gear(38, 62, 24, 9, spin, "#127A75");
    gear(80, 98, 17, 7, -spin * 1.35 + .2, "#1E9E96");
    gear(44, 128, 13, 6, spin * 1.8, "#0E5F5B");
    g.globalAlpha = 1;
  });
  const pq = back(open);
  cylinder(I, D2 + .48, .95, 0, .42 * pq, .06, "#2F9FE4", "#1E6FA8");  // пул: неглубокая чаша с жетонами
  if (pq > .5) {
    cylinder(I, D2 + .48, .95, .06, .34 * pq, .001, "#5DB8F0", "#5DB8F0");
    [[-.14, .9, 0], [.12, .82, 1.4], [.02, 1.08, 2.6]].forEach(([dx, y, ph]) => hexToken(I, D2 + .48 + dx, y, .04 + .025 * Math.sin(t * 2.4 + ph), .1, .2 * Math.sin(t * 1.7 + ph)));
  }
  const w = pop(t, "g_wal");
  if (w > 0) {                                              // кошелёк
    const x = D2 - 1.0, y = .8;
    box(I, x - .26, y, 0, .52, .32, .34 * w, ["#A5704C", "#8B5A3C", "#6B442D"], {grain: .2});
    if (w > .9) {
      box(I, x - .26, y + .2, .2, .52, .13, .14, ["#B37B55", "#9A6443", "#76492F"], {grain: 0, edge: 0});
      const P = I.p(x + .12, y + .33, .26);
      g.fillStyle = C.amber;
      g.beginPath();
      g.arc(P[0], P[1], .03 * I.s, 0, TURN);
      g.fill();
    }
  }
}

function room3(I, t) {                                      // OTC: две таблички лицом к лицу и один большой ящик
  const D3 = DOORS[2], open = pg(t, e("g_d3") + .15, .35);
  if (open <= 0) return;
  const q = back(open);
  [[-1, C.teal], [1, C.coral]].forEach(([sd, col]) => {
    const x = D3 + sd * .85, y = .95;
    box(I, x - .05, y - .05, 0, .1, .1, .3 * q, tri(C.plate2), {grain: 0, edge: 0});
    slab(I, x, y, .3 * q, .5, .06, .44 * q, -sd * .95, col);
  });
  const t0 = e("g_crate");
  if (t >= t0 - .35) {
    const f = clamp((t - t0 + .35) / .35), z = 2.2 * (1 - f * f) + (f >= 1 ? .06 * Math.abs(wob(t - t0, 3, 8)) : 0);
    const cx = D3 - .4, cy = .62, P = {w: .8, d: .66, h: .64};
    floorShadow(I, cx, cy, P.w, P.d, .35 * f, .1, .08);
    box(I, cx, cy, z, P.w, P.d, P.h, ["#D9B27A", "#B8874E", "#8E6435"], {grain: .25});
    onWallY(I, cx, cy + P.d + .002, z + P.h, () => {
      g.strokeStyle = rgba("#5E3F1E", .7);
      g.lineWidth = 3;
      for (const yy of [20, 42]) {
        g.beginPath();
        g.moveTo(0, yy); g.lineTo(P.w * 100, yy);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(4, 4); g.lineTo(P.w * 100 - 4, P.h * 100 - 4);
      g.stroke();
    });
  }
}

function stationE(I, t) {
  const phis = [0, 1, 2].map(k => doorAngle(t, k));
  phis.forEach((p, k) => doorLight(I, k, p));
  room2(I, t);                                              // шестерёнки висят в проёме за стеной
  wallE(I);
  phis.forEach((p, k) => doorLeaf(I, k, p, t));
  room1(I, t);
  room3(I, t);
}

function labelsE(I, t) {
  if (t < e("g_d1") || t > e("h_move") + .4) return;
  g.globalAlpha = 1 - pg(t, e("h_move"), .3);
  if (t >= e("g_fee") && t < e("g_m2") + .3) {
    const P = I.p(DOORS[0] + .55, .57, .4);
    tag(tx("g_fee"), P[0], P[1] - 96, t, e("g_fee"), C.amber, {size: 44, tail: true});
  }
  if (t >= e("g_pool") && t < e("g_m3") + .3) {
    const P = I.p(DOORS[1] + .55, .95, .1);                  // над бассейном: внизу кадра субтитры
    tag(tx("g_pool"), P[0], P[1] - 150, t, e("g_pool"), C.sky, {size: 46, tail: true, tc: C.white});
  }
  g.globalAlpha = 1;
}

// ---------- место F: три карточки ----------

const CARD_W = 1.3, CARD_H = 1.7, CARD_C = [C.amber, C.teal, C.coral], CARD_BODY = "#55516A";

function calendar(I, x, y, t) {
  const w = .46, h = .52, z = .14;
  box(I, x - w / 2, y, z, w, .1, h, [tone(C.white, -.05), "#E9E4DE", "#B9B4AE"], {grain: 0, edge: 0});
  const page = (ink) => onWallY(I, x - w / 2, y + .1, z + h, () => {
    g.fillStyle = C.fall;
    g.fillRect(0, 0, w * 100, 12);
    g.fillStyle = ink;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(6 + c * 10, 20 + r * 9, 6, 5);
  });
  page("#BDB7B0");
  const t0 = e("h_cal");
  if (t >= t0 && t < t0 + .5) {                             // лист перелистывается вверх через край
    const ps = Math.PI * eio(pg(t, t0, .45)), L = h - .14;
    const pts = [I.p(x - w / 2, y + .1, z + h - .12), I.p(x + w / 2, y + .1, z + h - .12),
      I.p(x + w / 2, y + .1 + L * Math.sin(ps), z + h - .12 - L * Math.cos(ps)), I.p(x - w / 2, y + .1 + L * Math.sin(ps), z + h - .12 - L * Math.cos(ps))];
    poly(pts, ps < HALF ? "#F2EEE8" : "#D6D0C8");
  }
  for (const rx of [-.12, .12]) {
    const P = I.p(x + rx, y + .1, z + h);
    g.fillStyle = "#4A4655";
    g.beginPath();
    g.arc(P[0], P[1], .022 * I.s, 0, TURN);
    g.fill();
  }
}

function handshake(I, x, y, t) {                            // две таблички тянутся друг к другу и касаются верхом
  const q = t >= e("h_fut") ? eio(pg(t, e("h_fut"), .5)) : 0, z = .14, h = .5;
  [[-1, C.amber], [1, C.teal]].forEach(([sd, col]) => {
    const xb = x + sd * .22, xt = x + sd * lerp(.2, .03, q);
    const pts = [I.p(xb - .07, y, z), I.p(xb + .07, y, z), I.p(xt + .07, y, z + h), I.p(xt - .07, y, z + h)];
    poly([I.p(xb - .07, y - .05, z), I.p(xb + .07, y - .05, z), I.p(xt + .07, y - .05, z + h), I.p(xt - .07, y - .05, z + h)], tone(col, -.35));
    poly(pts, col);
  });
}

function marginProp(I, x, y, t) {                           // коробка на тонкой ножке; на ликвидации ножка ломается
  const t0 = e("h_liq"), grow = 1 + .35 * eio(pg(t, e("h_mar") + .6, .5)), P = {w: .42 * grow, d: .36 * grow, h: .36 * grow};
  const sway = .05 * Math.sin(t * 2.3) * pg(t, e("h_mar"), .5) + .1 * wob(t - e("h_rock"), 1.6, 2), z0 = .14, L = 1.05;
  if (t < t0) {
    const top = I.p(x + sway, y, z0 + L), bot = I.p(x, y, z0);
    line(bot, top, "#2C2934", .07 * I.s);
    line(bot, top, "#8C8996", .035 * I.s);
    carton(I, x + sway, y - P.d / 2, z0 + L, P, 0);
    return;
  }
  const f = clamp((t - t0) / .4), mid = I.p(x, y, z0 + L * .5), bot = I.p(x, y, z0);
  line(bot, mid, "#8C8996", .04 * I.s);                     // нижняя половина стоит
  const a = .9 * eio(clamp((t - t0) / .35)), tip = I.p(x + .5 * L * Math.sin(a), y, z0 + L * .5 + .5 * L * Math.cos(a) - .4 * L * f * f);
  line([mid[0], mid[1]], tip, "#8C8996", .035 * I.s);
  const zb = lerp(z0 + L, z0, f * f) + (f >= 1 ? .05 * Math.abs(wob(t - t0 - .4, 3, 8)) : 0);
  slab(I, x + .35 * f, y, zb, P.w, P.d, P.h, .45 * f, C.tan);
  if (t - t0 < .5) {                                        // щепки
    g.globalAlpha = 1 - (t - t0) / .5;
    for (let i = 0; i < 6; i++) {
      const dt = t - t0, P2 = I.p(x + (i - 2.5) * .12 * dt * 4, y, z0 + L * .5 + dt * (1.4 - i * .1) - 3 * dt * dt);
      g.fillStyle = C.tan2;
      g.fillRect(P2[0], P2[1], 8, 3);
    }
    g.globalAlpha = 1;
  }
}

function stationF(I, t) {
  if (t < e("h_move") - .5) return;
  box(I, XF - 2.55, -.55, 0, 5.1, 1.55, .14, [tone(C.plate2, .12), C.plate2, tone(C.plate2, -.32)], {grain: .2});
  const focus = t >= e("h_m") ? 2 : t >= e("h_f") ? 1 : -1;
  CARDS.forEach((x, i) => {
    const q = back(pg(t, e(`h_c${i + 1}`), .35));
    if (q <= 0) return;
    g.globalAlpha = focus >= 0 && focus !== i ? .45 : 1;
    box(I, x - CARD_W / 2, -.44, .14, CARD_W, .08, CARD_H * q, [tone(CARD_BODY, .12), CARD_BODY, tone(CARD_BODY, -.3)], {grain: .2});
    onWallY(I, x - CARD_W / 2, -.36, .14 + CARD_H * q, () => {
      g.scale(1, q);
      g.fillStyle = CARD_C[i];
      g.fillRect(0, 0, CARD_W * 100, 44);
      text(tx(`h_c${i + 1}`), CARD_W * 50, 32, 25, C.ink, {align: "center", w: 800});
    });
    if (q > .9) {
      if (i === 0) carton(I, x, -.05, .14, {w: .5, d: .42, h: .38}, 0, {sticker: 1, label: tx("a_mine")});
      if (i === 1) { calendar(I, x - .3, -.1, t); handshake(I, x + .3, .35, t); }
      if (i === 2) marginProp(I, x, .3, t);
    }
    g.globalAlpha = 1;
  });
}

function labelsF(I, t) {
  if (t < e("h_liq") || t > e("i_move") + .4) return;
  const P = I.p(CARDS[2] + .35, .3, .7);
  g.globalAlpha = 1 - pg(t, e("i_move"), .3);
  tag(tx("h_liq"), P[0], P[1] - 70, t, e("h_liq") + .1, C.fall, {size: 50, tail: true, tc: C.white});
  g.globalAlpha = 1;
}

// ---------- место G: весы ----------

const SCALE = {pz: 2.15, L: 1.3, hang: .95};
const PRO = ["i_p1", "i_p2", "i_p3", "i_p4"], CON = ["i_m1", "i_m2"];

function tiltOf(t) {
  let a = 0;
  for (const k of PRO) if (t >= e(k)) a += .055 * spring(t - e(k) - .18, 1.2, 3.2);
  for (const k of CON) if (t >= e(k)) a -= .065 * spring(t - e(k) - .18, 1.2, 3.2);
  return a;
}

function stationG(I, t) {
  if (t < e("i_move") - .5) return;
  const x = XG, y = .1, th = tiltOf(t), c = Math.cos(th), s = Math.sin(th);
  box(I, x - .4, y - .35, 0, .8, .7, .12, tri(C.plate2), {grain: .2});
  box(I, x - .07, y - .07, .12, .14, .14, SCALE.pz - .12, [tone(C.amber2, .2), C.amber2, tone(C.amber2, -.3)], {grain: 0, edge: 0});
  const ends = [[x - SCALE.L * c, SCALE.pz - SCALE.L * s], [x + SCALE.L * c, SCALE.pz + SCALE.L * s]];
  ends.forEach(([ex, ez], side) => {                        // нити и чаши
    const pz = ez - SCALE.hang, list = side ? CON : PRO;
    for (const [dx, dy] of [[-.36, 0], [.36, 0], [0, -.3]]) line(I.p(ex, y, ez), I.p(ex + dx, y + dy, pz), rgba(C.white, .55), 2);
    cylinder(I, ex, y, pz - .05, .44, .05, tone(C.amber, .25), C.amber2);
    list.forEach((k, i) => {                                // груз падает на чашу вместе с табличкой
      if (t < e(k)) return;
      const f = clamp((t - e(k)) / .2), zz = pz + i * .09 + .9 * (1 - f * f);
      box(I, ex - .24, y - .15, zz, .48, .3, .08, tri(side ? C.fall : C.rise), {grain: 0, edge: 0});
    });
  });
  const A = I.p(ends[0][0], y, ends[0][1]), B = I.p(ends[1][0], y, ends[1][1]);
  line(A, B, "#7A4E14", .09 * I.s);
  line(A, B, C.amber, .05 * I.s);
  const P = I.p(x, y, SCALE.pz);
  g.fillStyle = C.amber;
  g.beginPath();
  g.arc(P[0], P[1], .09 * I.s, 0, TURN);
  g.fill();
  g.fillStyle = "#7A4E14";
  g.beginPath();
  g.arc(P[0], P[1], .035 * I.s, 0, TURN);
  g.fill();
}

// ---------- надписи ----------

const NOTE_SPANS = [[e("b_t1"), e("c_move") - .2], [e("c_t1"), e("d_move") - .2], [e("d_t1"), e("e_move") - .2], [e("f_t1"), e("g_move") - .2],
  [e("g_s1"), e("g_m2") - .2], [e("g_s2"), e("g_m3") - .2], [e("g_s3"), e("h_move") - .2], [e("h_spot"), e("h_f") - .1], [e("h_fut"), e("h_m") - .1],
  [e("h_mar"), e("i_move") - .2], [e("i_p1"), WIPE - .3], [e("j_t1"), BACK - .2]];

function scrim(t) {                                         // тёмная подложка сверху, пока висят надписи: табло за ними не мешает читать
  let a = 0;
  for (const [s0, s1] of NOTE_SPANS) a = Math.max(a, clamp((t - s0 + .15) / .3) * (1 - clamp((t - s1) / .35)));
  if (a <= 0) return;
  const lg = g.createLinearGradient(0, 0, 0, 660);
  lg.addColorStop(0, `rgba(10,8,14,${.7 * a})`);
  lg.addColorStop(.55, `rgba(10,8,14,${.55 * a})`);
  lg.addColorStop(1, "rgba(10,8,14,0)");
  g.fillStyle = lg;
  g.fillRect(0, 0, W, 660);
}

function notes(t) {
  resetCam();
  scrim(t);
  let off = e("c_move") - .2;
  note("b_t1", NOTE, 260, 100, C.white, t, {off, block: C.amber, lh: 112});
  note("b_pay", NOTE, 470, 56, C.white, t, {off, block: C.amber});
  if (t >= e("b_get") - .1 && t < off + .3) {               // шаг за шагом: заплатил → получил
    g.globalAlpha = eo3(pg(t, e("b_get") - .1, .2)) * (1 - pg(t, off, .25));
    line([NOTE + 4, 527], [NOTE + 40, 527], C.rise, 7, "butt");
    poly([[NOTE + 38, 512], [NOTE + 58, 527], [NOTE + 38, 542]], C.rise);
    g.globalAlpha = 1;
  }
  note("b_get", NOTE + 76, 545, 56, C.white, t, {off, block: C.rise});
  note("c_t1", NOTE, 300, 72, C.white, t, {off: e("d_move") - .2, block: C.fall, lh: 86});
  note("d_t1", NOTE, 300, 84, C.white, t, {off: e("e_move") - .2, block: C.rise, lh: 96});
  note("f_t1", NOTE, 300, 72, C.white, t, {off: e("g_move") - .2, block: C.amber, lh: 84});
  note("g_s1", NOTE, 300, 78, C.white, t, {off: e("g_m2") - .2, block: C.sky, lh: 90});
  off = e("g_m3") - .2;
  note("g_s2", NOTE, 300, 120, C.white, t, {off, block: "#127A75"});
  if (t >= e("g_ctrl") && t < off + .3) {                   // контроль больше, защиты меньше
    g.globalAlpha = 1 - pg(t, off, .25);
    tag(tx("g_ctrl"), NOTE, 360, t, e("g_ctrl"), C.rise, {size: 50, align: "left", icon: (x, y, r) => arrowUp(x, y + r * .1, r * 1.2, C.bg, -1)});
    tag(tx("g_prot"), NOTE + 430, 360, t, e("g_prot"), C.fall, {size: 50, align: "left", tc: C.white, icon: (x, y, r) => arrowUp(x, y, r * 1.2, C.white, 1)});
    g.globalAlpha = 1;
  }
  off = e("h_move") - .2;
  note("g_s3", NOTE, 300, 120, C.white, t, {off, block: C.amber});
  note("g_one", NOTE, 420, 66, C.white, t, {off, block: C.amber2, lh: 78});
  note("h_spot", NOTE, 300, 64, C.white, t, {off: e("h_f") - .1, block: C.amber, lh: 76});
  note("h_fut", NOTE, 300, 60, C.white, t, {off: e("h_m") - .1, block: C.teal, lh: 72});
  note("h_mar", NOTE, 300, 64, C.white, t, {off: e("i_move") - .2, block: C.fall, lh: 76});
  off = WIPE - .3;
  [["i_p1", 280], ["i_p2", 344], ["i_p3", 408], ["i_p4", 472]].forEach(([k, y]) => note(k, NOTE, y, 50, tone(C.rise, .45), t, {off, block: C.rise, lh: 60}));
  [["i_m1", 640], ["i_m2", 704]].forEach(([k, y]) => note(k, W - NOTE, y, 50, tone(C.fall, .45), t, {off, block: C.fall, lh: 60, align: "right"}));
  off = BACK - .2;
  note("j_t1", NOTE, 250, 84, C.white, t, {off, block: C.amber});
  note("j_t2", NOTE, 345, 84, C.white, t, {off, block: C.rise});
  note("j_t3", NOTE, 500, 130, C.amber, t, {off, block: C.white});
  note("j_note", W / 2, 1605, 32, C.grey, t, {off, align: "center", block: C.grey});   // сразу под субтитрами: ниже — подпись TikTok
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

OVERLAYS.push(t => chWipe(t, WIPE));

// ---------- кадр ----------

function shakeOf(t) {
  return .7 * wob(t - e("a_land"), 5, 7) + .5 * wob(t - e("c_try"), 7, 8) + 1.2 * wob(t - e("g_crate"), 5, 6)
    + 1.1 * wob(t - e("h_liq") - .4, 5, 6) + .5 * wob(t - e("b_pin"), 5, 7);
}

const SPAN = {A: [-4.7, 2.7], B: [XB - 1.4, XB + 2.0], C: [XC - 1.7, XC + 1.7], D: [XD - 2.0, XD + 2.0], E: [WALL.x0 - .6, WALL.x1 + .6],
  F: [XF - 2.6, XF + 2.6], G: [XG - 1.8, XG + 1.8]};       // границы мест по x: место рисуется, если хоть край в кадре

function drawAll(t) {
  const V = viewOf(SHOTS, t, shakeOf(t)), I = V.I, half = 600 / V.s + 1;
  const near = k => SPAN[k][1] > V.fx - half && SPAN[k][0] < V.fx + half;
  const flash = t >= e("a_land") ? .25 * Math.exp(-(t - e("a_land")) * 3) : 0;
  sky(V, t, flash);
  floorW(I, V.fx, V.s);
  if (near("A")) stationA(I, t);
  if (near("B")) stationB(I, t);
  if (near("C")) stationC(I, t);
  if (near("D")) stationD(I, t);
  if (near("E")) stationE(I, t);
  if (near("F")) stationF(I, t);
  if (near("G")) stationG(I, t);
  foreground(V.v, t, .35);
  resetCam();
  if (near("A")) labelsA(I, t);
  if (near("B")) labelsB(I, t);
  if (near("C")) labelsC(I, t);
  if (near("D")) labelsD(I, t);
  if (near("E")) labelsE(I, t);
  if (near("F")) labelsF(I, t);
  notes(t);
}

for (let k = 1; k <= 10; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_drop", 0, .9, 3], ["c_move", 0, .95, 8], ["d_move", 0, .95, 8], ["e_move", 0, .8, 6], ["f_move", 0, .95, 8],
  ["f_zip", 0, .35, 6], ["g_move", 0, 1, 8], ["g_m2", 0, .75, 8], ["g_m3", 0, .75, 8], ["g_crate", -.35, .1, 4], ["h_move", 0, 1, 8],
  ["i_move", 0, 1, 8], ["j_wipe", -.26, .32, 10], ["j_debt", 0, .9, 5], ["j_back", 0, END - BACK, 10], ["b_fly", 0, .45, 4]);
