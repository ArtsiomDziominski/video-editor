"use strict";
// TikTok «Фильтр для фотографий, который торгует тренд» (Bilateral Filter Trend). Мир A: шумная фотография гор на
// закате стоит на постаменте; полоса фильтра снимает шум, а силуэт гор отрывается от фото и становится линией графика.
// Дальше камера едет вдоль этого же графика: средняя опаздывает, линия фильтра поворачивает сразу, правило лонг/шорт,
// стоп на три размаха, боковик. Мир B за шторкой — честная статистика. В конце график сматывается назад и снова
// становится фотографией: последний кадр совпадает с первым.

const END = D.dur, NOTE = 64, BACK = e("z_back"), HOME = BACK + 1.0;   // HOME — камера снова у фото
const loopT = t => t < BACK ? t : BACK * (1 - eio(pg(t, BACK, END - BACK)));

// Смешать два цвета: #rrggbb или rgb(...) из tone()
const rgbOf = c => c[0] === "#" ? [16, 8, 0].map(s => (parseInt(c.slice(1), 16) >> s) & 255) : c.match(/\d+/g).slice(0, 3).map(Number);

function blend(a, b, x) {
  const A = rgbOf(a), B = rgbOf(b);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], x)).toString(16).padStart(2, "0")).join("");
}

// ---------- график: силуэт гор, потом тренд, разворот, дрожь, снова тренд, боковик и большой тренд ----------

const DX = .42, BW = .26, WK = .05, LY = BW / 2 + .05, X0 = -2.1;      // шаг свечей, тело, тень; линии идут перед свечами
const xOf = i => X0 + (i + .5) * DX;
const PH = {x: -2.3, y: -.8, z: 3.7, w: 4.6, h: 3.4};                // фотография на стойках над графиком: левый край, плоскость, низ, размер
const RZ = PH.z - .32;                                               // силуэт на фото — те же горы, поднятые над свечами
const PEAKS = [[-1.05, 2.5, 1.0], [.45, 3.0, 1.05], [1.75, 2.35, .8]];

function ridge(x) {                                                  // высота силуэта гор над полом
  let z = 1.15;
  for (const [px, h, w] of PEAKS) z = Math.max(z, h - Math.abs(x - px) * (h - 1.0) / w);
  return z + .05 * Math.sin(x * 11) + .035 * Math.sin(x * 27 + 1.3);
}

const NC = 112, CHOP = [70, 92], RIDGE_N = 11;
const KEYS = [[10, ridge(xOf(10))], [14, 3.5], [24, 6.09], [25, 5.95], [30, 2.45], [40, 2.52], [42, 2.59], [56, 5.67], [57, 5.74],
  [63, 3.57], [66, 3.36], [70, 3.67], [92, 3.67], [111, 8.0]];
const CLOSE = (() => {
  const r = rng(53), rj = rng(61), c = [];                           // rj — дрожь свечей под фото, остальной ряд не трогает
  for (let i = 0; i < NC; i++) {
    if (i < RIDGE_N) { c.push(ridge(xOf(i)) + (rj() - .5) * .55); continue; }
    if (i >= CHOP[0] && i <= CHOP[1]) { c.push(3.67 + .8 * Math.sin((i - 70) * Math.PI * 2 / 7.5) + (r() - .5) * .14); continue; }
    let k = 0;
    while (k < KEYS.length - 2 && i > KEYS[k + 1][0]) k++;
    const [ia, va] = KEYS[k], [ib, vb] = KEYS[k + 1];
    const amp = i > 30 && i < 41 ? .39 : i > 24 && i < 31 ? .08 : .2;
    c.push(lerp(va, vb, (i - ia) / (ib - ia)) + (r() - .5) * amp);
  }
  return c;
})();
const CANDLES = (() => {
  const r = rng(71);
  return CLOSE.map((c, i) => {
    const o = i ? CLOSE[i - 1] : c - .12, top = Math.max(o, c), low = Math.min(o, c), big = i >= RIDGE_N ? 1 : .6;
    return {i, x: xOf(i), o, c, h: top + (.04 + r() * .16) * big, l: low - (.04 + r() * .16) * big};
  });
})();
const RNG = CANDLES.slice(RIDGE_N).reduce((s, k) => s + k.h - k.l, 0) / (NC - RIDGE_N);   // средний размах свечи

// Билатеральный фильтр: вес свечи — по возрасту и по расстоянию её закрытия от опоры (медиана трёх последних закрытий)
const ST = 8, KR = .59, NW = 30, REV = .59;
const refOf = i => [CLOSE[i], CLOSE[Math.max(0, i - 1)], CLOSE[Math.max(0, i - 2)]].sort((a, b) => a - b)[1];
const wAge = j => Math.exp(-j * j / (2 * ST * ST));
const wDist = (v, ref) => Math.exp(-.5 * ((v - ref) / KR) ** 2);
const BF = CLOSE.map((_, i) => {
  const ref = refOf(i);
  let s = 0, w = 0;
  for (let j = 0; j < NW && i - j >= 0; j++) {
    const v = CLOSE[i - j], q = wAge(j) * wDist(v, ref);
    s += q * v;
    w += q;
  }
  return s / w;
});
const SMA = CLOSE.map((_, i) => {
  const a = Math.max(0, i - 13);
  let s = 0;
  for (let j = a; j <= i; j++) s += CLOSE[j];
  return s / (i - a + 1);
});
const TREND = (() => {                                              // разворот: фильтр отошёл от экстремума на порог
  let dir = 1, ext = BF[0];
  return BF.map(v => {
    if (dir > 0) { ext = Math.max(ext, v); if (v < ext - REV) { dir = -1; ext = v; } } else { ext = Math.min(ext, v); if (v > ext + REV) { dir = 1; ext = v; } }
    return dir;
  });
})();
const FLIPS = TREND.map((d, i) => i && d !== TREND[i - 1] ? i : -1).filter(i => i > 0);
const LONG4 = FLIPS.find(i => i > 41 && TREND[i] > 0), SHORT4 = FLIPS.find(i => i > LONG4 && TREND[i] < 0);
const CHOP_FLIPS = FLIPS.filter(i => i > CHOP[0] + 4 && i <= CHOP[1]);
const PEAK2 = 24, REF3 = 31, FORM = 65;                             // вершина перед разворотом, «текущий уровень», свеча с часами

// ---------- сколько свечей видно: график растёт по событиям, в конце сматывается назад ----------

const REVEAL = [[e("b_move") + .2, e("b_turn") - e("b_move") - .2, RIDGE_N, PEAK2 + 1],
  [e("b_turn"), .75, PEAK2 + 1, REF3], [e("c_calm") - .2, 1.6, REF3, 41], [e("d_move") + .1, e("d_flip") - e("d_move") + .1, 41, SHORT4 + 1],
  [e("d_flip") + .25, e("d_close") - e("d_flip") - .55, SHORT4 + 1, FORM], [e("d_close") - .3, .3, FORM, FORM + 1],
  [e("g_wipe"), .001, FORM + 1, CHOP[0]], [e("g_big"), 2.2, CHOP[1] + 1, NC]];
{                                                           // в боковике: каждый разворот раскрывается к своей вспышке стопа
  const at = [e("g_t"), e("g_s1"), e("g_s2"), e("g_s3"), e("g_s4"), e("g_norm")], n = [CHOP[0], ...CHOP_FLIPS.slice(0, 4).map(i => i + 1), CHOP[1] + 1];
  for (let k = 0; k < 5; k++) REVEAL.splice(REVEAL.length - 1, 0, [at[k], Math.max(.05, at[k + 1] - at[k]), n[k], n[k + 1]]);
}

function shownN(t) {
  if (t >= BACK) return lerp(NC, RIDGE_N, eio(pg(t, BACK, HOME - BACK)));   // свечи под фото есть с первого кадра и до последнего
  let n = RIDGE_N;
  for (const [a, d, n0, n1] of REVEAL) if (t >= a) n = lerp(n0, n1, pg(t, a, d));
  return n;
}

// Линия фильтра появляется в третьей сцене и тянется за свечами
function bfN(t, n) {
  if (t >= BACK) return t < HOME - .25 ? n : lerp(n, RIDGE_N - 1, pg(t, HOME - .25, .25));   // к стыку линии фильтра нет, как в первом кадре
  if (t < e("c_line")) return 0;
  return Math.min(n, lerp(RIDGE_N - 1, REF3 + 1, eo3(pg(t, e("c_line"), .8))) + Math.max(0, n - REF3 - 1));
}

// Фото ↔ график: 0 — фотография, 1 — линия графика со свечами
function photoMix(t) {
  if (t >= BACK) return 1 - eio(pg(t, HOME, END - HOME - .2));
  return eio(pg(t, e("a_morph") + .1, .5));                // край ушёл с фото — фото гаснет, пока камера не увела его под заголовок
}

// ---------- настроение сцены: свечение фона ----------

const MOODS = {
  sunset: ["#FF8A3D", "#2A1A22", .55], cold: ["#7C8BB0", "#15151D", .2], red: [C.fall, "#22121A", .3], teal: ["#3FC1C9", "#0F1D24", .36],
  green: [C.rise, "#0E2219", .4], navy: [C.sky2, "#101A2C", .38], gold: ["#FFC34D", "#221A12", .45],
};
const MOOD_KEYS = [[e("b_move"), 1, "cold"], [e("b_pull"), .8, "red"], [e("c_line"), .8, "teal"], [e("d_up"), .6, "green"],
  [e("d_flip"), .6, "red"], [e("e_move"), .8, "navy"], [e("f_wipe"), .001, "navy"], [e("f_cols"), .8, "green"], [e("g_wipe"), .001, "red"],
  [e("g_big"), 1, "green"], [e("h_title"), .8, "gold"], [BACK, END - BACK - .1, "sunset"]];

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
  let [glow, bg, amt] = MOODS.sunset;
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

const SHOT0 = [165, 7, 0, 3.5, 540, 1060];                         // фото сверху, свечи под ним — с первого кадра видно график
const zMid = (a, b) => (Math.min(...CLOSE.slice(a, b)) + Math.max(...CLOSE.slice(a, b))) / 2;
const shotA = [[0, .001, ...SHOT0],
  [0, e("a_morph") - .2, 172, 5, 0, 3.6, 540, 1045],                       // медленный наезд
  [e("a_morph") - .05, 1.3, 200, 9, .2, 2.1, 540, 1020],                   // вслед за линией вниз, к свечам
  [e("b_move"), 1.1, 150, 8, xOf(19), 4.3, 540, 1060],                     // вдоль тренда вверх
  [e("b_turn") - .4, 1.2, 138, 11, xOf(24), 4.1, 540, 1060],
  [e("c_s1") - .3, 1.2, 128, 7, xOf(22), 4.15, 540, 1080],
  [e("c_calm") - .2, 1.2, 150, 9, xOf(35), 2.6, 540, 1010],                // мелкая дрожь крупнее
  [e("d_move"), 1.1, 140, 7, xOf(52), 4.3, 540, 1060],
  [e("d_flip") - .3, 1.2, 132, 10, xOf(56), 4.3, 540, 1060],
  [e("d_close") - .3, 1, 170, 8, xOf(FORM) - .3, 3.5, 560, 1040],          // свеча с часами
  [e("e_move"), 1, 172, 6, xOf(LONG4) + .7, CLOSE[LONG4] - 1.0, 520, 1000],  // вход и три размаха вниз
  [e("e_risk") - .3, 1, 160, 9, xOf(LONG4) + 1.1, CLOSE[LONG4] - .9, 470, 1000],
  [e("g_wipe"), .001, 140, 6, xOf(77), zMid(70, 93), 540, 1060],
  [e("g_wipe") + .01, e("g_s4") - e("g_wipe"), 146, 4, xOf(86), zMid(70, 93), 540, 1060],
  [e("g_s4"), e("g_big") - e("g_s4"), 150, 6, xOf(88), zMid(70, 93), 540, 1060],
  [e("g_big"), 1.8, 76, 9, xOf(98), 5.4, 540, 1060],                       // большой тренд целиком
  [e("h_title") - .2, 1.2, 66, 6, xOf(96), 5.4, 540, 1230],
  [BACK, HOME - BACK, ...SHOT0]];

const shotB = [[0, .001, 270, 9, 1.2, .5, 540, 1100],
  [e("f_wipe"), e("f_sq") - e("f_wipe") + .2, 280, 6, 1.5, .5, 540, 1100],  // крупно первые квадратики
  [e("f_sq") + .2, 1.5, 100, 8, 4.7, .5, 540, 1080],                       // отъезд: видно все десять
  [e("f_cols") - .3, 1.3, 104, 10, 4.6, 1.4, 540, 1150],                   // столбики за рядом
  [e("f_cols") + 1, e("g_wipe") - e("f_cols") - 1, 108, 6, 4.5, 1.5, 540, 1150]];

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
  const live = pg(t, 0, .7) * (1 - pg(t, END - 1.1, .6));   // камера не стоит на месте, но на стыке петли замирает
  s *= 1 + live * .02 * Math.sin(t * .47);
  th += live * 1.8 * Math.sin(t * .61);
  const I = new Iso(0, 0, s, th, .42), P = I.p(fx, 0, fz);
  I.ox = px - P[0];
  I.oy = py - P[1] + shake * 18;
  return {I, s, v: {x: 610 + fx * 60, y: 540 + fz * 40 + Math.log(s) * 240}};
}

// ---------- мир A: пол и кубики заднего плана ----------

const PROPS_A = (() => {
  const r = rng(41), out = [];
  for (let i = 0; i < 40; i++) out.push({x: -6 + i * 1.45 + r() * .7, y: -4.4 + r() * 1.4, w: .14 + r() * .26, d: .14 + r() * .26, h: .1 + r() * .55, col: [C.plate2, C.navy, C.coral, C.sky2, C.plate2, C.amber2][i % 6]});
  for (let i = 0; i < 14; i++) out.push({x: -5 + i * 4.2 + r() * 1.5, y: 2.2 + r() * 1.6, w: .14 + r() * .2, d: .14 + r() * .2, h: .08 + r() * .3, col: [C.teal, C.navy, C.plate2][i % 3]});
  return out.sort((a, b) => a.y - b.y);
})();

function floorA(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-30, -9), P(80, -9), P(80, 26), P(-30, 26)], C.plate);   // дальний край — горизонт; ближний и боковые с запасом
  g.globalAlpha = .09;
  for (let x = -30; x <= 80; x += .8) line(P(x, -9), P(x, 26), C.white, 1);
  for (let y = -8.6; y <= 26; y += .8) line(P(-30, y), P(80, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_A) if (k.y < 0) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

function floorFront(I) {
  for (const k of PROPS_A) if (k.y >= 0) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

// ---------- фотография гор на закате ----------

const NOISE = (() => {                                      // цветное зерно: крупное, чтобы читалось на телефоне
  const w = 160, h = 120, cv = document.createElement("canvas"), r = rng(19);
  cv.width = w; cv.height = h;
  const x = cv.getContext("2d"), im = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = r(), c = r();
    im.data[4 * i] = v < .5 ? 255 * c : 30 * c;
    im.data[4 * i + 1] = v < .5 ? 220 * r() : 20 * r();
    im.data[4 * i + 2] = v < .5 ? 255 * r() : 60 * r();
    im.data[4 * i + 3] = 60 + r() * 120;
  }
  x.putImageData(im, 0, 0);
  return cv;
})();
const FAR = [[-2.3, 2.4], [-1.6, 2.85], [-.9, 2.5], [-.15, 2.15], [.6, 2.9], [1.2, 3.25], [1.8, 2.7], [2.3, 2.95]];   // дальний хребет
const SUN = {x: -.2, z: 2.3, r: .45};                              // садится в седловину дальнего хребта

// Фото в своих единицах: 100 = клетка мира; v растёт вниз от верхнего края
function photoArt(t, clean, noiseA) {
  const w = PH.w * 100, h = PH.h * 100, top = PH.z + PH.h, U = x => (x - PH.x) * 100, V = z => (top - z - RZ) * 100;
  const sk = g.createLinearGradient(0, 0, 0, h);
  sk.addColorStop(0, "#2B1E4A");
  sk.addColorStop(.42, "#B23A68");
  sk.addColorStop(.66, "#FF8A3D");
  sk.addColorStop(.82, "#FFD27A");
  sk.addColorStop(1, "#FFD27A");
  g.fillStyle = sk;
  g.fillRect(0, 0, w, h);
  const sg = g.createRadialGradient(U(SUN.x), V(SUN.z), 0, U(SUN.x), V(SUN.z), SUN.r * 260);
  sg.addColorStop(0, "rgba(255,200,120,.95)");
  sg.addColorStop(.25, "rgba(255,214,140,.45)");
  sg.addColorStop(1, "rgba(255,180,90,0)");
  g.fillStyle = sg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#FFC36A";
  g.beginPath();
  g.arc(U(SUN.x), V(SUN.z), SUN.r * 100, 0, 7);
  g.fill();
  g.fillStyle = "#7A3A6B";
  g.beginPath();
  g.moveTo(0, h);
  for (const [x, z] of FAR) g.lineTo(U(x), V(z));
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  g.fillStyle = "#1C1424";
  g.beginPath();
  g.moveTo(0, h);
  for (let k = 0; k <= 92; k++) { const x = PH.x + PH.w * k / 92; g.lineTo(U(x), V(ridge(x))); }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  if (noiseA > 0 && clean < 1) {                              // шум справа от полосы фильтра; меняется 15 раз в секунду
    const f = Math.floor(loopT(t) * 15), r = rng(f * 7 + 3), cu = Math.max(0, clean) * w;
    g.save();
    g.beginPath();
    g.rect(cu, 0, w - cu, h);
    g.clip();
    g.globalAlpha *= noiseA;
    g.imageSmoothingEnabled = false;
    const ox = -r() * 480, oy = -r() * 360;
    for (let y = oy; y < h; y += 360) for (let x = ox; x < w; x += 480) g.drawImage(NOISE, x, y, 480, 360);
    g.imageSmoothingEnabled = true;
    g.restore();
  }
  const vg = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(10,6,16,.45)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

function filterBar(t) {                                     // полоса фильтра и её свечение
  const p = pg(t, e("a_sweep"), 1.4);
  if (p <= 0 || p >= 1 || t >= BACK) return -1;
  const u = lerp(-.04, 1.04, eio(p));
  return u;
}

function photo(I, t, mix) {
  if (mix >= 1) return;
  const a = 1 - mix, clean = t >= BACK ? -1 : t >= e("a_sweep") ? lerp(-.04, 1.04, eio(pg(t, e("a_sweep"), 1.4))) : -1;
  g.globalAlpha = a;
  floorShadow(I, PH.x - .1, PH.y - .3, PH.w + .2, .5, .35, .25, .2);
  for (const px of [PH.x + .55, PH.x + PH.w - .73]) box(I, px, PH.y - .17, 0, .18, .16, PH.z, [tone(C.plate2, .15), C.plate2, tone(C.plate2, -.32)], {grain: .2, edge: 0});
  g.globalAlpha = a;
  onWallY(I, PH.x, PH.y, PH.z + PH.h, () => {
    const w = PH.w * 100, h = PH.h * 100;
    g.fillStyle = "#F4EEE6";                                // белое паспарту
    g.fillRect(-9, -9, w + 18, h + 18);
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    photoArt(t, clean, 1);
    const u = filterBar(t);
    if (u > -1) {
      const x = u * w, lg = g.createLinearGradient(x - 60, 0, x + 26, 0);
      lg.addColorStop(0, "rgba(125,191,201,0)");
      lg.addColorStop(.7, "rgba(160,230,240,.55)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg;
      g.fillRect(x - 60, 0, 86, h);
      g.fillStyle = C.white;
      g.fillRect(x - 3, 0, 6, h);
    }
    g.restore();
  });
  g.globalAlpha = 1;
}

// Блик по краю гор: шум ушёл, а граница осталась резкой
function edgeGlint(I, t) {
  const p = pg(t, e("a_edge"), .8);
  if (p <= 0 || p >= 1 || t >= BACK) return;
  const x0 = PH.x + PH.w * lerp(-.1, 1, p), pts = [];
  for (let k = 0; k <= 24; k++) { const x = x0 - k * .04; if (x > PH.x && x < PH.x + PH.w) pts.push(I.p(x, PH.y, ridge(x) + RZ)); }
  if (pts.length < 2) return;
  g.save();
  g.shadowColor = C.white;
  g.shadowBlur = 18;
  g.beginPath();
  pts.forEach((P, k) => k ? g.lineTo(P[0], P[1]) : g.moveTo(P[0], P[1]));
  g.strokeStyle = rgba(C.white, .95 * Math.sin(p * Math.PI));
  g.lineWidth = 5;
  g.lineCap = "round";
  g.stroke();
  g.restore();
}

// Линия силуэта: край гор на фото отрывается, падает на свечи под фото и ложится ровной линией сквозь их дрожь
function ridgeLine(I, t, mix) {
  let lift, m2, yq, hop = 0, gone = 0;
  if (t >= BACK) {                                          // петля: линия взлетает обратно в фото
    lift = eio(pg(t, HOME - .45, .35)) * (1 - eio(pg(t, END - .3, .25)));
    m2 = yq = mix;
  } else {
    const p = pg(t, e("a_morph"), e("a_chart") - e("a_morph"));
    lift = pg(t, e("a_morph"), .1);
    m2 = p < .3 ? 0 : ((p - .3) / .7) ** 2;                 // сначала отрыв вверх, потом падение с ускорением
    hop = p < .3 ? .32 * Math.sin(Math.PI / 2 * p / .3) : .32 * (1 - m2);
    yq = eio(p);
    gone = eio(pg(t, e("b_move"), .7));
  }
  if (lift <= 0 || gone >= 1) return;
  const amber = t >= BACK ? 0 : Math.exp(-Math.max(0, t - e("a_strat")) * 2.2) * (t >= e("a_strat") ? 1 : 0);
  const trend = t >= BACK ? 0 : eio(pg(t, e("a_strat") + .1, .45));    // «стратегия»: вверх — зелёная, вниз — красная
  const y = lerp(PH.y, LY, yq), pts = [], zs = [];
  for (let k = 0; k <= 92; k++) {
    const x = PH.x + PH.w * k / 92, z = lerp(ridge(x) + RZ, ridge(x), m2) + hop;
    pts.push(I.p(x, y, z));
    zs.push(z);
  }
  const base = blend(C.white, C.amber, clamp(amber * 1.4));
  g.save();
  g.globalAlpha = lift * (1 - gone);
  g.lineWidth = 6 + 4 * amber;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.shadowBlur = 16 + 30 * amber;
  if (trend <= 0) {
    g.shadowColor = amber > .05 ? C.amber : C.white;
    g.beginPath();
    pts.forEach((P, k) => k ? g.lineTo(P[0], P[1]) : g.moveTo(P[0], P[1]));
    g.strokeStyle = base;
    g.stroke();
  } else {
    for (let k = 1; k < pts.length; k++) {
      const col = blend(base, zs[k] >= zs[k - 1] ? C.rise : C.fall, trend);
      g.shadowColor = col;
      g.strokeStyle = col;
      g.beginPath();
      g.moveTo(pts[k - 1][0], pts[k - 1][1]);
      g.lineTo(pts[k][0], pts[k][1]);
      g.stroke();
    }
  }
  g.restore();
}

// ---------- свечи в мире ----------

function candle3D(I, k, o = {}) {
  const c = o.c ?? k.c, rise = c >= k.o, main = o.col ?? (rise ? C.rise : C.fall), d = BW / 2, dz = o.dz ?? 0;
  const lo = Math.min(k.o, c) + dz, hi = Math.max(k.o, c) + dz, gr = o.grow ?? 1, mid = (lo + hi) / 2;
  const blo = lerp(mid, lo, gr), bhi = lerp(mid, hi, gr), wl = lerp(mid, Math.min(k.l + dz, blo), gr), wh = lerp(mid, Math.max(k.h + dz, bhi), gr);
  const faces = [tone(main, .22), main, tone(main, -.36)], wick = [tone(main, .1), tone(main, -.2), tone(main, -.2)], m = WK / 2;
  const A = o.a ?? 1;
  g.globalAlpha = A;
  if (wl < blo) box(I, k.x - m, -m, wl, WK, WK, blo - wl, wick, {grain: 0, edge: 0});
  box(I, k.x - d, -d, blo, BW, BW, Math.max(bhi - blo, .04), faces, {grain: .24, edge: A < .99 ? 0 : tone(main, .42)});
  g.globalAlpha = A;                                        // box() возвращает прозрачность к 1 после рёбер
  if (wh > bhi) box(I, k.x - m, -m, bhi, WK, WK, wh - bhi, wick, {grain: 0, edge: 0});
  g.globalAlpha = 1;
}

// Прозрачность свечи в третьей сцене: её вес в фильтре на «текущем уровне»
function weightA(i, t) {
  if (t < e("c_s1") || t >= e("d_move") + .6 || i > REF3) return 1;
  const j = REF3 - i, s1 = eio(pg(t, e("c_s1"), .6)), s2 = eio(pg(t, e("c_s2"), .6)), back_ = eio(pg(t, e("c_calm") + .2, .8));
  const age = j < NW ? wAge(j) : 0, dist = wDist(CLOSE[i], refOf(REF3));
  const a = lerp(1, lerp(.25 + .75 * age, .1 + .9 * age * dist, s2), s1);
  return lerp(a, 1, back_);
}

function meltOf(i, t) {                                     // свечи старого уровня оседают и тают
  if (t < e("c_melt") || t >= e("d_move") + .6 || i > REF3 || i < RIDGE_N) return 0;
  if (wDist(CLOSE[i], refOf(REF3)) > .15) return 0;
  return eio(pg(t, e("c_melt") + (REF3 - i) * .03, .9)) * (1 - eio(pg(t, e("c_calm") + .2, .8)));
}

function candlesA(I, t) {
  const n = shownN(t);
  for (const k of CANDLES) {
    const q = clamp(n - k.i);
    if (q <= 0) continue;
    const P = I.p(k.x, 0, k.c);
    if (P[0] < -90 || P[0] > W + 90) continue;
    const melt = meltOf(k.i, t), o = {grow: back(q), a: weightA(k.i, t) * (1 - .55 * melt), dz: -.35 * melt};
    if (melt > 0) o.col = blend(k.c >= k.o ? C.rise : C.fall, C.grey, melt);
    if (k.i === FORM && t >= e("d_close") - .3 && t < e("d_four")) o.c = k.c + .32 * Math.sin((t - e("d_close")) * 7.5) * (1 - pg(t, e("d_four") - .5, .5));
    candle3D(I, k, o);
  }
}

// Ломаная по точкам мира с подсветкой
function worldLine(I, pts, col, wd, glow = 14, a = 1, cols = null) {
  if (pts.length < 2 || a <= 0) return;
  g.save();
  g.globalAlpha = a;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.lineWidth = wd;
  if (!cols) {
    g.shadowColor = col;
    g.shadowBlur = glow;
    g.beginPath();
    pts.forEach((P, k) => k ? g.lineTo(P[0], P[1]) : g.moveTo(P[0], P[1]));
    g.strokeStyle = col;
    g.stroke();
  } else {
    for (let k = 1; k < pts.length; k++) {                  // по отрезкам: цвет у каждого свой
      g.shadowColor = cols[k];
      g.shadowBlur = glow;
      g.beginPath();
      g.moveTo(pts[k - 1][0], pts[k - 1][1]);
      g.lineTo(pts[k][0], pts[k][1]);
      g.strokeStyle = cols[k];
      g.stroke();
    }
  }
  g.restore();
}

const seriesPts = (I, arr, a, b, y = LY) => {
  const out = [];
  const bi = Math.floor(b), f = b - bi;
  for (let i = a; i <= Math.min(bi, NC - 1); i++) out.push(I.p(xOf(i), y, arr[i]));
  if (f > 0 && bi + 1 < NC) out.push(I.p(lerp(xOf(bi), xOf(bi + 1), f), y, lerp(arr[bi], arr[bi + 1], f)));
  return out;
};

function smaLine(I, t, n) {
  if (t < e("b_avg") || t >= e("d_move") + .5) return null;
  const a = (1 - eio(pg(t, e("d_move"), .45))) * lerp(1, .45, eio(pg(t, e("c_line"), .6)));
  const upto = Math.min(n - 1, lerp(13, n - 1, eo3(pg(t, e("b_avg"), .7))));
  const pts = seriesPts(I, SMA, 13, upto);
  worldLine(I, pts, "#C9C6D2", 7, 10, a);
  return pts;
}

function gapFill(I, t, n) {                                 // красный зазор: средняя ещё вверху, свечи уже внизу
  if (t < e("b_pull") || t >= e("c_calm") + .6) return;
  const a = eio(pg(t, e("b_pull"), .5)) * (1 - eio(pg(t, e("c_line"), .8)) * .6) * (1 - eio(pg(t, e("c_calm"), .5)));
  const b = Math.min(n - 1, REF3 + 2);
  if (b <= PEAK2 + 1) return;
  const top = seriesPts(I, SMA, PEAK2, b), bot = seriesPts(I, CLOSE, PEAK2, b).reverse();
  g.save();
  g.globalAlpha = a * (.42 + .1 * Math.sin(t * 6));
  path([...top, ...bot]);
  g.fillStyle = C.fall;
  g.fill();
  g.restore();
}

function trendCol(i, t) {
  const tr = TREND[i] > 0 ? C.rise : C.fall, x = t >= BACK ? 1 : eio(pg(t, e("d_up") - .1, .4));
  return blend(C.amber, tr, x);
}

function bfLine(I, t, n) {
  const m = bfN(t, n);
  if (m <= RIDGE_N - 1) return;
  const pts = seriesPts(I, BF, RIDGE_N - 1, m), cols = pts.map((_, k) => trendCol(Math.min(NC - 1, RIDGE_N - 1 + k), t));
  worldLine(I, pts, C.amber, 9, 22, 1, cols);
}

// ---------- метки сцен 2–5 и 7 ----------

const atBF = (I, i, dz = 0) => I.p(xOf(i), LY, BF[i] + dz);

function iconArrow(dir, col) { return (x, y, r) => arrowUp(x, y + r * .08, r * .95, col, dir); }

function labels(I, t) {
  if (t >= e("b_avg") && t < e("c_line") + .3) {            // «СРЕДНЯЯ» над хвостом серой линии
    const i = clamp(Math.floor(shownN(t)) - 2, 14, REF3), P = I.p(xOf(i), LY, SMA[i] + .45);
    g.save();
    g.globalAlpha = 1 - pg(t, e("c_line"), .3);
    tag(tx("b_avg"), P[0], P[1] - 70, t, e("b_avg"), "#C9C6D2", {size: 44, tail: true});
    g.restore();
  }
  if (t >= e("d_up") && t < e("e_move") + .4) {
    const P = atBF(I, LONG4 + 3, .5), q = 1 - pg(t, e("e_move"), .3);
    g.save();
    g.globalAlpha = q;
    tag(tx("d_up"), P[0] - 30, P[1] - 80, t, e("d_up"), C.rise, {size: 48, tail: true, icon: iconArrow(-1, C.bg)});
    if (t >= e("d_flip")) {                                 // лонг зачёркнут
      const wd = widthOf(tx("d_up"), 48) + 48 * .55 * 2 + 72 * .32 * 2 + 48 * .55 * .3;
      g.save();
      g.globalAlpha = q * .95;
      cross(P[0] - 30, P[1] - 80 + 36, wd * .42, pg(t, e("d_flip"), .35), C.fall, 9);
      g.restore();
    }
    if (t >= e("d_short")) {
      const S = atBF(I, SHORT4 + 1, -.55);
      tag(tx("d_short"), S[0] + 40, S[1] + 40, t, e("d_short"), C.fall, {size: 48, icon: iconArrow(1, C.white), tc: C.white});
    }
    g.restore();
  }
  if (t >= e("d_close") - .3 && t < e("e_move") + .4) {      // часы над свечой: решение только на закрытой свече
    const k = CANDLES[FORM], P = I.p(k.x, 0, Math.max(k.h, k.o + .5) + .9), q = back(pg(t, e("d_close") - .3, .3)) * (1 - eio(pg(t, e("e_move"), .3)));
    const p = pg(t, e("d_close"), e("d_four") - e("d_close"));
    clockAt(P[0], P[1] - 40, 70, q, p, p * TURN);
    if (t >= e("d_four")) {
      const f = Math.exp(-(t - e("d_four")) * 4);
      g.strokeStyle = rgba(C.amber, f);
      g.lineWidth = 6;
      g.beginPath();
      g.arc(P[0], P[1] - 40, 70 + 60 * (1 - f), 0, 7);
      g.stroke();
    }
  }
  if (t >= e("e_move") && t < e("f_wipe")) protection(I, t);
  if (t >= e("g_wipe")) chopMarks(I, t);
}

// Стоп: от входа вниз три размаха свечи, на конце красная линия
function protection(I, t) {
  const i = LONG4, z0 = CLOSE[i], xr = xOf(i) + DX * 1.4, a = pg(t, e("e_move") + .5, .4);
  const E = I.p(xOf(i), LY, z0);
  g.save();
  g.globalAlpha = a;
  g.setLineDash([12, 10]);
  line(E, I.p(xr + .3, LY, z0), C.white, 3);
  g.setLineDash([]);
  diamond(E[0], E[1], 13, C.white);
  g.restore();
  const segs = [e("e_r1"), e("e_r2"), e("e_r3")];
  segs.forEach((s, k) => {
    if (t < s) return;
    const q = eo5(pg(t, s, .28)), A = I.p(xr, LY, z0 - RNG * k), B = I.p(xr, LY, z0 - RNG * (k + q));
    g.save();
    g.globalAlpha = .28 * q;                                // призрак свечи: такой же размах
    box(I, xr - .5 - BW / 2, -BW / 2, z0 - RNG * (k + q), BW, BW, RNG * q, C.amber, {grain: 0, edge: 0});
    g.restore();
    line(A, B, C.amber, 7, "butt");
    line([A[0] - 16, A[1]], [A[0] + 16, A[1]], C.amber, 5);
    if (q >= 1) line([B[0] - 16, B[1]], [B[0] + 16, B[1]], C.amber, 5);
  });
  if (t >= e("e_ruler")) {
    const M = I.p(xr, LY, z0 - RNG * 1.5);
    tag(tx("e_ruler"), M[0] + 34, M[1] - 33, t, e("e_ruler"), C.amber, {size: 42, align: "left"});
  }
  if (t >= e("e_lock")) {
    const zs = z0 - RNG * 3, f = Math.exp(-(t - e("e_lock")) * 4), p = eo5(pg(t, e("e_lock"), .35));
    const A = I.p(xOf(i) - 1.3, LY, zs), B = I.p(lerp(xOf(i) - 1.3, xr + .6, p), LY, zs);
    g.save();
    g.shadowColor = C.fall;
    g.shadowBlur = 22 + 40 * f;
    line(A, B, C.fall, 8 + 6 * f, "butt");
    g.restore();
    tag(tx("e_lock"), A[0] + 10, A[1] + 18, t, e("e_lock"), C.fall, {size: 46, align: "left", tc: C.white});
  }
  if (t >= e("e_risk")) riskGauge(t);
}

// Шкала риска сбоку: из пятидесяти делений горит одно
function riskGauge(t) {
  const q = back(pg(t, e("e_risk"), .35)) * (1 - eio(pg(t, e("f_wipe") - .35, .3)));
  if (q <= 0) return;
  const x = 930, y0 = 640, hh = 640, n = 50, cw = 74;
  resetCam();
  g.save();
  g.translate(x, y0 + hh / 2);
  g.scale(q, q);
  g.translate(-x, -y0 - hh / 2);
  g.fillStyle = rgba(C.ink, .82);
  g.beginPath();
  g.roundRect(x - cw / 2 - 12, y0 - 12, cw + 24, hh + 24, 14);
  g.fill();
  for (let k = 0; k < n; k++) {
    const y = y0 + k * hh / n, lit = k === 0, f = lit ? .6 + .4 * Math.sin((t - e("e_risk")) * 8) : 0;
    g.fillStyle = lit ? blend(C.fall, C.white, .2 * f) : rgba(C.white, .16);
    g.fillRect(x - cw / 2, y + 2, cw, hh / n - 4);
  }
  g.restore();
  tag(tx("e_risk"), x - cw / 2 - 26, y0 - 26, t, e("e_risk") + .15, C.fall, {size: 44, align: "right", tc: C.white});
}

// Боковик: коридор, развороты линии и вспышки стопов
function chopMarks(I, t) {
  const z = 3.67, A = I.p(xOf(CHOP[0] - 1), LY, z), n = shownN(t), xb = xOf(Math.min(CHOP[1] + 1, Math.max(CHOP[0], n)));
  if (t < e("g_big") + 1.2) {
    g.save();
    g.globalAlpha = 1 - pg(t, e("g_big") + .6, .5);
    g.setLineDash([16, 12]);
    for (const dz of [-.95, .95]) line(I.p(xOf(CHOP[0] - 1), LY + .02, z + dz), I.p(xb, LY + .02, z + dz), rgba(C.white, .55), 4, "butt");
    g.setLineDash([]);
    g.restore();
  }
  for (const i of CHOP_FLIPS) {                             // ромбик на каждом развороте линии
    if (n < i + 1) continue;
    const P = atBF(I, i), q = back(clamp((n - i - 1) * 3));
    diamond(P[0], P[1], 14 * q, TREND[i] > 0 ? C.rise : C.fall);
  }
  CHOP_FLIPS.slice(0, 4).forEach((i, k) => {                // стопы вспыхивают один за другим
    const s = e(`g_s${k + 1}`);
    if (t < s || t > s + 1.4) return;
    const f = Math.exp(-(t - s) * 3), zs = TREND[i - 1] > 0 ? BF[i] - .75 : BF[i] + .75, a = 1 - pg(t, s + 1, .4);
    const P = I.p(xOf(i) - .6, LY, zs), Q = I.p(xOf(i) + .6, LY, zs);
    g.save();
    g.globalAlpha = a;
    g.shadowColor = C.fall;
    g.shadowBlur = 20 + 40 * f;
    line(P, Q, C.fall, 8 + 8 * f, "butt");
    g.restore();
    g.save();
    g.globalAlpha = a;
    tag("СТОП", (P[0] + Q[0]) / 2, P[1] - (zs > BF[i] ? 84 : -24), t, s, C.fall, {size: 42, tc: C.white});
    g.restore();
  });
}

// ---------- часы: без цифр, риски, стрелка и заполненный сектор ----------

const TURN = Math.PI * 2;

function clockAt(cx, cy, cr, q, p, ang) {
  if (q <= 0) return;
  g.save();
  g.translate(cx, cy);
  g.scale(q, q);
  g.fillStyle = "rgba(10,8,14,.55)";
  g.beginPath();
  g.arc(-6, 8, cr + 5, 0, 7);
  g.fill();
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(0, 0, cr, 0, 7);
  g.fill();
  if (p > 0) {
    g.fillStyle = rgba(C.amber, .9);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, cr - 10, -Math.PI / 2, -Math.PI / 2 + p * TURN);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = C.white;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, cr, 0, 7);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TURN;
    line([Math.sin(a) * (cr - 14), -Math.cos(a) * (cr - 14)], [Math.sin(a) * (cr - 6), -Math.cos(a) * (cr - 6)], C.white, i % 3 ? 2.5 : 5);
  }
  line([0, 0], [Math.sin(ang) * (cr - 18), -Math.cos(ang) * (cr - 18)], C.white, 7);
  g.fillStyle = C.coral;
  g.beginPath();
  g.arc(0, 0, 9, 0, 7);
  g.fill();
  g.restore();
}

// ---------- ползунки третьей сцены: возраст и расстояние ----------

function slider(k, y, t, u0, u1) {
  const t0 = e(k), q = back(pg(t, t0, .32)) * (1 - eio(pg(t, e("c_calm") - .1, .3)));
  if (q <= 0) return;
  const x = NOTE, w = 952, h = 104, tx0 = x + 430, tw = 470, u = lerp(u0, u1, eio(pg(t, t0 + .25, .6)));
  resetCam();
  g.save();
  g.translate(x, y + h / 2);
  g.scale(q, q);
  g.translate(-x, -y - h / 2);
  g.fillStyle = rgba(C.ink, .84);
  g.beginPath();
  g.roundRect(x, y, w, h, 16);
  g.fill();
  text(tx(k), x + 30, y + h / 2 + 16, 44, C.white);
  g.fillStyle = rgba(C.white, .2);
  g.beginPath();
  g.roundRect(tx0, y + h / 2 - 7, tw, 14, 7);
  g.fill();
  g.fillStyle = C.amber;
  g.beginPath();
  g.roundRect(tx0, y + h / 2 - 7, tw * u, 14, 7);
  g.fill();
  g.beginPath();
  g.arc(tx0 + tw * u, y + h / 2, 24, 0, 7);
  g.fill();
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(tx0 + tw * u, y + h / 2, 10, 0, 7);
  g.fill();
  g.restore();
}

// ---------- мир A целиком ----------

function worldA(t) {
  const shake = .9 * wob(t - e("a_chart"), 6, 7) + 1.2 * wob(t - e("b_turn"), 5, 6) + .8 * wob(t - e("d_flip"), 5, 6) + .9 * wob(t - e("e_lock"), 6, 7)
    + [1, 2, 3, 4].reduce((s, k) => s + .6 * wob(t - e(`g_s${k}`), 6, 7), 0);
  const V = viewOf(shotA, t, shake), I = V.I, n = shownN(t), mix = photoMix(t);
  const pulse = t >= e("a_strat") && t < BACK ? .25 * Math.exp(-(t - e("a_strat")) * 3) : 0;
  sky(V, t, pulse + (t >= e("b_turn") ? .15 * Math.exp(-(t - e("b_turn")) * 3) : 0));
  floorA(I);
  photo(I, t, mix);
  edgeGlint(I, t);
  candlesA(I, t);
  gapFill(I, t, n);
  smaLine(I, t, n);
  bfLine(I, t, n);
  ridgeLine(I, t, mix);
  floorFront(I);
  return V;
}

function sceneA(t) {
  const V = worldA(t), I = V.I;
  foreground(V.v, t, .4);
  resetCam();
  labels(I, t);
  resetCam();
  const hook = tx("a_hook"), hs = fitSize(hook, 112);
  reveal(hook, NOTE, 300, hs, C.white, t, -10, {off: e("b_move") - .15, block: C.coral, lh: hs * 1.17});
  note("b_late", NOTE, 300, fitSize(tx("b_late"), 92), C.white, t, {off: e("c_s1") - .15, block: C.fall, lh: 104});
  slider("c_s1", 540, t, .15, .72);
  slider("c_s2", 664, t, .15, .82);
  note("c_t1", NOTE, 300, fitSize(tx("c_t1"), 100), C.white, t, {off: e("d_move") - .15, block: C.teal, lh: 112});
  note("d_close", NOTE, 300, 96, C.white, t, {off: e("e_move") - .15, block: C.amber, lh: 108});
  if (t >= e("g_wipe")) {
    note("g_t", NOTE, 300, fitSize(tx("g_t"), 100), C.white, t, {off: e("g_big") + .6, block: C.fall, lh: 112});
    if (t >= e("g_norm") && t < e("g_big") + 1) {           // серия крестиков: ошибки подряд — это нормально
      const a = 1 - pg(t, e("g_big") + .5, .4);
      g.save();
      g.globalAlpha = a;
      for (let k = 0; k < 5; k++) {
        const p = pg(t, e("g_norm") + k * .12, .3);
        if (p > 0) cross(NOTE + 34 + k * 92, 560, 26, p, C.fall, 11);
      }
      g.restore();
    }
  }
  if (t >= e("h_title") - .3) summary(t);
}

function fitSize(s, max) {
  const wd = Math.max(...s.split("\n").map(r => widthOf(r, 100)));
  return Math.min(max, 100 * (W - NOTE * 2) / wd);
}

// Итоговая карточка: название и три пункта; к стыку петли всё уходит
function summary(t) {
  const off = BACK - .1, a = eio(pg(t, e("h_title") - .3, .4)) * (1 - eio(pg(t, off, .3)));
  if (a > 0) {
    g.fillStyle = rgba(C.bg, .55 * a);
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = rgba(C.ink, .86);
    g.beginPath();
    g.roundRect(36, 196, W - 72, 760, 26);
    g.fill();
    g.strokeStyle = rgba(C.amber, .5);
    g.lineWidth = 3;
    g.stroke();
    g.restore();
  }
  const ts = fitSize(tx("h_title"), 104);
  note("h_title", NOTE + 14, 330, ts, C.amber, t, {off, block: C.white, lh: ts * 1.1});
  const s = Math.min(66, fitSize([tx("h_1"), tx("h_2"), tx("h_3")].join("\n"), 66) * .98);
  note("h_1", NOTE + 14, 620, s, C.white, t, {off, block: C.rise});
  note("h_2", NOTE + 14, 730, s, C.white, t, {off, block: C.amber});
  note("h_3", NOTE + 14, 840, s, C.white, t, {off, block: C.fall});
  note("h_note", W / 2, 1650, 34, C.grey, t, {off, align: "center", block: C.grey, lh: 42});
  if (t >= BACK + .3) {                                     // петля: крючок снова на месте к последнему кадру
    const hook = tx("a_hook"), hs = fitSize(hook, 112);
    reveal(hook, NOTE, 300, hs, C.white, t, BACK + .32, {block: C.coral, lh: hs * 1.17});
  }
}

// ---------- мир B: десять квадратиков и два столбика ----------

const SQ = 10, GREEN = [1, 4, 8], CUBE = .72, GAP = .96;
const COLS = [{x: 2.6, h: 3.0, col: C.rise}, {x: 4.9, h: 1.0, col: C.fall}];

const PROPS_B = (() => {
  const r = rng(97), out = [];
  for (let i = 0; i < 18; i++) out.push({x: -5 + i * 1.2 + r() * .5, y: -5.4 + r() * 1.3, w: .14 + r() * .22, d: .14 + r() * .22, h: .1 + r() * .5, col: [C.navy, C.teal, C.plate2, C.sky2][i % 4]});
  return out.sort((a, b) => a.y - b.y);
})();

function floorB(I) {
  const P = (x, y) => I.p(x, y, 0);
  poly([P(-20, -8), P(30, -8), P(30, 20), P(-20, 20)], "#2E3244");
  g.globalAlpha = .09;
  for (let x = -20; x <= 30; x += .8) line(P(x, -8), P(x, 20), C.white, 1);
  for (let y = -7.6; y <= 20; y += .8) line(P(-20, y), P(30, y), C.white, 1);
  g.globalAlpha = 1;
  for (const k of PROPS_B) box(I, k.x, k.y, 0, k.w, k.d, k.h, k.col, {grain: .2});
}

function columns(I, t) {
  if (t < e("f_cols") - .2) return;
  COLS.forEach((c, k) => {
    const grow = eio(pg(t, e("f_cols"), k === 0 ? 1.5 : .5)), h = Math.max(.05, c.h * grow);
    floorShadow(I, c.x, -2.6, 1.3, 1.3, .3, .3, .2);
    box(I, c.x, -2.6, 0, 1.3, 1.3, .12, [tone(C.plate2, .1), C.plate, tone(C.plate, -.3)], {grain: .2});
    box(I, c.x + .1, -2.5, .12, 1.1, 1.1, h, tri(c.col), {grain: .25});
    if (k === 1 && t >= e("f_cut")) {                       // стоп срезает убыток: красная планка сверху
      const p = eo5(pg(t, e("f_cut"), .3)), f = Math.exp(-(t - e("f_cut")) * 4);
      box(I, c.x - .05, -2.55, .12 + h + lerp(1.2, .02, p), 1.4, 1.2, .1, [tone(C.fall, .3 + .4 * f), C.fall, tone(C.fall, -.3)], {grain: 0});
    }
    if (k === 0 && t >= e("f_hold")) {
      const f = .55 + .45 * Math.sin((t - e("f_hold")) * 5), P = I.p(c.x + .65, -1.95, .12 + h);
      g.save();
      g.globalAlpha = f * eio(pg(t, e("f_hold"), .4));
      g.shadowColor = C.rise;
      g.shadowBlur = 50;
      path([I.p(c.x + .1, -1.4, .12), I.p(c.x + 1.2, -1.4, .12), I.p(c.x + 1.2, -1.4, .12 + h), I.p(c.x + .1, -1.4, .12 + h)]);
      g.strokeStyle = C.rise;
      g.lineWidth = 7;
      g.stroke();
      g.restore();
      for (let i = 0; i < 6; i++) {
        const u = ((t - e("f_hold")) * .5 + i / 6) % 1, Q = I.p(c.x + .2 + (i * .31) % .9, -1.4, .3 + u * (h + .6));
        g.fillStyle = rgba(C.rise, .8 * (1 - u));
        g.fillRect(Q[0] - 4, Q[1] - 4, 8, 8);
      }
    }
  });
}

function squares(I, t) {
  for (let k = 0; k < SQ; k++) {
    const t0 = e("f_sq") + .14 * k, on = t >= t0, ok = GREEN.includes(k), p = on ? back(pg(t, t0, .3)) : 0;
    const col = on ? (ok ? C.rise : C.grey) : C.plate2, lift = ok ? .18 * p : 0, x = k * GAP;
    floorShadow(I, x, 0, CUBE, CUBE, .3, .25, .2);
    box(I, x, 0, lift, CUBE, CUBE, CUBE, tri(blend(C.plate2, col, on ? clamp(p) : 0)), {grain: .25});
    if (ok && on) {
      const f = Math.exp(-(t - t0) * 3);
      if (f > .02) {
        const P = I.p(x + CUBE / 2, CUBE / 2, lift + CUBE * 1.1);
        g.strokeStyle = rgba(C.rise, f);
        g.lineWidth = 6;
        g.beginPath();
        g.arc(P[0], P[1], 40 + 90 * (1 - f), 0, 7);
        g.stroke();
      }
    }
  }
}

function sceneB(t) {
  const V = viewOf(shotB, t, .8 * wob(t - e("f_t2"), 5, 6) + .6 * wob(t - e("f_cut"), 6, 7)), I = V.I;
  sky(V, t, t >= e("f_t2") ? .2 * Math.exp(-(t - e("f_t2")) * 3) : 0);
  floorB(I);
  columns(I, t);
  squares(I, t);
  foreground(V.v, t, .4);
  resetCam();
  note("f_t1", NOTE, 300, fitSize(tx("f_t1"), 96), C.white, t, {block: C.rise, lh: 108});
  note("f_t2", NOTE, 540, fitSize(tx("f_t2"), 96), C.amber, t, {block: C.white, lh: 108});
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

OVERLAYS.push(t => { chWipe(t, e("f_wipe")); chWipe(t, e("g_wipe")); });

function drawAll(t) {
  if (t >= e("f_wipe") && t < e("g_wipe")) sceneB(t);
  else sceneA(t);
}

for (let k = 1; k <= 8; k++) SC[k] = {draw: drawAll};

BLUR_EV.push(["a_morph", -.1, 1.3, 4], ["b_move", 0, 1.1, 5], ["b_turn", -.1, .7, 4], ["c_line", 0, .8, 4], ["c_calm", -.2, 1.2, 4],
  ["d_move", 0, 1.1, 5], ["d_flip", -.1, .6, 4], ["e_move", 0, 1, 4], ["f_wipe", -.26, .32, 10], ["f_sq", .2, 1.5, 4],
  ["g_wipe", -.26, .32, 10], ["g_big", 0, 1.8, 4], ["z_back", 0, HOME - BACK + .05, 10]);
