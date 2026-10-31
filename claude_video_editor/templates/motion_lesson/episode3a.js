"use strict";
// Выпуск 3, «Переключение каналов»: общий реквизит и вступление. Комната с пустым креслом — дом ролика.

const NOTE_X = 1284;

function cyl(I, x, y, z, r, h, col, n = 28) {
  const [top, left, right] = Array.isArray(col) ? col : tri(col);
  const ring = zz => Array.from({length: n}, (_, i) => {
    const a = i / n * Math.PI * 2;
    return I.p(x + Math.cos(a) * r, y + Math.sin(a) * r, zz);
  });
  const lo = ring(z), hi = ring(z + h), order = lo.map((p, i) => i);
  const lx = Math.min(...lo.map(p => p[0])), rx = Math.max(...lo.map(p => p[0]));
  if (h > 0) {
    const pts = [...order.map(i => lo[i]), ...order.map(i => hi[i])];
    const hull = hullOf(pts);
    const lg = g.createLinearGradient(lx, 0, rx, 0);
    lg.addColorStop(0, left);
    lg.addColorStop(1, right);
    poly(hull, lg);
  }
  poly(hi, top);
}

function hullOf(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of s) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of s.reverse()) {
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function leaf(x, y, ang, len, wd, col, dark) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * .4, -wd, len, 0);
  g.quadraticCurveTo(len * .4, wd, 0, 0);
  g.fillStyle = col;
  g.fill();
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * .4, wd, len, 0);
  g.lineTo(0, 0);
  g.fillStyle = dark;
  g.fill();
  g.restore();
}

function plant(I, x, y, t, col) {
  cyl(I, x, y, 0, .62, .95, [C.white, C.white, "#B9B4BE"]);
  cyl(I, x, y, .95, .52, 0, [tone("#3A2A22", 0), "#000", "#000"]);
  const b = I.p(x, y, .95), s = I.s;
  const stem = [b[0], b[1] - s * 2.2];
  line(b, stem, tone(col, -.5), 3.5);
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? 1 : -1, hh = i / 10;
    const a = (-90 + side * (70 - hh * 52)) * Math.PI / 180 + Math.sin(t * .9 + i) * .03;
    const px = lerp(b[0], stem[0], .15 + hh * .85), py = lerp(b[1], stem[1], .15 + hh * .85);
    leaf(px, py, a, s * (1.46 - hh * .5), s * .36, i % 3 === 1 ? tone(col, .14) : col, tone(col, -.32));
  }
}

function lampTable(I, x, y, t, shadeCol, bright = 1) {
  const legs = [[0, 0], [1.3, 0], [0, 1.3], [1.3, 1.3]];
  for (const [a, b] of legs) box(I, x + a, y + b, 0, .09, .09, 1.2, [C.tan2, tone(C.tan2, -.5), tone(C.tan2, -.6)], {grain: 0, edge: 0});
  box(I, x - .1, y - .1, 1.2, 1.6, 1.6, .12, [C.white, C.tan, C.tan2], {grain: 0, edge: 0});
  const cx = x + .7, cy = y + .7;
  cyl(I, cx, cy, 1.32, .34, .08, [C.tan, C.tan2, tone(C.tan2, -.3)]);
  line(I.p(cx, cy, 1.4), I.p(cx, cy, 2.5), C.tan2, 3.5);
  const glow = g.createRadialGradient(...I.p(cx, cy, 2.7), 6, ...I.p(cx, cy, 2.7), I.s * 2.4);
  glow.addColorStop(0, rgba(C.amber, .34 * bright));
  glow.addColorStop(1, rgba(C.amber, 0));
  g.fillStyle = glow;
  const q = I.p(cx, cy, 2.7);
  g.fillRect(q[0] - I.s * 2.6, q[1] - I.s * 2.6, I.s * 5.2, I.s * 5.2);
  const n = 22, ringAt = (r, z) => Array.from({length: n}, (_, i) => I.p(cx + Math.cos(i / n * 6.283) * r, cy + Math.sin(i / n * 6.283) * r, z));
  const hull = hullOf([...ringAt(.72, 2.42), ...ringAt(.4, 3.32)]);
  const lg = g.createLinearGradient(q[0] - I.s * .7, 0, q[0] + I.s * .7, 0);
  lg.addColorStop(0, tone(shadeCol, .2));
  lg.addColorStop(1, tone(shadeCol, -.2));
  poly(hull, lg);
  poly(ringAt(.4, 3.32), tone(shadeCol, .46));
}

function armchair(I, x, y, col) {
  const [hi, mid, lo] = [tone(col, .14), col, tone(col, -.34)], c = [hi, mid, lo];
  for (const [a, b] of [[.1, .1], [2.2, .1], [.1, 3.1], [2.2, 3.1]]) box(I, x + a, y + b, 0, .2, .2, .36, [C.tan, C.tan2, tone(C.tan2, -.4)], {grain: 0, edge: 0});
  const soft = {grain: .2};
  box(I, x, y, .36, 2.5, .5, 1.5, c, soft);            // дальний подлокотник
  box(I, x, y + .5, .36, 2.1, 2.4, .86, c, soft);            // сиденье
  box(I, x + .12, y + .62, 1.22, 1.9, 2.16, .26, [tone(col, .24), col, tone(col, -.2)], {grain: 0});   // подушка
  box(I, x, y + 2.9, .36, 2.5, .5, 1.5, c, soft);            // ближний подлокотник
  box(I, x + 2.05, y + .5, .36, .72, 2.4, 3.2, c, soft);     // спинка
}

function tvSet(I, x, y, wd, hh, zb, pal, scr, o = {}) {   // экран смотрит на +x, центр по оси y, zb — низ экрана
  const dy = wd / 2, bezel = .12;
  if (o.console !== 0) {
    for (const [a, b] of [[.1, .1], [1.3, .1], [.1, wd + .3 - .1], [1.3, wd + .3 - .1]]) {
      box(I, x - .95 + a, y - dy - .3 + b, 0, .12, .12, .34, [C.tan2, tone(C.tan2, -.5), tone(C.tan2, -.6)], {grain: 0, edge: 0});
    }
    box(I, x - .95, y - dy - .3, .34, 1.65, wd + .6, .4, [C.white, C.tan, C.tan2], {grain: 0, edge: 0});
    box(I, x - .42, y - .8, .74, .5, 1.6, zb - .74, ["#2A2833", "#17151D", "#100F15"], {grain: 0, edge: 0});
  }
  box(I, x - .36, y - dy, zb, .36, wd, hh, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: "#55525E"});
  onWallX(I, x, y + dy - bezel, zb + hh - bezel, () => {
    const lw = (wd - bezel * 2) * 100, lh = (hh - bezel * 2) * 100;
    g.beginPath();
    g.rect(0, 0, lw, lh);
    g.clip();
    scr(lw, lh);
  });
}

function screenBg(w, h, col = C.bg, gridA = .05, step = 50) {
  g.fillStyle = col;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = `rgba(247,243,238,${gridA})`;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = step; x < w; x += step) { g.moveTo(x, 0); g.lineTo(x, h); }
  for (let y = step; y < h; y += step) { g.moveTo(0, y); g.lineTo(w, y); }
  g.stroke();
}

function lightCone(I, x, y, wd, len, spread, col, a = .2) {
  const p0 = I.p(x, y + wd / 2), p1 = I.p(x, y - wd / 2), p2 = I.p(x + len, y - wd / 2 - spread), p3 = I.p(x + len, y + wd / 2 + spread);
  const m0 = I.p(x, y), m1 = I.p(x + len, y);
  const lg = g.createLinearGradient(m0[0], m0[1], m1[0], m1[1]);
  lg.addColorStop(0, rgba(col, a));
  lg.addColorStop(1, rgba(col, 0));
  poly([p0, p1, p2, p3], lg);
}

// Палитры «каналов»: при переключении меняется весь мир, как в референсе
const CHANNELS = [
  {chair: C.sky, plant: C.green, pool: C.red, plate: C.plate, light: C.crim2, lamp: C.amber, glow: C.crim},
  {chair: C.crim, plant: C.crim, pool: C.red, plate: C.crim2, light: C.crim2, lamp: C.crim2, glow: C.crim},
  {chair: C.sky, plant: C.green, pool: C.green2, plate: C.plate, light: C.rise, lamp: C.amber, glow: C.green},
  {chair: C.navy, plant: C.green, pool: C.sky2, plate: C.plate2, light: C.sky, lamp: C.amber, glow: C.sky},
  {chair: C.tan2, plant: C.coral, pool: C.amber2, plate: C.plate, light: C.amber, lamp: C.coral, glow: C.amber},
  {chair: C.sky, plant: C.green, pool: C.navy, plate: C.plate, light: C.teal, lamp: C.amber, glow: C.teal},
];

function room(I, t, P, scr, o = {}) {
  plate(I, -5.5, -5.5, 11.4, 11.6, P.plate);
  pool(I, .2, -.2, 4.5, (o.prev || P).pool, 3, t);
  if (o.prev) pool(I, -3.2, 0, 8.4, P.pool, 3, t, {grow: o.grow});
  lightCone(I, -3.9, 0, 5.6, 7.4, 2.2, P.light, .3);
  lampTable(I, 1.6, -4.7, t, P.lamp);
  tvSet(I, -3.9, 0, 6.4, 3.7, 1.36, P, scr);
  plant(I, -3.3, 4.6, t, P.plant);
  armchair(I, 1.0, -1.7, P.chair);
}

// ---------- 1. Вступление: стена экранов → тишина → одна свеча → комната ----------

const WALL = (() => {
  const r = rng(21), out = [];
  const cols = 10, rows = 6, cw = W / cols, ch = H / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      out.push({x: i * cw + 4, y: j * ch + 4, w: cw - 8, h: ch - 8, at: r() * r() * 5.2, s: Math.floor(r() * 1e6), layer: 0});
    }
  }
  for (let i = 0; i < 26; i++) {
    const w = 170 + r() * 190;
    out.push({x: r() * (W - w), y: r() * (H - w * .6), w, h: w * (.56 + r() * .2), at: 1.5 + r() * 5, s: Math.floor(r() * 1e6), layer: 1});
  }
  return out.sort((a, b) => a.layer - b.layer);
})();

const WALL_COL = [C.crim2, C.rise, C.sky, C.amber, C.teal, C.coral, C.white];

function miniScreen(sc, k, t, heat, squash) {
  const slot = Math.floor(t * (1.6 + heat * 13) + sc.s % 7 * .31), r = rng(sc.s + slot * 131), kind = Math.floor(r() * 6);
  const jx = (r() - .5) * heat * 9, jy = (r() - .5) * heat * 7, x = sc.x + jx, y = sc.y + jy + sc.h * (1 - squash) / 2, w = sc.w, h = sc.h * squash;
  g.fillStyle = sc.layer ? "#100F15" : C.ink;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath();
  g.rect(x + 3, y + 3, w - 6, h - 6);
  g.clip();
  const col = WALL_COL[Math.floor(r() * 7)], col2 = WALL_COL[Math.floor(r() * 7)];
  const n = kind === 0 ? 16 : 30;
  if (kind === 0) {
    let p = .5;
    for (let i = 0; i < n; i++) {
      const c = clamp(p + (r() - .5) * .3, .08, .92), up = c > p, bx = x + 8 + i * (w - 16) / n, yy = u => y + h * (1 - u);
      g.fillStyle = up ? C.rise : C.fall;
      g.fillRect(bx + 3, yy(Math.max(p, c) + .08 * r()), 1.6, h * (Math.abs(c - p) + .14 * r()));
      g.fillRect(bx, yy(Math.max(p, c)), (w - 16) / n * .7, Math.max(2, h * Math.abs(c - p)));
      p = c;
    }
  } else if (kind === 1 || kind === 2) {
    for (let q = 0; q < (kind === 1 ? 1 : 3); q++) {
      let p = .3 + r() * .4;
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        p = clamp(p + (r() - .5) * .22, .05, .95);
        const px = x + i * w / n, py = y + h * (1 - p);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.strokeStyle = q ? col2 : col;
      g.lineWidth = 2.2;
      g.stroke();
    }
  } else if (kind === 3) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const v = r();
      g.fillRect(x + i * w / n, y + h - h * .8 * v, w / n * .6, h * .8 * v);
    }
  } else if (kind === 4) {
    g.strokeStyle = col;
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = y + (i + .5) * h / 6;
      g.globalAlpha = .4 + r() * .6;
      line([x + 10, yy], [x + 10 + r() * (w - 20), yy], i % 2 ? col : col2, h / 16);
    }
    g.globalAlpha = 1;
  } else {
    const cx = x + w / 2, cy = y + h / 2, rr = Math.min(w, h) * .36;
    g.lineWidth = rr * .34;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(cx, cy, rr, r() * 6, r() * 6 + 3.6);
    g.stroke();
    g.strokeStyle = col2;
    g.beginPath();
    g.arc(cx, cy, rr, r() * 6, r() * 6 + 1.4);
    g.stroke();
  }
  g.restore();
}

function drawWall(t, calm) {
  const heat = clamp(t / calm) ** 1.6;
  resetCam();
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  const z = 1 + heat * .1, sh = heat ** 2 * 7;
  g.setTransform(z, 0, 0, z, W / 2 * (1 - z) + Math.sin(t * 91) * sh, H / 2 * (1 - z) + Math.cos(t * 77) * sh);
  g.rotate(-.012 * heat);
  WALL.forEach((sc, k) => {
    const on = pg(t, sc.at * calm / 8.4, .1);
    if (on <= 0) return;
    const dist = Math.hypot(sc.x + sc.w / 2 - W / 2, sc.y + sc.h / 2 - H / 2) / 1100;
    const off = t > calm ? 1 - clamp((t - calm - (1 - dist) * .03) / .06) : 1;
    if (off > 0) miniScreen(sc, k, t, heat, on * off);
  });
  resetCam();
}

function calmCandle(t, t0, w, h, o = {}) {   // одна спокойная свеча в центре экрана
  const dt = t - t0, breathe = Math.sin(t * 1.1) * 2.5, cx = w / 2, cy = h / 2 + (o.dy ?? 0), s = o.s ?? 1;
  const q = back(clamp(dt / .34));
  candle(cx, 62 * s, cy + (78 + breathe) * s, cy - (78 + breathe) * s, cy - 138 * s, cy + 128 * s, true, q);
}

SC[1] = {
  draw(t, a, b) {
    const calm = e("calm");
    if (t < calm + .1) drawWall(t, calm);
    if (t >= calm) {
      const pull = e("pull"), x = eio(pg(t, pull, 5.4));
      const th = lerp(90, 58, x), z = lerp(5.6, 1.04, eo3(pg(t, pull, 5.0)));
      const J = new Iso(0, 0, 68, th), c0 = J.p(-3.9, 0, 3.2), c1 = J.p(.3, 0, 2.3), v = camera(t, [[0, 0, 0, z, th]]);
      v.x = lerp(c0[0] - 350 / z, c1[0], x);
      v.y = lerp(c0[1], c1[1], x);
      v.z = z;
      v.th = th;
      const pals = [[0, 0], ["c1", 1], ["c2", 2], ["c3", 3], ["c4", 4], ["c5", 5], ["nop", 0]];
      let cur = 0, prev = 0, at = -9;
      for (const [k, q] of pals) {
        const tt = k ? e(k) : 0;
        if (t >= tt) { prev = cur; cur = q; at = tt; }
      }
      const P = CHANNELS[cur], grow = eo3(pg(t, at, .4));
      backdrop(v, t, P.glow, {glow: .12 * x});
      applyCam(v);
      room(J, t, P, (w, h) => {
        screenBg(w, h, C.bg, .05 * x);
        const fl = at > 0 && t - at < .12 ? 1 : 0;
        if (fl) { g.fillStyle = rgba(P.light, .5); g.fillRect(0, 0, w, h); }
        calmCandle(t, calm, w, h, {s: .86});
      }, grow < 1 && at > 0 ? {prev: CHANNELS[prev], grow} : {});
      foreground(v, t, x * .5);
      rightFade(Math.max(x, pg(t, e("title") - .9, .5)));
    }
    resetCam();
    if (t < calm) {                                       // на стене экранов субтитрам нужна подложка
      g.fillStyle = rgba(C.bg, .93);
      g.beginPath();
      g.roundRect(1258, 884, 640, 176, 12);
      g.fill();
    }
    const y = 250;
    note("title", NOTE_X, y, 92, C.white, t, {block: C.coral, lh: 100});
    ["c1", "c2", "c3", "c4", "c5"].forEach((k, i) => {
      if (t < e(k)) return;
      diamond(NOTE_X + 11, 412 + i * 58, 9 * back(pg(t, e(k), .25)), CHANNELS[i + 1].light);
      note(k, NOTE_X + 36, 424 + i * 58, 36, C.white, t, {block: CHANNELS[i + 1].light, w: 600});
    });
    note("nop", NOTE_X, 780, 54, C.amber, t, {block: C.amber});
  },
};
