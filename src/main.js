/* main.js — render engine (static layer + dynamic overlays) and boot. */
(function () {

const MARGIN = 2;                       // cells of margin baked into static layer
let staticLayer = null, staticDirty = true;
let dpr = 1;
const _inv = HP.invalidateRegions;
HP.invalidateRegions = function () { staticDirty = true; _inv(); };

/* ================= STATIC LAYER ================= */
function rebuildStatic() {
  const C = HP.CELL, W = HP.GRID_W, H = HP.GRID_H;
  const w = (W + MARGIN * 2) * C, h = (H + MARGIN * 2) * C;
  if (!staticLayer) {
    staticLayer = document.createElement('canvas');
    staticLayer.width = w; staticLayer.height = h;
  }
  const g = staticLayer.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.save();
  g.translate(MARGIN * C, MARGIN * C);
  drawGround(g);
  drawUnderlay(g);
  drawFloors(g);
  if (HP.showGrid) drawGridLines(g);
  drawLabels(g);
  drawWalls(g);
  drawFences(g);
  g.restore();
  staticDirty = false;
}

function drawGround(g) {
  const C = HP.CELL;
  // lot slightly lighter than far grass + soft edge shadow
  g.save();
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
  g.fillStyle = HP.state.bg || '#aebfa0';
  g.fillRect(-MARGIN * C * 0.4, -MARGIN * C * 0.4,
    HP.GRID_W * C + MARGIN * C * 0.8, HP.GRID_H * C + MARGIN * C * 0.8);
  g.restore();
  // lawn mow stripes (deterministic)
  g.fillStyle = 'rgba(255,255,255,.045)';
  for (let y = 0; y < HP.GRID_H * C; y += C * 8)
    g.fillRect(-MARGIN * C * 0.4, y, HP.GRID_W * C + MARGIN * C * 0.8, C * 4);
  // grass speckle: dark flecks + light blades (deterministic)
  g.fillStyle = 'rgba(0,0,0,.05)';
  for (let i = 0; i < 900; i++) {
    const x = ((i * 2654435761) % 1000) / 1000 * HP.GRID_W * C;
    const y = ((i * 40503) % 977) / 977 * HP.GRID_H * C;
    g.fillRect(x, y, 3, 3);
  }
  g.fillStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 700; i++) {
    const x = ((i * 2246822519) % 1000) / 1000 * HP.GRID_W * C;
    const y = ((i * 74121) % 983) / 983 * HP.GRID_H * C;
    g.fillRect(x, y, 2, 4);
  }
}

/* faint ghost of the floor below, for aligning walls/stairs */
function drawUnderlay(g) {
  if (HP.state.level <= 0 || HP.showUnderlay === false) return;
  const below = HP.state.levels[HP.state.level - 1];
  const C = HP.CELL;
  g.save();
  // walls: the alignment cue — darker marks
  g.globalAlpha = 0.4;
  g.fillStyle = '#33415c';
  for (const k in below.walls) {
    const s = HP.parseWallKey(k);
    if (s.d === 'h') g.fillRect(s.x * C, s.y * C - 3, C, 6);
    else g.fillRect(s.x * C - 3, s.y * C, 6, C);
  }
  // furniture: outlines only
  g.globalAlpha = 0.3;
  g.strokeStyle = '#33415c'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
  for (const it of below.furniture) {
    const f = HP.footprint(it);
    g.strokeRect(f.x * C, f.y * C, f.w * C, f.h * C);
  }
  g.setLineDash([]);
  g.restore();
}

const MATS = {
  wood:     { c: '#c9a877' },
  walnut:   { c: '#7d5c3f' },
  tile:     { c: '#dfe5e8' },
  carpet:   { c: '#b3a590' },
  marble:   { c: '#eceae6' },
  concrete: { c: '#b9bcb9' },
  parquet:  { c: '#c19a6b' },
  checker:  { c: '#e8e8e4' },
  terracotta:{ c: '#c47a4d' },
  slate:    { c: '#8a93a0' },
  mosaic:   { c: '#a8ccd8' },
  brick:    { c: '#b06a50' },
  hextile:  { c: '#e4e7e9' },
  pebble:   { c: '#b8b2a4' },
  travertine:{ c: '#d8cbb2' },
  granite:  { c: '#5c6068' },
  cork:     { c: '#cfa878' },
  deck:     { c: '#9a7f5e' },
  grass:    { c: '#7da464' },
  gravel:   { c: '#a8a49c' },
  foam:     { c: '#e8a0a8' },
  gym:      { c: '#3c4048' },
  vinyl:    { c: '#c8c2b4' },
  tatami:   { c: '#cdc494' },
  bamboo:   { c: '#d8c088' },
  laminate: { c: '#b0a494' },
  whitewash:{ c: '#e2ddd2' },
  herring:  { c: '#b98a58' },
  lino:     { c: '#b8c8b0' },
  sand:     { c: '#e0cf9e' },
  dirt:     { c: '#7a5f45' },
  mulch:    { c: '#54402c' },
  flagstone:{ c: '#b0a898' },
  onyx:     { c: '#23262c' },
  terrazzo: { c: '#e4ddd0' },
};

/* deterministic hash → 0..1 (per-board/tile variation, stable across redraws) */
function h2(a, b) { return ((a * 2654435761 + b * 40503) % 1000) / 1000; }

/* scatter — deterministic detail points on a global jittered lattice.
   Points live in world space so marks flow continuously across cells
   (callers clip to the cell; edge fragments join seamlessly) instead of
   repeating identically every 0.5 m. m = margin in lattice cells. */
function scatter(rx, ry, rw, rh, s, m, seed, fn) {
  for (let row = Math.floor(ry / s) - m; row * s <= ry + rh + m * s; row++)
    for (let col = Math.floor(rx / s) - m; col * s <= rx + rw + m * s; col++) {
      const px = col * s + s * (0.1 + Math.abs(h2(col + seed * 7 + 501, row + seed * 13 + 701)) * 0.8);
      const py = row * s + s * (0.1 + Math.abs(h2(col + seed * 5 + 901, row + seed * 3 + 301)) * 0.8);
      fn(px, py, Math.abs(h2(col + seed * 31 + 977, row + seed * 17 + 331)), col, row);
    }
}

/* value noise — smooth continuous randomness in world space */
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = Math.abs(h2(xi, yi)), b = Math.abs(h2(xi + 1, yi));
  const c = Math.abs(h2(xi, yi + 1)), d = Math.abs(h2(xi + 1, yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

let _nc = null;
/* render organic detail as per-pixel noise on a scratch canvas, then blit.
   drawImage (unlike putImageData) honours transform + clip → works in
   scaled swatch previews and the region-clipped floor pass. */
function noiseImage(w, h, fn) {
  if (!_nc) _nc = document.createElement('canvas');
  _nc.width = Math.ceil(w); _nc.height = Math.ceil(h);
  const g2 = _nc.getContext('2d');
  const img = g2.createImageData(_nc.width, _nc.height);
  fn(img.data, _nc.width, _nc.height);
  g2.putImageData(img, 0, 0);
  return _nc;
}

/* Material painters draw a region whose top-left sits at world (rx,ry).
   All pattern math uses absolute coords → textures run continuously
   across cells/rooms instead of repeating per 0.5 m cell. */

function woodPaint(g, rx, ry, rw, rh, base, seamCol) {
  const C = HP.CELL, PH = C / 3, PL = 3.5 * C;        // plank ~17 cm wide, ~1.75 m long
  g.fillStyle = base; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  for (let y = Math.floor(ry / PH) * PH; y < ry + rh; y += PH) {
    const ri = Math.round(y / PH), off = (ri % 3) * 1.2 * C;
    let jx = Math.floor((rx - off) / PL) * PL + off;
    const xs = [rx];
    while (jx < rx + rw) { if (jx > rx) xs.push(jx); jx += PL; }
    xs.push(rx + rw);
    for (let i = 0; i < xs.length - 1; i++) {
      const bi = Math.round((xs[i] - off) / PL), bt = 0.93 + h2(ri, bi) * 0.12;
      const by0 = Math.max(ry, y), by1 = Math.min(y + PH, ry + rh);
      // plank tone
      g.fillStyle = HP.shade(base, bt);
      g.fillRect(xs[i], by0, xs[i + 1] - xs[i], by1 - by0);
      // one soft grain line per plank, mid-board
      const gy = y + PH * (0.35 + h2(bi, ri) * 0.3);
      if (gy > by0 + 1 && gy < by1 - 1) {
        g.strokeStyle = HP.shade(base, bt - 0.12); g.lineWidth = 1; g.globalAlpha = 0.35;
        g.beginPath(); g.moveTo(xs[i] + 2, gy); g.lineTo(xs[i + 1] - 2, gy); g.stroke();
        g.globalAlpha = 1;
      }
      // rare knot
      if (h2(bi * 13, ri * 7) > 0.88 && xs[i + 1] - xs[i] > C) {
        const kx = xs[i] + (0.3 + h2(bi, ri * 3) * 0.4) * (xs[i + 1] - xs[i]);
        const ky = Math.min(by1 - 2, Math.max(by0 + 2, y + PH / 2));
        g.fillStyle = HP.shade(base, 0.75);
        g.beginPath(); g.ellipse(kx, ky, 2, 1.3, 0, 0, 7); g.fill();
      }
      // clean edge: soft top light on the plank
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(xs[i], by0, xs[i + 1] - xs[i], 1);
    }
    // seams
    g.strokeStyle = seamCol; g.lineWidth = 1;
    g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + rw, y); g.stroke();
    for (let i = 1; i < xs.length - 1; i++) {
      g.beginPath(); g.moveTo(xs[i], Math.max(ry, y)); g.lineTo(xs[i], Math.min(y + PH, ry + rh)); g.stroke();
    }
  }
}

function tilePaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;                             // 1 m tiles
  const base = MATS.tile.c;
  const tx = Math.floor(rx / T), ty = Math.floor(ry / T);
  const sx = tx * T, sy = ty * T, h = h2(tx, ty);
  g.fillStyle = HP.shade(base, 0.95 + h * 0.08);      // gentle per-tile tone
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // soft gloss diagonal (low contrast)
  g.fillStyle = 'rgba(255,255,255,.06)';
  g.beginPath(); g.moveTo(sx, sy + T); g.lineTo(sx + T, sy);
  g.lineTo(sx + T, sy + T * 0.4); g.lineTo(sx + T * 0.4, sy + T); g.fill();
  // tile-centre highlight
  g.fillStyle = 'rgba(255,255,255,.05)';
  g.fillRect(sx + T * 0.2, sy + T * 0.2, T * 0.6, T * 0.6);
  g.restore();
  // grout on 1 m boundaries
  g.strokeStyle = '#b8bfc5'; g.lineWidth = 1.5;
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (ry % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
}

function carpetPaint(g, rx, ry, rw, rh) {
  const base = MATS.carpet.c, C = HP.CELL;
  g.fillStyle = base; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  // nap: many tiny dashes at low alpha — texture, not streaks
  for (let yy = Math.floor(ry / 5) * 5; yy < ry + rh; yy += 5)
    for (let xx = Math.floor(rx / 5) * 5; xx < rx + rw; xx += 5) {
      const h = h2(xx * 1.3, yy * 1.7);
      g.strokeStyle = h > 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)';
      g.lineWidth = 1.2;
      const px = xx + h * 4, py = yy + h2(yy, xx) * 4, a = h * 3;
      g.beginPath(); g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * 2.5, py + Math.sin(a) * 2.5); g.stroke();
    }
  // gentle broad tone patches — global, not per-cell checkerboard
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C * 3, 2, 59, (px, py, h) => {
    g.fillStyle = `rgba(${h > 0.5 ? '255,255,255' : '0,0,0'},.03)`;
    g.beginPath(); g.ellipse(px, py, C * (1 + h), C * (0.8 + h * 0.6), h * 3, 0, 7); g.fill();
  });
  g.restore();
}

function marblePaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;
  g.fillStyle = MATS.marble.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const sx = Math.floor(rx / T) * T, sy = Math.floor(ry / T) * T;
  const h = h2(sx, sy);
  // per-slab tone + polish sheen
  g.fillStyle = `rgba(${h > 0.5 ? '255,255,255' : '180,185,190'},${0.03 + h * 0.03})`;
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.fillStyle = 'rgba(255,255,255,.05)';
  g.fillRect(rx, ry, rw + 0.5, rh * 0.5);
  // veins live in slab space; each cell clips to its slice → continuous across cells
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // soft cloudy patch behind veins
  g.fillStyle = 'rgba(190,195,205,.10)';
  g.beginPath(); g.ellipse(sx + T * (0.3 + h * 0.4), sy + T * (0.3 + h2(sy, sx) * 0.4), T * 0.45, T * 0.3, h * 3, 0, 7); g.fill();
  // one soft broad vein + one faint companion — no scratchy lines
  if (h < 0.68) {
    g.strokeStyle = 'rgba(150,152,160,.30)'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx + T * 0.05, sy + T * (0.75 - h * 0.3));
    g.quadraticCurveTo(sx + T * (0.4 + h * 0.3), sy + T * (0.3 + h * 0.25), sx + T * 0.95, sy + T * (0.2 + h * 0.35));
    g.stroke();
    g.strokeStyle = 'rgba(150,152,160,.45)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(sx + T * 0.05, sy + T * (0.75 - h * 0.3));
    g.quadraticCurveTo(sx + T * (0.4 + h * 0.3), sy + T * (0.3 + h * 0.25), sx + T * 0.95, sy + T * (0.2 + h * 0.35));
    g.stroke();
  }
  if (h > 0.4) {
    g.strokeStyle = 'rgba(150,152,160,.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sx + T * 0.15, sy + T * 0.95);
    g.quadraticCurveTo(sx + T * (0.5 + h * 0.2), sy + T * (0.55 - h * 0.2), sx + T * 0.85, sy + T * (0.3 + h * 0.3));
    g.stroke();
  }
  g.restore();
  // grout
  g.strokeStyle = '#d8d5cb'; g.lineWidth = 1;
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (ry % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
}

function concretePaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;
  g.fillStyle = MATS.concrete.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const sx = Math.floor(rx / T) * T, sy = Math.floor(ry / T) * T;
  const h = h2(Math.floor(rx / T), Math.floor(ry / T));
  g.fillStyle = `rgba(0,0,0,${0.02 + h * 0.04})`;      // pour variation
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // soft pour variation — wide faint washes blending edge to edge
  g.fillStyle = `rgba(255,255,255,${0.025 + h * 0.015})`;
  g.beginPath(); g.ellipse(sx + T * (0.2 + h * 0.5), sy + T * 0.3, T * 0.8, T * 0.45, h * 2, 0, 7); g.fill();
  g.fillStyle = `rgba(0,0,0,${0.025 + h * 0.015})`;
  g.beginPath(); g.ellipse(sx + T * (0.5 - h * 0.3), sy + T * 0.75, T * 0.75, T * 0.4, h * 2 + 1, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (ry % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
  // formwork tie dot at panel centre
  const cx = sx + T / 2, cy = sy + T / 2;
  if (cx >= rx && cx < rx + rw && cy >= ry && cy < ry + rh) {
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.arc(cx, cy, 2.2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.beginPath(); g.arc(cx - 0.6, cy - 0.6, 0.8, 0, 7); g.fill();
  }
}

/* parquet: small boards at ±45° in a chevron arrangement */
function parquetPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, BH = C / 4, BL = C * 0.9, S = BH * 1.45;
  g.fillStyle = MATS.parquet.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  for (let j = Math.floor(ry / S) - 1; j * S < ry + rh + S; j++)
    for (let i = Math.floor(rx / S) - 1; i * S < rx + rw + S; i++) {
      const cx = i * S, cy = j * S, dir = (i + j) % 2 ? 1 : -1;
      g.save(); g.translate(cx, cy); g.rotate(dir * Math.PI / 4);
      g.fillStyle = HP.shade(MATS.parquet.c, 0.94 + h2(i, j) * 0.09);   // tight tone range → calm
      g.fillRect(-BL / 2, -BH / 2, BL, BH);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(-BL / 2, -BH / 2, BL, 1);
      g.strokeStyle = 'rgba(80,52,28,.25)'; g.lineWidth = 0.8;
      g.strokeRect(-BL / 2, -BH / 2, BL, BH);
      g.restore();
    }
  g.restore();
}

function checkerPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  const dark = ((rx / C) + (ry / C)) % 2 === 0;
  g.fillStyle = dark ? '#2e3138' : MATS.checker.c;
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  // glaze speckle — global lattice, clipped to the tile
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C / 2.6, 1, 61, (px, py, h) => {
    g.fillStyle = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    g.fillRect(px, py, 1.4, 1.4);
  });
  g.restore();
  // grout + bevel + gloss sweep
  g.strokeStyle = dark ? 'rgba(120,125,135,.4)' : 'rgba(90,95,100,.35)'; g.lineWidth = 1;
  g.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
  g.fillStyle = dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.14)';
  g.beginPath(); g.moveTo(rx, ry + rh); g.lineTo(rx + rw, ry); g.lineTo(rx + rw, ry + rh * 0.4); g.lineTo(rx + rw * 0.4, ry + rh); g.fill();
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(rx + 0.5, ry + 0.5, rw, 1);
  g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(rx + 0.5, ry + rh - 1, rw, 1);
}

/* terracotta: rustic 0.5 m tiles, warm tone variation */
function terracottaPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, x = rx / C, y = ry / C;
  const h = h2(x, y);
  g.fillStyle = '#a8704f';                                    // grout bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.fillStyle = HP.shade(MATS.terracotta.c, h > 0.85 ? 0.72 : 0.88 + h * 0.2);  // occasional burnt tile
  g.fillRect(rx + 1, ry + 1, rw - 1.5, rh - 1.5);
  // saltillo mottle — global so every tile doesn't get the same stains
  g.save(); g.beginPath(); g.rect(rx + 1, ry + 1, rw - 1.5, rh - 1.5); g.clip();
  scatter(rx, ry, rw, rh, C / 2.4, 1, 67, (px, py, hh) => {
    g.fillStyle = hh > 0.5 ? 'rgba(255,220,180,.10)' : 'rgba(120,55,25,.10)';
    g.beginPath(); g.ellipse(px, py, 3 + hh * 3, 2 + hh * 2, h * 5, 0, 7); g.fill();
  });
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.09)';                      // top-edge light
  g.fillRect(rx + 1, ry + 1, rw - 1.5, 2);
  g.fillStyle = 'rgba(60,25,10,.14)';                         // bottom-edge shade
  g.fillRect(rx + 1, ry + rh - 3, rw - 1.5, 2);
}

/* slate: large staggered stone panels */
function slatePaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, RW = 2 * C, RH = C;                      // 1 m × 0.5 m stones
  g.fillStyle = '#6e7580';                                    // grout bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const row = Math.floor(ry / RH), off = (row % 2) * C;
  const col = Math.floor((rx + off) / RW), h = h2(row, col);
  g.fillStyle = HP.shade(MATS.slate.c, 0.86 + h * 0.22);
  g.fillRect(rx + 1, ry + 1, rw - 1.5, rh - 1.5);
  g.save(); g.beginPath(); g.rect(rx + 1, ry + 1, rw - 1.5, rh - 1.5); g.clip();
  // soft mineral clouding — small, faint
  g.fillStyle = 'rgba(255,255,255,.04)';
  g.beginPath(); g.ellipse(rx + rw * h, ry + rh * 0.3, rw * 0.35, rh * 0.2, h * 2, 0, 7); g.fill();
  g.fillStyle = 'rgba(20,24,30,.05)';
  g.beginPath(); g.ellipse(rx + rw * (1 - h), ry + rh * 0.7, rw * 0.3, rh * 0.18, h * 2 + 1, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(30,34,40,.4)'; g.lineWidth = 1;
  if (ry % RH === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
  if ((rx + off) % RW === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
}

/* mosaic: small 0.25 m bath tiles */
function mosaicPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, s = C / 2;
  g.fillStyle = '#8fb4c2';                                    // grout bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  for (let y = Math.floor(ry / s) * s; y < ry + rh; y += s)
    for (let x = Math.floor(rx / s) * s; x < rx + rw; x += s) {
      const h = h2(x, y);
      g.fillStyle = h > 0.88 ? HP.shade(MATS.mosaic.c, 0.7) : HP.shade(MATS.mosaic.c, 0.9 + h * 0.18);
      g.fillRect(x + 0.8, y + 0.8, s - 1.4, s - 1.4);
      g.fillStyle = 'rgba(255,255,255,.22)';                  // glaze glint
      g.fillRect(x + 1.6, y + 1.6, 2, 1.5);
    }
}

/* brick: running bond, 0.5 m bricks (2 rows per cell) */
function brickPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, BH = C / 2, BL = C;
  g.fillStyle = '#cfc6b8';                                    // mortar bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  for (let y = Math.floor(ry / BH) * BH; y < ry + rh; y += BH) {
    const row = Math.round(y / BH), off = (row % 2) * C / 2;
    const y0 = Math.max(ry, y), y1 = Math.min(y + BH, ry + rh);
    let bx = Math.floor((rx - off) / BL) * BL + off;
    for (; bx < rx + rw; bx += BL) {
      const x0 = Math.max(bx, rx), x1 = Math.min(bx + BL, rx + rw);
      const bi = Math.round((bx - off) / BL), h = h2(row, bi);
      g.fillStyle = HP.shade(MATS.brick.c, h > 0.86 ? 0.7 : 0.9 + h * 0.18);   // occasional dark-fired brick
      g.fillRect(x0 + 1, y0 + 1, x1 - x0 - 1.5, y1 - y0 - 1.5);
      // brick face bevel + pockmark
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(x0 + 1, y0 + 1, x1 - x0 - 1.5, 1.5);
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(x0 + 1, y1 - 3, x1 - x0 - 1.5, 1.5);
      if (h > 0.4 && h < 0.6) {
        g.fillStyle = 'rgba(70,30,15,.2)';
        g.fillRect(x0 + 4 + h * 10, y0 + 3 + h * 5, 1.6, 1.6);
      }
    }
    g.strokeStyle = 'rgba(80,40,25,.3)'; g.lineWidth = 1;
    if (y > ry) { g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + rw, y); g.stroke(); }
  }
}

/* hex tile — the classic small bathroom floor */
function hextilePaint(g, rx, ry, rw, rh) {
  const r = HP.CELL / 5.5, dx = r * 1.5, dy = r * 1.732;
  g.fillStyle = '#a9b2b8';                                     // grout bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  for (let i = Math.floor(rx / dx) - 1; i * dx < rx + rw + dx; i++)
    for (let j = Math.floor(ry / dy) - 1; j * dy < ry + rh + dy; j++) {
      const cx = i * dx, cy = j * dy + (i % 2 ? dy / 2 : 0);
      const h = h2(i, j);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        const vx = cx + Math.cos(a) * (r - 1), vy = cy + Math.sin(a) * (r - 1);
        k ? g.lineTo(vx, vy) : g.moveTo(vx, vy);
      }
      g.closePath();
      g.fillStyle = h > 0.9 ? '#7a93a8' : HP.shade(MATS.hextile.c, 0.92 + h * 0.12); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)';                    // glaze dot
      g.fillRect(cx - 1, cy - r * 0.4, 1.5, 1.5);
    }
  g.restore();
}

/* pebble — river-stone shower floor, tightly packed stones */
function pebblePaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, s = C / 2.6;
  g.fillStyle = '#8f8a7c'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  for (let y = Math.floor(ry / s) * s; y < ry + rh + s; y += s * 0.85) {
    const off = (Math.round(y / (s * 0.85)) % 2) * s * 0.5;    // staggered + overlapping rows
    for (let x = Math.floor((rx - off) / s) * s + off; x < rx + rw + s; x += s * 0.9) {
      const h = h2(x * 3, y * 5);
      const ex = x + s / 2 + (h - 0.5) * 3, ey = y + s / 2 + (h2(y, x) - 0.5) * 3;
      const er = s * (0.5 + h * 0.14);
      const tones = ['#c9c2b0', '#b8b2a4', '#a39c8e', '#c2bcb4', '#96907f'];
      g.fillStyle = 'rgba(0,0,0,.20)';                         // stone shadow
      g.beginPath(); g.arc(ex + 0.8, ey + 1.2, er, 0, 7); g.fill();
      g.fillStyle = tones[Math.floor(h * tones.length)];
      g.beginPath(); g.arc(ex, ey, er, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)';                   // highlight
      g.beginPath(); g.arc(ex - er * 0.3, ey - er * 0.35, er * 0.3, 0, 7); g.fill();
    }
  }
  g.restore();
}

/* travertine — warm limestone slabs with natural pits */
function travertinePaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;
  g.fillStyle = MATS.travertine.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const sx = Math.floor(rx / T) * T, sy = Math.floor(ry / T) * T;
  const h = h2(Math.floor(rx / T), Math.floor(ry / T));
  g.fillStyle = `rgba(150,120,80,${0.03 + h * 0.06})`;
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // broad soft sedimentary bands
  for (let i = 0; i < 3; i++) {
    const by = sy + T * (0.2 + i * 0.3 + h * 0.1);
    g.strokeStyle = 'rgba(165,140,100,.22)'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(sx, by);
    g.bezierCurveTo(sx + T * 0.3, by + (h2(sx, i) - 0.5) * 10, sx + T * 0.7, by + (h2(i, sy) - 0.5) * 10, sx + T, by);
    g.stroke();
  }
  // few pits
  for (let i = 0; i < 5; i++) {
    const px = sx + h2(sx + i * 13, sy) * T, py = sy + h2(sy + i * 29, sx) * T;
    g.fillStyle = 'rgba(120,95,60,.22)';
    g.beginPath(); g.ellipse(px, py, 3, 1.2, h * 3, 0, 7); g.fill();
  }
  g.restore();
  g.strokeStyle = '#c0b090'; g.lineWidth = 1;
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (ry % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
}

/* granite — dark polished speckled slabs */
function granitePaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;
  const sx = Math.floor(rx / T) * T, sy = Math.floor(ry / T) * T;
  g.fillStyle = MATS.granite.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // fine mica speckle — many tiny dots, real granite texture
  for (let i = 0; i < 24; i++) {
    const px = sx + h2(sx + i * 7, sy + i * 3) * T, py = sy + h2(sy + i * 11, sx + i * 5) * T;
    g.fillStyle = i % 4 ? 'rgba(255,255,255,.16)' : 'rgba(190,170,150,.2)';
    g.fillRect(px, py, 1.3, 1.3);
  }
  // occasional larger crystal
  for (let i = 0; i < 3; i++) {
    const px = sx + h2(sx + i * 37, sy + i * 17) * T, py = sy + h2(sy + i * 23, sx + i * 13) * T;
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.fillRect(px, py, 2, 2);
  }
  g.fillStyle = 'rgba(255,255,255,.06)';                       // polish streak
  g.beginPath(); g.moveTo(sx, sy + T); g.lineTo(sx + T, sy); g.lineTo(sx + T, sy + T * 0.5); g.lineTo(sx + T * 0.5, sy + T); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(20,22,26,.5)'; g.lineWidth = 1.5;
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (ry % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
}

/* cork — warm speckled comfort floor */
function corkPaint(g, rx, ry, rw, rh) {
  g.fillStyle = MATS.cork.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  // fine grain — global lattice so it doesn't tile per cell
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, HP.CELL / 4.2, 1, 47, (px, py, h) => {
    g.fillStyle = h > 0.5 ? 'rgba(140,95,50,.12)' : 'rgba(255,235,200,.12)';
    g.beginPath(); g.ellipse(px, py, 1.5 + h * 2, 1 + h * 1.5, h * 4, 0, 7); g.fill();
  });
  g.restore();
  g.strokeStyle = 'rgba(120,85,45,.2)'; g.lineWidth = 1;
  g.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
}

/* deck — outdoor boards with gaps + screws */
function deckPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, BH = C / 3, PL = 4 * C;
  g.fillStyle = '#4a3c2c';                                     // dark gap bed
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  for (let y = Math.floor(ry / BH) * BH; y < ry + rh; y += BH) {
    const ri = Math.round(y / BH);
    const y0 = Math.max(ry, y) + 1, y1 = Math.min(y + BH, ry + rh) - 1;
    if (y1 <= y0) continue;
    const bt = 0.9 + h2(ri, 7) * 0.14;
    g.fillStyle = HP.shade(MATS.deck.c, bt);
    g.fillRect(rx, y0, rw + 0.5, y1 - y0);
    // one soft grain line per board
    g.strokeStyle = HP.shade(MATS.deck.c, bt - 0.14); g.lineWidth = 0.8; g.globalAlpha = 0.4;
    g.beginPath(); g.moveTo(rx, (y0 + y1) / 2);
    g.lineTo(rx + rw, (y0 + y1) / 2 + (h2(ri, 3) - 0.5) * 1.5); g.stroke();
    g.globalAlpha = 1;
    // staggered board ends + screw pairs
    const off = (ri % 2) * 2 * C;
    for (let jx = Math.ceil((rx - off) / PL) * PL + off; jx < rx + rw; jx += PL) {
      g.strokeStyle = 'rgba(40,28,18,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(jx, y0); g.lineTo(jx, y1); g.stroke();
      g.fillStyle = 'rgba(35,25,15,.6)';
      g.beginPath(); g.arc(jx - 3, (y0 + y1) / 2 - 1.5, 1.1, 0, 7); g.fill();
      g.beginPath(); g.arc(jx - 3, (y0 + y1) / 2 + 1.5, 1.1, 0, 7); g.fill();
    }
    // weathered top-edge light
    g.fillStyle = 'rgba(255,240,210,.06)'; g.fillRect(rx, y0, rw + 0.5, 1);
  }
}

/* tuft — one fan of pointed grass blades, like the garden sprite set */
function tuft(g, x, y, s, h) {
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const t = (i / (blades - 1)) * 2 - 1;                       // -1…1 fan spread
    const jx = (Math.abs(h2(i * 7 + h * 40, h * 90 + 5)) - 0.5) * s * 0.3;
    const tipX = x + t * s * 0.55 + jx;
    const tipY = y - s * (0.55 + Math.abs(h2(i + 31, h * 60 + 7)) * 0.45) * (1 - Math.abs(t) * 0.35);
    const baseX = x + t * s * 0.14, midX = x + t * s * 0.3, midY = y - s * 0.35;
    const g2 = Math.abs(h2(i + h * 50, 3));
    g.fillStyle = g2 > 0.5 ? '#5c8a3e' : '#6fa04a';             // two leaf tones
    g.beginPath();
    g.moveTo(baseX - s * 0.09, y);
    g.quadraticCurveTo(midX - s * 0.05, midY, tipX, tipY);      // outer edge → tip
    g.quadraticCurveTo(midX + s * 0.06, midY + s * 0.08, baseX + s * 0.09, y); // inner edge back
    g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(55,85,35,.35)';                           // dark base mound
  g.beginPath(); g.ellipse(x, y, s * 0.32, s * 0.12, 0, 0, 7); g.fill();
}

/* grass — drawn lawn: flat meadow + scattered blade tufts */
function grassPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.fillStyle = '#86b060'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // faint large-scale colour drift so big lawns aren't flat
  scatter(rx, ry, rw, rh, C * 3.4, 2, 3, (px, py, h, col, row) => {
    const hh = Math.abs(h2(col + 11, row + 13));
    g.fillStyle = hh > 0.5 ? 'rgba(70,120,50,.08)' : 'rgba(150,200,110,.07)';
    g.beginPath(); g.ellipse(px, py, C * (1.6 + hh), C * (1.1 + hh * 0.8), hh * 3, 0, 7); g.fill();
  });
  // tufts on the global lattice — varied size, no per-cell repetition
  scatter(rx, ry, rw, rh, C / 2.1, 1, 7, (px, py, h) => {
    tuft(g, px, py + 3, 7 + h * 5, h);
  });
  g.restore();
}

/* --- TEMP grass candidates B/C/D/F (A = tuft painter, E = photo texture) --- */
function grassBPaint(g, rx, ry, rw, rh) {     // fine short blade strokes
  const C = HP.CELL;
  g.fillStyle = '#7fae5e'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C / 3.4, 1, 7, (px, py, h) => {
    for (let k = 0; k < 3; k++) {
      const bx = px + (k - 1) * 2.2, hh = Math.abs(h2(px * 3 + k, py * 7));
      g.strokeStyle = hh > 0.5 ? 'rgba(60,105,45,.4)' : 'rgba(140,190,100,.35)';
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(bx, py + 2); g.lineTo(bx + (hh - 0.5) * 2, py - 2 - hh * 2); g.stroke();
    }
  });
  g.restore();
}
function grassCPaint(g, rx, ry, rw, rh) {     // clean meadow — soft drift + speckle
  const C = HP.CELL;
  g.fillStyle = '#84ae62'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C * 2.8, 2, 3, (px, py, h, col, row) => {
    const hh = Math.abs(h2(col + 11, row + 13));
    g.fillStyle = hh > 0.5 ? 'rgba(65,115,48,.10)' : 'rgba(155,205,115,.09)';
    g.beginPath(); g.ellipse(px, py, C * (1.5 + hh), C * (1 + hh * 0.7), hh * 3, 0, 7); g.fill();
  });
  scatter(rx, ry, rw, rh, C / 2, 1, 9, (px, py) => {
    g.fillStyle = 'rgba(60,105,45,.18)'; g.fillRect(px, py, 1.4, 1.4);
  });
  g.restore();
}
function grassDPaint(g, rx, ry, rw, rh) {     // uniform stipple grain
  const C = HP.CELL;
  g.fillStyle = '#7aa85a'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C / 4.4, 1, 13, (px, py, h) => {
    g.fillStyle = h > 0.55 ? 'rgba(88,140,60,.5)' : 'rgba(160,200,120,.4)';
    g.fillRect(px, py, 2, 2);
  });
  g.restore();
}
function grassGPaint(g, rx, ry, rw, rh) {     // lawn — clover sprigs + daisies
  const C = HP.CELL;
  g.fillStyle = '#7cab5c'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C * 3, 2, 3, (px, py, h, col, row) => {
    const hh = Math.abs(h2(col + 11, row + 13));
    g.fillStyle = hh > 0.5 ? 'rgba(60,110,45,.09)' : 'rgba(145,195,105,.08)';
    g.beginPath(); g.ellipse(px, py, C * (1.5 + hh), C * (1 + hh * 0.7), hh * 3, 0, 7); g.fill();
  });
  // clover sprigs — 3-leaf clusters
  scatter(rx, ry, rw, rh, C / 2.4, 1, 7, (px, py, h) => {
    g.fillStyle = 'rgba(60,115,50,.55)';
    for (let k = 0; k < 3; k++) {
      const a = h * 6.28 + k * 2.1;
      g.beginPath(); g.ellipse(px + Math.cos(a) * 1.8, py + Math.sin(a) * 1.8, 1.6, 1.1, a, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(50,95,42,.5)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + 1, py + 3); g.stroke();
  });
  // sparse daisies
  scatter(rx, ry, rw, rh, C * 1.8, 1, 1, (px, py, h) => {
    if (h < 0.7) return;
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let k = 0; k < 5; k++) {
      const a = k * 1.257;
      g.beginPath(); g.ellipse(px + Math.cos(a) * 1.4, py + Math.sin(a) * 1.4, 1, 0.7, a, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(250,210,80,.9)'; g.beginPath(); g.arc(px, py, 0.8, 0, 7); g.fill();
  });
  g.restore();
}
function grassFPaint(g, rx, ry, rw, rh) {     // mown field — soft comb rows
  const C = HP.CELL, RS = C * 1.6;
  g.fillStyle = '#83ad60'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  g.strokeStyle = 'rgba(60,100,40,.25)'; g.lineWidth = 2;
  for (let j = Math.floor(ry / RS) - 1; j * RS < ry + rh + RS; j++) {
    const y0 = j * RS;
    g.beginPath();
    for (let x = rx; x <= rx + rw; x += 8)
      g.lineTo(x, y0 + Math.sin((x + j * 47) / 26) * 3);
    g.stroke();
  }
  scatter(rx, ry, rw, rh, C / 3, 1, 17, (px, py) => {
    g.fillStyle = 'rgba(120,165,85,.3)'; g.fillRect(px, py, 2.5, 1.4);
  });
  g.restore();
}

/* gravel — crushed stone for paths/driveways */
/* gravel — crushed aggregate: fine high-contrast noise + few larger stones */
function gravelPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.drawImage(noiseImage(rw + 0.5, rh + 0.5, (d, W, H) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const n = vnoise((rx + i) / 1.6, (ry + j) / 1.6) * 0.6
              + vnoise((rx + i) / 5, (ry + j) / 5) * 0.3
              + vnoise((rx + i) / 22, (ry + j) / 22) * 0.1;
      const v = 128 + n * 80 - 40, k = (j * W + i) * 4;
      d[k] = v; d[k + 1] = v - 4; d[k + 2] = v - 14; d[k + 3] = 255;
    }
  }), rx, ry);
  scatter(rx, ry, rw, rh, C / 2.4, 1, 11, (px, py, h) => {     // larger stones
    g.fillStyle = h > 0.5 ? 'rgba(200,196,184,.5)' : 'rgba(95,92,84,.4)';
    g.beginPath(); g.arc(px, py, 1.4 + h * 1.8, 0, 7); g.fill();
  });
}

/* foam — colorful interlocking kids' puzzle mats */
function foamPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, cols = ['#e89aa2', '#8fc4e8', '#9cd08f', '#e8d48f'];
  const k = Math.abs((rx / C + ry / C * 2)) % 4;
  g.fillStyle = HP.shade(cols[k], 0.96 + h2(rx, ry) * 0.08);
  g.fillRect(rx + 1, ry + 1, rw - 1.5, rh - 1.5);
  // squishy bevel + inner seam
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(rx + 1, ry + 1, rw - 1.5, 2.5);
  g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(rx + 1, ry + rh - 3.5, rw - 1.5, 2.5);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5;
  g.strokeRect(rx + 3, ry + 3, rw - 5.5, rh - 5.5);
  // nubs on two edges, sockets on the others
  g.fillStyle = cols[k];
  g.beginPath(); g.arc(rx + rw / 2, ry, 3.5, 0, 7); g.fill();
  g.beginPath(); g.arc(rx, ry + rh / 2, 3.5, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.beginPath(); g.arc(rx + rw / 2, ry + rh, 3.5, 0, 7); g.stroke();
  g.beginPath(); g.arc(rx + rw, ry + rh / 2, 3.5, 0, 7); g.stroke();
}

/* gym — dark flecked rubber */
function gymPaint(g, rx, ry, rw, rh) {
  g.fillStyle = MATS.gym.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const fl = ['#e05a5a', '#5ab0e0', '#e0c05a', '#8fd08f', '#c8c8c8'];
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, HP.CELL / 4, 1, 43, (px, py, h) => {
    g.fillStyle = fl[Math.floor(h * 5)];
    g.globalAlpha = 0.35 + h * 0.3;
    g.fillRect(px, py, 1.4, 1.4);
  });
  g.globalAlpha = 1; g.restore();
  // rubber tile bevel + seam
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(rx + 0.5, ry + 0.5, rw, 1.5);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(rx + 0.5, ry + rh - 2, rw, 1.5);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
  g.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
}

/* vinyl — smooth sheet linoleum with soft mottle */
function vinylPaint(g, rx, ry, rw, rh) {
  const T = 3 * HP.CELL;
  g.fillStyle = MATS.vinyl.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const h = h2(Math.floor(rx / T), Math.floor(ry / T));
  g.fillStyle = `rgba(140,130,110,${0.05 + h * 0.06})`;         // sheet variation
  g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  // soft two-tone mottle — global so it doesn't repeat per cell
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, HP.CELL, 1, 41, (px, py, h) => {
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.beginPath(); g.ellipse(px, py, 8, 5, h * 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(110,100,80,.05)';
    g.beginPath(); g.ellipse(px + 4, py + 3, 6, 4, h * 4 + 1, 0, 7); g.fill();
  });
  g.restore();
  // faint embossed grid + sheet seam every T
  g.strokeStyle = 'rgba(120,110,90,.12)'; g.lineWidth = 1;
  g.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
  g.strokeStyle = 'rgba(120,110,90,.22)';
  if (rx % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
}

/* tatami — straw mats, alternating weave direction + cloth borders */
function tatamiPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  const horiz = ((Math.floor(rx / C) + Math.floor(ry / (2 * C))) % 2 + Math.floor(ry / C)) % 2 === 0;
  g.fillStyle = '#cdc494'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  // woven straws — alternating light/dark thin lines
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = i % 2 ? 'rgba(110,100,55,.24)' : 'rgba(230,220,170,.3)';
    if (horiz) {
      const ly = ry + (i + 0.5) * rh / 6;
      g.beginPath(); g.moveTo(rx, ly); g.lineTo(rx + rw, ly); g.stroke();
    } else {
      const lx = rx + (i + 0.5) * rw / 6;
      g.beginPath(); g.moveTo(lx, ry); g.lineTo(lx, ry + rh); g.stroke();
    }
  }
  // dark cloth band on mat edges (mats run 2 cells tall)
  g.fillStyle = 'rgba(70,80,55,.55)';
  if (ry % (2 * C) === 0) g.fillRect(rx, ry, rw + 0.5, 3);
  if ((ry + rh) % (2 * C) === 0) g.fillRect(rx, ry + rh - 3, rw + 0.5, 3);
  g.fillStyle = 'rgba(160,150,80,.1)';                         // straw tone band
  if ((rx + ry) % (4 * C) === 0) g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
}

/* herringbone — diagonal parquet strips, alternating blocks */
function herringPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, S = C / 3, B = S * 2.5;
  const tones = ['#bd9260', '#c69a68', '#b4895a', '#c09464'];
  const dir = (Math.floor(rx / B) + Math.floor(ry / B)) % 2 ? 1 : -1;
  g.fillStyle = '#8a6a44'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  g.translate(rx + rw / 2, ry + rh / 2); g.rotate(dir * Math.PI / 4);
  const ext = rw + rh;
  for (let i = -ext; i < ext; i += S) {
    const ti = Math.abs(Math.round(i / S + rx / C + ry / C)) % 4;
    g.fillStyle = tones[ti];
    g.fillRect(i, -ext / 2, S - 0.8, ext);
    g.fillStyle = 'rgba(255,240,210,.08)'; g.fillRect(i, -ext / 2, 1, ext);
  }
  g.restore();
}

/* lino — linoleum, soft cloudy mottle on a global lattice */
function linoPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.fillStyle = MATS.lino.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  scatter(rx, ry, rw, rh, C * 1.6, 2, 37, (px, py, h) => {
    g.fillStyle = h > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(80,100,75,.07)';
    g.beginPath(); g.ellipse(px, py, 5 + h * 6, 3 + h * 3.5, h * 4, 0, 7); g.fill();
  });
  g.restore();
}

/* sand — dune field: warm noise bed + global wind ripples */
function sandPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.drawImage(noiseImage(rw + 0.5, rh + 0.5, (d, W, H) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const wx = rx + i, wy = ry + j;
      // anisotropic: stretch noise along x → wind-formed dune bands
      const n = vnoise(wx / 14, wy / 3.2) * 0.55
              + vnoise(wx / 3, wy / 3) * 0.25
              + vnoise(wx / 45, wy / 45) * 0.2;
      const k = (j * W + i) * 4;
      d[k] = 196 + n * 52; d[k + 1] = 172 + n * 46; d[k + 2] = 122 + n * 32; d[k + 3] = 255;
    }
  }), rx, ry);
}

/* dirt — tilled garden soil: 3-octave noise, warm earth palette */
function dirtPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.drawImage(noiseImage(rw + 0.5, rh + 0.5, (d, W, H) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const wx = rx + i, wy = ry + j;
      const n = vnoise(wx / 1.9, wy / 1.9) * 0.45            // crumb grain
              + vnoise(wx / 7, wy / 7) * 0.35                // clods
              + vnoise(wx / 30, wy / 30) * 0.2;              // moisture drift
      const k = (j * W + i) * 4;
      d[k] = 96 + n * 62; d[k + 1] = 72 + n * 48; d[k + 2] = 50 + n * 32; d[k + 3] = 255;
    }
  }), rx, ry);
  scatter(rx, ry, rw, rh, C, 1, 29, (px, py, h) => {          // small stones
    if (h > 0.6) {
      g.fillStyle = 'rgba(150,132,105,.5)';
      g.beginPath(); g.arc(px, py, 1.3 + h * 0.8, 0, 7); g.fill();
    }
  });
}

/* mulch — dark bark bed + chunky shredded pieces */
function mulchPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  g.drawImage(noiseImage(rw + 0.5, rh + 0.5, (d, W, H) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const n = vnoise((rx + i) / 2.4, (ry + j) / 2.4) * 0.6
              + vnoise((rx + i) / 9, (ry + j) / 9) * 0.4;
      const k = (j * W + i) * 4;
      d[k] = 62 + n * 42; d[k + 1] = 45 + n * 32; d[k + 2] = 30 + n * 22; d[k + 3] = 255;
    }
  }), rx, ry);
  const tones = ['rgba(110,84,56,.55)', 'rgba(70,52,34,.5)', 'rgba(130,100,66,.4)'];
  scatter(rx, ry, rw, rh, C / 3.4, 1, 31, (px, py, h) => {      // bark shreds
    g.strokeStyle = tones[Math.floor(h * 3)]; g.lineWidth = 1.4;
    const a = h * 3.1;
    g.beginPath(); g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * (2.5 + h * 2), py + Math.sin(a) * (2.5 + h * 2)); g.stroke();
  });
}

/* flagstone — fitted irregular paving: jittered global lattice, thin mortar gaps */
function flagstonePaint(g, rx, ry, rw, rh) {
  const C = HP.CELL, S = C * 0.92;
  g.fillStyle = '#7d7870'; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);   // mortar bed
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  const r0 = Math.floor(ry / S) - 1, r1 = Math.floor((ry + rh) / S) + 1;
  for (let row = r0; row <= r1; row++) {
    const off = (Math.abs(row) % 2) * S * 0.5;                      // staggered courses
    const c0 = Math.floor((rx - off) / S) - 1, c1 = Math.floor((rx + rw - off) / S) + 1;
    for (let col = c0; col <= c1; col++) {
      const h = h2(col + 500, row + 500);
      const cx = col * S + off + S / 2 + (h - 0.5) * S * 0.2;
      const cy = row * S + S / 2 + (h2(row + 503, col + 507) - 0.5) * S * 0.2;
      const n = 7, pts = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + h * 2;
        const rr = S * 0.52 * (0.82 + h2(col + k * 31 + 511, row - k * 13 + 517) * 0.36);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const path = () => { g.beginPath(); pts.forEach(([vx, vy], k) => k ? g.lineTo(vx, vy) : g.moveTo(vx, vy)); g.closePath(); };
      g.translate(0, 1.3); path(); g.fillStyle = 'rgba(0,0,0,.16)'; g.fill();   // seat shadow
      g.translate(0, -1.3); path();
      g.fillStyle = HP.shade(MATS.flagstone.c, 0.86 + h * 0.26); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;                  // top-edge light
      g.beginPath();
      for (let k = 0; k <= n / 2; k++) { const [vx, vy] = pts[k]; k ? g.lineTo(vx, vy) : g.moveTo(vx, vy); }
      g.stroke();
    }
  }
  g.restore();
}

/* onyx — black marble, white + gold veins, polish */
function onyxPaint(g, rx, ry, rw, rh) {
  const T = 2 * HP.CELL;
  const sx = Math.floor(rx / T) * T, sy = Math.floor(ry / T) * T;
  const hs = h2(sx, sy);
  g.fillStyle = MATS.onyx.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.fillStyle = `rgba(255,255,255,${0.02 + hs * 0.03})`; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // one soft white vein per slab — wide low-contrast + thin core
  g.strokeStyle = 'rgba(210,210,205,.16)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(sx, sy + T * hs);
  g.bezierCurveTo(sx + T * 0.3, sy + T * (hs * 0.5 + 0.2), sx + T * 0.7, sy + T * (hs + 0.4), sx + T, sy + T * (1 - hs)); g.stroke();
  g.strokeStyle = 'rgba(225,225,220,.25)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(sx, sy + T * hs);
  g.bezierCurveTo(sx + T * 0.3, sy + T * (hs * 0.5 + 0.2), sx + T * 0.7, sy + T * (hs + 0.4), sx + T, sy + T * (1 - hs)); g.stroke();
  // faint gold vein on some slabs
  if (hs > 0.65) {
    g.strokeStyle = 'rgba(200,170,100,.14)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sx + T * 0.2, sy);
    g.quadraticCurveTo(sx + T * hs, sy + T * 0.5, sx + T * 0.8, sy + T); g.stroke();
  }
  // polish streak
  g.fillStyle = 'rgba(255,255,255,.05)';
  g.beginPath(); g.moveTo(sx, sy + T); g.lineTo(sx + T, sy); g.lineTo(sx + T, sy + T * 0.35); g.lineTo(sx + T * 0.35, sy + T); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  if (Math.round(rx) % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry + rh); g.stroke(); }
  if (Math.round(ry) % T === 0) { g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + rw, ry); g.stroke(); }
}

/* terrazzo — cream binder, angular stone chips + polish */
function terrazzoPaint(g, rx, ry, rw, rh) {
  const C = HP.CELL;
  const sx = Math.floor(rx / C) * C, sy = Math.floor(ry / C) * C;
  g.fillStyle = MATS.terrazzo.c; g.fillRect(rx, ry, rw + 0.5, rh + 0.5);
  const chip = ['#c9a48a', '#8a9aa8', '#a8b8a0', '#c8b8d0', '#e0d0b0', '#9a8a80', '#7a8a95'];
  g.save(); g.beginPath(); g.rect(rx, ry, rw + 0.5, rh + 0.5); g.clip();
  // dense small chips — global lattice so the speckle doesn't tile per cell
  scatter(rx, ry, rw, rh, C / 4.2, 1, 53, (px, py, h, col, row) => {
    g.fillStyle = chip[Math.floor(Math.abs(h2(col + 3, row + 5)) * 7)];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(px, py); g.lineTo(px + 1.5 + h * 1.8, py + h * 1.2); g.lineTo(px + h * 1.6, py + 1.5 + h * 1.8);
    g.closePath(); g.fill();
  });
  g.globalAlpha = 1;
  // polish sheen on top half
  g.fillStyle = 'rgba(255,255,255,.05)';
  g.fillRect(rx, ry, rw + 0.5, rh * 0.5);
  g.restore();
}

/* ============ design painters for floor variants ============
   Different PATTERNS (not just colors). World-anchored so they flow
   across cells; called clipped per cell via designPaint(). */
function _bg(g,px,py,C,col){g.fillStyle=col;g.fillRect(px,py,C+0.6,C+0.6);}
function _tone(h,a){return h>.5?`rgba(255,255,255,${(h-.5)*a})`:`rgba(0,0,0,${(.5-h)*a})`;}

function dPlank(g,px,py,C,o,col){          // horizontal boards w/ grain, knots, nails
  const bw=C*(o.bw||.5); _bg(g,px,py,C,col);
  for(let y=Math.floor(py/bw)*bw;y<py+C;y+=bw){
    const ri=Math.round(y/bw),h=(h2(ri,31)+1)/2;
    g.fillStyle=_tone(h,.3);g.fillRect(px,y,C,bw);
    g.fillStyle='rgba(50,35,20,.45)';g.fillRect(px,y,C,1.2);
    g.fillStyle='rgba(255,255,255,.10)';g.fillRect(px,y+1.2,C,1);
    const jx=((h2(ri,7)+1)*4096)%(C*3);
    for(let x=Math.floor(px/(C*3))*C*3;x<px+C;x+=C*3){
      g.fillStyle='rgba(50,35,20,.45)';g.fillRect(x+jx,y,1.2,bw);
      if(bw>10){                                   // nail pair at each joint
        g.fillStyle='rgba(45,35,25,.4)';
        g.beginPath();g.arc(x+jx+2.5,y+bw*.25,.8,0,7);g.fill();
        g.beginPath();g.arc(x+jx+2.5,y+bw*.75,.8,0,7);g.fill();
      }
    }
    g.strokeStyle='rgba(70,45,25,.10)';g.lineWidth=.8;
    g.beginPath();const gy=y+bw*.5;g.moveTo(px,gy);g.bezierCurveTo(px+C*.3,gy+(h-.5)*5,px+C*.7,gy-(h-.5)*5,px+C,gy);g.stroke();
    if(h>.62&&bw>8){                               // occasional knot
      const kx=px+((h2(ri,19)+1)/2)*C;
      g.strokeStyle='rgba(55,35,20,.35)';g.lineWidth=.9;
      g.beginPath();g.ellipse(kx,y+bw*.55,2.6,1.6,(h-.5)*2,0,7);g.stroke();
      g.strokeStyle='rgba(55,35,20,.22)';
      g.beginPath();g.ellipse(kx,y+bw*.55,4.2,2.6,(h-.5)*2,0,7);g.stroke();
    }
  }
}
function dPlankV(g,px,py,C,o,col){         // vertical boards
  const bw=C*(o.bw||.5); _bg(g,px,py,C,col);
  for(let x=Math.floor(px/bw)*bw;x<px+C;x+=bw){
    const ci=Math.round(x/bw),h=(h2(ci,37)+1)/2;
    g.fillStyle=_tone(h,.3);g.fillRect(x,py,bw,C);
    g.fillStyle='rgba(50,35,20,.45)';g.fillRect(x,py,1.2,C);
    g.fillStyle='rgba(255,255,255,.10)';g.fillRect(x+1.2,py,1,C);
    const jy=((h2(ci,11)+1)*4096)%(C*3);
    for(let y=Math.floor(py/(C*3))*C*3;y<py+C;y+=C*3){g.fillStyle='rgba(50,35,20,.45)';g.fillRect(x,y+jy,bw,1.2);}
  }
}
function dTiles(g,px,py,C,o,col){          // square tiles w/ bevel, glaze, accents
  const n=o.n||2,s=C/n;
  g.fillStyle=o.gap||'rgba(0,0,0,.32)';g.fillRect(px,py,C+0.6,C+0.6);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=px+i*s,y=py+j*s,h=(h2(Math.round(x)*7+Math.round(y),Math.round(y)-Math.round(x))+1)/2;
    g.fillStyle=(o.acc&&h>(1-(o.acc)))?(o.accCol||'#7fa8c9'):col;
    g.fillRect(x+.8,y+.8,s-1.6,s-1.6);
    g.fillStyle=_tone(h,.4);g.fillRect(x+.8,y+.8,s-1.6,s-1.6);
    g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x+.8,y+.8,s-1.6,1);          // bevel top
    g.fillStyle='rgba(255,255,255,.10)';g.fillRect(x+.8,y+.8,1,s-1.6);          // bevel left
    g.fillStyle='rgba(0,0,0,.14)';g.fillRect(x+.8,y+s-1.6,s-1.6,1);             // bevel bottom
    if(s>11&&h>.55){                                                           // glaze glint
      g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=1;
      g.beginPath();g.moveTo(x+s*.22,y+s*.72);g.lineTo(x+s*.72,y+s*.22);g.stroke();
    }
  }
}
function dCheck(g,px,py,C,o,col){          // checkerboard (o.n per cell, o.diag)
  const n=o.n||2,s=C/n,dark=o.dark||'#2e3138';
  const draw=(ox,oy,w)=>{for(let j=0;j<w;j++)for(let i=0;i<w;i++){
    g.fillStyle=(i+j)%2?dark:col;g.fillRect(ox+i*s,oy+j*s,s+0.6,s+0.6);
    if(s>9){g.fillStyle='rgba(255,255,255,.13)';g.fillRect(ox+i*s,oy+j*s,s,1);
      g.fillStyle='rgba(0,0,0,.12)';g.fillRect(ox+i*s,oy+j*s+s-1,s,1);}
  }};
  if(o.diag){g.save();g.translate(px+C/2,py+C/2);g.rotate(Math.PI/4);draw(-C,-C,n*2);g.restore();}
  else draw(px,py,n);
}
function dSubway(g,px,py,C,o,col){         // running-bond rectangles (o.vert, o.stacked)
  const rh=C*(o.rh||.25),len=C*(o.len||1);
  g.fillStyle=o.gap||'rgba(0,0,0,.30)';g.fillRect(px,py,C+0.6,C+0.6);
  if(o.vert){
    for(let x=Math.floor(px/rh)*rh;x<px+C;x+=rh){
      const ci=Math.round(x/rh),off=(!o.stacked&&ci%2)?len/2:0;
      for(let y=Math.floor((py-off)/len)*len+off;y<py+C;y+=len){
        const h=(h2(ci*13+Math.round(y),Math.round(y)*3-ci)+1)/2;
        g.fillStyle=col;g.fillRect(x+.8,y+.8,rh-1.6,len-1.6);
        g.fillStyle=_tone(h,.4);g.fillRect(x+.8,y+.8,rh-1.6,len-1.6);
        g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x+.8,y+.8,1,len-1.6);
        g.fillStyle='rgba(0,0,0,.13)';g.fillRect(x+rh-1.6,y+.8,1,len-1.6);
      }
    }
    return;
  }
  for(let y=Math.floor(py/rh)*rh;y<py+C;y+=rh){
    const ri=Math.round(y/rh),off=(!o.stacked&&ri%2)?len/2:0;
    for(let x=Math.floor((px-off)/len)*len+off;x<px+C;x+=len){
      const h=(h2(Math.round(x)+ri*101,ri*7-Math.round(x))+1)/2;
      g.fillStyle=col;g.fillRect(x+.8,y+.8,len-1.6,rh-1.6);
      g.fillStyle=_tone(h,.4);g.fillRect(x+.8,y+.8,len-1.6,rh-1.6);
      g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x+.8,y+.8,len-1.6,1);
      g.fillStyle='rgba(0,0,0,.13)';g.fillRect(x+.8,y+rh-1.6,len-1.6,1);
      if(h>.6&&rh>7){g.strokeStyle='rgba(255,255,255,.20)';g.lineWidth=1;
        g.beginPath();g.moveTo(x+len*.2,y+rh*.7);g.lineTo(x+len*.6,y+rh*.3);g.stroke();}
    }
  }
}
function _hex(g,cx,cy,r){g.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;g[i?'lineTo':'moveTo'](cx+r*Math.cos(a),cy+r*Math.sin(a));}g.closePath();}
function dHex(g,px,py,C,o,col){            // hex tiles (o.s size)
  const s=C*(o.s||.28),w=s*1.74;
  g.fillStyle=o.gap||'rgba(0,0,0,.28)';g.fillRect(px,py,C+0.6,C+0.6);
  let row=0;
  for(let y=Math.floor(py/(s*1.5))*s*1.5-s;y<py+C+s;y+=s*1.5,row++){
    const off=(row%2)?w/2:0;
    for(let x=Math.floor((px-off)/w)*w+off-w;x<px+C+w;x+=w){
      const h=(h2(Math.round(x*3)+row*97,row*3-Math.round(x))+1)/2;
      g.fillStyle=col;_hex(g,x+w/2,y+s,s*.94);g.fill();
      g.fillStyle=_tone(h,.35);_hex(g,x+w/2,y+s,s*.94);g.fill();
      g.fillStyle='rgba(255,255,255,.14)';_hex(g,x+w/2-s*.1,y+s-s*.16,s*.62);g.fill();   // raised top
      g.fillStyle='rgba(0,0,0,.10)';_hex(g,x+w/2+s*.12,y+s+s*.14,s*.5);g.fill();        // lower shade
    }
  }
}
function _blob(g,cx,cy,r,n,seed){g.beginPath();for(let i=0;i<=n;i++){const a=Math.PI*2*i/n,rr=r*(0.78+((h2(seed,i)+1)/2)*0.4);g[i?'lineTo':'moveTo'](cx+rr*Math.cos(a),cy+rr*Math.sin(a));}g.closePath();}
function dStone(g,px,py,C,o,col){          // fitted irregular stones (o.s size)
  const s=C*(o.s||1.15);
  _bg(g,px,py,C,o.bed||'#8d867c');
  for(let gy=Math.floor(py/s)*s-s;gy<py+C+s;gy+=s){
    const ri=Math.round(gy/s),off=(ri%2)?s*.5:0;
    for(let gx=Math.floor((px-off)/s)*s+off-s;gx<px+C+s;gx+=s){
      const ci=Math.round(gx/s),h=(h2(ci*61+ri*7,ri*3-ci)+1)/2;
      const cx=gx+s/2+(h-.5)*s*.3,cy=gy+s/2+((h2(ci,ri*31)+1)/2-.5)*s*.3,r=s*.47;
      g.fillStyle='rgba(0,0,0,.25)';_blob(g,cx+r*.08,cy+r*.1,r,7,ci*97+ri);g.fill();
      g.fillStyle=col;_blob(g,cx,cy,r,7,ci*97+ri);g.fill();
      g.fillStyle=_tone(h,.3);_blob(g,cx,cy,r,7,ci*97+ri);g.fill();
      g.fillStyle='rgba(255,255,255,.12)';_blob(g,cx-r*.2,cy-r*.22,r*.55,6,ci+ri*13);g.fill();
    }
  }
}
function dRounds(g,px,py,C,o,col){         // packed round stones (o.n per cell)
  const s=C/(o.n||5);
  _bg(g,px,py,C,o.bed||'#9b938a');
  for(let gy=Math.floor(py/s)*s-s;gy<py+C+s;gy+=s)
    for(let gx=Math.floor(px/s)*s-s;gx<px+C+s;gx+=s){
      const ix=Math.round(gx/s),iy=Math.round(gy/s),h=(h2(ix*3+iy,iy*7+ix)+1)/2;
      const cx=gx+s/2+(h-.5)*s*.45,cy=gy+s/2+((h2(iy,ix*5)+1)/2-.5)*s*.45,r=s*.42;
      g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.arc(cx+r*.15,cy+r*.2,r*.95,0,7);g.fill();
      g.fillStyle=col;g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
      g.fillStyle=_tone(h,.4);g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
      g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.arc(cx-r*.3,cy-r*.35,r*.28,0,7);g.fill();
    }
}
function dCobble(g,px,py,C,o,col){         // rounded cobble rows (o.s size)
  const s=C*(o.s||.3);
  g.fillStyle=o.gap||'rgba(0,0,0,.3)';g.fillRect(px,py,C+0.6,C+0.6);
  let r=0;
  for(let y=Math.floor(py/s)*s-s;y<py+C+s;y+=s,r++){
    const off=(r%2)?s/2:0;
    for(let x=Math.floor((px-off)/s)*s+off-s;x<px+C+s;x+=s){
      const h=(h2(Math.round(x*5)+r*13,r*7)+1)/2;
      g.fillStyle=col;g.beginPath();g.ellipse(x+s/2,y+s/2,s*.44,s*.4,0,0,7);g.fill();
      g.fillStyle=_tone(h,.35);g.beginPath();g.ellipse(x+s/2,y+s/2,s*.44,s*.4,0,0,7);g.fill();
      g.fillStyle='rgba(255,255,255,.14)';g.beginPath();g.ellipse(x+s/2-s*.12,y+s/2-s*.14,s*.2,s*.12,-.4,0,7);g.fill();
    }
  }
}
function dWeave(g,px,py,C,o,col){          // woven strips (o.n per cell)
  const n=o.n||4,s=C/n; _bg(g,px,py,C,col);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=px+i*s,y=py+j*s,h=(h2(i+Math.round(px*3),j+Math.round(py*5))+1)/2;
    g.fillStyle=`rgba(0,0,0,${.04+h*.12})`;g.fillRect(x,y,s,s);
    g.fillStyle='rgba(255,255,255,.10)';
    if((i+j)%2)g.fillRect(x,y+s*.18,s,s*.24);else g.fillRect(x+s*.18,y,s*.24,s);
    g.fillStyle='rgba(0,0,0,.15)';
    if((i+j)%2)g.fillRect(x,y+s*.7,s,1);else g.fillRect(x+s*.7,y,1,s);
  }
}
function dSpeck(g,px,py,C,o,col){          // scattered multi-colour chips
  _bg(g,px,py,C,col);
  const step=C/6,acc=o.acc||['#b8543c','#3c6478','#8a8a6a','#e8dcc8'];
  for(let y=Math.floor(py/step)*step-step;y<py+C+step;y+=step)
    for(let x=Math.floor(px/step)*step-step;x<px+C+step;x+=step){
      const h=(h2(Math.round(x),Math.round(y))+1)/2;
      if(h>(o.d||.5))continue;
      const cx=x+((h2(Math.round(y),Math.round(x))+1)/2)*step,s=C*(o.big||.035)*(0.6+h);
      g.save();g.translate(cx,y);g.rotate(h*6);
      const k=(h*7|0);
      g.fillStyle=k<3?acc[k%acc.length]:(h>.35?`rgba(255,255,255,${.2+h*.25})`:`rgba(20,20,25,${.25+h*.25})`);
      g.beginPath();g.moveTo(-s,-s*.5);g.lineTo(s*.8,-s*.3);g.lineTo(s*.5,s*.7);g.lineTo(-s*.6,s*.4);g.closePath();g.fill();
      g.restore();
    }
}
function dWaves(g,px,py,C,o,col){          // wavy horizontal bands (o.n per cell)
  const n=o.n||4,s=C/n; _bg(g,px,py,C,col);
  for(let y=Math.floor(py/s)*s;y<py+C;y+=s){
    const ri=Math.round(y/s),h=(h2(ri,23)+1)/2;
    g.strokeStyle=h>.5?`rgba(0,0,0,.16)`:`rgba(255,255,255,.13)`;g.lineWidth=s*.3;
    g.beginPath();
    for(let x=px;x<=px+C;x+=4){const yy=y+Math.sin((x+ri*97)/s*2.2)*s*.3;x===px?g.moveTo(x,yy):g.lineTo(x,yy);}
    g.stroke();
  }
}
function dStripes(g,px,py,C,o,col){        // straight tonal stripes (o.n per cell)
  const n=o.n||5,s=C/n; _bg(g,px,py,C,col);
  for(let y=Math.floor(py/s)*s;y<py+C;y+=s){
    const ri=Math.round(y/s),h=(h2(ri,53)+1)/2;
    g.fillStyle=`rgba(${h>.5?'0,0,0':'255,255,255'},${.05+Math.abs(h-.5)*.16})`;
    g.fillRect(px,y,C,s);
  }
}
function dChevron(g,px,py,C,o,col){        // zigzag chevron bands (o.s size)
  const s=C*(o.s||.25); _bg(g,px,py,C,col);
  for(let y=Math.floor(py/s)*s-s;y<py+C+s;y+=s){
    const ri=Math.round(y/s),h=(h2(ri,41)+1)/2;
    g.fillStyle=`rgba(${h>.5?'0,0,0':'255,255,255'},${.05+Math.abs(h-.5)*.22})`;
    g.beginPath();
    for(let x=px-s;x<=px+C+s;x+=s*2){
      g.moveTo(x,y+s);g.lineTo(x+s,y);g.lineTo(x+s*2,y+s);g.lineTo(x+s*2,y+s+s);g.lineTo(x+s,y+s+s);g.lineTo(x,y+s+s);
    }
    g.closePath();g.fill();
  }
}
function dDots(g,px,py,C,o,col){           // raised stud dots (o.n per cell)
  const n=o.n||4,s=C/n; _bg(g,px,py,C,col);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=px+(i+.5)*s,y=py+(j+.5)*s;
    g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(x+1,y+1.2,s*.28,0,7);g.fill();
    g.fillStyle='rgba(255,255,255,.16)';g.beginPath();g.arc(x,y,s*.26,0,7);g.fill();
  }
}
function dCracks(g,px,py,C,o,col){         // dried-mud crack polygons
  _bg(g,px,py,C,col);
  const s=C*.9;
  for(let gy=Math.floor(py/s)*s-s;gy<py+C+s;gy+=s)
    for(let gx=Math.floor(px/s)*s-s;gx<px+C+s;gx+=s){
      const ix=Math.round(gx/s),iy=Math.round(gy/s),h=(h2(ix+iy*3,ix*7-iy)+1)/2;
      g.strokeStyle='rgba(0,0,0,.32)';g.lineWidth=1.1;
      _blob(g,gx+s/2+(h-.5)*s*.4,gy+s/2,s*.46,7,ix*13+iy);g.stroke();
      g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=2;
      _blob(g,gx+s/2+(h-.5)*s*.4,gy+s/2,s*.46,7,ix*13+iy);g.stroke();
    }
}
function dVein(g,px,py,C,o,col){           // marble veins (o.dark = light veins)
  _bg(g,px,py,C,col);
  const vc=o.dark?'255,255,255':'60,60,80';
  for(let gy=Math.floor(py/C)*C-C;gy<py+C+C;gy+=C)
    for(let gx=Math.floor(px/C)*C-C;gx<px+C+C;gx+=C){
      const ix=Math.round(gx/C),iy=Math.round(gy/C),h=(h2(ix+iy*11,iy*3+ix)+1)/2;
      if(h>.5)continue;
      g.strokeStyle=`rgba(${vc},.10)`;g.lineWidth=C*.05;
      g.beginPath();g.moveTo(gx,gy+C*(.2+h*.6));
      g.bezierCurveTo(gx+C*.4,gy+C*(h*.8),gx+C*.6,gy+C*(1-h*.5),gx+C,gy+C*(.3+h*.4));g.stroke();
      g.strokeStyle=`rgba(${vc},.22)`;g.lineWidth=1;
      g.beginPath();g.moveTo(gx,gy+C*(.2+h*.6));
      g.bezierCurveTo(gx+C*.4,gy+C*(h*.8),gx+C*.6,gy+C*(1-h*.5),gx+C,gy+C*(.3+h*.4));g.stroke();
    }
}
function dBlock(g,px,py,C,o,col){          // parquet blocks w/ alternating grain
  const n=o.n||2,s=C/n;
  g.fillStyle='rgba(60,40,20,.3)';g.fillRect(px,py,C+0.6,C+0.6);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=px+i*s,y=py+j*s,h=(h2(Math.round(x)+Math.round(y)*3,Math.round(y)-Math.round(x))+1)/2;
    g.fillStyle=col;g.fillRect(x+1,y+1,s-2,s-2);
    g.fillStyle=_tone(h,.35);g.fillRect(x+1,y+1,s-2,s-2);
    g.strokeStyle='rgba(70,45,25,.14)';g.lineWidth=.8;
    for(let k=1;k<4;k++){
      g.beginPath();
      if((i+j)%2){g.moveTo(x+s*k/4,y+2);g.lineTo(x+s*k/4,y+s-2);}
      else{g.moveTo(x+2,y+s*k/4);g.lineTo(x+s-2,y+s*k/4);}
      g.stroke();
    }
  }
}
function dShag(g,px,py,C,o,col){           // shag carpet rings
  _bg(g,px,py,C,col);
  const step=C/7;
  for(let y=Math.floor(py/step)*step;y<py+C;y+=step)
    for(let x=Math.floor(px/step)*step;x<px+C;x+=step){
      const h=(h2(Math.round(x*2),Math.round(y*2))+1)/2;
      g.strokeStyle=`rgba(${h>.5?'255,255,255':'0,0,0'},.12)`;g.lineWidth=1.4;
      g.beginPath();g.arc(x+step*.5,y+step*.5,step*.28,0,7);g.stroke();
    }
}

function dOctDot(g,px,py,C,o,col){         // octagon tiles + small dark squares
  const n=o.n||2,s=C/n,c=s*.3,gp=s*.05;
  g.fillStyle=o.dot||'#3a3f46';g.fillRect(px,py,C+0.6,C+0.6);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=px+i*s,y=py+j*s,h=(h2(Math.round(x)+Math.round(y)*3,Math.round(y))+1)/2;
    g.fillStyle=col;
    g.beginPath();
    g.moveTo(x+c,y+gp);g.lineTo(x+s-c,y+gp);g.lineTo(x+s-gp,y+c);g.lineTo(x+s-gp,y+s-c);
    g.lineTo(x+s-c,y+s-gp);g.lineTo(x+c,y+s-gp);g.lineTo(x+gp,y+s-c);g.lineTo(x+gp,y+c);
    g.closePath();g.fill();
    g.fillStyle=_tone(h,.3);
    g.beginPath();
    g.moveTo(x+c,y+gp);g.lineTo(x+s-c,y+gp);g.lineTo(x+s-gp,y+c);g.lineTo(x+s-gp,y+s-c);
    g.lineTo(x+s-c,y+s-gp);g.lineTo(x+c,y+s-gp);g.lineTo(x+gp,y+s-c);g.lineTo(x+gp,y+c);
    g.closePath();g.fill();
  }
}
function dFishscale(g,px,py,C,o,col){      // scallop / mermaid fan tiles
  const s=C*(o.s||.28),rh=s*.75;
  g.fillStyle='rgba(0,0,0,.22)';g.fillRect(px,py,C+0.6,C+0.6);
  let r=0;
  for(let y=Math.floor(py/rh)*rh-rh;y<py+C+rh;y+=rh,r++){
    const off=(r%2)?s/2:0;
    for(let x=Math.floor((px-off)/s)*s+off-s;x<px+C+s;x+=s){
      const h=(h2(Math.round(x*3)+r*97,r*3-Math.round(x))+1)/2;
      g.fillStyle=col;g.beginPath();g.arc(x+s/2,y,s*.48,0,Math.PI);g.closePath();g.fill();
      g.fillStyle=_tone(h,.4);g.beginPath();g.arc(x+s/2,y,s*.48,0,Math.PI);g.closePath();g.fill();
      g.strokeStyle='rgba(255,255,255,.16)';g.lineWidth=1;
      g.beginPath();g.arc(x+s/2,y,s*.3,0,Math.PI);g.stroke();
    }
  }
}
function dBasketTile(g,px,py,C,o,col){     // basketweave — alternating strip pairs
  const s=C*(o.s||.25);
  g.fillStyle='rgba(0,0,0,.28)';g.fillRect(px,py,C+0.6,C+0.6);
  for(let gy=Math.floor(py/(s*2))*(s*2)-s*2;gy<py+C+s*2;gy+=s*2)
    for(let gx=Math.floor(px/(s*2))*(s*2)-s*2;gx<px+C+s*2;gx+=s*2){
      const ix=Math.round(gx/(s*2)),iy=Math.round(gy/(s*2)),vert=(ix+iy)%2===0,h=(h2(ix,iy*3)+1)/2;
      for(let k=0;k<2;k++){
        const rx=vert?gx+k*s:gx,ry=vert?gy:gy+k*s,rw=vert?s:s*2,rh=vert?s*2:s;
        g.fillStyle=col;g.fillRect(rx+1,ry+1,rw-2,rh-2);
        g.fillStyle=_tone(h,.28);g.fillRect(rx+1,ry+1,rw-2,rh-2);
        g.fillStyle='rgba(255,255,255,.12)';g.fillRect(rx+1,ry+1,rw-2,1);
      }
    }
}
function dVersailles(g,px,py,C,o,col){     // parquet panels — framed blocks w/ inner grain
  const s=C*(o.s||1.5);
  g.fillStyle='rgba(60,40,20,.4)';g.fillRect(px,py,C+0.6,C+0.6);
  for(let gy=Math.floor(py/s)*s-s;gy<py+C+s;gy+=s)
    for(let gx=Math.floor(px/s)*s-s;gx<px+C+s;gx+=s){
      const ix=Math.round(gx/s),iy=Math.round(gy/s),h=(h2(ix,iy*3)+1)/2;
      g.fillStyle=col;g.fillRect(gx+1,gy+1,s-2,s-2);
      g.fillStyle=_tone(h,.22);g.fillRect(gx+1,gy+1,s-2,s-2);
      const m=s*.14;
      g.strokeStyle='rgba(60,40,20,.45)';g.lineWidth=1;
      g.beginPath();g.rect(gx+m,gy+m,s-m*2,s-m*2);g.stroke();
      g.beginPath();g.moveTo(gx+m,gy+s/2);g.lineTo(gx+s-m,gy+s/2);
      g.moveTo(gx+s/2,gy+m);g.lineTo(gx+s/2,gy+s-m);g.stroke();
      g.strokeStyle='rgba(70,45,25,.15)';
      for(let k=1;k<3;k++){
        g.beginPath();
        g.moveTo(gx+m+(s-2*m)*k/3,gy+m);g.lineTo(gx+m+(s-2*m)*k/3,gy+s/2);
        g.moveTo(gx+m+(s-2*m)*k/3,gy+s/2);g.lineTo(gx+m+(s-2*m)*k/3,gy+s-m);
        g.moveTo(gx+m,gy+m+(s-2*m)*k/3);g.lineTo(gx+s/2,gy+m+(s-2*m)*k/3);
        g.moveTo(gx+s/2,gy+m+(s-2*m)*k/3);g.lineTo(gx+s-m,gy+m+(s-2*m)*k/3);
        g.stroke();
      }
    }
}
function dBrickBasket(g,px,py,C,o,col){    // brick basketweave — alternating pairs
  const s=C*.25;
  g.fillStyle='rgba(60,35,25,.38)';g.fillRect(px,py,C+0.6,C+0.6);
  for(let gy=Math.floor(py/(s*2))*(s*2)-s*2;gy<py+C+s*2;gy+=s*2)
    for(let gx=Math.floor(px/(s*2))*(s*2)-s*2;gx<px+C+s*2;gx+=s*2){
      const ix=Math.round(gx/(s*2)),iy=Math.round(gy/(s*2)),vert=(ix+iy)%2===0,h=(h2(ix*7,iy*3)+1)/2;
      for(let k=0;k<2;k++){
        const rx=vert?gx+k*s:gx,ry=vert?gy:gy+k*s,rw=vert?s:s*2,rh=vert?s*2:s;
        g.fillStyle=col;g.fillRect(rx+1,ry+1,rw-2,rh-2);
        g.fillStyle=_tone(h,.3);g.fillRect(rx+1,ry+1,rw-2,rh-2);
        if(h>.8){g.fillStyle='rgba(40,25,18,.2)';g.fillRect(rx+1,ry+1,rw-2,rh-2);}   // burnt brick
      }
    }
}
function dTatamiAuth(g,px,py,C,o,col){     // real tatami layout — bordered 2:1 mats
  const w=C*1.2,h=C*.6;
  g.fillStyle='rgba(80,70,40,.4)';g.fillRect(px,py,C+0.6,C+0.6);
  let r=0;
  for(let y=Math.floor(py/h)*h-h;y<py+C+h;y+=h,r++){
    const off=(r%2)?w/2:0;
    for(let x=Math.floor((px-off)/w)*w+off-w;x<px+C+w;x+=w){
      const hh=(h2(Math.round(x)+r*31,r*7)+1)/2;
      g.fillStyle=col;g.fillRect(x+1.5,y+1.5,w-3,h-3);
      g.fillStyle=_tone(hh,.2);g.fillRect(x+1.5,y+1.5,w-3,h-3);
      g.strokeStyle='rgba(90,80,40,.22)';g.lineWidth=.7;
      for(let sy=y+5;sy<y+h-2;sy+=4){g.beginPath();g.moveTo(x+3,sy);g.lineTo(x+w-3,sy);g.stroke();}
      g.strokeStyle='rgba(55,45,25,.7)';g.lineWidth=1.5;
      g.beginPath();g.rect(x+1.5,y+1.5,w-3,h-3);g.stroke();
    }
  }
}
function dCarpetPat(g,px,py,C,o,col){      // patterned carpet — diamond motifs
  _bg(g,px,py,C,col);
  scatter(px,py,C,C,C/4,1,5,(x,y,h)=>{g.fillStyle=`rgba(0,0,0,${.04+h*.08})`;g.fillRect(x,y,2,1);});
  const s=C*.5;
  g.strokeStyle='rgba(0,0,0,.20)';g.lineWidth=1;
  for(let y=Math.floor(py/s)*s-s;y<py+C+s;y+=s)
    for(let x=px-s;x<px+C+s;x+=s){
      g.beginPath();g.moveTo(x+s/2,y);g.lineTo(x+s,y+s/2);g.lineTo(x+s/2,y+s);g.lineTo(x,y+s/2);g.closePath();g.stroke();
    }
  g.fillStyle='rgba(0,0,0,.25)';
  for(let y=Math.floor(py/s)*s-s;y<py+C+s;y+=s)
    for(let x=px-s;x<px+C+s;x+=s){
      g.beginPath();g.arc(x+s/2,y,1.4,0,7);g.fill();
      g.beginPath();g.arc(x,y+s/2,1.4,0,7);g.fill();
    }
}
function dShellSand(g,px,py,C,o,col){      // beach sand — ripples + tiny shells
  dWaves(g,px,py,C,{n:4},col);
  scatter(px,py,C,C,C*.9,1,11,(x,y,h)=>{
    if(h<0.74)return;
    if(h<0.88){
      g.fillStyle='rgba(242,228,205,.85)';
      g.beginPath();g.arc(x,y,2.4,Math.PI*1.1,Math.PI*1.9);g.closePath();g.fill();
      g.strokeStyle='rgba(190,160,120,.7)';g.lineWidth=.6;
      for(let a=0;a<5;a++){const an=Math.PI*1.15+a*.16;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(an)*2.3,y+Math.sin(an)*2.3);g.stroke();}
    }else{
      g.fillStyle='rgba(210,180,150,.8)';
      g.beginPath();g.arc(x,y,1.6,0,7);g.fill();
    }
  });
}

/* variant id -> [painter, opts] — DESIGN overrides for drawn mode */
const PSPEC = {
  wood2:['plank',{bw:.22}],      wood3:['versailles',{s:1.2}], wood4:['plank',{bw:.8}],
  walnut2:['plank',{bw:.25}],    walnut3:['plankV',{bw:.4}],   walnut4:['chevron',{s:.2}],
  tile2:['tiles',{n:4,acc:.12,accCol:'#7fa8c9'}], tile3:['subway',{rh:.25}], tile4:['octdot'],
  carpet2:['stripes',{n:6}],     carpet3:['weave',{n:6}],      carpet4:['shag'],        carpet5:['carpetpat'],
  marble2:['tiles',{n:1,gap:'rgba(120,120,130,.30)'}], marble3:['vein'], marble4:['vein',{dark:1}],
  concrete2:['tiles',{n:2,gap:'rgba(90,90,90,.32)'}], concrete3:['tiles',{n:1,gap:'rgba(90,90,90,.32)'}], concrete4:['stripes',{n:8}],
  parquet2:['versailles',{s:1.5}], parquet3:['chevron',{s:.2}], parquet4:['plank',{bw:.3}],
  checker2:['check',{n:4}],      checker3:['check',{n:1}],     checker4:['check',{n:3,diag:1}],
  terracotta2:['tiles',{n:3,acc:.1,accCol:'#a85430'}], terracotta3:['subway',{rh:.33}], terracotta4:['hex',{s:.3}],
  slate2:['tiles',{n:2}],        slate3:['stone',{s:1.2}],     slate4:['subway',{rh:.33}],
  mosaic2:['tiles',{n:6,acc:.15,accCol:'#4a7a9c'}], mosaic3:['hex',{s:.18}], mosaic4:['rounds',{n:6}],  mosaic5:['fishscale'],
  brick2:['subway',{rh:.2,stacked:1}], brick3:['subway',{rh:.15}], brick4:['brickbasket'],
  hextile2:['hex',{s:.4}],       hextile3:['hex',{s:.22}],     hextile4:['dots',{n:4}],
  pebble2:['rounds',{n:4}],      pebble3:['rounds',{n:8}],     pebble4:['stone',{s:.7}],
  travertine2:['stripes',{n:5}], travertine3:['tiles',{n:2}],  travertine4:['speck',{d:.4}],
  granite2:['speck',{d:.8,big:.02}], granite3:['speck',{d:.5,big:.08}], granite4:['vein',{dark:1}],
  cork2:['tiles',{n:2}],         cork3:['speck',{d:.7,big:.06}], cork4:['block',{n:2}],
  deck2:['plankV',{bw:.2}],      deck3:['plank',{bw:.75}],     deck4:['plank',{bw:.4}],
  gravel2:['rounds',{n:10}],     gravel3:['speck',{d:.9,big:.025}], gravel4:['rounds',{n:6}],
  foam2:['dots',{n:3}],          foam3:['check',{n:2,dark:'#8a94a8'}], foam4:['tiles',{n:2}],
  gym2:['stripes',{n:4}],        gym3:['speck',{d:.9,big:.04}],  gym4:['dots',{n:5}],
  vinyl2:['plank',{bw:.33}],     vinyl3:['tiles',{n:3}],       vinyl4:['vein'],
  tatami2:['weave',{n:8}],       tatami3:['weave',{n:3}],      tatami4:['tatamiauth'],
  bamboo2:['plankV',{bw:.12}],   bamboo3:['plank',{bw:.16}],   bamboo4:['weave',{n:4}],
  laminate2:['plank',{bw:.25}],  laminate3:['plankV',{bw:.3}], laminate4:['block',{n:2}],
  whitewash2:['plank',{bw:.3}],  whitewash3:['plankV',{bw:.25}], whitewash4:['plank',{bw:.55}],
  herring2:['chevron',{s:.3}],   herring3:['chevron',{s:.15}], herring4:['block',{n:3}],
  lino2:['speck',{d:.6,big:.03}],lino3:['stripes',{n:6}],      lino4:['tiles',{n:2}],
  sand2:['waves',{n:5}],         sand3:['waves',{n:3}],        sand4:['shellsand'],
  dirt2:['cracks'],              dirt3:['speck',{d:.5,big:.05}], dirt4:['rounds',{n:9}],
  mulch2:['speck',{d:.8,big:.07}],mulch3:['stripes',{n:9}],    mulch4:['rounds',{n:7}],
  flagstone2:['stone',{s:1.4}],  flagstone3:['cobble',{s:.33}],flagstone4:['stone',{s:.8}],
  onyx2:['vein',{dark:1}],       onyx3:['stripes',{n:3}],      onyx4:['tiles',{n:2,gap:'rgba(200,180,120,.3)'}],
  terrazzo2:['speck',{d:.7,big:.08}], terrazzo3:['speck',{d:.95,big:.025}], terrazzo4:['tiles',{n:3}],
};
const DP = {plank:dPlank,plankV:dPlankV,tiles:dTiles,check:dCheck,subway:dSubway,hex:dHex,
  stone:dStone,rounds:dRounds,cobble:dCobble,weave:dWeave,speck:dSpeck,waves:dWaves,
  stripes:dStripes,chevron:dChevron,dots:dDots,cracks:dCracks,vein:dVein,block:dBlock,shag:dShag,
  octdot:dOctDot,fishscale:dFishscale,baskettile:dBasketTile,versailles:dVersailles,
  brickbasket:dBrickBasket,tatamiauth:dTatamiAuth,carpetpat:dCarpetPat,shellsand:dShellSand};

/* === real photo textures (CC0 — ambientCG), seamless tiles ===
   s = world px per texture repeat (1 cell = 28px = 0.5 m).
   Patterns anchor at world origin → continuous across cells/rooms.
   Procedural painters stay as fallback until the image has loaded. */
const TEX = {
  wood: 112, walnut: 112, tile: 84, carpet: 112, marble: 168, concrete: 112,
  parquet: 84, terracotta: 56, mosaic: 42, brick: 112,
  hextile: 112, pebble: 84, travertine: 84, granite: 112, cork: 56,
  deck: 112, gravel: 140, gym: 56, vinyl: 84, tatami: 112,
  bamboo: 56, laminate: 112, whitewash: 112, herring: 112, lino: 84,
  sand: 140, dirt: 140, mulch: 84, flagstone: 160, onyx: 112, terrazzo: 84,
  grassE: 150,
};
const _texImg = {}, _texPat = {}, _prevCvs = [];
HP._texImg = _texImg;                                // debug/inspection
// every colourway variant gets its own photo file: textures/<variantId>.jpg
if (HP.FLOOR_MATS) for (const m of HP.FLOOR_MATS)
  if (m.fam && !TEX[m.id]) TEX[m.id] = TEX[m.fam] || 96;

function loadTex(mat) {                              // lazy: load on first use
  const st = _texImg[mat];
  if (st !== undefined) return st;
  _texImg[mat] = false;
  if (typeof Image === 'undefined') return false;
  const im = new Image();
  im.onload = () => {
    _texImg[mat] = im; _texPat[mat] = null;
    HP.invalidateRegions();                         // rebuild static layer
    for (const p of _prevCvs) if (p.mat === mat) paintPreview(p);   // live swatch update
  };
  im.onerror = () => { _texImg[mat] = false; };
  im.src = 'textures/' + mat + '.jpg';
  return false;
}
function floorTexture(g, mat) {
  if (HP.state && HP.state.photoFloors === false) return null;   // user prefers drawn look
  if (!TEX[mat]) return null;
  const im = loadTex(mat);
  if (!im) return null;
  let p = _texPat[mat];
  if (!p) {
    p = g.createPattern(im, 'repeat');
    p.setTransform(new DOMMatrix().scale(TEX[mat] / im.width));
    _texPat[mat] = p;
  }
  return p;
}

const FMI = {};
if (HP.FLOOR_MATS) HP.FLOOR_MATS.forEach(m => FMI[m.id] = m);

function paintFloorCell(g, mat, px, py) {
  const C = HP.CELL;
  const fm = FMI[mat] || {};
  const bid = fm.fam || mat;                      // variants paint their family base
  let tex = floorTexture(g, mat);                 // variant's own photo
  const ownTex = !!tex;
  if (!tex && fm.fam) tex = floorTexture(g, bid); // family photo fallback
  if (tex) { g.fillStyle = tex; g.fillRect(px, py, C + 0.6, C + 0.6); }
  else {
    const spec = PSPEC[mat];                       // variant design override (drawn mode)
    if (spec && DP[spec[0]]) {
      g.save(); g.beginPath(); g.rect(px, py, C + 0.6, C + 0.6); g.clip();
      DP[spec[0]](g, px, py, C, spec[1] || {}, fm.col || '#b9a988');
      g.restore();
    } else switch (bid) {
    case 'wood':     woodPaint(g, px, py, C, C, MATS.wood.c, 'rgba(88,58,32,.4)'); break;
    case 'walnut':   woodPaint(g, px, py, C, C, MATS.walnut.c, 'rgba(40,26,15,.5)'); break;
    case 'tile':     tilePaint(g, px, py, C, C); break;
    case 'carpet':   carpetPaint(g, px, py, C, C); break;
    case 'marble':   marblePaint(g, px, py, C, C); break;
    case 'concrete': concretePaint(g, px, py, C, C); break;
    case 'parquet':  parquetPaint(g, px, py, C, C); break;
    case 'checker':  checkerPaint(g, px, py, C, C); break;
    case 'terracotta': terracottaPaint(g, px, py, C, C); break;
    case 'slate':    slatePaint(g, px, py, C, C); break;
    case 'mosaic':   mosaicPaint(g, px, py, C, C); break;
    case 'brick':    brickPaint(g, px, py, C, C); break;
    case 'hextile':  hextilePaint(g, px, py, C, C); break;
    case 'pebble':   pebblePaint(g, px, py, C, C); break;
    case 'travertine': travertinePaint(g, px, py, C, C); break;
    case 'granite':  granitePaint(g, px, py, C, C); break;
    case 'cork':     corkPaint(g, px, py, C, C); break;
    case 'deck':     deckPaint(g, px, py, C, C); break;
    case 'grass':    grassGPaint(g, px, py, C, C); break;
    case 'gravel':   gravelPaint(g, px, py, C, C); break;
    case 'foam':     foamPaint(g, px, py, C, C); break;
    case 'gym':      gymPaint(g, px, py, C, C); break;
    case 'vinyl':    vinylPaint(g, px, py, C, C); break;
    case 'tatami':   tatamiPaint(g, px, py, C, C); break;
    case 'bamboo':   woodPaint(g, px, py, C, C, MATS.bamboo.c, 'rgba(150,130,70,.4)'); break;
    case 'laminate': woodPaint(g, px, py, C, C, MATS.laminate.c, 'rgba(90,85,75,.35)'); break;
    case 'whitewash': woodPaint(g, px, py, C, C, MATS.whitewash.c, 'rgba(150,145,135,.4)'); break;
    case 'herring':  herringPaint(g, px, py, C, C); break;
    case 'lino':     linoPaint(g, px, py, C, C); break;
    case 'sand':     sandPaint(g, px, py, C, C); break;
    case 'dirt':     dirtPaint(g, px, py, C, C); break;
    case 'mulch':    mulchPaint(g, px, py, C, C); break;
    case 'flagstone': flagstonePaint(g, px, py, C, C); break;
    case 'onyx':     onyxPaint(g, px, py, C, C); break;
    case 'terrazzo': terrazzoPaint(g, px, py, C, C); break;
    case 'grassA':   grassPaint(g, px, py, C, C); break;
    case 'grassB':   grassBPaint(g, px, py, C, C); break;
    case 'grassC':   grassCPaint(g, px, py, C, C); break;
    case 'grassD':   grassDPaint(g, px, py, C, C); break;
    case 'grassE':   grassCPaint(g, px, py, C, C); break;   // photo variant falls back to meadow
    case 'grassA':   grassPaint(g, px, py, C, C); break;
    case 'grassF':   grassFPaint(g, px, py, C, C); break;
    default:         g.fillStyle = '#e8e2d6'; g.fillRect(px, py, C + 0.5, C + 0.5);
    }
  }
  if (fm.t && !ownTex) { g.fillStyle = fm.t; g.fillRect(px, py, C + 0.6, C + 0.6); }   // colourway wash (fallback only)
}
HP.paintFloorCell = paintFloorCell;

function drawFloors(g) {
  const C = HP.CELL;
  const { regions, regionOf } = HP.computeRegions();
  const mats = HP.cur().floors;
  for (const r of regions) {
    g.save();
    g.beginPath();                                     // clip to the room's shape so
    for (const [x, y] of r.cells) g.rect(x * C, y * C, C, C);  // oversized stones/boards
    g.clip();                                          // can't bleed past the walls
    for (const [x, y] of r.cells)
      paintFloorCell(g, mats[x + ',' + y] || 'default', x * C, y * C);
    g.restore();
  }
  // path cells: floor paint outside any enclosed room (walkways, garden paths)
  for (const k in mats) {
    const s = k.split(','), x = +s[0], y = +s[1];
    if (!HP.cellIn(x, y) || regionOf[y * HP.GRID_W + x] >= 0) continue;
    paintFloorCell(g, mats[k], x * C, y * C);
  }
}

/* small live texture preview for the material swatches */
function paintPreview(p) {
  const g = p.c.getContext('2d');
  const C = HP.CELL, s = p.w / (C * 2.4);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, p.w, p.h);
  g.scale(s, s);
  for (let y = 0; y * C < p.h / s; y++)
    for (let x = 0; x * C < p.w / s; x++)
      paintFloorCell(g, p.mat, x * C, y * C);
}
HP.floorPreview = function (mat, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const p = { mat, c, w, h };
  _prevCvs.push(p);
  if (_prevCvs.length > 400) _prevCvs.splice(0, 200);   // cap stale swatches
  paintPreview(p);
  return c;
};

function drawGridLines(g) {
  const C = HP.CELL;
  g.strokeStyle = 'rgba(60,70,60,.13)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= HP.GRID_W; x++) { g.moveTo(x * C, 0); g.lineTo(x * C, HP.GRID_H * C); }
  for (let y = 0; y <= HP.GRID_H; y++) { g.moveTo(0, y * C); g.lineTo(HP.GRID_W * C, y * C); }
  g.stroke();
}

function drawLabels(g) {
  const { regions } = HP.computeRegions();
  const C = HP.CELL;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const placed = [];
  for (const r of [...regions].sort((a, b) => b.m2 - a.m2)) {
    if (r.m2 < 3) continue;
    const ax = r.lx ?? r.cx, ay = r.ly ?? r.cy;
    // shift label down until it no longer overlaps an already-placed one
    let ly = ay, tries = 0;
    while (tries++ < 8 &&
           placed.some(p => Math.abs(p.x - ax) < C * 3 && Math.abs(p.y - ly) < C * 0.9))
      ly += C * 0.9;
    placed.push({ x: ax, y: ly });
    const label = r.name || 'ROOM';
    g.fillStyle = 'rgba(60,55,45,.85)';
    g.font = '600 ' + Math.round(C * 0.42) + 'px "Segoe UI", sans-serif';
    g.fillText(label, ax, ly - C * 0.24);
    g.fillStyle = 'rgba(60,55,45,.6)';
    g.font = '500 ' + Math.round(C * 0.34) + 'px "Segoe UI", sans-serif';
    g.fillText(r.m2.toFixed(1) + ' m²', ax, ly + C * 0.3);
  }
}

/* ================= WALLS ================= */
function wallThick(seg) {                    // exterior → thicker
  const { regionOf } = HP.computeRegions();
  const out = (x, y) => !HP.cellIn(x, y) || regionOf[y * HP.GRID_W + x] < 0;
  if (seg.d === 'h') return (out(seg.x, seg.y - 1) || out(seg.x, seg.y)) ? 0.44 : 0.3;
  return (out(seg.x - 1, seg.y) || out(seg.x, seg.y)) ? 0.44 : 0.3;
}

function drawWalls(g) {
  const C = HP.CELL;
  const lvl = HP.cur();
  const isDoor = (d, x, y) => { const w = lvl.walls[d + ',' + x + ',' + y]; return w && w.f === 'door'; };
  for (const k in lvl.walls) {
    const s = HP.parseWallKey(k);
    const feat = lvl.walls[k].f;
    // within a run of adjacent doors, even offsets start a pair, odd are skipped
    let pair = false;
    if (feat === 'door') {
      let offset = 0;
      if (s.d === 'h') { for (let x = s.x - 1; isDoor('h', x, s.y); x--) offset++; }
      else             { for (let y = s.y - 1; isDoor('v', s.x, y); y--) offset++; }
      if (offset % 2 === 1) continue;
      pair = s.d === 'h' ? isDoor('h', s.x + 1, s.y) : isDoor('v', s.x, s.y + 1);
    }
    const t = wallThick(s) * C;
    // body: dark shell + light core (architectural plan look)
    g.fillStyle = '#2e3138';
    if (s.d === 'h') g.fillRect(s.x * C, s.y * C - t / 2, C + 0.6, t);
    else g.fillRect(s.x * C - t / 2, s.y * C, t, C + 0.6);
    const ti = Math.max(2, t - 8);
    g.fillStyle = '#f5f3ec';
    if (s.d === 'h') g.fillRect(s.x * C + 2, s.y * C - ti / 2, C - 3.4, ti);
    else g.fillRect(s.x * C - ti / 2, s.y * C + 2, ti, C - 3.4);
    if (feat) drawGap(g, s, t, pair);        // cut opening after body
    if (feat === 'door') (pair ? drawDoubleDoor : drawDoor)(g, s, t);
    else if (feat === 'window') drawWindow(g, s, t);
  }
}

function drawGap(g, s, t, dbl) {
  const C = HP.CELL, n = dbl ? 2 : 1;
  g.save();
  g.fillStyle = '#e8e2d6';
  if (s.d === 'h') g.fillRect(s.x * C + 2, s.y * C - t / 2 - 2, n * C - 4, t + 4);
  else g.fillRect(s.x * C - t / 2 - 2, s.y * C + 2, t + 4, n * C - 4);
  g.restore();
}

function insideDir(s) {                      // which side is inside? for door swing
  const { regionOf } = HP.computeRegions();
  const inr = (x, y) => HP.cellIn(x, y) && regionOf[y * HP.GRID_W + x] >= 0;
  if (s.d === 'h') return inr(s.x, s.y) ? 1 : -1;        // inside below (+y) or above
  return inr(s.x, s.y) ? 1 : -1;                          // inside right (+x) or left
}

function drawDoor(g, s, t) {
  const C = HP.CELL, dir = insideDir(s);
  const rec = HP.cur().walls[s.d + ',' + s.x + ',' + s.y];
  const closed = rec && rec.c;
  g.strokeStyle = '#7c5a38'; g.fillStyle = '#7c5a38'; g.lineWidth = 3;
  if (closed) {                                  // leaf shut across the doorway
    if (s.d === 'h') {
      const jy = s.y * C;
      g.fillRect(s.x * C - 2, jy - t / 2, 5, t);
      g.fillRect((s.x + 1) * C - 3, jy - t / 2, 5, t);
      g.fillRect(s.x * C + 3, jy - 3.5, C - 6, 7);
      g.beginPath(); g.arc(s.x * C + C * 0.8, jy + 5.5, 1.7, 0, 7); g.fill();
    } else {
      const jx = s.x * C;
      g.fillRect(jx - t / 2, s.y * C - 2, t, 5);
      g.fillRect(jx - t / 2, (s.y + 1) * C - 3, t, 5);
      g.fillRect(jx - 3.5, s.y * C + 3, 7, C - 6);
      g.beginPath(); g.arc(jx + 5.5, s.y * C + C * 0.8, 1.7, 0, 7); g.fill();
    }
    return;
  }
  if (s.d === 'h') {
    const jx = s.x * C, jy = s.y * C;                    // hinge at left vertex
    g.fillRect(jx - 2, jy - t / 2, 5, t);                // jamb caps
    g.fillRect((s.x + 1) * C - 3, jy - t / 2, 5, t);
    g.beginPath();                                       // leaf (opened into room)
    g.moveTo(jx, jy); g.lineTo(jx, jy + dir * C * 0.9); g.stroke();
    g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(jx, jy, C * 0.9, dir > 0 ? 0 : -Math.PI / 2, dir > 0 ? Math.PI / 2 : 0); g.stroke();
  } else {
    const jx = s.x * C, jy = s.y * C;
    g.fillRect(jx - t / 2, jy - 2, t, 5);
    g.fillRect(jx - t / 2, (s.y + 1) * C - 3, t, 5);
    g.beginPath();
    g.moveTo(jx, jy); g.lineTo(jx + dir * C * 0.9, jy); g.stroke();
    g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(jx, jy, C * 0.9, dir > 0 ? 0 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI); g.stroke();
  }
}

/* double door: 2-cell opening, jambs at outer ends, two leaves swung inward */
function drawDoubleDoor(g, s, t) {
  const C = HP.CELL, dir = insideDir(s);
  const rec = HP.cur().walls[s.d + ',' + s.x + ',' + s.y];
  if (rec && rec.c) {                              // both leaves shut, meeting in the middle
    g.fillStyle = '#7c5a38';
    if (s.d === 'h') {
      const y = s.y * C, xL = s.x * C, xR = (s.x + 2) * C;
      g.fillRect(xL - 2, y - t / 2, 5, t); g.fillRect(xR - 3, y - t / 2, 5, t);
      g.fillRect(xL + 3, y - 3.5, C - 3, 7); g.fillRect(xL + C, y - 3.5, C - 6, 7);
      g.beginPath(); g.arc(xL + C - 5, y + 5.5, 1.7, 0, 7); g.fill();
      g.beginPath(); g.arc(xL + C + 5, y + 5.5, 1.7, 0, 7); g.fill();
    } else {
      const x = s.x * C, yT = s.y * C, yB = (s.y + 2) * C;
      g.fillRect(x - t / 2, yT - 2, t, 5); g.fillRect(x - t / 2, yB - 3, t, 5);
      g.fillRect(x - 3.5, yT + 3, 7, C - 3); g.fillRect(x - 3.5, yT + C, 7, C - 6);
      g.beginPath(); g.arc(x + 5.5, yT + C - 5, 1.7, 0, 7); g.fill();
      g.beginPath(); g.arc(x + 5.5, yT + C + 5, 1.7, 0, 7); g.fill();
    }
    return;
  }
  const LEN = C * 0.95, ANG = Math.PI / 3;              // leaves ~60° open
  const dl = Math.cos(ANG) * LEN, dw = Math.sin(ANG) * LEN * dir;
  g.fillStyle = '#2e3138';
  g.strokeStyle = '#7c5a38'; g.lineWidth = 3; g.lineCap = 'round';
  if (s.d === 'h') {
    const y = s.y * C, xL = s.x * C, xR = (s.x + 2) * C;
    g.fillRect(xL - 2, y - t / 2, 5, t);                 // outer jamb caps
    g.fillRect(xR - 3, y - t / 2, 5, t);
    g.beginPath(); g.moveTo(xL, y); g.lineTo(xL + dl, y + dw); g.stroke();   // leaves
    g.beginPath(); g.moveTo(xR, y); g.lineTo(xR - dl, y + dw); g.stroke();
    g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 1.2;                 // swing arcs
    const aL = Math.atan2(dw, dl), aR = Math.atan2(dw, -dl);
    g.beginPath(); g.arc(xL, y, LEN, 0, aL, dir < 0); g.stroke();
    g.beginPath(); g.arc(xR, y, LEN, Math.PI, aR, dir > 0); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;                      // meeting stile
    g.beginPath(); g.moveTo(xL + C, y - t / 2 - 1); g.lineTo(xL + C, y + t / 2 + 1); g.stroke();
  } else {
    const x = s.x * C, yT = s.y * C, yB = (s.y + 2) * C;
    const dx = Math.sin(ANG) * LEN * dir, dy = Math.cos(ANG) * LEN;
    g.fillRect(x - t / 2, yT - 2, t, 5);
    g.fillRect(x - t / 2, yB - 3, t, 5);
    g.beginPath(); g.moveTo(x, yT); g.lineTo(x + dx, yT + dy); g.stroke();
    g.beginPath(); g.moveTo(x, yB); g.lineTo(x + dx, yB - dy); g.stroke();
    g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 1.2;
    const aT = Math.atan2(dy, dx), aB = Math.atan2(-dy, dx);
    g.beginPath(); g.arc(x, yT, LEN, Math.PI / 2, aT, dir > 0); g.stroke();
    g.beginPath(); g.arc(x, yB, LEN, -Math.PI / 2, aB, dir < 0); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - t / 2 - 1, yT + C); g.lineTo(x + t / 2 + 1, yT + C); g.stroke();
  }
}

function drawWindow(g, s, t) {
  const C = HP.CELL;
  g.strokeStyle = '#5b8aa8'; g.lineWidth = 2;
  const o = t * 0.28;
  if (s.d === 'h') {
    const y = s.y * C;
    g.fillStyle = '#2e3138';
    g.fillRect(s.x * C - 1, y - t / 2, 4, t); g.fillRect((s.x + 1) * C - 3, y - t / 2, 4, t);
    g.beginPath();
    g.moveTo(s.x * C + 2, y - o); g.lineTo((s.x + 1) * C - 2, y - o);
    g.moveTo(s.x * C + 2, y + o); g.lineTo((s.x + 1) * C - 2, y + o);
    g.stroke();
  } else {
    const x = s.x * C;
    g.fillStyle = '#2e3138';
    g.fillRect(x - t / 2, s.y * C - 1, t, 4); g.fillRect(x - t / 2, (s.y + 1) * C - 3, t, 4);
    g.beginPath();
    g.moveTo(x - o, s.y * C + 2); g.lineTo(x - o, (s.y + 1) * C - 2);
    g.moveTo(x + o, s.y * C + 2); g.lineTo(x + o, (s.y + 1) * C - 2);
    g.stroke();
  }
}

/* ================= FENCES ================= */
/* one fence segment drawn as a mini elevation (item-style 3D look):
   thick band + face pattern + protruding posts + soft drop shadow.
   Local coords: segment runs along +x for length C, centred on y=0. */
function drawFenceSeg(g, s, f) {
  const C = HP.CELL, L = C, Ht = C * 0.42, hb = Ht / 2;
  g.save();
  g.translate(s.x * C, s.y * C);
  if (s.d === 'v') g.rotate(Math.PI / 2);          // v segs run down; draw along x
  /* post = little 3D box taller than the band, light cap on top */
  const post = () => {
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(-2.6, -hb - 0.6, 5.8, hb * 2 + 3);
    g.fillStyle = f.post;            g.fillRect(-2.6, -hb - 1.6, 5.2, hb * 2 + 3.2);
    g.fillStyle = HP.shade(f.post, 1.3); g.fillRect(-2.6, -hb - 1.6, 5.2, 1.6);
  };
  const posts = () => { post(); g.save(); g.translate(L, 0); post(); g.restore(); };
  const band = (col, h) => {                        // face strip + lit top + shaded foot
    const hh = h || hb;
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(1, -hh + 1.6, L, hh * 2);
    g.fillStyle = col; g.fillRect(0, -hh, L, hh * 2);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, -hh, L, 1.4);
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, hh - 1.4, L, 1.4);
  };
  const vlines = (col, step, w, y0, y1, x0) => {      // vertical strokes in the face
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    for (let x = (x0 === undefined ? step / 2 : x0); x < L - 1; x += step) { g.moveTo(x, y0); g.lineTo(x, y1); }
    g.stroke();
  };
  switch (f.t) {
    case 'picket': {
      band(HP.shade(f.c, 0.92), hb * 0.62);
      g.fillStyle = f.c;
      for (let x = 3.2; x < L - 1; x += 5.2) {                       // slats + points
        g.fillRect(x - 1.4, -hb * 0.85, 2.8, hb * 1.7);
        g.beginPath();
        g.moveTo(x - 1.4, -hb * 0.85); g.lineTo(x, -hb * 1.18); g.lineTo(x + 1.4, -hb * 0.85);
        g.fill();
      }
      posts();
      break;
    }
    case 'iron': {
      band(HP.shade(f.c, 0.8), hb * 0.5);
      vlines(HP.shade(f.c, 1.15), 4.6, 1.5, -hb * 0.9, hb * 0.9, 3); // bars
      g.fillStyle = HP.shade(f.c, 1.3);                              // spear tips
      for (let x = 3; x < L - 1; x += 4.6) {
        g.beginPath(); g.moveTo(x - 1.3, -hb * 0.9); g.lineTo(x, -hb * 1.3); g.lineTo(x + 1.3, -hb * 0.9); g.fill();
      }
      g.fillStyle = '#a8a294';                                        // stone posts
      post(); g.save(); g.translate(L, 0); post(); g.restore();
      break;
    }
    case 'stone': {
      band(f.c);
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;             // mortar dashes
      g.beginPath();
      for (let x = 4; x < L; x += 6) { g.moveTo(x, -hb + 2); g.lineTo(x, -1); }
      for (let x = 7; x < L; x += 6) { g.moveTo(x, 1); g.lineTo(x, hb - 2); }
      g.moveTo(0, 0); g.lineTo(L, 0);
      g.stroke();
      g.fillStyle = '#e2d9c8'; g.fillRect(0, -hb - 1.2, L, 2.4);      // coping
      posts();
      break;
    }
    case 'brick': {
      band(f.c);
      g.strokeStyle = '#8a4f3c'; g.lineWidth = 1;                     // courses
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(L, 0);
      for (let x = 3; x < L; x += 5.6) { g.moveTo(x, -hb + 1); g.lineTo(x, -0.6); }
      for (let x = 5.8; x < L; x += 5.6) { g.moveTo(x, 0.6); g.lineTo(x, hb - 1); }
      g.stroke();
      g.fillStyle = '#efe9da'; g.fillRect(0, -hb - 1.2, L, 2.4);      // light coping
      posts();
      break;
    }
    case 'whitewall': {
      band(f.c);
      g.fillStyle = HP.shade(f.c, 0.9); g.fillRect(0, -hb - 1.2, L, 2.4);  // coping
      posts();
      break;
    }
    case 'bamboo': case 'reed': {
      const step = f.t === 'bamboo' ? 3.1 : 2.3, hw = f.t === 'bamboo' ? 2.7 : 2;
      for (let x = 1.5, i = 0; x < L - 1; x += step, i++) {            // sticks
        g.strokeStyle = HP.shade(f.c, i % 3 === 1 ? 0.82 : 1);
        g.lineWidth = hw;
        const h = f.t === 'bamboo' ? hb : hb * (0.85 + (i % 3) * 0.12);
        g.beginPath(); g.moveTo(x, -h); g.lineTo(x, h); g.stroke();
      }
      g.strokeStyle = HP.shade(f.post, 0.8); g.lineWidth = 1.3;        // lashings
      g.beginPath();
      g.moveTo(0, -hb * 0.45); g.lineTo(L, -hb * 0.45);
      g.moveTo(0, hb * 0.45);  g.lineTo(L, hb * 0.45);
      g.stroke();
      break;
    }
    case 'chainlink': {
      g.save();
      g.beginPath(); g.rect(0, -hb * 0.8, L, hb * 1.6); g.clip();      // mesh inside band
      g.strokeStyle = 'rgba(170,180,187,.9)'; g.lineWidth = 0.9;
      g.beginPath();
      for (let x = -8; x < L + 4; x += 4) { g.moveTo(x, -hb); g.lineTo(x + hb, hb); }
      for (let x = 0; x < L + hb + 4; x += 4) { g.moveTo(x, -hb); g.lineTo(x - hb, hb); }
      g.stroke();
      g.restore();
      g.strokeStyle = HP.shade(f.c, 0.7); g.lineWidth = 1.6;           // top rail
      g.beginPath(); g.moveTo(0, -hb * 0.8); g.lineTo(L, -hb * 0.8); g.stroke();
      posts();
      break;
    }
    case 'lattice': {
      band(HP.shade(f.c, 1.05));
      g.save();
      g.beginPath(); g.rect(0, -hb + 1, L, Ht - 2); g.clip();          // crisscross inside
      g.strokeStyle = HP.shade(f.c, 0.6); g.lineWidth = 1.1;
      g.beginPath();
      for (let x = -6; x < L + 3; x += 4.5) { g.moveTo(x, -hb); g.lineTo(x + hb, hb); }
      for (let x = 0; x < L + hb + 3; x += 4.5) { g.moveTo(x, -hb); g.lineTo(x - hb, hb); }
      g.stroke();
      g.restore();
      g.strokeStyle = HP.shade(f.c, 0.7); g.lineWidth = 1.4;
      g.strokeRect(0, -hb, L, Ht);
      posts();
      break;
    }
    case 'ranch':
      g.strokeStyle = f.c; g.lineWidth = 2.6; g.lineCap = 'round';     // 3 open rails
      g.beginPath();
      for (const dy of [-hb * 0.9, 0, hb * 0.9]) { g.moveTo(0, dy); g.lineTo(L, dy); }
      g.stroke();
      posts();
      break;
    case 'glass':
      g.fillStyle = 'rgba(140,200,220,.45)'; g.fillRect(0, -hb, L, Ht);  // pane
      g.strokeStyle = 'rgba(120,180,200,.9)'; g.lineWidth = 1.4;
      g.strokeRect(0, -hb, L, Ht);
      g.strokeStyle = 'rgba(240,250,252,.85)'; g.lineWidth = 1.2;        // glint
      g.beginPath(); g.moveTo(2, hb - 1); g.lineTo(L * 0.45, -hb + 1); g.stroke();
      g.fillStyle = f.post; post(); g.save(); g.translate(L, 0); post(); g.restore();
      break;
    case 'metal': {
      band(f.c);
      vlines(HP.shade(f.c, 0.65), 4, 1.1, -hb + 1, hb - 1, 4);           // ribs
      posts();
      break;
    }
    case 'fieldstone':
      for (let x = 4, i = 0; x < L - 1; x += 6.4, i++) {
        g.fillStyle = HP.shade(f.c, 0.88 + (i % 3) * 0.08);
        g.beginPath(); g.ellipse(x, (i % 2 ? 1.6 : -1.6), 3, 2.4, 0, 0, 7); g.fill();
        g.strokeStyle = f.post; g.lineWidth = 0.8; g.stroke();
      }
      break;
    case 'rope':
      g.strokeStyle = f.c; g.lineWidth = 2;                            // sagging ropes
      g.beginPath(); g.moveTo(0, -hb * 0.7); g.quadraticCurveTo(L / 2, hb * 0.5, L, -hb * 0.7); g.stroke();
      g.beginPath(); g.moveTo(0, hb * 0.1); g.quadraticCurveTo(L / 2, hb * 1.1, L, hb * 0.1); g.stroke();
      g.fillStyle = f.post;
      g.fillRect(-2.2, -hb - 1.6, 4.4, Ht + 3.2);                      // tall posts
      g.save(); g.translate(L, 0); g.fillRect(-2.2, -hb - 1.6, 4.4, Ht + 3.2); g.restore();
      break;
    case 'hedge':
      for (let x = 2, i = 0; x < L + 3; x += 6.5, i++) {
        g.fillStyle = HP.shade(f.c, 0.86 + (i % 3) * 0.1);
        g.beginPath(); g.ellipse(x, (i % 2 ? 1 : -1) * 1.2, 5.2, hb * 0.95, 0, 0, 7); g.fill();
      }
      g.strokeStyle = HP.shade(f.c, 0.6); g.lineWidth = 1;
      g.beginPath(); g.ellipse(L / 2, 0, L / 2 + 2, hb * 0.95, 0, 0, 7); g.stroke();
      break;
    case 'gate': {
      g.fillStyle = f.post; post(); g.save(); g.translate(L, 0); post(); g.restore();
      g.fillStyle = HP.shade(f.c, 1.05);                               // open leaf (elevated)
      g.save(); g.rotate(-0.6);
      g.fillRect(0, -hb * 0.6, L * 0.75, hb * 1.2);
      g.strokeStyle = HP.shade(f.c, 0.6); g.lineWidth = 1.4;             // brace
      g.beginPath(); g.moveTo(1, -hb * 0.4); g.lineTo(L * 0.72, hb * 0.4); g.stroke();
      g.restore();
      g.strokeStyle = 'rgba(92,64,40,.5)'; g.lineWidth = 1.1; g.setLineDash([3, 3]);
      g.beginPath(); g.arc(0, 0, L * 0.9, -Math.PI / 2, 0); g.stroke();  // swing arc
      g.setLineDash([]);
      break;
    }
    default: /* wood — plank panel + posts */
      band(f.c);
      vlines(HP.shade(f.c, 0.6), 4.4, 0.9, -hb + 1.6, hb - 1.6);        // plank seams
      posts();
  }
  g.restore();
}

function drawFences(g) {
  const lvl = HP.cur();
  for (const k in lvl.fences) {
    const rec = lvl.fences[k];
    const d = HP.FENCE_TYPES[rec.t] || HP.FENCE_TYPES.wood;
    drawFenceSeg(g, HP.parseWallKey(k), { t: rec.t, c: d.c, post: d.post });
  }
}
HP.drawFenceSeg = drawFenceSeg;

/* ================= DYNAMIC ================= */
function drawItems(g) {
  for (const it of HP.cur().furniture) HP.drawItem(g, it);
}

/* warm light pools under lamps that are switched on (walk-mode interact).
   Drawn BEFORE items so the lamp sits inside its own glow — no floating dot. */
function drawLights(g) {
  const C = HP.CELL;
  for (const it of HP.cur().furniture) {
    if (!it.on || !HP.isLamp || !HP.isLamp(it.type)) continue;
    const f = HP.footprint(it);
    const mx = (f.x + f.w / 2) * C, my = (f.y + f.h / 2) * C, Rr = C * 3.4;
    const gr = g.createRadialGradient(mx, my, 0, mx, my, Rr);
    gr.addColorStop(0, 'rgba(255,216,130,.45)');
    gr.addColorStop(0.4, 'rgba(255,216,130,.22)');
    gr.addColorStop(1, 'rgba(255,216,130,0)');
    g.fillStyle = gr;
    g.fillRect(mx - Rr, my - Rr, Rr * 2, Rr * 2);
  }
}

function drawOverlays(g) {
  const C = HP.CELL;
  if (HP.drawPeerCursors) HP.drawPeerCursors(g);   // live co-op cursors
  if (HP.playing) {                       // walk mode: just the player
    if (HP.player) HP.drawPlayer(g);
    return;
  }
  // measure line
  if (HP.measureLine) {
    const m = HP.measureLine;
    const mlen = Math.hypot(m.bx - m.ax, m.by - m.ay) / C * 0.5;
    g.strokeStyle = '#ffb74d'; g.lineWidth = 2; g.setLineDash([8, 5]);
    g.beginPath(); g.moveTo(m.ax, m.ay); g.lineTo(m.bx, m.by); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffb74d';
    g.beginPath(); g.arc(m.ax, m.ay, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(m.bx, m.by, 4, 0, 7); g.fill();
    g.font = '600 13px "Segoe UI", sans-serif'; g.textAlign = 'center';
    const tx = (m.ax + m.bx) / 2, ty = (m.ay + m.by) / 2 - 10;
    const label = mlen.toFixed(2) + ' m';
    const tw = g.measureText(label).width + 12;
    g.fillStyle = 'rgba(20,23,28,.85)';
    g.fillRect(tx - tw / 2, ty - 10, tw, 20);
    g.fillStyle = '#ffb74d'; g.fillText(label, tx, ty + 4);
  }
  // wall draw preview
  if (HP.wallPreview) {
    g.fillStyle = 'rgba(79,156,249,.55)';
    for (const k of HP.wallPreview) {
      const s = HP.parseWallKey(k);
      if (s.d === 'h') g.fillRect(s.x * C, s.y * C - 4, C, 8);
      else g.fillRect(s.x * C - 4, s.y * C, 8, C);
    }
    if (HP.wallPreview.length) {
      const n = HP.wallPreview.length;
      const last = HP.parseWallKey(HP.wallPreview[n - 1]);
      const lx = (last.d === 'h' ? last.x + 0.5 : last.x) * C;
      const ly = (last.d === 'v' ? last.y + 0.5 : last.y) * C - 14;
      const label = n + ' seg · ' + (n * 0.5).toFixed(1) + ' m';
      g.font = '600 13px "Segoe UI", sans-serif'; g.textAlign = 'center';
      const tw = g.measureText(label).width + 12;
      g.fillStyle = 'rgba(20,23,28,.85)';
      g.fillRect(lx - tw / 2, ly - 10, tw, 20);
      g.fillStyle = '#4f9cf9'; g.fillText(label, lx, ly + 4);
    }
  }
  // fence draw preview
  if (HP.fencePreview) {
    g.fillStyle = 'rgba(230,140,60,.55)';
    for (const k of HP.fencePreview) {
      const s = HP.parseWallKey(k);
      if (s.d === 'h') g.fillRect(s.x * C, s.y * C - 4, C, 8);
      else g.fillRect(s.x * C - 4, s.y * C, 8, C);
    }
  }
  // placement ghost
  if (HP.pending && HP.ghost) {
    const def = HP.pending.def;
    const w = (HP.pending.rot % 2 === 0) ? def.w : def.h;
    const h = (HP.pending.rot % 2 === 0) ? def.h : def.w;
    const ok = HP.ghost.valid;
    g.fillStyle = ok ? 'rgba(90,200,120,.35)' : 'rgba(224,92,92,.4)';
    g.fillRect(HP.ghost.x * C, HP.ghost.y * C, w * C, h * C);
    g.strokeStyle = ok ? '#46a35e' : '#d33'; g.lineWidth = 2; g.setLineDash([6, 4]);
    g.strokeRect(HP.ghost.x * C, HP.ghost.y * C, w * C, h * C); g.setLineDash([]);
    HP.drawItem(g, { type: def.id, x: HP.ghost.x, y: HP.ghost.y, rot: HP.pending.rot, v: HP.pending.v }, ok ? 'ghost' : false);
  }
  // selection outline (all members of a connected group)
  if (HP.selected) {
    for (const m of HP.groupOf(HP.selected)) {
      const f = HP.footprint(m);
      g.strokeStyle = '#4f9cf9'; g.lineWidth = 2; g.setLineDash([7, 5]);
      g.strokeRect(f.x * C - 3, f.y * C - 3, f.w * C + 6, f.h * C + 6);
      g.setLineDash([]);
    }
    const f = HP.footprint(HP.selected);
    g.fillStyle = '#4f9cf9';
    g.beginPath(); g.arc((f.x + f.w) * C - 3, f.y * C - 3, 6, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('⟳', (f.x + f.w) * C - 3, f.y * C - 3);
  }
  // invalid-move tint on dragged item
  // (item itself already moves; footprint overlap drawn via ghost only)
}

/* ================= MAIN LOOP ================= */
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, ((t || 0) - lastT) / 1000); lastT = t || 0;
  if (HP.playing) HP.tickPlayer(dt);
  if (staticDirty) rebuildStatic();
  if (HP.dirty) {
    /* Safari can change the wrap size without firing resize — re-check
       every painted frame or the backing store smears at the edges */
    const cw = Math.round(HP.canvas.clientWidth * dpr);
    const ch = Math.round(HP.canvas.clientHeight * dpr);
    if (HP.canvas.width !== cw || HP.canvas.height !== ch) {
      HP.canvas.width = cw; HP.canvas.height = ch;
    }
    const ctx = HP.ctx, w = HP.canvas.clientWidth, h = HP.canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = HP.shade(HP.state.bg || '#aebfa0', 0.82);   // far grass
    ctx.fillRect(0, 0, w, h);
    const cam = { x: HP.camera.x, y: HP.camera.y, zoom: HP.camera.zoom, w, h };
    HP.renderAll(ctx, cam, staticLayer);
    HP.dirty = false;
  }
  requestAnimationFrame(frame);
}

/* shared renderer: blits cached static layer + draws dynamic stuff.
   In export mode draws static content directly (no cache needed). */
HP.renderAll = function (g, cam, layer) {
  g.save();
  g.translate(cam.w / 2, cam.h / 2);
  g.scale(cam.zoom, cam.zoom);
  g.translate(-cam.x, -cam.y);
  if (layer && !cam.export) {
    g.drawImage(layer, -MARGIN * HP.CELL, -MARGIN * HP.CELL);
  } else {
    drawGround(g); drawFloors(g); drawLabels(g); drawWalls(g); drawFences(g);
  }
  drawLights(g);
  drawItems(g);
  if (!cam.export) drawOverlays(g);
  g.restore();
};

/* ================= BOOT ================= */
function boot() {
  HP.canvas = document.getElementById('view');
  HP.ctx = HP.canvas.getContext('2d');
  function resize() {
    dpr = window.devicePixelRatio || 1;
    HP.canvas.width = HP.canvas.clientWidth * dpr;
    HP.canvas.height = HP.canvas.clientHeight * dpr;
    HP.markDirty();
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  resize();

  if (!HP.loadState()) HP.state = HP.migrate(HP.PRESETS[0].build());   // first run → cozy apartment
  HP.nextId = Math.max(HP.nextId, HP.maxFurnitureId() + 1);

  // fit camera to the grid
  const fit = Math.min(HP.canvas.clientWidth / (HP.GRID_W * HP.CELL + 120),
                       HP.canvas.clientHeight / (HP.GRID_H * HP.CELL + 160));
  HP.camera.zoom = Math.max(HP.MIN_ZOOM, Math.min(1.2, fit));

  HP.initUI();
  HP.initInput();
  HP.initWalk();
  HP.status('Welcome! Pick furniture on the left, or tap New for another house.', false);
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
})();
