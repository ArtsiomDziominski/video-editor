"use strict";
// Выпуск 3: глава 4 — весы спроса и предложения.

function hangDish(I, x, y, z, r, col) {
  const n = 30, ring = (rr, zz) => Array.from({length: n}, (_, i) => I.p(x + Math.cos(i / n * 6.283) * rr, y + Math.sin(i / n * 6.283) * rr, zz));
  const body = hullOf([...ring(r, z), ...ring(r * .62, z - .34)]);
  const lg = g.createLinearGradient(I.p(x - r, y)[0], 0, I.p(x + r, y)[0], 0);
  lg.addColorStop(0, tone(col, .08));
  lg.addColorStop(1, tone(col, -.4));
  poly(body, lg);
  poly(ring(r, z), tone(col, .22));
  poly(ring(r * .86, z + .01), tone(col, -.1));
}

function bounceH(dt) {        // падение с двумя отскоками: высота 1 → 0
  if (dt < 0) return 1;
  const T = .3;
  if (dt < T) return 1 - (dt / T) ** 2;
  const a = dt - T;
  if (a < .22) return .12 * (1 - ((a - .11) / .11) ** 2);
  const b = a - .22;
  if (b < .12) return .03 * (1 - ((b - .06) / .06) ** 2);
  return 0;
}

const FIG_SPOTS = [[0, 0], [-.7, .2], [.6, -.3], [-.2, -.75], [.25, .75], [-.85, -.45], [.85, .3], [-.55, .7]];
const S5 = {};

function s5setup() {
  if (S5.up) return;
  S5.buy = [0, 1, 2, 3, 4].map(i => e("s5_b" + i));
  S5.sell = [0, 1, 2, 3, 4, 5, 6, 7].map(i => e("s5_s" + i));
  S5.buy2 = [0, 1, 2].map(i => e("s5_e" + i));
  S5.wt = [0, 1, 2, 3, 4].map(i => e("s5_w" + i));
  S5.up = candlesOf([[0, .42], [3, .4], [8, .62], [14, .84]], 501, .04, 1.4);
  S5.down = candlesOf([[0, .84], [3, .78], [8, .46], [14, .3]], 502, .04, 1.4);
  S5.side = candlesOf([[0, .3], [3, .44], [6, .32], [9, .45], [12, .33]], 503, .03, 1.2);
  S5.last = candlesOf([[0, .33], [3, .3], [7, .52], [11, .7]], 504, .03, 1.4);
}

function drawScaleChart(t, w, h) {
  screenBg(w, h, C.ink, .05, 52);
  const yOf = p => h - 26 - p * (h - 52), parts = [
    [S5.up, e("s5_b0"), e("s5_upEnd")],
    [S5.down, e("s5_s0"), e("s5_downEnd")],
    [S5.side, e("s5_eq"), e("s5_sideEnd")],
    [S5.last, e("s5_w0"), e("s5_lastEnd")],
  ];
  const total = parts.reduce((n, q) => n + q[0].length, 0), dx = (w - 40) / Math.max(total, 1);
  let i0 = 0, view = 0;
  // Лента свечей едет только когда новых свечей уже не хватает на экране
  let shown = 0;
  for (const [list, a, b] of parts) shown += clamp((t - a) / (b - a)) * list.length;
  g.save();
  g.translate(20 - view, 0);
  for (const [list, a, b] of parts) {
    const rev = clamp((t - a) / (b - a)) * list.length;
    candles(list, i0 * dx, dx, yOf, rev, {w: dx * .66});
    i0 += list.length;
  }
  const a = e("s5_eq"), s0 = parts[0][0].length + parts[1][0].length;
  const q = eo3(pg(t, a + .7, .5));
  if (q > 0) {
    g.fillStyle = rgba(C.sky, .15);
    g.fillRect(s0 * dx - 6, yOf(.47), S5.side.length * dx * q + 12, yOf(.28) - yOf(.47));
    g.fillStyle = C.sky;
    g.fillRect(s0 * dx - 6, yOf(.47), S5.side.length * dx * q + 12, 3);
    g.fillRect(s0 * dx - 6, yOf(.28), S5.side.length * dx * q + 12, 3);
  }
  g.restore();
}

SC[5] = {
  draw(t, a, b) {
    s5setup();
    const v = camera(t, [[a, 600, 560, 1.16, 30], [e("s5_vesy"), 610, 540, 1.04, 24], [e("s5_b0"), 560, 530, 1.05, 20], [e("s5_s0"), 660, 530, 1.05, 27],
      [e("s5_eq"), 610, 520, 1.0, 22], [e("s5_w0"), 610, 560, 1.1, 19], [e("s5_w4"), 590, 540, 1.04, 26], [b, 610, 530, 1.0, 22]]);
    backdrop(v, t, C.sky, {glow: .14});
    applyCam(v);
    const I = new Iso(610, 770, 66, v.th);

    // сумма импульсов: каждая фигурка наклоняет коромысло, а пружина даёт ему вес
    let phi = 0;
    const kick = (ts, d) => { for (const q of ts) phi += d * spring(t - q - .3, 1.1, 2.6); };
    kick(S5.buy, .056);
    kick(S5.sell, -.056);
    kick(S5.buy2, .056);
    S5.wt.forEach((q, i) => { phi += (i % 2 ? -.075 : .095) * spring(t - q - .3, 1.1, 2.6); });
    phi = clamp(phi, -.34, .34);

    plate(I, -7, -4.6, 14, 8.6, C.plate);
    pool(I, 0, -.2, 4.9, C.navy, 5, t, {ry: .72});
    // экран с графиком за весами
    box(I, -5.4, -4.1, 0, .22, .22, 3.4, [C.plate2, "#201E27", "#17151D"], {grain: 0, edge: 0});
    box(I, 5.2, -4.1, 0, .22, .22, 3.4, [C.plate2, "#201E27", "#17151D"], {grain: 0, edge: 0});
    box(I, -5.7, -4.1, 3.2, 11.4, .24, 4.9, ["#34323E", "#1B1921", "#15131B"], {grain: 0, edge: "#55525E"});
    onWallY(I, -5.58, -3.86, 7.98, () => {
      g.beginPath();
      g.rect(0, 0, 1116, 466);
      g.clip();
      drawScaleChart(t, 1116, 466);
    });

    const Z = 5.1, L = 4.5, pivot = [0, 0], cs = Math.cos(phi), sn = Math.sin(phi);
    const endL = {x: -L * cs, z: Z - L * sn}, endR = {x: L * cs, z: Z + L * sn}, drop = 2.5;
    const sway = (ts, f) => ts.reduce((s, q) => s + wob(t - q - .3, 1.3, 2.4) * .12, 0) + Math.sin(t * f) * .03;
    const swL = sway(S5.buy.concat(S5.buy2), 1.1), swR = sway(S5.sell, 1.3);
    const pl = {x: endL.x + swL, y: 0, z: endL.z - drop}, pr = {x: endR.x + swR, y: 0, z: endR.z - drop};
    const heavyL = phi > .02, heavyR = phi < -.02;

    const blob = (P) => {
      const n = 24, r = 1.5 - P.z * .1;
      poly(Array.from({length: n}, (_, i) => I.p(P.x + Math.cos(i / n * 6.283) * r, Math.sin(i / n * 6.283) * r)), rgba("#0C0A12", .3));
    };
    blob(pl);
    blob(pr);
    box(I, -1.5, -1.5, 0, 3, 3, .34, [C.tan, C.tan2, tone(C.tan2, -.3)], {grain: 0});

    const dish = (P, col, end, side) => {
      const r = 1.42;
      for (const q of [[-1, 0], [1, 0], [0, -1]]) {
        line(I.p(end.x, 0, end.z), I.p(P.x + q[0] * r * .92, P.y + q[1] * r * .92, P.z), C.grey, 2);
      }
      hangDish(I, P.x, P.y, P.z, r, col);
    };
    const dish2 = (P, end) => line(I.p(end.x, 0, end.z), I.p(P.x, P.y + 1.42 * .92, P.z), C.grey, 2);
    const figs = (P, ts, col, dir, tt = 0) => ts.forEach((q, i) => {
      const dt = t - q, sp = FIG_SPOTS[(i + tt) % FIG_SPOTS.length];
      if (dt < 0) return;
      const h = bounceH(dt) * 4.2, m = I.p(P.x + sp[0], P.y + sp[1], P.z + .02 + h);
      const squash = 1 + wob(dt - .3, 4, 8) * .25;
      g.save();
      g.translate(m[0], m[1]);
      g.scale(1 + (squash - 1) * .6, 2 - squash);
      poly([[-13, 3], [0, -3.5], [13, 3], [0, 8]], "rgba(12,10,18,.3)");
      arrowUp(0, -32, 26, col, dir);
      g.fillStyle = tone(col, -.3);
      g.fillRect(2.5, dir < 0 ? -32 : -56, 7, 46);
      g.restore();
    });

    dish(pl, C.green, endL, 1);
    figs(pl, S5.buy, C.rise, -1);
    figs(pl, S5.buy2, C.rise, -1, 5);
    const wx = [[-.5, .25], [.55, -.2], [0, .7]];
    S5.wt.forEach((q, i) => {
      if (i % 2) return;
      const dt = t - q;
      if (dt < 0) return;
      const P = pl, sp = wx[i / 2], h = bounceH(dt) * 4.6, z = P.z + h;
      cyl(I, P.x + sp[0], P.y + sp[1], z, .3, .34, C.amber);
      cyl(I, P.x + sp[0], P.y + sp[1], z + .34, .12, .14, C.amber2);
    });
    dish2(pl, endL);

    box(I, -.2, -.2, .34, .4, .4, Z - .34, [C.white, C.tan, C.tan2], {grain: .12});
    const pts = (u, y, zz) => I.p(u * cs, y, Z + u * sn + zz);
    poly([pts(-L, -.16, .14), pts(L, -.16, .14), pts(L, .16, .14), pts(-L, .16, .14)], C.white);
    poly([pts(-L, .16, .14), pts(L, .16, .14), pts(L, .16, -.1), pts(-L, .16, -.1)], C.tan);
    cyl(I, 0, 0, Z - .3, .34, .68, [C.amber, C.amber2, tone(C.amber2, -.3)]);
    for (const u of [-L, L]) {
      const m = pts(u, 0, 0);
      g.fillStyle = C.amber;
      g.beginPath();
      g.arc(m[0], m[1], 9, 0, 7);
      g.fill();
    }

    dish(pr, C.crim, endR, -1);
    figs(pr, S5.sell, C.fall, 1);
    S5.wt.forEach((q, i) => {
      if (!(i % 2)) return;
      const dt = t - q;
      if (dt < 0) return;
      const P = pr, sp = wx[(i - 1) / 2], h = bounceH(dt) * 4.6, z = P.z + h;
      cyl(I, P.x + sp[0], P.y + sp[1], z, .3, .34, C.amber);
      cyl(I, P.x + sp[0], P.y + sp[1], z + .34, .12, .14, C.amber2);
    });
    dish2(pr, endR);

    // подписи чаш и гирек живут в мире
    const lp = I.p(pl.x, pl.y + 1.42, pl.z - .3), rp = I.p(pr.x, pr.y + 1.42, pr.z - .3);
    tag(tx("s5_lb"), lp[0] - 10, lp[1] + 24, t, e("s5_lb"), C.rise, {size: 27});
    tag(tx("s5_rb"), rp[0], rp[1] + 24, t, e("s5_rb"), C.fall, {size: 27, tc: C.white});
    S5.wt.forEach((q, i) => {
      const P = i % 2 ? pr : pl, m = I.p(P.x, P.y, P.z + 2.2 + (i % 3) * .45), k = "s5_wt" + i;
      if (t > q && t < q + 2.1) tag(tx(k), m[0] + (i % 2 ? 70 : -70), m[1] - 46 * (i % 3), t, q - .12, C.amber, {size: 27});
    });
    if (t > e("s5_eq") + .8 && t < e("s5_w0")) {
      const m = I.p(0, -3.86, 8.5);
      tag(tx("s5_side"), m[0] + 90, m[1] + 8, t, e("s5_side"), C.sky, {size: 27, tc: C.white});
    }

    foreground(v, t, .5);
    rightFade();
    note("s5_q", NOTE_X, 210, 56, C.white, t, {block: C.coral, off: e("s5_n1") - .4, lh: 66});
    note("s5_n1", NOTE_X, 230, 50, C.rise, t, {block: C.rise, lh: 60});
    note("s5_n2", NOTE_X, 420, 50, C.fall, t, {block: C.fall, lh: 60});
    note("s5_n3", NOTE_X, 620, 50, C.amber, t, {block: C.amber, lh: 60});
  },
};
