"use strict";
// Выпуск 3: большая студия с экраном и главы 1–3.

// Студия: большой экран смотрит на +x. Экран почти фронтально при th ≈ 68
function studio(I, t, pool_, glow, scr, o = {}) {
  const cy = o.cy ?? 0, wd = o.wd ?? 12.4;
  plate(I, -5.2, -7.4, 11.6, 14.6, C.plate);
  pool(I, .6, cy, 4.6, pool_, o.seed ?? 4, t, {ry: 1.3});
  lightCone(I, -3.3, cy, wd - 1.4, 7, 1.2, glow, .24);
  if (o.back) o.back();
  tvSet(I, -3.3, cy, wd, o.hh ?? 7, 1.1, null, scr);
  if (o.front) o.front();
}

function markArrow(x, y, dir, col, label, t, t0, o = {}) {     // dir -1: стрелка смотрит вверх и стоит ниже цены
  const dt = t - t0;
  if (dt < 0) return;
  const q = back(clamp(dt / .26)), s = 25 * q, yy = y + dir * -46 + (1 - eo3(clamp(dt / .26))) * dir * -70;
  arrowUp(x, yy, s, col, dir);
  tag(label, x, dir < 0 ? yy + 36 : yy - 92, t, t0 + .04, col, {size: o.size ?? 34, tc: o.tc ?? C.bg});
}

function bracket(x0, x1, y0, y1, col, p) {     // вертикальная скоба разницы
  const x = (x0 + x1) / 2;
  g.fillStyle = rgba(col, .16);
  g.fillRect(x0, y1, x1 - x0, (y0 - y1) * p);
  g.fillRect(x0, y0 - (y0 - y1) * p, x1 - x0, 0);
  line([x1 + 16, y0], [x1 + 16, lerp(y0, y1, p)], col, 4);
  line([x1 + 6, y0], [x1 + 26, y0], col, 4);
  if (p >= 1) line([x1 + 6, y1], [x1 + 26, y1], col, 4);
}

// ---------- 2. Глава 1: купил, продал, разница, шорт ----------

const S2 = {};

function s2setup() {
  if (S2.up) return;
  S2.up = candlesOf([[0, .46], [4, .36], [8, .22], [14, .4], [20, .68], [23, .78]], 211, .04, 1.6);
  S2.dn = candlesOf([[0, .62], [5, .76], [8, .82], [13, .62], [20, .3], [23, .22]], 212, .04, 1.6);
}

function compass(I, x, y, t, ang, col) {
  cyl(I, x, y, 0, 1.28, .22, [C.white, C.tan, C.tan2]);
  cyl(I, x, y, .22, 1.06, 0, [C.navy2, C.navy2, C.navy2]);
  const m = [Math.cos(ang), Math.sin(ang)], b = I.p(x - m[0] * .9, y - m[1] * .9, .26), a = I.p(x + m[0] * .96, y + m[1] * .96, .26);
  const nx = -(a[1] - b[1]) * .1, ny = (a[0] - b[0]) * .1;
  poly([a, [(a[0] + b[0]) / 2 + nx, (a[1] + b[1]) / 2 + ny], [(a[0] + b[0]) / 2 - nx, (a[1] + b[1]) / 2 - ny]], col);
  poly([b, [(a[0] + b[0]) / 2 + nx, (a[1] + b[1]) / 2 + ny], [(a[0] + b[0]) / 2 - nx, (a[1] + b[1]) / 2 - ny]], C.grey);
}

SC[2] = {
  draw(t, a, b) {
    s2setup();
    const sw = e("s2_sw");
    const v = camera(t, [[a, 610, 540, .98, 56], [e("s2_buy") - 1, 610, 530, 1.0, 66], [e("s2_gap"), 680, 470, 1.08, 68], [e("s2_year"), 620, 520, 1.0, 64],
      [sw, 610, 530, 1.0, 70], [e("s2_gap2"), 620, 520, 1.08, 68], [e("s2_dir"), 590, 600, .96, 62], [b, 600, 610, .96, 60]]);
    backdrop(v, t, C.sky, {glow: .14});
    applyCam(v);
    const I = new Iso(745, 875, 78, v.th), compAt = e("s2_dir");
    const swirl = t < compAt ? 0 : (1 - eo3(pg(t, compAt, 2.2))) * 26;
    studio(I, t, C.navy, C.sky, (w, h) => {
      screenBg(w, h, C.ink);
      const dx = (w - 150) / 23, x0 = 40, yOf = p => h - 40 - p * (h - 100), first = t < sw, list = first ? S2.up : S2.dn;
      const fl = pg(t, sw - .1, .16) * (1 - pg(t, sw + .06, .16));
      const t0 = first ? e("s2_show") : sw + .1, t1 = first ? e("s2_sell") + .2 : e("s2_buy2") + .4;
      const n = clamp((t - t0) / (t1 - t0)) * list.length;
      candles(list, x0, dx, yOf, n);
      const cx = i => x0 + dx * (i + .5);
      if (first) {
        const y0 = yOf(.22), y1 = yOf(.78), gap = eo3(pg(t, e("s2_gap"), .5));
        if (gap > 0) bracket(cx(8), cx(22), y0, y1, C.amber, gap);
        markArrow(cx(8), y0, -1, C.sky, tx("s2_buy"), t, e("s2_buy"));
        markArrow(cx(22), y1, 1, C.rise, tx("s2_sell"), t, e("s2_sell"));
        tag(tx("s2_gap"), cx(15) + 6, (y0 + y1) / 2 - 20, t, e("s2_gap") + .2, C.amber, {size: 30});
      } else {
        const y0 = yOf(.82), y1 = yOf(.22), gap = eo3(pg(t, e("s2_gap2"), .5));
        if (gap > 0) {
          g.fillStyle = rgba(C.amber, .15);
          g.fillRect(cx(8), y0, (cx(22) - cx(8)), (y1 - y0) * gap);
        }
        markArrow(cx(7.5), y0, 1, C.sky, tx("s2_sell2"), t, e("s2_sell2"));
        markArrow(cx(22), y1, -1, C.rise, tx("s2_buy2"), t, e("s2_buy2"));
        tag(tx("s2_gap2"), cx(16), (y0 + y1) / 2 - 90, t, e("s2_gap2") + .2, C.amber, {size: 30});
      }
      if (fl > 0) { g.fillStyle = rgba(C.white, fl * .7); g.fillRect(0, 0, w, h); }
    }, {
      front() {
        const ang = -1.1 + Math.sin(t * 4.2 + 1) * swirl * .1 + swirl * .4;
        compass(I, .8, 3.2, t, ang, C.amber);
      },
    });
    foreground(v, t, .45);
    rightFade();
    note("s2_n1", NOTE_X, 210, 58, C.amber, t, {lh: 68});
    note("s2_n2", NOTE_X, 420, 44, C.white, t, {block: C.coral, lh: 54});
    note("s2_n3", NOTE_X, 560, 44, C.white, t, {block: C.sky, lh: 54});
    note("s2_n4", NOTE_X, 720, 62, C.fall, t, {block: C.fall});
  },
};

// ---------- 3. Глава 2: маленькое движение и плечо ----------

const S3 = {};

function s3setup() {
  if (S3.base) return;
  S3.base = candlesOf([[0, .38], [6, .42], [12, .4], [18, .44], [24, .43]], 311, .02, .8);
  S3.up = candlesOf([[0, .43], [5, .52]], 312, .012, .5);
  S3.dn = candlesOf([[0, .52], [5, .43]], 313, .012, .5);
}

function gauge(I, x, y, t, level, col, unit) {   // шкала-башня: ноль посередине, столбик растёт вверх или вниз
  const Z0 = 5, hh = 9.4, wd = 1.5;
  box(I, x, y - wd / 2, .3, .9, wd, hh, [C.plate2, "#26242F", "#34323E"], {grain: 0, edge: "#6A6774"});
  onWallX(I, x + .9, y + wd / 2, .3 + hh, () => {
    g.strokeStyle = "rgba(247,243,238,.6)";
    g.lineWidth = 3;
    g.beginPath();
    for (let z = 0; z <= 10; z++) {
      const yy = (hh - Z0 + .3 + (5 - z) * unit) * 100;
      g.moveTo(0, yy);
      g.lineTo(z === 5 ? 150 : 28, yy);
    }
    g.stroke();
    const y0 = (hh - Z0 + .3) * 100, len = level * unit * 100;
    g.fillStyle = col;
    g.fillRect(44, Math.min(y0, y0 - len), 80, Math.abs(len));
    g.fillStyle = tone(col, -.3);
    g.fillRect(96, Math.min(y0, y0 - len), 28, Math.abs(len));
  });
}

function magnifier(x, y, r, p, draw) {
  g.save();
  g.translate(x, y);
  g.scale(p, p);
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.save();
  g.clip();
  g.fillStyle = "#26242F";
  g.fillRect(-r, -r, r * 2, r * 2);
  draw();
  g.restore();
  g.strokeStyle = C.amber;
  g.lineWidth = 12;
  g.stroke();
  g.strokeStyle = C.tan;
  g.lineWidth = 18;
  g.lineCap = "round";
  line([r * .72, r * .72], [r * 1.5, r * 1.5], C.tan, 20);
  line([r * .72, r * .72], [r * 1.42, r * 1.42], C.amber2, 8);
  g.restore();
}

SC[3] = {
  draw(t, a, b) {
    s3setup();
    const v = camera(t, [[a, 610, 540, .98, 58], [e("s3_small"), 560, 520, 1.04, 68], [e("s3_many"), 590, 530, 1.0, 66], [e("s3_lev"), 640, 520, 1.0, 64],
      [e("s3_five"), 720, 420, 1.0, 62], [e("s3_both"), 650, 530, 1.0, 66], [e("s3_minus"), 700, 540, 1.0, 60], [e("s3_lens"), 560, 520, 1.04, 68], [b, 590, 530, 1.0, 64]]);
    backdrop(v, t, C.amber, {glow: .13});
    applyCam(v);
    const I = new Iso(745, 875, 78, v.th);
    const lvl = (e("s3_five") < t ? eo3(pg(t, e("s3_five"), .5)) : 0) * (1 - eio(pg(t, e("s3_both"), .5))), neg = pg(t, e("s3_minus"), .6);
    const stretch = spring(t - e("s3_five"), 1.6, 3.6) * (1 - eio(pg(t, e("s3_both"), .5))) - spring(t - e("s3_minus"), 1.6, 3.6) * (1 - eio(pg(t, e("s3_lens"), .6)));
    const small = pg(t, e("s3_lev"), .4) * (1 - pg(t, e("s3_lens"), .6));
    studio(I, t, C.amber2, C.amber, (w, h) => {
      screenBg(w, h, C.ink);
      const yOf = p => h - 70 - (p - .3) * h * 2.5, dx = (w - 120) / 30.5, x0 = 40;
      const n = clamp((t - a - 1) / 3.2) * S3.base.length;
      candles(S3.base, x0, dx, yOf, n);
      const up = pg(t, e("s3_small"), .9), down = pg(t, e("s3_both"), .9) * (t > e("s3_both") ? 1 : 0);
      const down_ = t >= e("s3_both");
      candles(down_ ? S3.dn : S3.up, x0 + dx * 24, dx, yOf, (down_ ? pg(t, e("s3_both"), .9) : up) * 5);
      const y0 = yOf(.43), y1 = yOf(.52), q = eo3(pg(t, e("s3_small"), .5)), lensAt = e("s3_lens"), lq = eo3(pg(t, lensAt, .6));
      g.fillStyle = rgba(C.amber, .16 * q);
      g.fillRect(x0 + dx * 23.6, y1 - 6, dx * 6, y0 - y1 + 12);
      tag(tx("s3_small"), x0 + dx * 27, y1 - 80, t, e("s3_small") + .3, C.amber, {size: 34});
      if (lq > 0) {
        const lx = lerp(w * .3, w * .46, Math.sin((t - lensAt) * .5) ** 2);
        const ly = yOf(.41);
        magnifier(lx, ly, 170, lq, () => {
          g.scale(2.2, 2.2);
          g.translate(-lx, -ly);
          candles(S3.base, x0, dx, yOf, 99);
          candles(down_ ? S3.dn : S3.up, x0 + dx * 24, dx, yOf, 99);
        });
      }
    }, {
      wd: 9.4, hh: 6.8, cy: 1.5,
      front() {
        const level = small * lerp(1, 5, clamp(stretch)) * (t >= e("s3_both") ? clamp(-stretch) > 0 ? -1 : 1 : 1);
        const col = level < 0 ? C.fall : C.rise, lv = (t >= e("s3_both") ? -1 : 1) * small * (t >= e("s3_both") ? lerp(1, 5, clamp(-stretch)) : lerp(1, 5, clamp(stretch)));
        gauge(I, -2.4, -4.4, t, lv, lv < 0 ? C.fall : C.rise, .86);
        const m = I.p(-1.9, -4.4, 8.7);
        tag(tx("s3_lev"), m[0] + 28, m[1] - 18, t, e("s3_lev"), C.amber, {size: 30});
      },
    });
    foreground(v, t, .45);
    rightFade();
    note("s3_n1", NOTE_X, 210, 48, C.amber, t, {lh: 56});
    note("s3_n2", NOTE_X, 350, 40, C.white, t, {block: C.coral, lh: 50});
    note("s3_n3", NOTE_X, 490, 56, C.rise, t, {block: C.rise});
    note("s3_n4", NOTE_X, 570, 56, C.fall, t, {block: C.fall});
    note("s3_n5", NOTE_X, 700, 48, C.white, t, {block: C.amber, lh: 56});
  },
};

// ---------- 4. Глава 3: инвестор и трейдер ----------

const S4 = {};

function s4setup() {
  if (S4.inv) return;
  S4.inv = candlesOf([[0, .12], [10, .3], [18, .22], [30, .5], [38, .42], [50, .78]], 411, .02);
  S4.tr = candlesOf([[0, .4], [4, .3], [8, .56], [12, .44], [16, .34], [20, .62]], 412, .018);
}

function miniTV(I, x, y, wd, hh, zb, scr) {
  box(I, x - .3, y - .5, 0, .9, 1, zb, ["#2A2833", "#17151D", "#100F15"], {grain: 0, edge: 0});
  tvSet(I, x, y, wd, hh, zb, null, scr, {console: 0});
}

SC[4] = {
  draw(t, a, b) {
    s4setup();
    const v = camera(t, [[a, 610, 530, 1.0, 60], [e("s4_inv"), 500, 520, 1.06, 64], [e("s4_tr"), 720, 490, 1.06, 62], [e("s4_prot"), 700, 490, 1.04, 66],
      [e("s4_same"), 610, 530, 1.0, 60], [e("s4_mix"), 610, 550, 1.0, 62], [b, 610, 530, 1.0, 60]]);
    backdrop(v, t, C.teal, {glow: .12});
    applyCam(v);
    const I = new Iso(650, 850, 65, v.th);
    plate(I, -4.6, -9, 9.4, 18, C.plate);
    pool(I, 0, 3.4, 2.9, C.sky2, 7, t, {ry: 1.5});
    pool(I, 0, -3.8, 2.9, C.red, 9, t, {ry: 1.5});
    const hopAt = e("s4_mix");
    miniTV(I, -2.4, -4.2, 7.2, 5.6, 1.6, (w, h) => {
      screenBg(w, h, C.ink);
      const yOf = p => h - 30 - p * (h - 70), dx = (w - 60) / 20, x0 = 30;
      const n = clamp((t - e("s4_tr")) / 2.4) * S4.tr.length;
      candles(S4.tr, x0, dx, yOf, n);
      const trades = [[4, .3, .24], [12, .44, .38], [16, .34, .28]];
      trades.forEach(([i, p, stop], k) => {
        const at = e("s4_prot") + k * .36, q = eo3(pg(t, at, .35)), xx = x0 + dx * (i + .5);
        if (q <= 0) return;
        g.fillStyle = C.sky;
        g.beginPath();
        g.arc(xx, yOf(p), 7, 0, 7);
        g.fill();
        g.fillStyle = C.fall;
        g.fillRect(xx - 10, yOf(stop), 96 * q, 4);
      });
    });
    tag(tx("s4_tr"), I.p(-2.4, -4.4, 7.7)[0], I.p(-2.4, -4.4, 7.7)[1] - 30, t, e("s4_tr"), C.crim2, {size: 32, tc: C.white});
    miniTV(I, -2.4, 4, 7.2, 5.6, 1.6, (w, h) => {
      screenBg(w, h, C.ink);
      const yOf = p => h - 30 - p * (h - 70), dx = (w - 60) / 50, x0 = 30;
      const n = clamp((t - e("s4_inv")) / 3.6) * S4.inv.length;
      candles(S4.inv, x0, dx, yOf, n);
      const q = eo3(pg(t, e("s4_inv") + .3, .35));
      if (q > 0) {
        g.fillStyle = C.sky;
        g.beginPath();
        g.arc(x0 + dx * .5, yOf(.12), 9 * q, 0, 7);
        g.fill();
      }
      const dip = eo3(pg(t, e("s4_dip"), .4));
      if (dip > 0) {
        g.fillStyle = rgba(C.fall, .18 * dip);
        g.fillRect(x0 + dx * 28, yOf(.56), dx * 11, yOf(.38) - yOf(.56));
      }
    });
    tag(tx("s4_inv"), I.p(-2.4, 4, 7.7)[0], I.p(-2.4, 4, 7.7)[1] - 30, t, e("s4_inv"), C.sky, {size: 32, tc: C.white});

    // перебежчик: зашёл как трейдер, в минусе ушёл к инвестору
    const dtH = t - hopAt;
    if (dtH > 0) {
      const A0 = I.p(2.2, -4.2, .1), B0 = I.p(2.2, 4, .1), hop = eio(clamp(dtH / 2.6)), m = arcAt(A0, B0, 240, hop);
      dashedArc(A0, B0, 240, C.amber, -t * 50, 3);
      diamond(A0[0], A0[1], 9, C.amber);
      diamond(B0[0], B0[1], 9, C.amber);
      arrowUp(m[0], m[1] - 34, 28, C.amber, 1);
      if (hop > .95) tag(tx("s4_mix"), B0[0], B0[1] + 26, t, hopAt + 2.5, C.amber, {size: 28});
    }

    foreground(v, t, .45);
    rightFade();
    // таблица сравнения: одна линия заголовков и три строки
    const X1 = NOTE_X + 150, X2 = NOTE_X + 400, y0 = 220;
    if (t > e("s4_row1") - .5) {
      text("ИНВЕСТОР", X1, y0, 32, C.sky, {w: 700});
      text("ТРЕЙДЕР", X2, y0, 32, C.crim2, {w: 700});
    }
    [["s4_row1", "СРОК"], ["s4_row2", "ВОПРОС"], ["s4_row3", "ЗАЩИТА"]].forEach(([k, name], i) => {
      const at = e(k), y = y0 + 100 + i * 140, q = eo3(pg(t, at, .4));
      if (q <= 0) return;
      g.fillStyle = "rgba(247,243,238,.14)";
      g.fillRect(NOTE_X, y - 62, 590 * q, 2);
      text(name, NOTE_X, y, 25, C.grey, {w: 600});
      const [l, r] = tx(k).split("|");
      reveal(l, X1, y, 34, C.white, t, at, {block: C.sky, lh: 40});
      reveal(r, X2, y, 34, C.white, t, at + .3, {block: C.crim2, lh: 40});
    });
    note("s4_n1", NOTE_X, 760, 44, C.amber, t, {lh: 54});
  },
};
