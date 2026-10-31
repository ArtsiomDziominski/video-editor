"use strict";
// Выпуск 3: глава 5 (кит), глава 6 (объёмная свеча), глава 7 (узнавание).

// ---------- 6. Глава 5: кит и поток ----------

const FISH = (() => {
  const r = rng(61), out = [];
  for (let i = 0; i < 170; i++) {
    out.push({cx: 90 + r() * 1040, cy: 170 + r() * 720, f1: .5 + r() * 1.1, f2: .4 + r() * .9, p1: r() * 6.3, p2: r() * 6.3, p3: r() * 6.3,
      band: r(), sp: 120 + r() * 90, off: r() * 1300, d: r() * .9, s: .75 + r() * .6, col: [C.teal, C.sky, C.white, C.teal, "#A9DDE6"][i % 5]});
  }
  return out;
})();

function fishAt(f, t, turn) {
  const cx = f.cx + Math.sin(t * f.f1 + f.p1) * 70 + Math.sin(t * f.f2 * 2.1 + f.p2) * 26;
  const cy = f.cy + Math.cos(t * f.f2 + f.p3) * 48;
  const k = eio(pg(t, turn + f.d * .9, 1.5));
  if (k <= 0) return [cx, cy];
  const span = 1500, x = ((f.off + f.sp * (t - turn)) % span) - 170, y = 300 + f.band * 520 - (x - 600) * .16 + Math.sin(x * .01 + f.p1) * 16;
  return [lerp(cx, x, k), lerp(cy, y, k)];
}

function drawFish(x, y, ang, s, col) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(s, s);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(15, 0);
  g.quadraticCurveTo(2, -9, -9, 0);
  g.quadraticCurveTo(2, 9, 15, 0);
  g.fill();
  g.beginPath();
  g.moveTo(-7, 0);
  g.lineTo(-17, -7);
  g.lineTo(-15, 0);
  g.lineTo(-17, 7);
  g.closePath();
  g.fill();
  g.restore();
}

function whale(t) {
  const body = new Path2D("M340 8 C330 -92 176 -158 18 -148 C-126 -138 -246 -84 -350 -24 C-378 -10 -398 -6 -420 -12 C-402 26 -372 28 -344 32 C-224 88 -62 142 96 130 C228 120 330 86 340 8Z");
  const fin = Math.sin(t * 1.1) * .08, tail = Math.sin(t * 1.6) * .22;
  g.save();                                                      // дальний плавник
  g.translate(120, 98);
  g.rotate(.5 + fin);
  g.fillStyle = C.navy2;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(80, 50, 140, 150);
  g.quadraticCurveTo(40, 110, -44, 26);
  g.closePath();
  g.fill();
  g.restore();
  g.save();                                                      // хвост
  g.translate(-408, 4);
  g.rotate(tail);
  g.fillStyle = "#17305A";
  g.beginPath();
  g.moveTo(20, -8);
  g.quadraticCurveTo(-60, -40, -150, -112);
  g.quadraticCurveTo(-112, -30, -92, 2);
  g.quadraticCurveTo(-112, 34, -150, 96);
  g.quadraticCurveTo(-60, 38, 20, 12);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = "#17305A";
  g.fill(body);
  g.save();
  g.clip(body);
  g.fillStyle = C.cream;                                         // брюхо с полосами
  g.beginPath();
  g.moveTo(350, -6);
  g.bezierCurveTo(200, 22, 40, 48, -130, 40);
  g.lineTo(-300, 26);
  g.lineTo(-330, 200);
  g.lineTo(350, 200);
  g.closePath();
  g.fill();
  g.strokeStyle = tone(C.cream, -.3);
  g.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(330 - i * 44, 4 + i * 3.4);
    g.quadraticCurveTo(200 - i * 50, 70 + i * 5, 40 - i * 40, 124 + i * 2 - i * i * .9);
    g.stroke();
  }
  g.fillStyle = C.navy;
  g.beginPath();
  g.ellipse(20, -150, 330, 72, -.02, 0, 7);
  g.fill();
  g.restore();
  g.fillStyle = C.navy2;                                         // спинной плавник
  g.beginPath();
  g.moveTo(-210, -82);
  g.quadraticCurveTo(-250, -128, -292, -120);
  g.quadraticCurveTo(-268, -86, -252, -60);
  g.closePath();
  g.fill();
  g.save();                                                      // ближний плавник
  g.translate(136, 84);
  g.rotate(.3 - fin);
  g.fillStyle = C.navy2;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(70, 60, 96, 186);
  g.quadraticCurveTo(10, 130, -60, 30);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = C.white;
  g.beginPath();
  g.arc(236, -14, 12, 0, 7);
  g.fill();
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(240, -14, 7, 0, 7);
  g.fill();
}

const S6 = {};

SC[6] = {
  draw(t, a, b) {
    if (!S6.ch) {
      S6.ch = candlesOf([[0, .4], [4, .46], [8, .38], [12, .44], [16, .4]], 601, .03, 1);
      S6.go = candlesOf([[0, .4], [3, .5], [6, .62], [9, .74], [12, .9]], 602, .03, 1.2);
    }
    const turn = e("s6_turn"), fight = e("s6_fight");
    const v = camera(t, [[a, 640, 540, 1.0, 45], [e("s6_big"), 610, 540, 1.03, 45], [turn, 590, 540, 1.0, 45], [turn + 3, 660, 520, 1.03, 45], [b, 700, 530, 1.05, 45]]);
    const dx = v.x - 610, dy = v.y - 540;
    resetCam();
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, "#19507F");
    sea.addColorStop(.55, C.navy);
    sea.addColorStop(1, "#0D1A30");
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);
    // лучи сверху и дальний рельеф: чем дальше, тем медленнее
    g.globalAlpha = .1;
    for (let i = 0; i < 6; i++) {
      const x = 120 + i * 230 - dx * .2 + Math.sin(t * .2 + i) * 30;
      poly([[x, -10], [x + 90, -10], [x + 340, 1090], [x + 120, 1090]], C.white);
    }
    g.globalAlpha = 1;
    const ridge = (par, base, amp, col, seed) => {
      const pts = [[-100, H + 10]], r = rng(seed);
      for (let i = 0; i <= 14; i++) pts.push([-100 + i * 170 - dx * par, base + (r() - .5) * amp - dy * par]);
      pts.push([1400, H + 10]);
      poly(pts, col);
    };
    ridge(.3, 860, 100, "#12294B", 3);
    ridge(.55, 960, 90, "#0D1F3A", 4);
    // рыбы за китом
    const flow = eio(pg(t, turn, 1.6));
    g.setTransform(v.z, 0, 0, v.z, 610 - v.x * v.z, 540 - v.y * v.z);
    FISH.forEach((f, i) => {
      if (i === 0 || i % 2) return;
      const p = fishAt(f, t, turn), q = fishAt(f, t + .04, turn), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      drawFish(p[0], p[1], ang, f.s * .8, tone(f.col, -.3));
    });
    // кит: до поворота плывёт влево, поворот — настоящий разворот через ось
    const sx = lerp(-1, 1, eio(pg(t, turn, 1.5)));
    const wx = lerp(lerp(730, 640, pg(t, a, turn - a)), 500, eio(pg(t, turn, 5))), wy = 520 + Math.sin(t * .6) * 16 - flow * 26;
    g.save();
    g.translate(wx, wy);
    g.rotate((sx < 0 ? .03 : -.03) - flow * .1);
    g.scale(.92 * (sx >= 0 ? Math.max(.12, sx) : Math.min(-.12, sx)), .92);
    whale(t);
    g.restore();
    FISH.forEach((f, i) => {
      if (i === 0 || !(i % 2)) return;
      const p = fishAt(f, t, turn), q = fishAt(f, t + .04, turn), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      drawFish(p[0], p[1], ang, f.s, f.col);
    });
    // янтарная рыбка — это мы
    const us = e("s6_us"), f0 = {cx: 760, cy: 850, f1: .7, f2: .6, p1: 1, p2: 2, p3: 3, band: 1.06, sp: 0, off: 690, d: .1};
    let p0 = fishAt(f0, t, turn);
    if (t > fight) {       // рыбка пробует против потока, её сносит
      const k = t - fight, back_ = eio(clamp(k / 1.8)), tired = eio(pg(k, 1.8, 1.4));
      p0 = [p0[0] - 230 * back_ + 230 * tired + Math.sin(t * 9) * 4 * (1 - tired), p0[1] - 34 * back_ + 34 * tired];
    }
    const q0 = t > fight && t < fight + 1.8 ? Math.PI : 0;
    drawFish(p0[0], p0[1], q0, 2.1, C.amber);
    if (t > us - 1) tag(tx("s6_us"), p0[0], p0[1] + 30, t, us, C.amber, {size: 30});
    const wtag = (k, dx_, dy_, off) => { if (t < e(k) + off) tag(tx(k), wx + dx_, wy + dy_, t, e(k), C.white, {size: 28}); };
    wtag("s6_w1", -240, -230, 3.4);
    wtag("s6_w2", 40, -270, 3.0);
    wtag("s6_w3", 280, -220, 2.6);
    tag(tx("s6_big"), wx, wy + 192, t, e("s6_big"), C.sky, {size: 32, tc: C.white});
    // график на панели: боковик, затем сильное движение за китом
    resetCam();
    const px = 66 - dx * .12, py = 128 - dy * .12, pw = 500, ph = 250;
    if (t > e("s6_chart") - .3) {
      const q = back(pg(t, e("s6_chart") - .3, .4));
      g.save();
      g.translate(px + pw / 2, py + ph / 2);
      g.scale(q, q);
      g.translate(-px - pw / 2, -py - ph / 2);
      g.fillStyle = rgba(C.ink, .88);
      g.beginPath();
      g.roundRect(px, py, pw, ph, 10);
      g.fill();
      g.beginPath();
      g.rect(px + 4, py + 4, pw - 8, ph - 8);
      g.clip();
      const yOf = p => py + ph - 12 - p * (ph - 24), ddx = (pw - 24) / 28;
      candles(S6.ch, px + 10, ddx, yOf, clamp((t - e("s6_chart")) / 2.5) * S6.ch.length);
      candles(S6.go, px + 10 + ddx * 16, ddx, yOf, clamp((t - turn) / 2.4) * S6.go.length);
      g.restore();
    }
    rightFade(1, C.bg);
    note("s6_n1", NOTE_X, 210, 52, C.sky, t, {lh: 62});
    note("s6_n2", NOTE_X, 380, 42, C.white, t, {block: C.coral, lh: 52});
    note("s6_n3", NOTE_X, 560, 76, C.amber, t, {lh: 86});
  },
};

// ---------- 7. Глава 6: объёмная свеча ----------

function solidCandle(I, x, y, wd, z0, z1, zl, zh, col, o = {}) {
  const c = o.wickCol ?? tone(col, -.2), w = wd * .14, q = wd / 2 - w / 2, cl = o.lowCol ?? c;
  if (zl < z0) box(I, x + q, y + q, zl, w, w, z0 - zl, cl, {grain: 0, edge: 0});
  box(I, x, y, z0, wd, wd, Math.max(z1 - z0, .04), col, {grain: .16});
  if (zh > z1) box(I, x + q, y + q, z1, w, w, zh - z1, c, {grain: 0, edge: 0});
}

function leader(I, from, side, label, col, t, t0, o = {}) {   // подпись с линией от точки свечи
  const dt = t - t0;
  if (dt < 0) return;
  const a = I.p(...from), p = eo3(clamp(dt / .3)), bx = a[0] + side * (o.len ?? 150) * p, by = a[1] + (o.dy ?? 0) * p;
  line(a, [bx, by], col, 2.5);
  g.fillStyle = col;
  g.beginPath();
  g.arc(a[0], a[1], 6, 0, 7);
  g.fill();
  if (dt > .16) tag(label, bx + (side > 0 ? 6 : -6), by - 21, t, t0 + .16, col, {size: 28, align: side > 0 ? "left" : "right", tc: o.tc ?? C.bg});
}

const S7 = {};

SC[7] = {
  draw(t, a, b) {
    if (!S7.row) S7.row = candlesOf([[0, .3], [5, .26], [11, .44], [15, .38], [22, .72], [26, .66], [30, .88]], 701, .05, 1.6);
    const red = e("s7_red"), hint = e("s7_try"), rep = e("s7_rep");
    const v = camera(t, [[a, 610, 590, 1.0, 28], [e("s7_body"), 590, 560, 1.12, 44], [red, 560, 560, 1.0, 58], [hint, 610, 540, 1.08, 42], [rep, 590, 570, 1.0, 58],
      [rep + 2.6, 600, 500, 1.0, 82], [b, 610, 500, 1.0, 86]]);
    backdrop(v, t, C.green, {glow: .14});
    applyCam(v);
    const I = new Iso(610, 800, 66, v.th);
    plate(I, -6.4, -8.8, 12.8, 17.6, C.plate);
    pool(I, 0, 0, 5.2, C.green3, 8, t, {ry: 1.34});
    const rise = back(pg(t, a + 1.1, .7)), slide = eio(pg(t, hint - .5, .9)), leave = eio(pg(t, rep - .3, .8));
    const c1 = {x: -1.3 - 3 * slide, y: .9 + 6 * slide}, c2 = {x: -1.1 - 3 * slide, y: -4.4 - 4.2 * slide};
    const zB = 1.6 * rise, hB = 4.5 * rise, gone = leave * 12;
    if (leave < 1) {
      if (t > red) {
        const q = back(pg(t, red, .5));
        solidCandle(I, c2.x, c2.y, 2.4, 1.6 * q + gone, 5.6 * q + gone, .7 * q + gone, 7.2 * q + gone, C.crim, {wickCol: C.fall});
      }
      solidCandle(I, c1.x, c1.y, 2.6, zB + gone, zB + hB + gone, .55 * rise + gone, 8.2 * rise + gone, C.green, {wickCol: C.rise});
    }
    if (slide < .02) {
      leader(I, [c1.x + 2.6, c1.y + 1.3, 3.8], 1, tx("s7_body"), C.white, t, e("s7_body"));
      leader(I, [c1.x + 1.3, c1.y + 1.3, 7.2], 1, tx("s7_wick"), C.white, t, e("s7_wick"), {len: 120});
      leader(I, [c1.x, c1.y + 2.6, 6.05], -1, tx("s7_close"), C.rise, t, e("s7_close"), {len: 70});
      leader(I, [c1.x, c1.y + 2.6, 1.6], -1, tx("s7_open"), C.rise, t, e("s7_open"), {len: 70});
      leader(I, [c1.x + 1.3, c1.y + 1.3, 8.2], -1, tx("s7_top"), C.amber, t, e("s7_top"), {len: 120});
      leader(I, [c1.x + 1.3, c1.y + 1.3, .6], 1, tx("s7_low"), C.amber, t, e("s7_low"), {len: 130});
      if (t > red + .4) {
        leader(I, [c2.x + 2.4, c2.y + 2.4, 5.5], 1, tx("s7_o2"), C.fall, t, red + .5, {len: 90, tc: C.white});
        leader(I, [c2.x + 2.4, c2.y + 2.4, 1.7], 1, tx("s7_c2"), C.fall, t, red + .8, {len: 90, tc: C.white});
      }
    }
    if (t > hint - .1 && leave < 1) {
      const m = eio(pg(t, e("s7_low2"), .9)), q = back(pg(t, hint - .1, .5)), x = -1.2, y = -1.2, wd = 2.4;
      const z0 = lerp(1.8, 4.6, m) * q + gone, z1 = lerp(3.3, 6.2, m) * q + gone, zl = lerp(1.2, .5, m) * q + gone, zh = lerp(9.4, 7, m) * q + gone;
      solidCandle(I, x, y, wd, z0, z1, zl, zh, C.green, {wickCol: m < .5 ? C.amber : C.rise, lowCol: m > .5 ? C.amber : C.rise});
      if (leave <= 0) {
        if (m < .5) {
          leader(I, [x + 1.2, y + 1.2, 7], 1, tx("s7_try"), C.amber, t, e("s7_try"), {len: 170});
          leader(I, [x + 2.4, y + 2.4, 2.5], 1, tx("s7_res"), C.rise, t, e("s7_res"), {len: 160});
          const m_ = I.p(x + 1.2, y + 1.2, 9.5);
          if (t > e("s7_no")) tag(tx("s7_no"), m_[0], m_[1] - 62, t, e("s7_no"), C.fall, {size: 28, tc: C.white});
        } else {
          const m_ = I.p(x + 1.2, y + 1.2, 1.6);
          tag(tx("s7_yes"), m_[0] + 220, m_[1] - 14, t, e("s7_yes"), C.rise, {size: 28});
        }
      }
    }
    // ряд свечей: каждая прилетает на своё место, вместе они становятся графиком
    if (t > rep - .4) {
      S7.row.forEach((c, i) => {
        const at = rep + i * .07, q = eo5(pg(t, at, .55));
        if (q <= 0) return;
        const y = 7.4 - i * .5, z = p => 1.1 + p * 7.6, fly = (1 - q) * 9, top = Math.max(c.o, c.c), low = Math.min(c.o, c.c);
        solidCandle(I, lerp(5, -.2, q), y, .38, z(low) + fly, z(top) + fly + .05, z(c.l) + fly, z(c.h) + fly, c.c >= c.o ? C.rise : C.fall);
      });
    }
    foreground(v, t, .45);
    rightFade();
    note("s7_n1", NOTE_X, 210, 46, C.white, t, {block: C.rise, lh: 56, off: e("s7_n2") - .4});
    note("s7_n2", NOTE_X, 210, 54, C.amber, t, {lh: 64});
    note("s7_n3", NOTE_X, 430, 44, C.white, t, {block: C.coral, lh: 54});
  },
};

// ---------- 8. Глава 7: узнавание ситуаций ----------

const DB = [[[0, .72], [5, .54], [9, .24], [13, .46], [17, .25], [22, .56], [26, .74]],
  [[0, .6], [4, .7], [9, .3], [13, .52], [17, .31], [21, .62], [26, .8]],
  [[0, .8], [6, .58], [10, .28], [13, .44], [17, .3], [23, .52], [26, .66]]];
const BN = [[[0, .3], [6, .68], [11, .4], [17, .76], [21, .42], [26, .74]],
  [[0, .84], [6, .5], [11, .72], [16, .46], [21, .78], [26, .5]],
  [[0, .5], [5, .3], [10, .66], [15, .32], [20, .6], [26, .34]]];

function tracePath(pts, p, col, w = 7) {
  const n = pts.length - 1, f = p * n, k = Math.min(n - 1, Math.floor(f));
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= k; i++) g.lineTo(pts[i][0], pts[i][1]);
  const x = f - k;
  g.lineTo(lerp(pts[k][0], pts[k + 1][0], x), lerp(pts[k][1], pts[k + 1][1], x));
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke();
}

function patternScreen(w, h, list, keys, t, at, col, seedAt) {
  screenBg(w, h, C.ink);
  const pad = 26, dx = (w - pad * 2) / 26, yOf = p => h - 26 - p * (h - 56);
  candles(list, pad, dx, yOf, clamp((t - seedAt) / 1.2) * 26);
  const q = eio(pg(t, at, .55));
  if (q > 0) tracePath(keys.slice(1, -1).map(k => [pad + k[0] * dx, yOf(k[1])]), q, col);
}

function standWord(I, s, x0, y, size, col, t, t0) {     // объёмные буквы встают из пола
  let x = x0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], wd = widthOf(ch, size), q = back(pg(t, t0 + i * .05, .42));
    if (q > 0) {
      for (let d = 16; d >= 0; d -= 2) {
        onWallY(I, x / 100, y - d / 100, size * .9 * .01, () => {
          g.translate(0, size * .9);
          g.scale(1, q);
          text(ch, 0, 0, size, d ? tone(col, -.46) : col);
        });
      }
    }
    x += wd + 4;
  }
}

const S8 = {};

SC[8] = {
  draw(t, a, b) {
    if (!S8.db) {
      S8.db = DB.map((k, i) => candlesOf(k, 801 + i, .03, 1.3));
      S8.bn = BN.map((k, i) => candlesOf(k, 811 + i, .03, 1.3));
      S8.wall = candlesOf(DB[0], 821, .02, 1);
    }
    const b1 = e("s8_b0"), wall = e("s8_wall"), word = e("s8_word");
    const v = camera(t, [[a, 610, 520, 1.0, 54], [e("s8_m0"), 560, 510, 1.04, 60], [e("s8_m2"), 650, 500, 1.04, 62], [b1, 610, 520, 1.0, 66], [wall, 610, 500, .98, 70],
      [word - 1.4, 610, 500, .98, 66], [word, 620, 540, 1.0, 22], [b, 620, 530, 1.02, 18]]);
    backdrop(v, t, C.teal, {glow: .14});
    applyCam(v);
    const I = new Iso(640, 850, 70, v.th);
    plate(I, -4.8, -9.4, 11.4, 18.8, C.plate);
    pool(I, 1.2, 0, 4.4, "#2C6E78", 12, t, {ry: 1.5});
    const vanish = 1 - eio(pg(t, wall - .2, .6));
    if (vanish > 0) {
      [5.2, 0, -5.2].forEach((y, i) => {
        const zb = 1.4, hh = 4.6 * vanish;
        const fn = (w, h) => {
          if (t < b1) patternScreen(w, h, S8.db[i], DB[i], t, e("s8_m" + i), C.amber, a + 1 + i * .4);
          else patternScreen(w, h, S8.bn[i], BN[i], t, e("s8_b" + i), C.sky, b1 - .4);
          if (t > b1 - .15 && t < b1 + .1) { g.fillStyle = "rgba(247,243,238,.6)"; g.fillRect(0, 0, w, h); }
        };
        if (hh > .1) {
          box(I, -2.6, y - .4, 0, .8, .8, zb, ["#2A2833", "#17151D", "#100F15"], {grain: 0, edge: 0});
          tvSet(I, -2.3, y, 4.7, hh, zb, null, fn, {console: 0});
        }
      });
      [0, 1, 2].forEach(i => {
        const y = [5.2, 0, -5.2][i], m = I.p(-2.3, y, 6.3);
        const at = t < b1 ? e("s8_m" + i) : e("s8_b" + i), k = t < b1 ? "s8_tagA" : "s8_tagB";
        if (vanish > .9 && t > at) tag(tx(k), m[0], m[1] - 44, t, at + .3, t < b1 ? C.amber : C.sky, {size: 26, tc: t < b1 ? C.bg : C.white});
      });
    }
    // стена из вступления, но теперь на всех экранах одна картинка
    const wq = eo3(pg(t, wall, .7)) * (1 - eio(pg(t, word - 1.4, .8)));
    if (wq > 0) {
      const z0 = lerp(-9, .2, wq), rows = 4, cols = 7, cw = 2.6, ch = 2.3;
      box(I, -4.2, -9.2, z0, .3, 18.4, 9.4, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: 0});
      onWallX(I, -3.9, 9.1, z0 + 9.3, () => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const at = wall + .5 + (r * 7 + c) * .09, xx = c * cw * 100 + 12, yy = r * ch * 100 + 12, w = cw * 100 - 16, h = ch * 100 - 16;
            g.save();
            g.translate(xx, yy);
            g.beginPath();
            g.rect(0, 0, w, h);
            g.clip();
            patternScreen(w, h, S8.wall, DB[0], t, at, C.amber, wall);
            g.restore();
          }
        }
      });
    }
    if (t > word - .6) {
      const size = 196, sz = widthOf(tx("s8_word"), size) + 44;
      standWord(I, tx("s8_word"), -sz / 2, -1.2, size, C.amber, t, word);
    }
    // эмоции толпы — слова вспыхивают над экранами
    [["s8_e0", 300, 150], ["s8_e1", 560, 210], ["s8_e2", 800, 130], ["s8_e3", 1020, 200]].forEach(([k, x, y]) => {
      const at = e(k);
      if (t > at && t < e("s8_pic")) tag(tx(k), x, y, t, at, C.coral, {size: 30, tc: C.white});
    });
    foreground(v, t, .45);
    rightFade();
    note("s8_n1", NOTE_X, 210, 54, C.amber, t, {lh: 64});
    note("s8_n2", NOTE_X, 370, 42, C.white, t, {block: C.coral, lh: 52});
    note("s8_n3", NOTE_X, 520, 44, C.white, t, {block: C.teal, lh: 54});
  },
};
