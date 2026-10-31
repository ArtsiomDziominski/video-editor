"use strict";
// Холст моушен-урока. Кадр — чистая функция времени, поэтому куски ролика считаются параллельно и не расходятся.
// Мир задан в трёх осях (Iso), камера — поворот, наезд и панорама. Сцены лежат в episode<номер>*.js.
const W = 1920, H = 1080;
const cv = document.getElementById("c");
const g = cv.getContext("2d", {alpha: false, willReadFrequently: true});
const acc = document.createElement("canvas");
acc.width = W; acc.height = H;
const ag = acc.getContext("2d", {alpha: false, willReadFrequently: true});

let D = null, E = {}, TX = {};
const SC = {};        // номер сцены → {draw(t, a, b)}
const BLUR = [];      // окна размытия движения [от, до, подкадров]
const BLUR_EV = [];   // то же от событий: [событие, от, до, подкадров]

const C = {
  bg: "#1E1C26", bg2: "#26242F", plate: "#34323E", plate2: "#45424F", ink: "#15131B", white: "#F7F3EE", cream: "#ECC5BB",
  crim: "#E72959", crim2: "#F03766", red: "#BE1622", red2: "#AD0821", coral: "#E64D3F", navy: "#1F3A63", navy2: "#152A4A",
  sky: "#2F9FE4", sky2: "#1E7CC0", teal: "#7DBFC9", amber: "#FFB52E", amber2: "#E8930C", tan: "#E9C996", tan2: "#C99F66",
  green: "#18B566", green2: "#0E8A4C", green3: "#0A6B3A", grey: "#8C8996", rise: "#2BD37F", fall: "#F03766",
};

// ---------- время ----------

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, x) => a + (b - a) * x;
const pg = (t, a, d) => clamp((t - a) / d);
const eo3 = x => 1 - (1 - x) ** 3;
const eo5 = x => 1 - (1 - x) ** 5;
const ei3 = x => x ** 3;
const eio = x => x < .5 ? 4 * x ** 3 : 1 - (2 - 2 * x) ** 3 / 2;
const back = x => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const spring = (dt, f = 2.2, d = 5) => dt <= 0 ? 0 : 1 - Math.exp(-d * dt) * Math.cos(2 * Math.PI * f * dt);
const wob = (dt, f = 3, d = 5) => dt <= 0 ? 0 : Math.exp(-d * dt) * Math.sin(2 * Math.PI * f * dt);

function e(k) {
  const v = E[k];
  if (v === undefined) throw new Error("нет события " + k);
  return v;
}

function tx(k) {
  const v = TX[k];
  if (v === undefined) throw new Error("нет надписи " + k);
  return v;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- цвет ----------

const TONES = new Map();

function tone(hex, f) {   // f > 0 к белому, f < 0 к чёрному
  const key = hex + f;
  if (TONES.has(key)) return TONES.get(key);
  const n = parseInt(hex.slice(1), 16), to = f > 0 ? 255 : 18, a = Math.abs(f);
  const ch = s => Math.round(lerp((n >> s) & 255, to, a));
  const out = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  TONES.set(key, out);
  return out;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const tri = hex => [tone(hex, .14), hex, tone(hex, -.34)];

// ---------- изометрия ----------

class Iso {
  constructor(ox, oy, s, th = 45, k = .56, c = .84) {
    const a = th * Math.PI / 180;
    Object.assign(this, {ox, oy, s, k, c, cos: Math.cos(a), sin: Math.sin(a)});
  }

  p(x, y, z = 0) {
    return [this.ox + (x * this.cos - y * this.sin) * this.s,
      this.oy + (x * this.sin + y * this.cos) * this.k * this.s - z * this.c * this.s];
  }
}

function path(pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

function poly(pts, fill) {
  path(pts);
  g.fillStyle = fill;
  g.fill();
}

function line(a, b, col, w = 2, cap = "round") {
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = cap;
  g.stroke();
}

// Зернистая тень: точки густеют к концу, как штриховка в референсе.
const RAMPS = {};

function makeRamps() {
  for (const [name, col] of [["d", [12, 10, 18]], ["l", [255, 244, 236]]]) {
    RAMPS[name] = [128, 256, 512, 1024].map(L => {
      const c = document.createElement("canvas");
      c.width = L; c.height = 512;
      const x = c.getContext("2d"), img = x.createImageData(L, 512), r = rng(L + name.charCodeAt(0));
      for (let j = 0; j < 512; j++) {
        for (let i = 0; i < L; i++) {
          const on = r() < (i / L) ** 1.5 * .95, a = on ? 255 : 0, o = (j * L + i) * 4;
          img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = a;
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    });
  }
}

function shade(pts, a, b, strength = .5, kind = "d") {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 4) return;
  const set = RAMPS[kind], img = set.find(c => c.width >= len) || set[3];
  g.save();
  path(pts);
  g.clip();
  g.translate(a[0], a[1]);
  g.rotate(Math.atan2(dy, dx));
  g.scale(len / img.width, 1);
  g.globalAlpha = strength;
  const hh = 2400;
  for (let y = -hh; y < hh; y += 512) g.drawImage(img, 0, y);
  g.restore();
}

// Параллелепипед: верх, грань к +y (левая), грань к +x (правая)
function box(I, x, y, z, w, d, h, col, o = {}) {
  const [top, left, right] = Array.isArray(col) ? col : tri(col);
  const P = (a, b, c) => I.p(x + a, y + b, z + c);
  const L = [P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h)];
  const R = [P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h)];
  const T = [P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)];
  if (h > 0) {
    poly(L, left);
    poly(R, right);
    if (o.grain !== 0 && h * I.s * I.c > 26) {
      const k = o.grain ?? .2;
      shade(L, P(w / 2, d, h), P(w / 2, d, 0), k);
      shade(R, P(w, d / 2, h), P(w, d / 2, 0), k);
    }
  }
  poly(T, top);
  if (o.topShade) shade(T, P(0, 0, h), P(w, d, h), o.topShade);
  if (o.edge !== 0 && h > 0) {
    const ec = o.edge || tone(Array.isArray(col) ? col[1].startsWith("#") ? col[1] : C.plate : col, .32);
    g.globalAlpha = .55;
    line(P(0, d, h), P(w, d, h), ec, 1.4);
    line(P(w, 0, h), P(w, d, h), ec, 1.4);
    g.globalAlpha = 1;
  }
}

function floorShadow(I, x, y, w, d, a = .3, sx = .5, sy = .5) {
  poly([I.p(x + sx, y + sy), I.p(x + w + sx, y + sy), I.p(x + w + sx, y + d + sy), I.p(x + sx, y + d + sy)], rgba("#0C0A12", a));
}

// Плашка на плоскости мира: рисуем в локальных единицах (100 = одна клетка мира)
function onWallX(I, x, y0, z0, fn) {     // стена вдоль оси y, смотрит на +x; u идёт от +y к -y
  const A = I.p(x, y0, z0), U = I.p(x, y0 - .01, z0), V = I.p(x, y0, z0 - .01);
  g.save();
  g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
  fn();
  g.restore();
}

function onWallY(I, x0, y, z0, fn) {     // стена вдоль оси x, смотрит на +y
  const A = I.p(x0, y, z0), U = I.p(x0 + .01, y, z0), V = I.p(x0, y, z0 - .01);
  g.save();
  g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
  fn();
  g.restore();
}

function onFloor(I, x0, y0, z, fn) {     // пол: u вдоль +x, v вдоль +y
  const A = I.p(x0, y0, z), U = I.p(x0 + .01, y0, z), V = I.p(x0, y0 + .01, z);
  g.save();
  g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
  fn();
  g.restore();
}

// Цветное пятно на полу с неровным краем — как разлитый цвет в референсе
function pool(I, x, y, r, col, seed, t, o = {}) {
  const n = 64, pts = [], rr = o.grow ?? 1, ry = o.ry ?? 1;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const q = 1 + .05 * Math.sin(3 * a + seed) + .035 * Math.sin(7 * a + seed * 2 + t * .4) + .018 * Math.sin(13 * a + seed * 3 - t * .7);
    pts.push(I.p(x + Math.cos(a) * r * q * rr, y + Math.sin(a) * r * q * rr * ry));
  }
  poly(pts, col);
  shade(pts, I.p(x + r, y - r), I.p(x - r * .6, y + r * .7), .3);
}

function plate(I, x, y, w, d, col = C.plate, h = .22) {
  box(I, x, y, -h, w, d, h, [col, tone(col, -.2), tone(col, -.42)], {grain: 0, edge: 0});
}

// ---------- камера ----------

function camera(t, list) {
  const keys = list.slice().sort((p, q) => p[0] - q[0]);   // опорные слова могут поменяться местами после правки текста
  let k = 0;
  while (k < keys.length - 1 && t >= keys[k + 1][0]) k++;
  const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)];
  const x = b === a ? 1 : eio(clamp((t - a[0]) / (b[0] - a[0])));
  return {x: lerp(a[1], b[1], x) + Math.sin(t * .23) * 9, y: lerp(a[2], b[2], x) + Math.sin(t * .31 + 1) * 6,
    z: lerp(a[3], b[3], x) * (1 + Math.sin(t * .17) * .006), th: lerp(a[4], b[4], x) + Math.sin(t * .13) * 1.2};
}

function applyCam(v, focusX = 610, focusY = 540) {
  g.setTransform(v.z, 0, 0, v.z, focusX - v.x * v.z, focusY - v.y * v.z);
}

const resetCam = () => g.setTransform(1, 0, 0, 1, 0, 0);

// Дальний план: пылинки, короткие штрихи; медленнее сцены — отсюда глубина
const SPECKS = (() => {
  const r = rng(7), out = [];
  for (let i = 0; i < 190; i++) {
    out.push({x: r() * 2600 - 340, y: r() * 1500 - 210, s: 1 + r() * 2.1, d: .16 + r() * .38, tw: r() * 6.3, kind: r() < .12 ? 1 : 0, a: r() * 3.14});
  }
  return out;
})();

function backdrop(v, t, glow = null, o = {}) {
  resetCam();
  g.fillStyle = o.bg || C.bg;
  g.fillRect(0, 0, W, H);
  if (glow) {
    const gx = 610 - (v.x - 610) * .4, gy = 560 - (v.y - 540) * .4;
    const rg = g.createRadialGradient(gx, gy, 60, gx, gy, 780);
    rg.addColorStop(0, rgba(glow, o.glow ?? .17));
    rg.addColorStop(1, rgba(glow, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }
  for (const s of SPECKS) {
    const x = ((s.x - (v.x - 610) * s.d + 160) % 2240 + 2240) % 2240 - 160, y = ((s.y - (v.y - 540) * s.d + 90 + t * 3 * s.d) % 1260 + 1260) % 1260 - 90;
    g.globalAlpha = .28 + .4 * (.5 + .5 * Math.sin(t * .9 + s.tw));
    g.fillStyle = C.white;
    if (s.kind) {
      const dx = Math.cos(s.a) * 7, dy = Math.sin(s.a) * 7;
      line([x - dx, y - dy], [x + dx, y + dy], C.white, 1.3);
    } else g.fillRect(x, y, s.s, s.s);
  }
  g.globalAlpha = 1;
}

// Ближний план: крупные размытые ромбы и штрихи проходят быстрее сцены
const FG = (() => {
  const r = rng(11), out = [];
  for (let i = 0; i < 9; i++) out.push({x: r() * 2400 - 200, y: r() * 1300 - 100, s: 14 + r() * 26, c: [C.coral, C.teal, C.amber, C.white][i % 4], b: r() < .5});
  return out;
})();
const FG_SPR = {};

function makeFg() {
  for (const col of [C.coral, C.teal, C.amber, C.white]) {
    const c = document.createElement("canvas");
    c.width = c.height = 120;
    const x = c.getContext("2d");
    x.filter = "blur(5px)";
    x.fillStyle = col;
    x.translate(60, 60);
    x.rotate(Math.PI / 4);
    x.fillRect(-26, -26, 52, 52);
    FG_SPR[col] = c;
  }
}

function foreground(v, t, o = .55) {
  resetCam();
  g.globalAlpha = o;
  for (const f of FG) {
    const x = ((f.x - (v.x - 610) * 1.5 + 200) % 2300 + 2300) % 2300 - 200, y = ((f.y - (v.y - 540) * 1.5 + 100) % 1280 + 1280) % 1280 - 100;
    if (x > 1160) continue;
    g.drawImage(FG_SPR[f.c], x - f.s, y - f.s, f.s * 2, f.s * 2);
  }
  g.globalAlpha = 1;
}

// Справа сцена уходит под тёмную колонку: там надписи и субтитры
function rightFade(a = 1, bg = C.bg) {
  resetCam();
  const lg = g.createLinearGradient(1130, 0, 1262, 0);
  lg.addColorStop(0, rgba(bg, 0));
  lg.addColorStop(1, rgba(bg, a));
  g.fillStyle = lg;
  g.fillRect(1130, 0, 132, H);
  g.fillStyle = rgba(bg, a);
  g.fillRect(1262, 0, W - 1262, H);
}

// ---------- типографика ----------

const FACE = "Bahnschrift";
const fontOf = (size, w = 700, fam = FACE) => `${w} ${size}px "${fam}"`;

function setFont(size, w, fam, sp = 0) {
  g.font = fontOf(size, w, fam);
  g.letterSpacing = sp + "px";
}

function text(s, x, y, size, col, o = {}) {
  setFont(size, o.w ?? 700, o.fam ?? FACE, o.sp ?? 0);
  g.textAlign = o.align ?? "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = col;
  g.fillText(s, x, y);
  g.letterSpacing = "0px";
}

function widthOf(s, size, o = {}) {
  setFont(size, o.w ?? 700, o.fam ?? FACE, o.sp ?? 0);
  const m = g.measureText(s).width;
  g.letterSpacing = "0px";
  return m;
}

// Надпись открывается цветным блоком: блок вырастает, отступает, а слова поднимаются снизу
function reveal(s, x, y, size, col, t, t0, o = {}) {
  const dt = t - t0;
  if (dt < 0) return 0;
  const off = o.off === undefined ? -1 : t - o.off;
  if (off > .32) return 0;
  const rows = s.split("\n"), lh = o.lh ?? size * 1.16, block = o.block ?? col;
  let bottom = y;
  rows.forEach((row, i) => {
    const tl = dt - i * .08, yy = y + i * lh;
    bottom = yy;
    if (tl <= 0) return;
    const wd = widthOf(row, size, o), a = o.align === "right" ? x - wd : o.align === "center" ? x - wd / 2 : x;
    const p1 = eio(clamp(tl / .24)), p2 = eio(clamp((tl - .2) / .26));
    const top = yy - size * .9, hh = size * 1.1;
    g.save();
    g.beginPath();
    g.rect(a - 6, top - 2, wd + 12, hh + 4);
    g.clip();
    if (off > 0) {
      const q = eio(clamp(off / .3));
      g.fillStyle = col;
      g.globalAlpha = 1;
      g.translate(0, q * size * 1.1);
      text(row, a, yy, size, col, {...o, align: "left"});
    } else if (tl > .16) {
      const q = eo3(clamp((tl - .16) / .3));
      g.save();
      g.translate(0, (1 - q) * size * .7);
      text(row, a, yy, size, col, {...o, align: "left"});
      g.restore();
    }
    if (p2 < 1) {
      g.fillStyle = block;
      g.fillRect(a + wd * p2 - 4, top, (p1 - p2) * wd + 8, hh);
    }
    g.restore();
  });
  return bottom;
}

function note(k, x, y, size, col, t, o = {}) {
  return reveal(tx(k), x, y, size, col, t, e(k), o);
}

// Метка прямо в мире: подложка с хвостиком, буквы выскакивают по одной
function tag(s, x, y, t, t0, col, o = {}) {
  const dt = t - t0;
  if (dt < 0) return;
  const size = o.size ?? 28, tc = o.tc ?? C.bg, wd = widthOf(s, size, o), pad = size * .55, hh = size * 1.5;
  const q = back(clamp(dt / .3)), al = o.align ?? "center";
  const a = al === "center" ? x - wd / 2 - pad : al === "right" ? x - wd - pad * 2 : x;
  g.save();
  g.translate(x, y + hh / 2);
  g.scale(q, q);
  g.translate(-x, -y - hh / 2);
  if (o.tail) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - 9, y + hh - 1);
    g.lineTo(x + 9, y + hh - 1);
    g.lineTo(x, y + hh + 12);
    g.closePath();
    g.fill();
  }
  g.fillStyle = col;
  g.beginPath();
  g.roundRect(a, y, wd + pad * 2, hh, 7);
  g.fill();
  text(s, a + pad, y + hh * .72, size, tc, {...o, align: "left"});
  g.restore();
}

// ---------- значки ----------

function diamond(x, y, r, col) {
  poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], col);
}

function dashedArc(a, b, h, col, phase = 0, w = 3, dash = [12, 11]) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - h;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.quadraticCurveTo(mx, my, b[0], b[1]);
  g.setLineDash(dash);
  g.lineDashOffset = phase;
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = "butt";
  g.stroke();
  g.setLineDash([]);
}

function arcAt(a, b, h, x) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - h, u = 1 - x;
  return [u * u * a[0] + 2 * u * x * mx + x * x * b[0], u * u * a[1] + 2 * u * x * my + x * x * b[1]];
}

function tick(x, y, s, p, col, w = null) {
  const a = [x - s * .6, y + s * .02], b = [x - s * .12, y + s * .5], c = [x + s * .72, y - s * .55], p1 = clamp(p / .35), p2 = clamp((p - .35) / .65);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = col;
  g.lineWidth = w ?? s * .3;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(lerp(a[0], b[0], p1), lerp(a[1], b[1], p1));
  if (p2 > 0) g.lineTo(lerp(b[0], c[0], p2), lerp(b[1], c[1], p2));
  g.stroke();
}

function cross(x, y, s, p, col, w = null) {
  const p1 = clamp(p / .5), p2 = clamp((p - .5) / .5);
  g.lineCap = "round";
  g.strokeStyle = col;
  g.lineWidth = w ?? s * .3;
  g.beginPath();
  g.moveTo(x - s, y - s);
  g.lineTo(lerp(x - s, x + s, p1), lerp(y - s, y + s, p1));
  if (p2 > 0) {
    g.moveTo(x + s, y - s);
    g.lineTo(lerp(x + s, x - s, p2), lerp(y - s, y + s, p2));
  }
  g.stroke();
}

function arrowUp(x, y, s, col, dir = -1) {   // плоская стрелка: dir -1 вверх, 1 вниз
  const q = s * dir;
  poly([[x, y + q], [x + s * .62, y + q * .22], [x + s * .26, y + q * .22], [x + s * .26, y - q * .9], [x - s * .26, y - q * .9], [x - s * .26, y + q * .22], [x - s * .62, y + q * .22]], col);
}

// ---------- свечи ----------

// Точки пути (индекс, цена) → свечи: путь проходит через них, между ними живой шум
function candlesOf(keys, seed, noise = .012, wick = 1) {
  const r = rng(seed), n = keys[keys.length - 1][0], price = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    while (keys[k + 1] && i > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)], x = b[0] === a[0] ? 0 : (i - a[0]) / (b[0] - a[0]);
    const jit = keys.some(q => q[0] === i) ? 0 : (r() - .5) * noise * 2;
    price.push(lerp(a[1], b[1], x) + jit);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = price[i], c = price[i + 1], top = Math.max(o, c), low = Math.min(o, c);
    out.push({o, c, h: top + (r() * .028 + .005) * wick, l: low - (r() * .028 + .005) * wick});
  }
  return out;
}

// Свеча в локальных координатах: тень, тело и светлая полоска слева — плоский трёхцветный объём
function candle(x, w, yo, yc, yh, yl, rise, grow = 1, o = {}) {
  const col = o.col ?? (rise ? C.rise : C.fall), dark = rise ? C.green2 : C.red, mid = (yo + yc) / 2;
  const top = lerp(mid, Math.min(yo, yc), grow), bot = lerp(mid, Math.max(yo, yc), grow), hh = Math.max(bot - top, 2.5);
  g.fillStyle = o.wickCol ?? col;
  const ww = Math.max(2.4, w * .13);
  g.fillRect(x - ww / 2, lerp(mid, yh, grow), ww, lerp(mid, yl, grow) - lerp(mid, yh, grow));
  g.fillStyle = col;
  g.fillRect(x - w / 2, top, w, hh);
  g.fillStyle = o.dark ?? dark;
  g.fillRect(x + w * .14, top, w * .36, hh);
}

// Ряд свечей: reveal — сколько уже появилось (дробное значение растит текущую)
function candles(list, x0, dx, yOf, reveal_ = 1e9, o = {}) {
  const w = o.w ?? dx * .62;
  list.forEach((c, i) => {
    const q = clamp(reveal_ - i);
    if (q <= 0) return;
    const rise = c.c >= c.o;
    candle(x0 + dx * (i + .5), w, yOf(c.o), yOf(c.c), yOf(c.h), yOf(c.l), rise, back(q), o.colOf ? o.colOf(i, c) : o);
  });
}

// ---------- шапка главы ----------

function chapterPlate(t, k, a) {
  const name = (D.names[k - 1] || "").toUpperCase(), dt = t - a - .95;
  if (dt < 0 || !name) return;
  const num = k <= 15 ? String(k - 1) : "", size = 26, wd = widthOf(name, size, {sp: .6}), x = 54, y = 44, hh = 54;
  const q = eo5(clamp(dt / .5)), nw = num && k > 1 ? 58 : 0, full = nw + wd + 44;
  g.save();
  g.beginPath();
  g.rect(x - 8, y - 8, (full + 16) * q, hh + 16);
  g.clip();
  g.fillStyle = C.coral;
  g.beginPath();
  g.roundRect(x, y, full, hh, 8);
  g.fill();
  if (nw) {
    g.fillStyle = tone(C.coral, -.34);
    g.beginPath();
    g.roundRect(x, y, nw, hh, [8, 0, 0, 8]);
    g.fill();
    text(num, x + nw / 2, y + 38, 30, C.white, {align: "center", w: 700});
  }
  text(name, x + nw + 22, y + 37, size, C.white, {sp: .6});
  g.restore();
}

// ---------- субтитры ----------

const SUB_COL = {white: C.white, yellow: C.amber, green: C.rise, red: C.fall};

function subtitles(t) {
  for (const c of D.subs) {
    if (t < c.start || t >= c.end) continue;
    const size = 35, lh = 47, rows = c.rows, x0 = 1284, base = 1030 - (rows.length - 1) * lh;
    rows.forEach((row, i) => {
      let x = x0;
      const y = base + i * lh;
      for (const w of row) {
        const s = w.word + " ", lit = t >= w.t, dt = t - w.t, wd = widthOf(s, size, {w: 600});
        const q = lit ? clamp(dt / .1) : 0;
        g.save();
        g.translate(x, y - (1 - eo3(clamp(dt / .16))) * (lit ? 5 : 0));
        text(s, 0, 0, size, lit ? SUB_COL[w.color] : C.grey, {w: 600});
        if (w.color !== "white" && lit) {
          g.fillStyle = SUB_COL[w.color];
          g.fillRect(0, 8, (wd - 12) * q, 4);
        }
        g.restore();
        x += wd;
      }
    });
    return;
  }
}

function customTexts(t) {
  for (const c of D.custom) {
    const a = +(c.start ?? 0), dur = +(c.duration ?? 2.5), s = c.text ?? "";
    if (t < a || t >= a + dur || !s.trim()) continue;
    const x = (c.x ?? .67) * W, y = (c.y ?? .2) * H;
    reveal(s, x, y, +(c.size ?? 54), c.color ?? C.white, t, a, {off: a + dur - .32});
  }
}

// ---------- шторка «новый канал» ----------

function cover(t) {
  const cuts = D.cuts;
  for (let k = 1; k < cuts.length - 1; k++) {
    const c = cuts[k];
    if (t < c - .42 || t > c + 1.02) continue;
    const inn = eio(clamp((t - c + .42) / .4)), out = eio(clamp((t - c - .56) / .44));
    return {k: k + 1, c, inn, out, kind: k % 3};
  }
  return null;
}

function shutterPath(s) {
  g.beginPath();
  if (s.kind === 0) {                       // косая шторка слева направо
    const a = lerp(-420, W + 420, s.out), b = lerp(-420, W + 420, s.inn), tilt = 300;
    g.moveTo(a + tilt, 0); g.lineTo(b + tilt, 0); g.lineTo(b - tilt, H); g.lineTo(a - tilt, H);
  } else if (s.kind === 1) {                // круг из точки экрана, закрывается кольцом
    const R = 1480;
    g.arc(610, 520, R * s.inn, 0, 7);
    if (s.out > 0) {
      g.moveTo(610 + R * s.out, 520);
      g.arc(610, 520, R * s.out, 0, 7);
    }
  } else {                                  // жалюзи: полосы с разбежкой
    const n = 8, hh = H / n;
    for (let i = 0; i < n; i++) {
      const d = i / n * .36, q0 = eio(clamp((s.inn * 1.36 - d))), q1 = eio(clamp((s.out * 1.36 - d)));
      if (q1 < 1) g.rect(0, i * hh + hh / 2 - hh / 2 * q0 + hh * q1, W, hh * q0 * (1 - q1) + 1);
    }
  }
  g.closePath();
}

function cardArt(t, s) {
  const dt = t - s.c;
  g.fillStyle = C.coral;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,.34)";
  g.lineWidth = 1.5;
  const sh = (dt * 40) % 180;
  g.beginPath();
  for (let x = -180; x < W + 180; x += 180) { g.moveTo(x + sh, 0); g.lineTo(x + sh, H); }
  for (let y = 90; y < H; y += 180) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  const r = rng(s.k * 31), P = [[120 + r() * 200, 760 + r() * 160], [620 + r() * 200, 820 + r() * 100], [1180 + r() * 180, 760 + r() * 150], [1620 + r() * 180, 840 + r() * 100]];
  const H0 = [0, 1, 2].map(() => 170 + r() * 90);
  for (let i = 0; i < 3; i++) {
    dashedArc(P[i], P[i + 1], H0[i], C.white, -dt * 60, 3);
    diamond(P[i][0], P[i][1], 11, C.white);
  }
  diamond(P[3][0], P[3][1], 11, C.white);
  // зигзаг, соединённые точки, пересекающиеся круги — словарь второго референса
  g.strokeStyle = C.navy2;
  g.lineWidth = 8;
  g.lineJoin = "miter";
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = 1500 + i * 36, y = 150 + (i % 2) * 44 + Math.sin(dt * 3) * 6;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.fillStyle = C.white;
  const pts = [[140, 170], [230, 118], [320, 188], [410, 130]];
  g.strokeStyle = C.white;
  g.lineWidth = 3;
  g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.stroke();
  for (const p of pts) { g.beginPath(); g.arc(p[0], p[1], 10, 0, 7); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.2)";
  g.beginPath(); g.arc(1660, 880, 118, 0, 7); g.fill();
  g.fillStyle = "rgba(31,58,99,.34)";
  g.beginPath(); g.arc(1754, 900, 118, 0, 7); g.fill();
  const rr = rng(s.k * 7);
  g.fillStyle = C.white;
  for (let i = 0; i < 46; i++) g.fillRect(rr() * W, rr() * H, 3, 3);
  // мячик скачет по дугам: те самые ключевые кадры со второй картинки
  const seg = clamp((dt + .36) / .42, 0, 2.999), sk = Math.floor(seg), ball = arcAt(P[sk], P[sk + 1], H0[sk], seg - sk);
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(ball[0], ball[1], 17, 0, 7);
  g.fill();
  // номер и название
  const name = (D.names[s.k - 1] || "").toUpperCase(), num = s.k <= 15 ? String(s.k - 1) : "";
  const pop = spring(dt + .08, 2.6, 7), size = 80, lh = 96, x = num ? (num.length > 1 ? 590 : 410) : 150, lines = wrap(name, size, W - x - 150);
  if (num) {
    g.save();
    g.translate(150, 650);
    g.scale(pop, pop);
    text(num, 0, 0, 340, C.white, {w: 700});
    g.restore();
  }
  lines.forEach((ln, i) => {
    const yy = 530 - lines.length * lh / 2 + 80 + i * lh, q2 = eo3(clamp((dt + .1 - i * .06) / .32));
    g.save();
    g.beginPath();
    g.rect(x - 6, yy - 78, W - x, 100);
    g.clip();
    text(ln, x, yy + (1 - q2) * 100, size, C.white, {w: 700});
    g.restore();
  });
}

function wrap(s, size, max) {
  const out = [];
  let row = "";
  for (const w of s.split(" ")) {
    const test = row ? row + " " + w : w;
    if (row && widthOf(test, size) > max) { out.push(row); row = w; } else row = test;
  }
  out.push(row);
  return out;
}

function shutter(t) {
  const s = cover(t);
  if (!s) return;
  resetCam();
  g.save();
  shutterPath(s);
  g.clip(s.kind === 1 ? "evenodd" : "nonzero");
  cardArt(t, s);
  g.restore();
}

// ---------- кадр ----------

let GRAIN = null;

function makeGrain() {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d"), img = x.createImageData(W, H), r = rng(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const on = r() < .12, v = r() < .5 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = on ? 15 : 0;
  }
  x.putImageData(img, 0, 0);
  GRAIN = c;
}

function sceneAt(t) {
  const c = D.cuts;
  for (let k = c.length - 2; k >= 0; k--) if (t >= c[k]) return k + 1;
  return 1;
}

function frame(t) {
  const k = sceneAt(t), a = D.cuts[k - 1], b = D.cuts[k], sc = SC[k];
  g.globalAlpha = 1;
  resetCam();
  if (sc) sc.draw(t, a, b);
  else { g.fillStyle = C.bg; g.fillRect(0, 0, W, H); }
  resetCam();
  chapterPlate(t, k, a);
  subtitles(t);
  customTexts(t);
  g.drawImage(GRAIN, 0, 0);
  shutter(t);
}

function blurN(t) {
  if (cover(t)) return 4;
  for (const [a, b, n] of BLUR) if (t >= a && t <= b) return n;
  return 1;
}

function render(t) {
  const n = blurN(t);
  if (n <= 1) { frame(t); return; }
  const span = 1 / D.fps;
  for (let i = 0; i < n; i++) {
    frame(t + (i / (n - 1) - .5) * span);
    ag.globalAlpha = 1 / (i + 1);
    ag.drawImage(cv, 0, 0);
  }
  ag.globalAlpha = 1;
  g.globalAlpha = 1;
  resetCam();
  g.drawImage(acc, 0, 0);
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => fail(new Error("не загрузился " + src));
    document.head.appendChild(s);
  });
}

async function init(d) {
  D = d; E = d.ev; TX = d.text;
  makeRamps(); makeFg(); makeGrain();
  for (const f of d.files) await loadScript(f);
  for (const [k, a, b, n] of BLUR_EV) BLUR.push([e(k) + a, e(k) + b, n]);
}

function shot(t, q) {
  render(t);
  return cv.toDataURL("image/jpeg", q);
}
