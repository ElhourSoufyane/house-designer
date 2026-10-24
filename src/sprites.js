/* sprites.js — painter helpers (HP.P) + cached offscreen sprite rendering.
   Sprites are drawn once per (item type, variant) at PPC px per cell with PAD
   margin for baked drop-shadow, then rotated on the main canvas. */
(function () {
HP.PPC = 64;     // px per cell inside sprites
HP.PAD = 12;     // shadow margin

const cache = {};

/* ---------- painter helpers ---------- */
HP.P = {
  RR(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  },
  box(g, x, y, w, h, r, fill) {
    this.RR(g, x, y, w, h, r);
    g.fillStyle = fill; g.fill();
  },
  lg(g, x, y, w, h, c1, c2) {           // vertical gradient (light top-left feel)
    const gr = g.createLinearGradient(x, y, x + w * 0.3, y + h);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    return gr;
  },
  /* soft baked drop shadow under the whole item shape */
  shadow(g, x, y, w, h, r) {
    g.save();
    g.shadowColor = 'rgba(20,15,10,.45)';
    g.shadowBlur = 9; g.shadowOffsetX = 4; g.shadowOffsetY = 6;
    this.RR(g, x, y, w, h, r);
    g.fillStyle = 'rgba(0,0,0,.001)'; g.fill();
    g.restore();
  },
  wood(g, x, y, w, h, c) {
    this.shadow(g, x, y, w, h, 4);
    this.box(g, x, y, w, h, 4, this.lg(g, x, y, w, h, HP.shade(c, 1.15), HP.shade(c, 0.82)));
    // grain lines
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
    const n = Math.max(2, Math.floor(h / 12));
    for (let i = 1; i <= n; i++) {
      const yy = y + (h * i) / (n + 1) + (i % 2) * 2;
      g.beginPath(); g.moveTo(x + 3, yy); g.lineTo(x + w - 3, yy); g.stroke();
    }
    g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1.5;
    this.RR(g, x, y, w, h, 4); g.stroke();
  },
  fabric(g, x, y, w, h, r, c) {
    this.shadow(g, x, y, w, h, r);
    const gr = g.createRadialGradient(x + w * 0.4, y + h * 0.35, 2, x + w / 2, y + h / 2, Math.max(w, h));
    gr.addColorStop(0, HP.shade(c, 1.18)); gr.addColorStop(1, HP.shade(c, 0.85));
    this.box(g, x, y, w, h, r, gr);
    g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1.5;
    this.RR(g, x, y, w, h, r); g.stroke();
  },
  cushion(g, x, y, w, h, c) {
    const gr = g.createRadialGradient(x + w * 0.45, y + h * 0.35, 1, x + w / 2, y + h / 2, Math.max(w, h));
    gr.addColorStop(0, HP.shade(c, 1.1)); gr.addColorStop(1, HP.shade(c, 0.9));
    this.box(g, x, y, w, h, Math.min(8, w / 3, h / 3), gr);
    g.strokeStyle = HP.shade(c, 0.72); g.lineWidth = 1;
    this.RR(g, x, y, w, h, Math.min(8, w / 3, h / 3)); g.stroke();
    // stitch dashes
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.setLineDash([3, 3]);
    this.RR(g, x + 3, y + 3, w - 6, h - 6, Math.min(5, w / 4, h / 4)); g.stroke();
    g.setLineDash([]);
  },
  pillow(g, x, y, s, c, ang) {
    g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(ang || 0);
    const gr = g.createRadialGradient(-s * 0.1, -s * 0.15, 1, 0, 0, s * 0.7);
    gr.addColorStop(0, HP.shade(c, 1.15)); gr.addColorStop(1, HP.shade(c, 0.9));
    this.RR(g, -s / 2, -s / 2 + 1, s, s * 0.78, s * 0.3);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 1;
    this.RR(g, -s / 2, -s / 2 + 1, s, s * 0.78, s * 0.3); g.stroke();
    g.restore();
  },
  pot(g, cx, cy, r) {
    g.beginPath(); g.arc(cx, cy, r, 0, 7);
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    gr.addColorStop(0, '#c98a5e'); gr.addColorStop(1, '#96582f');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#6e3f20'; g.lineWidth = 1.5; g.stroke();
  },
  leaves(g, cx, cy, r, c, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const d = r * (0.35 + (i % 3) * 0.22);
      const lx = cx + Math.cos(a) * d * 0.6, ly = cy + Math.sin(a) * d * 0.6;
      g.beginPath();
      g.ellipse(lx, ly, r * 0.42, r * 0.24, a, 0, 7);
      g.fillStyle = HP.shade(c, 0.9 + (i % 3) * 0.12); g.fill();
    }
    g.beginPath(); g.arc(cx, cy, r * 0.3, 0, 7);
    g.fillStyle = HP.shade(c, 0.75); g.fill();
  }
};

/* ---------- sprite cache ---------- */
HP.getSprite = function (type, v, w, h, mask) {
  const def = HP.itemDef(type);
  const iw = w || def.w, ih = h || def.h;         // resized items render at their own size
  const key = type + ':' + v + ':' + iw + 'x' + ih + (mask ? ':' + mask : '');
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = iw * HP.PPC + HP.PAD * 2;
  c.height = ih * HP.PPC + HP.PAD * 2;
  const g = c.getContext('2d');
  g.translate(HP.PAD, HP.PAD);
  def.draw.call(def, g, iw * HP.PPC, ih * HP.PPC, v || 0, mask || 0);
  cache[key] = c;
  return c;
};

/* joinable items: bitmask of sides where an identical (same type+rot) item touches.
   bit0=right 1=down 2=left 3=up, in the sprite's LOCAL frame (before rotation) */
HP._joinMask = function (item) {
  const f = HP.footprint(item);
  const same = (cx, cy) => {
    const o = HP.itemAt(cx, cy);
    return o && o !== item && o.type === item.type && o.rot === item.rot;
  };
  let wm = 0;
  for (let j = 0; j < f.h; j++) if (same(f.x + f.w, f.y + j)) { wm |= 1; break; }
  for (let i = 0; i < f.w; i++) if (same(f.x + i, f.y + f.h)) { wm |= 2; break; }
  for (let j = 0; j < f.h; j++) if (same(f.x - 1, f.y + j)) { wm |= 4; break; }
  for (let i = 0; i < f.w; i++) if (same(f.x + i, f.y - 1)) { wm |= 8; break; }
  let lm = 0;                                     // sprite is drawn, then rotated rot*90° CW
  for (let s = 0; s < 4; s++) if (wm & (1 << s)) lm |= 1 << ((s - item.rot + 4) & 3);
  return lm;
};

/* draw a furniture item (rotated) onto the main canvas at world coords */
HP.drawItem = function (g, item, ghostOk) {
  const f = HP.footprint(item);
  const def = HP.itemDef(item.type);
  const mask = def.joins ? HP._joinMask(item) : 0;
  const spr = HP.getSprite(item.type, item.v, item.w, item.h, mask);
  const k = HP.CELL / HP.PPC;                     // world-px per sprite-px
  const cx = (f.x + f.w / 2) * HP.CELL, cy = (f.y + f.h / 2) * HP.CELL;
  g.save();
  g.translate(cx, cy);
  g.rotate(item.rot * Math.PI / 2);
  if (ghostOk === false) g.globalAlpha = 0.55;    // invalid ghost
  else if (ghostOk === 'ghost') g.globalAlpha = 0.8;
  const dw = (item.w || def.w) * HP.CELL, dh = (item.h || def.h) * HP.CELL; // sprite is stored unrotated
  g.drawImage(spr, -dw / 2 - HP.PAD * k, -dh / 2 - HP.PAD * k,
    (spr.width) * k, (spr.height) * k);
  g.restore();
};

/* small preview for catalog buttons */
HP.itemPreview = function (type, wpx, hpx) {
  const spr = HP.getSprite(type, 0);
  const c = document.createElement('canvas');
  c.width = wpx; c.height = hpx;
  const g = c.getContext('2d');
  const s = Math.min(wpx / spr.width, hpx / spr.height) * 0.92;
  g.drawImage(spr, (wpx - spr.width * s) / 2, (hpx - spr.height * s) / 2, spr.width * s, spr.height * s);
  return c;
};
})();
