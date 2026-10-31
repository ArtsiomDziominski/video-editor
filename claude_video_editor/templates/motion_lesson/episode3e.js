"use strict";
// Выпуск 3: глава 8 (четыре шага), глава 9 (сделка), глава 10 (1:3), глава 11 (проценты), глава 12 (три причины).

// ---------- 9. Глава 8: настольная игра из четырёх шагов ----------

const TILES = [{x: -6.1, y: -6.1, c: C.sky}, {x: 1.1, y: -6.1, c: C.amber}, {x: 1.1, y: 1.1, c: C.crim}, {x: -6.1, y: 1.1, c: C.green}];

function miniScales(I, x, y, z, t, tilt) {
  box(I, x - .5, y - .5, z, 1, 1, .14, [C.tan, C.tan2, tone(C.tan2, -.3)], {grain: 0, edge: 0});
  box(I, x - .08, y - .08, z + .14, .16, .16, 1.7, [C.white, C.tan, C.tan2], {grain: 0, edge: 0});
  const L = 1.5, sn = Math.sin(tilt), cs = Math.cos(tilt), zz = z + 1.84;
  const pl = [x - L * cs, zz - L * sn], pr = [x + L * cs, zz + L * sn];
  line(I.p(pl[0], y, pl[1]), I.p(pr[0], y, pr[1]), C.white, 5);
  for (const [px, pz, col] of [[pl[0], pl[1], C.rise], [pr[0], pr[1], C.fall]]) {
    line(I.p(px, y, pz), I.p(px, y, pz - .7), C.grey, 1.6);
    cyl(I, px, y, pz - .8, .5, .08, col, 16);
  }
}

function pressButton(I, x, y, z, press) {
  cyl(I, x, y, z, 1.1, .3, [C.plate2, "#26242F", "#17151D"]);
  cyl(I, x, y, z + .3, .82, .46 * (1 - press) + .06, [C.crim2, C.crim, C.red2]);
}

SC[9] = {
  draw(t, a, b) {
    const S = [0, 1, 2, 3].map(i => e("s9_t" + i)), end = e("s9_end");
    const focus = i => {
      const c = {x: TILES[i].x + 2.5, y: TILES[i].y + 2.5};
      return [(c.x - c.y) * .707 * 60 + 610, (c.x + c.y) * .707 * .56 * 60 + 540];
    };
    const f = [0, 1, 2, 3].map(focus);
    const mid = (p, k = .42) => [lerp(610, p[0], k), lerp(540, p[1], k)];
    const m = f.map(p => mid(p));
    const v = camera(t, [[a, 610, 540, .92, 38], [S[0], m[0][0], m[0][1], 1.04, 45], [S[1] - .5, m[0][0], m[0][1], 1.02, 45], [S[1], m[1][0], m[1][1], 1.04, 42], [S[2] - .5, m[1][0], m[1][1], 1.02, 45],
      [S[2], m[2][0], m[2][1], 1.04, 48], [S[3] - .5, m[2][0], m[2][1], 1.02, 45], [S[3], m[3][0], m[3][1], 1.04, 42], [end, m[3][0], m[3][1], 1.02, 45], [end + 1.8, 610, 540, .92, 52], [b, 610, 540, .92, 45]]);
    backdrop(v, t, C.coral, {glow: .11});
    applyCam(v);
    const I = new Iso(610, 540, 60, v.th);
    plate(I, -7.6, -7.6, 15.2, 15.2, C.plate);
    pool(I, 0, 0, 5.8, "#7A2A2A", 15, t);
    const cur = S.reduce((n, q, i) => t >= q ? i : n, -1);
    // пунктир по кругу и ромбы — ключевые кадры из второго референса
    const c0 = TILES.map(q => I.p(q.x + 2.5, q.y + 2.5, .6));
    for (let i = 0; i < 4; i++) {
      const A0 = c0[i], B0 = c0[(i + 1) % 4], lit = i < cur;
      dashedArc(A0, B0, 130, lit ? C.white : "rgba(247,243,238,.32)", -t * 34, 3);
      diamond(lerp(A0[0], B0[0], .5), lerp(A0[1], B0[1], .5) - 65, 9, lit ? C.white : "rgba(247,243,238,.4)");
    }
    [0, 1, 3, 2].forEach(i => {     // порядок дальше-ближе при угле около 45
      const q = TILES[i], act = i <= cur, lift = act ? spring(t - S[i], 1.8, 5) * .4 : 0, z = lift;
      const col = act ? q.c : C.plate2, cols = act ? tri(q.c) : [C.plate2, "#26242F", "#1B1921"];
      box(I, q.x, q.y, -.1 + z, 5, 5, .6, cols, {grain: .14});
      const zz = .5 + z, cx = q.x + 2.5, cy = q.y + 2.5, on = pg(t, S[i] + .1, .5);
      if (i === 0) {
        box(I, cx - 1.7, cy - 1.8, zz, .2, 3.6, 2.6, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: 0});
        onWallX(I, cx - 1.5, cy + 1.7, zz + 2.5, () => {
          screenBg(340, 240, C.ink);
          const list = S9L, dx = 340 / 16, yOf = p => 230 - p * 220;
          candles(list, 0, dx, yOf, on * 16);
          g.fillStyle = C.sky;
          g.fillRect(0, yOf(.5) - 2, 340 * on, 6);
        });
      } else if (i === 1) {
        miniScales(I, cx, cy, zz, t, Math.sin(t * 1.4) * .16 * (act ? 1 : .2));
      } else if (i === 2) {
        const dt = t - S[2];
        onFloor(I, cx - 1.6, cy - 1.8, zz + .02, () => {
          g.fillStyle = C.white;
          g.fillRect(0, 0, 320, 360);
          [[C.sky, "s9_q0"], [C.fall, "s9_q1"], [C.rise, "s9_q2"]].forEach(([c_, k], j) => {
            const p = eo3(pg(t, e(k), .4));
            g.fillStyle = c_;
            g.fillRect(36, 70 + j * 100, 248 * p, 26);
          });
        });
      } else {
        pressButton(I, cx, cy, zz, t > S[3] + .3 ? clamp(wob(t - S[3] - .3, 1.5, 3) * 1.4 + .1) : 0);
      }
    });
    // фишка: прыгает по дугам между плитками
    let pos = I.p(0, 0, .4), bob = Math.sin(t * 3) * 6;
    if (cur >= 0) {
      const from = c0[(cur + 3) % 4], to = c0[cur], x = eio(pg(t, S[cur] - .35, .55));
      pos = cur === 0 && x < 1 ? [lerp(I.p(0, 0)[0], to[0], x), lerp(I.p(0, 0)[1], to[1], x) - Math.sin(x * Math.PI) * 170] : arcAt(from, to, 130, x);
      if (x >= 1 && t >= end) {
        const k = eio(pg(t, end + .5, 1)), nx = arcAt(to, c0[0], 130, k);
        pos = nx;
      }
    }
    const land = cur >= 0 ? wob(t - S[cur] - .2, 3, 7) * .25 : 0;
    g.save();
    g.translate(pos[0], pos[1] - 34 + bob);
    g.scale(1 + land, 1 - land);
    poly([[0, -34], [24, 0], [0, 34], [-24, 0]], C.white);
    poly([[0, -34], [24, 0], [0, 34]], C.cream);
    g.restore();
    TILES.forEach((q, i) => {
      const m = I.p(q.x + 2.5, q.y + 5, .4);
      tag(tx("s9_t" + i), m[0] + (i === 3 ? -30 : 30), m[1] + 8, t, S[i], q.c, {size: 32, tc: i === 1 || i === 3 ? C.bg : C.white});
    });
    foreground(v, t, .45);
    rightFade();
    note("s9_n0", NOTE_X, 210, 46, C.sky, t, {lh: 58, off: S[1] - .4});
    note("s9_n1", NOTE_X, 210, 46, C.amber, t, {lh: 58, off: S[2] - .4});
    ["s9_q0", "s9_q1", "s9_q2"].forEach((k, i) => note(k, NOTE_X, 210 + i * 70, 50, [C.sky, C.fall, C.rise][i], t, {off: S[3] - .4}));
    note("s9_n2", NOTE_X, 480, 42, C.white, t, {block: C.crim2, lh: 52, off: S[3] - .4});
    note("s9_n3", NOTE_X, 210, 46, C.rise, t, {lh: 58, off: end - .4});
    note("s9_n4", NOTE_X, 210, 52, C.amber, t, {lh: 64});
  },
};
const S9L = candlesOf([[0, .3], [5, .44], [8, .34], [12, .46], [16, .62]], 901, .03, 1);

// ---------- 10. Глава 9: одна сделка от начала до конца ----------

const S10 = {
  base: candlesOf([[0, .2], [4, .3], [7, .24], [11, .42], [13, .35], [17, .47], [20, .42], [22, .5], [24, .54]], 1001, .03, 1.3),
  a: candlesOf([[0, .54], [3, .6], [6, .57], [10, .71], [13, .78]], 1002, .025, 1.2),
  b: candlesOf([[0, .54], [3, .58], [6, .52], [9, .46]], 1003, .02, 1),
  c: candlesOf([[0, .46], [4, .34], [8, .2], [12, .05]], 1004, .02, 1),
};

SC[10] = {
  draw(t, a, b) {
    const lvl = e("s10_lvl"), en = e("s10_in"), sl = e("s10_sl"), tp = e("s10_tp"), go = e("s10_go"), hit = e("s10_hit"), rew = e("s10_rew"), va = e("s10_b"), loss = e("s10_loss"), fail = e("s10_fail");
    const v = camera(t, [[a, 610, 540, .98, 58], [lvl, 620, 520, 1.04, 68], [en, 760, 460, 1.14, 68], [tp, 740, 470, 1.1, 64], [go, 720, 480, 1.08, 68], [hit, 800, 400, 1.14, 66],
      [rew, 700, 480, 1.04, 70], [va, 760, 500, 1.1, 66], [loss, 760, 540, 1.12, 68], [fail, 720, 580, 1.04, 60], [b, 700, 570, 1.02, 58]]);
    backdrop(v, t, C.sky, {glow: .12});
    applyCam(v);
    const I = new Iso(745, 875, 78, v.th);
    studio(I, t, C.navy, C.sky, (w, h) => {
      screenBg(w, h, C.ink);
      const dx = (w - 60) / 38, x0 = 16, yOf = p => h - 34 - (p - .12) * 1.3 * (h - 68), n0 = S10.base.length, cxOf = i => x0 + dx * (i + .5);
      candles(S10.base, x0, dx, yOf, clamp((t - a - 1) / (lvl + 2.6 - a - 1)) * n0);
      const lq = eo3(pg(t, lvl, .5));
      if (lq > 0) {
        g.fillStyle = C.sky;
        g.fillRect(0, yOf(.48) - 2.5, cxOf(23) * lq, 5);
        tag(tx("s10_lvl"), 130, yOf(.48) - 62, t, lvl + .2, C.sky, {size: 30, tc: C.white});
      }
      const X0 = cxOf(24);
      const zone = (a_, b_, col, at) => {
        const q = eo3(pg(t, at, .4));
        g.fillStyle = rgba(col, .15);
        g.fillRect(X0, yOf(Math.max(a_, b_)), (w - X0) * q, Math.abs(yOf(a_) - yOf(b_)));
      };
      const noStop = pg(t, fail, .5);
      if (t < fail + .5) {
        g.globalAlpha = 1 - noStop;
        zone(.54, .46, C.fall, sl);
        zone(.54, .78, C.rise, tp);
        g.globalAlpha = 1;
      }
      const mark = (p, col, k, at) => {
        const q = eo3(pg(t, at, .4));
        if (q <= 0) return;
        g.fillStyle = col;
        for (let x = X0; x < X0 + (w - X0) * q; x += 26) g.fillRect(x, yOf(p) - 2.5, 16, 5);
        tag(tx(k), X0 - 96, yOf(p) - 26, t, at, col, {size: 28, tc: col === C.sky || col === C.fall ? C.white : C.bg, align: "left"});
      };
      if (t < fail + .5) {
        g.globalAlpha = 1 - noStop;
        mark(.46, C.fall, "s10_sl", sl);
        g.globalAlpha = 1;
      }
      mark(.54, C.sky, "s10_in", en);
      mark(.78, C.rise, "s10_tp", tp);
      const rate = S10.a.length / (hit - go), revA = t < rew ? clamp((t - go) * rate, 0, S10.a.length) : S10.a.length * (1 - eio(pg(t, rew, .5)));
      if (revA > 0) candles(S10.a, cxOf(24) - dx * .5, dx, yOf, revA);
      if (t > va) candles(S10.b, cxOf(24) - dx * .5, dx, yOf, clamp((t - va) / (loss - va)) * S10.b.length);
      if (t > fail) candles(S10.c, cxOf(24) + dx * 8.5, dx, yOf, clamp((t - fail) / 1.8) * S10.c.length, {w: dx * .6});
      const hq = t < rew ? pg(t, hit, .4) : 0;
      if (hq > 0) {
        g.fillStyle = C.rise;
        g.beginPath();
        g.arc(cxOf(36), yOf(.78) - 66, 46 * back(hq), 0, 7);
        g.fill();
        tick(cxOf(36), yOf(.78) - 66, 22, hq, C.bg, 9);
      }
      const lq2 = pg(t, loss, .35);
      if (lq2 > 0) {
        g.fillStyle = C.fall;
        g.beginPath();
        g.arc(cxOf(33), yOf(.46) + 62, 40 * back(lq2), 0, 7);
        g.fill();
        g.fillStyle = C.white;
        g.fillRect(cxOf(33) - 20, yOf(.46) + 58, 40 * lq2, 9);
      }
      if (rew < t && t < rew + .5) {           // перемотка: строки как на старой кассете
        const k = Math.sin(pg(t, rew, .5) * Math.PI);
        g.fillStyle = `rgba(247,243,238,${k * .16})`;
        for (let y = (t * 3000) % 120; y < h; y += 120) g.fillRect(0, y, w, 26);
      }
    });
    foreground(v, t, .45);
    rightFade();
    [["s10_n0", 0], ["s10_n1", 1], ["s10_n2", 2], ["s10_n3", 3]].forEach(([k, i]) => {
      const at = e(k), y = 210 + i * 70, q = pg(t, at, .3);
      if (q <= 0) return;
      const done = i < 3 && t > e("s10_n" + (i + 1));
      tick(NOTE_X + 18, y - 16, 15, done ? 1 : q, done ? C.rise : C.amber, 6);
      reveal(tx(k), NOTE_X + 56, y, 42, done ? C.grey : C.white, t, at, {block: C.sky});
    });
    note("s10_n4", NOTE_X, 540, 54, C.amber, t, {lh: 64});
    note("s10_n5", NOTE_X, 730, 42, C.fall, t, {block: C.fall, lh: 52});
  },
};

// ---------- 11. Глава 10: соотношение 1:3 ----------

const S11 = {kinds: "RRGRRGRGRG"};

function towers(I, x, y, n, sz, col, t, t0, o = {}) {
  for (let k = 0; k < Math.ceil(n); k++) {
    const dt = t - t0 - k * .08, h = bounceH(dt) * 7, part = clamp(n - k);
    if (dt < 0 || part <= 0) continue;
    box(I, x, y, k * sz + h, sz, sz, sz * .94 * part, col, {grain: .12});
  }
}

SC[11] = {
  draw(t, a, b) {
    const r1 = e("s11_r"), g3 = e("s11_g"), red0 = e("s11_red"), grn0 = e("s11_grn"), sum = e("s11_sum"), flip = e("s11_flip"), back_ = e("s11_back");
    const reds = [0, 1, 2, 3, 4, 5].map(i => e("s11_x" + i)), grns = [0, 1, 2, 3].map(i => e("s11_y" + i));
    const v = camera(t, [[a, 610, 560, 1.06, 34], [r1, 590, 560, 1.12, 40], [red0 - .8, 610, 520, 1.0, 56], [grn0, 640, 520, 1.0, 66], [sum, 610, 500, .98, 62], [flip, 620, 520, 1.0, 54], [b, 610, 530, 1.0, 62]]);
    backdrop(v, t, C.green, {glow: .1});
    applyCam(v);
    const I = new Iso(640, 780, 62, v.th);
    plate(I, -6, -11, 12.4, 22, C.plate);
    pool(I, 0, 0, 5, "#17563C", 17, t, {ry: 1.9});
    const row = eio(pg(t, red0 - .9, .7)), S = 1.5;
    if (row < 1) {
      const zoff = -row * 10;
      g.save();
      towers(I, -2, 1.4, 1, 2, C.crim, t, r1);
      towers(I, -2, -3, 3, 2, C.green, t, g3);
      g.restore();
      const m1 = I.p(-1, 2.4, 2.4), m2 = I.p(-1, -2, 6.5);
      if (row <= 0) {
        tag(tx("s11_r"), m1[0] - 60, m1[1] - 80, t, r1, C.fall, {size: 34, tc: C.white});
        tag(tx("s11_g"), m2[0] + 50, m2[1] - 76, t, g3, C.rise, {size: 34});
      }
    }
    if (t > red0 - .2) {
      let ir = 0, ig = 0;
      const flipK = spring(t - flip, 1.4, 4) * (1 - spring(t - back_, 1.4, 4));
      const col = [];
      [...S11.kinds].forEach((kind, i) => {
        const y = 7.8 - i * 1.9, red = kind === "R", at = red ? reds[ir++] : grns[ig++];
        const h = red ? lerp(1, 3, flipK) : lerp(3, 1, flipK);
        const sink = 0;
        towers(I, -.6, y - .6, h, 1.24, red ? C.crim : C.green, t, at);
        if (t > at) {
          const m = I.p(.1, y, -.1);
        }
      });
    }
    foreground(v, t, .45);
    rightFade();
    const q = e("s11_ratio");
    if (t > q) {
      const s = spring(t - q, 2, 6), base = 196;
      g.save();
      g.translate(NOTE_X + 8, 340);
      g.scale(s, s);
      text(tx("s11_ratio"), 0, 0, base, C.amber, {w: 700});
      g.restore();
    }
    const y = 490, X = [NOTE_X, NOTE_X + 124, NOTE_X + 296];
    note("s11_m", X[0], y, 72, C.fall, t, {block: C.fall});
    note("s11_p", X[1], y, 72, C.rise, t, {block: C.rise});
    note("s11_eq", X[2], y, 72, C.amber, t, {});
    note("s11_n1", NOTE_X, 620, 44, C.white, t, {block: C.rise, lh: 54, off: flip - .4});
    note("s11_n2", NOTE_X, 620, 44, C.fall, t, {lh: 54, off: back_ - .4});
    note("s11_n3", NOTE_X, 620, 44, C.amber, t, {lh: 54});
  },
};

// ---------- 12. Глава 11: реалистичный процент ----------

SC[12] = {
  draw(t, a, b) {
    const f90 = e("s12_90"), r = e("s12_real"), ad = e("s12_ad"), xx = e("s12_x");
    const v = camera(t, [[a, 610, 530, .98, 58], [f90, 680, 500, 1.02, 64], [r, 590, 490, 1.04, 66], [ad - .8, 610, 530, 1.0, 62], [ad, 650, 560, 1.04, 62], [xx + 1.4, 640, 550, 1.02, 66], [b, 610, 540, 1.0, 60]]);
    backdrop(v, t, C.amber, {glow: .1});
    applyCam(v);
    const I = new Iso(640, 720, 66, v.th);
    plate(I, -6, -10.4, 12.4, 20.8, C.plate);
    pool(I, -.2, 2, 3.6, C.green3, 19, t, {ry: 1.4});
    pool(I, -.4, -6, 3.2, "#6C5A1C", 21, t, {ry: 1.2});
    // шкала от нуля до ста: длинный брус на стойках
    const y0 = 8.6, LEN = 17.2, zb = 3.6, hh = 2.6, P = p => y0 - p / 100 * LEN;
    box(I, -3.6, 4.6, 0, .4, .4, zb, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: 0});
    box(I, -3.6, -5, 0, .4, .4, zb, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: 0});
    box(I, -3.8, y0 - LEN, zb, .5, LEN, hh, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: "#55525E"});
    onWallX(I, -3.3, y0, zb + hh, () => {
      const wl = LEN * 100, hl = hh * 100;
      g.fillStyle = C.ink;
      g.fillRect(0, 0, wl, hl);
      const sw = eo3(pg(t, a + 1, 1.2)) * wl;
      g.fillStyle = C.plate2;
      g.fillRect(0, 0, sw, hl);
      g.fillStyle = "rgba(247,243,238,.7)";
      for (let p = 0; p <= 100; p += 10) {
        const y = p % 50 ? hl * .72 : hl * .5;
        g.fillRect(p / 100 * wl - 2, y, 4, hl - y);
      }
      const rq = eo3(pg(t, r, .6));
      g.fillStyle = C.green;
      g.fillRect(.4 * wl, 0, .15 * wl * rq, hl);
      g.fillStyle = C.green3;
      g.fillRect(.4 * wl, hl * .7, .15 * wl * rq, hl * .3);
      const fq = eo3(pg(t, f90 + .2, .5));
      g.fillStyle = C.grey;
      g.fillRect(.9 * wl, 0, .1 * wl * fq, hl);
      if (t > r + 1) {
        const sq = eo3(pg(t, r + 1, .4));
        line([.9 * wl, hl * .86], [.9 * wl + .1 * wl * sq, hl * .14], C.fall, 12);
      }
      text("0", 14, hl - 26, 62, C.white);
      text("100%", wl - 14, hl - 26, 62, C.white, {align: "right"});
    });
    const m1 = I.p(-3.3, P(95), zb + hh + .7), m2 = I.p(-3.3, P(47.5), zb + hh + .7);
    tag(tx("s12_90"), m1[0] - 40, m1[1] - 72, t, f90, C.grey, {size: 30, tc: C.bg});
    tag(tx("s12_real"), m2[0], m2[1] - 76, t, r, C.rise, {size: 32});
    // стрелка-указатель уезжает с «девяноста» в реальность
    if (t > f90 - .3) {
      const pct = lerp(90, 47.5, eio(pg(t, r - .3, 1.2))), m = I.p(-3.3, P(pct), zb + hh + .2), q = back(pg(t, f90 - .3, .3));
      arrowUp(m[0], m[1] - 18, 22 * q, C.amber, 1);
    }
    // реклама-пародия на телевизоре
    const blink = Math.floor(t * 4) % 2;
    const adQ = eo3(pg(t, ad - .6, .6));
    if (adQ > 0) {
      const z0 = lerp(-7, 0, adQ);
      g.save();
      tvSet(I, 1.2, -1.4, 6.8, 3.8, .9 + z0, null, (w, h) => {
        g.fillStyle = blink ? C.amber : C.crim2;
        g.fillRect(0, 0, w, h);
        g.fillStyle = blink ? C.bg : C.white;
        text("100%", w / 2, 180, 170, blink ? C.bg : C.white, {align: "center"});
        text("ПРИБЫЛЬНЫХ", w / 2, 262, 66, blink ? C.bg : C.white, {align: "center"});
        text("СДЕЛОК!!!", w / 2, 334, 66, blink ? C.bg : C.white, {align: "center"});
        const c = pg(t, xx, .3);
        if (c > 0) {
          line([40, 30], [lerp(40, w - 40, c), lerp(30, h - 30, c)], C.white, 34);
          line([w - 40, 30], [lerp(w - 40, 40, c), lerp(30, h - 30, c)], C.white, 34);
          line([40, 30], [lerp(40, w - 40, c), lerp(30, h - 30, c)], C.red, 22);
          line([w - 40, 30], [lerp(w - 40, 40, c), lerp(30, h - 30, c)], C.red, 22);
        }
      }, {console: 0});
      g.restore();
    }
    foreground(v, t, .45);
    rightFade();
    note("s12_n1", NOTE_X, 210, 52, C.amber, t, {lh: 62});
    note("s12_n2", NOTE_X, 400, 42, C.white, t, {block: C.green, lh: 52});
    note("s12_n3", NOTE_X, 560, 42, C.fall, t, {block: C.fall, lh: 52});
    note("s12_n4", NOTE_X, 720, 44, C.rise, t, {lh: 54});
  },
};

// ---------- 13. Глава 12: три причины ----------

function erraticArrow(w, h, t, t0, heat) {
  const pts = [], r = rng(1301);
  for (let i = 0; i < 40; i++) pts.push([70 + r() * (w - 140), 130 + r() * (h - 220)]);
  const f = Math.max(0, t - t0) * 2.2, k = Math.floor(f) % 38, x = eio(f - Math.floor(f));
  const p = [lerp(pts[k][0], pts[k + 1][0], x), lerp(pts[k][1], pts[k + 1][1], x)];
  g.setLineDash([9, 9]);
  g.strokeStyle = "rgba(247,243,238,.4)";
  g.lineWidth = 3;
  g.beginPath();
  for (let i = Math.max(0, k - 4); i <= k; i++) i === Math.max(0, k - 4) ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]);
  g.lineTo(p[0], p[1]);
  g.stroke();
  g.setLineDash([]);
  g.save();
  g.translate(p[0], p[1]);
  g.rotate(Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]) - Math.PI / 2);
  arrowUp(0, 0, 34, C.amber, 1);
  g.restore();
}

function equity(w, h, t, t0, dur, pts, col) {
  const rev = clamp((t - t0) / dur) * (pts.length - 1), yOf = p => h - 40 - p * (h - 190), xOf = i => 30 + i / (pts.length - 1) * (w - 60);
  g.beginPath();
  g.moveTo(xOf(0), yOf(pts[0]));
  const n = Math.floor(rev);
  for (let i = 1; i <= n; i++) g.lineTo(xOf(i), yOf(pts[i]));
  if (n < pts.length - 1) g.lineTo(lerp(xOf(n), xOf(n + 1), rev - n), lerp(yOf(pts[n]), yOf(pts[n + 1]), rev - n));
  g.strokeStyle = col;
  g.lineWidth = 7;
  g.lineJoin = "round";
  g.stroke();
}

const EQ2 = [.1, .16, .22, .3, .36, .44, .5, .58, .64, .72, .8, .04, .03];
const EQ3 = (() => { const r = rng(1303), out = [.4]; for (let i = 0; i < 26; i++) out.push(clamp(out[i] + (i % 2 ? 1 : -1) * (.12 + r() * .3), .03, .96)); return out; })();

SC[13] = {
  draw(t, a, b) {
    const R = [0, 1, 2].map(i => e("s13_r" + i)), X = [0, 1, 2].map(i => e("s13_x" + i)), Y = [0, 1, 2].map(i => e("s13_y" + i));
    const v = camera(t, [[a, 610, 530, .96, 56], [R[0], 430, 510, 1.14, 66], [R[1], 610, 500, 1.14, 62], [R[2], 790, 490, 1.14, 58], [Y[0] - .6, 610, 530, .98, 62], [b, 610, 530, .98, 60]]);
    backdrop(v, t, C.crim, {glow: .12});
    applyCam(v);
    const I = new Iso(640, 830, 70, v.th);
    plate(I, -5, -9.4, 11, 18.8, C.plate);
    pool(I, 1, 0, 4.4, C.red, 23, t, {ry: 1.9});
    const names = ["s13_t0", "s13_t1", "s13_t2"];
    [2, 1, 0].forEach(idx => {
      if (t < R[idx] - .5) return;
      const i = idx, y = [5.3, 0, -5.3][i], at = R[i], q = back(pg(t, at - .5, .5));
      const hh = 6.4 * q, wd = 4.9, x = -2.4;
      box(I, x - .2, y - wd / 2 - .1, 0, .7, wd + .2, .25, ["#3F3C49", "#26242F", "#17151D"], {grain: 0, edge: 0});
      box(I, x - .1, y - wd / 2, .2, .1 + .06, wd, hh, [C.cream, tone(C.cream, -.3), tone(C.cream, -.4)], {grain: 0, edge: 0});
      onWallX(I, x + .06, y + wd / 2 - .08, .2 + hh - .08, () => {
        const w = (wd - .16) * 100, h = (hh - .16) * 100;
        g.beginPath();
        g.rect(0, 0, w, h);
        g.clip();
        screenBg(w, h, C.ink, .05, 44);
        const title = tx(names[i]).split("\n");
        title.forEach((s, j) => text(s, 26, 62 + j * 50, 44, C.white));
        const done = t > Y[i] ? 1 : 0;
        if (!done) {
          if (i === 0) erraticArrow(w, h, t, at, 1);
          if (i === 1) equity(w, h, t, at + .4, X[1] - at - .4, EQ2, C.rise);
          if (i === 2) equity(w, h, t, at + .3, X[2] - at - .3, EQ3, C.amber);
        } else {
          const up = eo3(pg(t, Y[i] + .2, .6));
          const ok = [.1, .16, .14, .26, .3, .28, .42, .5, .46, .6, .68];
          equity(w, h, t, Y[i], 1.4, ok, C.rise);
        }
        const cq = pg(t, X[i], .3);
        const flip = pg(t, Y[i], .3);
        if (cq > 0 && flip < 1) {
          cross(w / 2, h / 2 + 30, 110 * (1 - flip * .9), cq, C.crim2, 40);
        }
        if (flip > 0) {
          const s = back(flip);
          g.fillStyle = C.rise;
          g.beginPath();
          g.arc(w - 74, h - 74, 48 * s, 0, 7);
          g.fill();
          tick(w - 74, h - 74, 25, flip, C.bg, 10);
        }
      });
      const m = I.p(x + .06, y, -.1);
      tag(tx("s13_y" + i), m[0], m[1] + 34, t, Y[i], C.rise, {size: 30});
    });
    foreground(v, t, .45);
    rightFade();
    note("s13_n0", NOTE_X, 210, 46, C.white, t, {block: C.crim2, lh: 56});
    note("s13_n1", NOTE_X, 380, 46, C.white, t, {block: C.crim2, lh: 56});
    note("s13_n2", NOTE_X, 550, 46, C.white, t, {block: C.crim2, lh: 56});
    note("s13_n3", NOTE_X, 730, 44, C.amber, t, {lh: 54});
  },
};
