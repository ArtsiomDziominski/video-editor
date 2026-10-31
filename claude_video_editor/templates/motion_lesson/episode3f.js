"use strict";
// Выпуск 3: глава 13 (лестница), глава 14 (сто сделок), чек-лист, финал.

// ---------- 14. Глава 13: лестница ----------

const STEP_COL = [C.sky, C.teal, C.amber, C.green, C.coral];

function book(I, x, y, z, t, open) {
  box(I, x, y, z, 2.2, 1.6, .16, [C.white, C.tan, C.tan2], {grain: 0, edge: 0});
  box(I, x - .06, y - .06, z - .12, 2.32, 1.72, .12, [C.coral, tone(C.coral, -.2), tone(C.coral, -.4)], {grain: 0, edge: 0});
  onFloor(I, x + .2, y + .2, z + .17, () => {
    g.fillStyle = C.grey;
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 30, 180 * clamp(open * 4 - i), 10);
  });
}

SC[14] = {
  draw(t, a, b) {
    const S = [0, 1, 2, 3, 4].map(i => e("s14_s" + i));
    const stepAt = i => ({y: 5.6 - i * 2.8, h: .9 + i * 1.45});
    const f = S.map((_, i) => {
      const q = stepAt(i);
      return [612 - q.y * .84 * 60, 800 + q.y * .3 * 60 - q.h * 42];
    });
    const v = camera(t, [[a, 610, 560, .96, 54], [S[0], f[0][0], f[0][1], 1.2, 58], [S[1], f[1][0], f[1][1], 1.16, 58], [S[2], f[2][0], f[2][1], 1.14, 58], [S[3], f[3][0], f[3][1], 1.12, 58],
      [S[4], f[4][0], f[4][1], 1.1, 58], [S[4] + 3.4, 610, 540, .96, 54], [b, 610, 540, .96, 60]]);
    backdrop(v, t, C.sky, {glow: .13});
    applyCam(v);
    const I = new Iso(620, 800, 60, v.th);
    plate(I, -5, -9.4, 11, 18.8, C.plate);
    pool(I, 1.4, 2, 3.4, C.sky2, 25, t, {ry: 1.5});
    const cur = S.reduce((n, q, i) => t >= q ? i : n, -1);
    for (let i = 4; i >= 0; i--) {
      const q = stepAt(i), act = i <= cur, col = act ? STEP_COL[i] : C.plate2, grow = back(pg(t, a + .9 + i * .14, .5));
      const hh = q.h * grow + (act && i === cur ? wob(t - S[i], 2, 5) * .12 : 0);
      box(I, -2.8, q.y, 0, 5.6, 2.8, hh, act ? tri(col) : [C.plate2, "#26242F", "#1B1921"], {grain: .14});
      const m = [I.p(2.8, q.y + 1.4, q.h * .46)];
      if (i === cur && t < S[4] + 3) {
        const top = [I.p(-2.8, q.y, q.h), I.p(2.8, q.y, q.h), I.p(2.8, q.y + 2.8, q.h), I.p(-2.8, q.y + 2.8, q.h)];
        poly(top, "rgba(247,243,238,.14)");
      }
    }
    const jq = pg(t, S[4] + 1.2, 1.2);
    // журнал идёт рядом со всеми ступенями: лента вдоль фасада
    if (jq > 0) {
      const a0 = I.p(3.1, 8.4, .02), b0 = I.p(3.1, 8.4 - 14 * jq, .02);
      line(a0, b0, C.coral, 12, "butt");
      book(I, 3.6, 5.2, .18, t, jq);
    }
    // стрелка поднимается по ступеням
    if (cur >= 0) {
      const q0 = stepAt(Math.max(cur - 1, 0)), q1 = stepAt(cur), x = eio(pg(t, S[cur] - .25, .55));
      const A0 = cur === 0 ? I.p(.4, 9.2, 0) : I.p(.2, q0.y + 1.4, q0.h), B0 = I.p(.2, q1.y + 1.4, q1.h), m = arcAt(A0, B0, 110, x);
      const land = wob(t - S[cur] - .3, 3, 7) * .3;
      g.save();
      g.translate(m[0], m[1] + Math.sin(t * 2.4) * 3);
      g.scale(1 + land, 1 - land);
      poly([[-16, 2], [0, -5], [16, 2], [0, 10]], "rgba(12,10,18,.35)");
      arrowUp(0, -38, 30, C.white, -1);
      g.fillStyle = C.cream;
      g.fillRect(3, -38, 8, 46);
      g.restore();
    }
    S.forEach((at, i) => {
      const q = stepAt(i), m = I.p(2.8, q.y + 1.4, q.h * .5);
      tag(tx("s14_s" + i), m[0] + 36, m[1] - 20, t, at, STEP_COL[i], {size: 28, align: "left", tc: i === 2 || i === 1 ? C.bg : C.white});
    });
    foreground(v, t, .45);
    rightFade();
    const notes = ["s14_n0", "s14_n1", "s14_n2", "s14_n3", "s14_n4"];
    notes.forEach((k, i) => note(k, NOTE_X, 210, 46, STEP_COL[i], t, {lh: 58, off: i < 4 ? S[i + 1] - .4 : undefined}));
    note("s14_n5", NOTE_X, 420, 44, C.white, t, {block: C.coral, lh: 54});
  },
};

// ---------- 15. Глава 14: сто сделок ----------

const TRADES = (() => {
  const r = rng(1501), out = [];
  let z = 0;
  const wins = new Set();
  while (wins.size < 42) wins.add(Math.floor(r() * 100));
  wins.add(37);
  for (let i = 0; i < 100; i++) {
    const win = wins.has(i);
    z += win ? .36 : -.13;
    out.push({win, z: Math.max(0, z)});
  }
  return out;
})();
const TRADE_CHART = candlesOf([[0, .3], [3, .26], [6, .42], [9, .38], [12, .62]], 1502, .025, 1);

function tradeFace(w, h, t, t0, win) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, w, h);
  const dx = w / 14, yOf = p => h * .9 - (p - .2) * h * 1.7;
  candles(TRADE_CHART, dx * .8, dx, yOf, clamp((t - t0) / 1.5) * 12);
  g.fillStyle = C.sky;
  g.fillRect(dx * 6, yOf(.42), w * .54, h * .016);
  g.fillStyle = win ? C.rise : C.fall;
  g.fillRect(dx * 6, win ? yOf(.62) : yOf(.3), w * .54, h * .016);
}

SC[15] = {
  draw(t, a, b) {
    const out = e("s15_out"), I0 = new Iso(0, 0, 46, 70), sad = e("s15_sad"), Y0 = 11.5;
    const K = 37, q = TRADES[K], y = Y0 - K * .232, x = 0;
    const pull = eio(pg(t, out, 4.6)), th = lerp(86, 68, pull), zm = Math.exp(lerp(Math.log(78), 0, pull)) * .98;
    const J = new Iso(0, 0, 46, th + Math.sin(t * .13) * 1.2), c0 = J.p(x + .22, y + .11, q.z + .13), c1 = J.p(0, 0, 8);
    const v = {x: lerp(c0[0], c1[0], eo3(pull)) + (1 - pull) * 0, y: lerp(c0[1], c1[1], eo3(pull)), z: zm, th};
    const tp = e("s15_wait");
    backdrop({x: 610 + pull * 40, y: 540, z: 1, th}, t, C.teal, {glow: .12});
    const shownEnd = Math.min(99, Math.floor(100 * clamp((t - out) / 3.6)));
    applyCam(v, lerp(600, 610, pull), 530);
    g.globalAlpha = pull;
    plate(J, -3, -13.5, 6, 27, C.plate);
    pool(J, 0, 0, 2.4, "#2C6E78", 27, t, {ry: 4.8});
    g.globalAlpha = 1;
    const shown = 100 * clamp((t - out) / 3.6);
    for (let i = 99; i >= 0; i--) {
      const c = TRADES[i];
      if (i !== K && (i > shown || pull <= 0)) continue;
      const yy = Y0 - i * .232, q1 = i === K ? 1 : back(clamp((shown - i) / 3));
      const win = i === K ? t < sad : c.win, col = win ? C.rise : C.crim;
      const zz = c.z;
      if (zz > .05) box(J, 0, yy, 0, .2, .2, zz, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: 0});
      box(J, 0, yy, zz, .22, .22, .22 * q1, tri(col), {grain: 0, edge: 0});
      if (i === K) {
        onWallX(J, .22, yy + .22, zz + .22, () => {
          g.scale(.055, .055);
          tradeFace(400, 400, t, a + 1, win);
        });
      }
    }
    if (t > tp) {          // терпение: фишка стоит на месте, и только изредка делает шаг
      const c = TRADES[99], m = J.p(.11, Y0 - 99 * .232 + .11, c.z + .4 + Math.sin(t * 2) * .06);
      diamond(m[0], m[1] - 10, 11 * back(pg(t, tp, .4)), C.amber);
    }
    foreground(v, t, pull * .45);
    rightFade();
    const big = 1 - pull;
    if (big > .4) {
      tag(tx("s15_win"), 300, 975, t, e("s15_win"), C.rise, {size: 40});
      tag(tx("s15_sad"), 720, 975, t, sad, C.fall, {size: 40, tc: C.white});
    }
    note("s15_n1", NOTE_X, 210, 50, C.amber, t, {lh: 60});
    note("s15_n2", NOTE_X, 380, 42, C.white, t, {block: C.teal, lh: 52});
    note("s15_n3", NOTE_X, 590, 48, C.rise, t, {lh: 58});
    note("s15_n4", NOTE_X, 780, 72, C.teal, t, {});
  },
};

// ---------- 16. Чек-лист ----------

SC[16] = {
  draw(t, a, b) {
    const v = camera(t, [[a, 620, 540, 1.0, 45], [b, 600, 530, 1.0, 45]]);
    backdrop(v, t, C.coral, {glow: .08});
    const rows = [0, 1, 2, 3, 4, 5, 6];
    const n = rows.length, y0 = 150, gapY = 116;
    rows.forEach(i => {
      const k = "s16_r" + i, at = e(k), dt = t - (a + 1 + i * .11);
      if (dt < 0) return;
      const x = 76 - (v.x - 610) * (.4 + i * .04), y = y0 + i * gapY, p = eo5(clamp(dt / .55)), wd = 1080, hh = 96;
      const skew = -.05;
      g.save();
      g.setTransform(1, 0, skew, 1, x + (1 - p) * -1100 + (y * -skew) + 8, y);
      g.fillStyle = "#17151D";
      g.fillRect(10, 12, wd, hh);
      g.fillStyle = "#34323E";
      g.fillRect(0, 0, wd, hh);
      g.fillStyle = t >= at ? [C.sky, C.teal, C.sky, C.green, C.amber, C.crim2, C.coral][i] : C.plate2;
      g.fillRect(0, 0, 14, hh);
      g.restore();
      resetCam();
      const tx_ = x + (1 - p) * -1100 + 96;
      const q = pg(t, at + .25, .4);
      g.save();
      g.translate(x + (1 - p) * -1100 + 62, y + hh / 2);
      g.fillStyle = C.rise;
      g.beginPath();
      g.arc(0, 0, 28 * back(q), 0, 7);
      g.fill();
      tick(0, 0, 15, q, C.bg, 6.5);
      g.restore();
      if (t >= at) reveal(tx(k), tx_, y + 63, 36, C.white, t, at, {block: C.white});
    });
    rightFade(1);
    note("s16_n", NOTE_X, 300, 84, C.amber, t, {lh: 96});
  },
};

// ---------- 17. Финал: та же комната ----------

const S17 = {
  left: candlesOf([[0, .2], [5, .3], [9, .24], [14, .4], [17, .36], [19, .44]], 1701, .025, 1.2),
  right: candlesOf([[0, .5], [3, .56], [6, .54], [9, .66], [12, .74]], 1702, .025, 1.2),
};

SC[17] = {
  draw(t, a, b) {
    const grow = e("s17_grow"), title = e("s17_title"), done = e("s17_note");
    const push = eio(pg(t, done, b - done));
    const th = lerp(46, 58, eio(pg(t, a, grow - a + 2))), base = 1.04;
    const J = new Iso(0, 0, 68, th + Math.sin(t * .13) * 1.2), c1 = J.p(.3, 0, 2.3), c2 = J.p(-3.9, 0, 3.2);
    // на сборке графика камера подходит к экрану, на прощание отступает к комнате
    const near = eio(pg(t, grow - .4, 2.4)) * (1 - push), z = lerp(base, 2.05, near);
    const v = {x: lerp(c1[0], c2[0] + 30, near), y: lerp(c1[1], c2[1] + 10, near), z, th};
    backdrop(v, t, CHANNELS[0].glow, {glow: .1});
    applyCam(v);
    room(J, t, CHANNELS[0], (w, h) => {
      screenBg(w, h, C.ink, .05);
      const dx = 26, cx = w / 2, yOf = p => h - 30 - p * (h - 60), rev = pg(t, grow, 4.4);
      const noise = t > e("s17_clear") - .5 && t < e("s17_clear") + .7;
      if (noise) {
        miniScreen({x: 0, y: 0, w, h, s: 1234, layer: 0}, 0, t, .8, 1);
        return;
      }
      // та же спокойная свеча, вокруг неё собирается чистый график
      const big = 1 - eio(pg(t, grow, 1.1));
      if (big > 0) calmCandle(t, a - 1, w, h, {s: .86 * lerp(.3, 1, big)});
      if (t > grow) {
        candles(S17.left, cx - 19.5 * dx + 40, dx, yOf, rev * 19 * 1.1);
        candles(S17.right, cx + 40, dx, yOf, clamp(rev * 1.1 - .4) * 12 * 1.67);
        const lv = eo3(pg(t, grow + 1.6, .5));
        g.fillStyle = C.sky;
        g.fillRect(cx - 200, yOf(.46) - 2, 240 * lv, 4);
        [[.52, C.sky, "ВХОД", 2.8], [.4, C.fall, "ЗАЩИТА", 3.2], [.78, C.rise, "ЦЕЛЬ", 3.6]].forEach(([p, c_, s, d]) => {
          const m = eo3(pg(t, grow + d, .4));
          if (m <= 0) return;
          g.fillStyle = c_;
          g.fillRect(cx + 40, yOf(p) - 2, (w / 2 - 44) * m, 4);
          text(s, w - 10, yOf(p) - 8, 22, c_, {align: "right"});
        });
      }
    });
    foreground(v, t, .4);
    rightFade(1);
    note("s17_title", NOTE_X, 280, 68, C.white, t, {block: C.coral, lh: 78});
    note("s17_n1", NOTE_X, 520, 40, C.amber, t, {lh: 50});
    text(tx("s17_dis").split("\n")[0], NOTE_X, 826, 22, C.grey, {w: 400});
    text(tx("s17_dis").split("\n")[1], NOTE_X, 856, 22, C.grey, {w: 400});
  },
};

// быстрые движения героев: на них копятся подкадры, остальное идёт без размытия
BLUR_EV.push(
  ["pull", 0, 1.4, 4],
  ["s3_five", -.05, .75, 4],
  ["s3_minus", -.05, .75, 4],
  ["s6_turn", 0, 2.2, 4],
  ["s7_rep", 0, 1.5, 4],
  ["s8_wall", 0, 1.2, 4],
  ["s10_rew", 0, .7, 6],
  ["s15_out", 0, 1.6, 4],
);
