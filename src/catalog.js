/* catalog.js — furniture definitions.
   Each item: { id, name, cat, w, h (in cells), colors:[variants], draw(g, W, H, v) }
   draw() renders the top view into a W×H px box (footprint area; sprite adds margin).
   Painter helpers live in sprites.js as HP.P — draw functions run lazily so order is fine. */

(function () {
const P = () => HP.P;

function sofa(len, L) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    // base + backrest (top edge)
    p.fabric(g, 4, H * 0.30, W - 8, H * 0.66, 10, HP.shade(c, 0.82));
    p.fabric(g, 4, 4, W - 8, H * 0.34, 9, c);
    // seat cushions
    const cw = (W - 24) / len;
    for (let i = 0; i < len; i++)
      p.cushion(g, 10 + i * cw + 2, H * 0.38, cw - 4, H * 0.5, HP.shade(c, 1.12));
    // armrests
    p.fabric(g, 2, 4, 12, H - 8, 6, HP.shade(c, 0.9));
    p.fabric(g, W - 14, 4, 12, H - 8, 6, HP.shade(c, 0.9));
    // pillows
    p.pillow(g, 18, H * 0.12, 14, HP.shade(c, 1.3), -0.2);
    p.pillow(g, W - 34, H * 0.12, 14, HP.shade(c, 1.3), 0.2);
  };
}

function bedDraw(wf) { // wf = pillow columns hint (unused, computed from W)
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    // wood frame
    p.wood(g, 3, 3, W - 6, H - 6, '#8a6844');
    // mattress
    p.fabric(g, 8, 8, W - 16, H - 16, 6, '#f2ede4');
    // headboard
    p.box(g, 3, 3, W - 6, 14, 6, p.lg(g, 3, 3, W - 6, 14, '#6b4f33', '#543e28'));
    // pillows
    const pw = (W - 30) / 2;
    p.pillow(g, 12, 16, pw - 4, '#ffffff', 0);
    p.pillow(g, 12 + pw + 6, 16, pw - 4, '#ffffff', 0);
    // duvet covering lower 60%
    p.fabric(g, 8, H * 0.38, W - 16, H * 0.56, 6, c);
    g.fillStyle = HP.shade(c, 1.18);
    g.fillRect(8, H * 0.38, W - 16, 8);                     // fold line
    g.fillStyle = HP.shade(c, 0.9);
    g.fillRect(W / 2 - 1, H * 0.42, 2, H * 0.5);            // centre crease
    // side drape
    p.fabric(g, 8, H * 0.38, 7, H * 0.56, 3, HP.shade(c, 0.88));
    p.fabric(g, W - 15, H * 0.38, 7, H * 0.56, 3, HP.shade(c, 0.88));
  };
}

function tableWood(ratio) { // simple wood table, legs
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    p.wood(g, 4, 4, W - 8, H - 8, c);
    g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2;
    P().RR(g, 7, 7, W - 14, H - 14, 4); g.stroke();
    // legs
    g.fillStyle = HP.shade(c, 0.55);
    [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]].forEach(pt => {
      g.beginPath(); g.arc(pt[0], pt[1], 4, 0, 7); g.fill();
    });
    if (ratio) { // center line + decor
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 8); g.stroke();
    }
  };
}

function chairDraw(withBack) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    p.fabric(g, 8, 10, W - 16, H - 18, 5, c);
    p.fabric(g, 6, 4, W - 12, 10, 4, HP.shade(c, 0.85));   // backrest
  };
}

function kitchenUnit(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    // cabinet + stone countertop
    p.box(g, 3, 3, W - 6, H - 6, 3, p.lg(g, 3, 3, W - 6, H - 6, '#cfc9bd', '#b7b1a5'));
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
    P().RR(g, 5, 5, W - 10, H - 10, 2); g.stroke();
    // cabinet doors below counter edge
    g.strokeStyle = HP.shade(c, 0.75);
    for (let x = 8; x < W - 8; x += 18) {
      g.beginPath(); g.moveTo(x, H - 14); g.lineTo(x + 12, H - 14); g.stroke();
    }
    if (kind === 'stove') {
      g.fillStyle = '#2c2f33';
      g.fillRect(8, 8, W - 16, H * 0.55);
      const bx = [W * 0.28, W * 0.72], by = [H * 0.2, H * 0.42];
      bx.forEach(x => by.forEach(y => {
        g.beginPath(); g.arc(x, y, 7, 0, 7); g.fillStyle = '#45494e'; g.fill();
        g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fillStyle = '#191b1d'; g.fill();
      }));
    } else if (kind === 'sink') {
      p.box(g, W / 2 - 14, 9, 28, H * 0.5, 4, p.lg(g, 0, 9, 0, H * 0.5, '#d7dde2', '#9aa4ab'));
      g.strokeStyle = '#7c858c'; g.lineWidth = 1.5;
      P().RR(g, W / 2 - 10, 12, 20, H * 0.5 - 8, 3); g.stroke();
      g.fillStyle = '#5b636a';
      g.fillRect(W / 2 - 1, 5, 2, 7);                        // faucet
    } else if (kind === 'fridge') {
      p.box(g, 4, 4, W - 8, H - 8, 5, p.lg(g, 4, 4, W - 8, H - 8, '#dfe5ea', '#aeb7bf'));
      g.strokeStyle = '#8b949c'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H * 0.42); g.lineTo(W - 6, H * 0.42); g.stroke();
      g.fillStyle = '#7c858c'; g.fillRect(W - 12, 8, 3, 14); g.fillRect(W - 12, H * 0.46, 3, 18);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(8, 6, 6, H - 12); // sheen
    } else if (kind === 'dish') {
      p.box(g, 5, 5, W - 10, H - 10, 3, p.lg(g, 5, 5, W - 10, H - 10, '#c9ced4', '#a9afb6'));
      g.fillStyle = '#33383e'; g.fillRect(9, 8, W - 18, 5);
      g.strokeStyle = '#878d94'; P().RR(g, 10, 18, W - 20, H - 28, 2); g.stroke();
    }
  };
}

/* ================= EXPANDED CATALOG — shared palettes & draw factories ================= */
const FABC = ['#7d8fa3', '#a06558', '#718a68', '#c9b48f', '#5d4a68', '#4a6b8a', '#8f8578', '#b0764f'];
const VELV = ['#5d4a68', '#3a5f5d', '#8a3a4a', '#3a5f8a', '#b0764f', '#6d6d8a', '#2f4a3f', '#7a4a6a'];
const BOUC = ['#e8e2d6', '#d8cfc0', '#c9c2b2', '#e4d4c2', '#cfc8b8', '#d8c8bc'];
const LEAT = ['#6b4a33', '#8a5a3a', '#3a3f47', '#9c5f45', '#54402e', '#7a3a3a'];
const GRE  = ['#4e7d45', '#5d8a50', '#3f6d55', '#6d9a5d', '#4a7a5a', '#7da06a'];
const TERR = ['#b0764f', '#a06558', '#c9a44e', '#8f8578', '#7a6a5c', '#96582f'];
const METL = ['#3a3f47', '#c9a44e', '#8b939c', '#e8e2d6', '#a06558', '#5b5f6b'];

/* Parametric sofa: o = {n seats, arm:'roll'|'track'|'low'|'none',
   back:'plain'|'tuft'|'chan'|'camel', leg:'wood'|'metal'|0, skirt, recline, futon} */
function sofaPro(o) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    if (o.leg) {
      g.fillStyle = o.leg === 'wood' ? '#6b4f33' : '#8b939c';
      [[10, 8], [W - 10, 8], [10, H - 8], [W - 10, H - 8]].forEach(pt => {
        g.beginPath(); g.arc(pt[0], pt[1], 3.2, 0, 7); g.fill();
      });
    }
    p.fabric(g, 4, H * 0.26, W - 8, H * 0.7, 8, HP.shade(c, 0.82));    // base
    const bh = H * 0.3;
    p.fabric(g, 4, 4, W - 8, bh, 7, c);                              // backrest
    if (o.back === 'tuft') {
      const cols = Math.max(3, Math.round(W / 26));
      g.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
        g.beginPath();
        g.arc(8 + (i + .5) * (W - 16) / cols, 7 + (j + .5) * (bh - 9) / 2, 1.8, 0, 7);
        g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 1;
      for (let i = 0; i <= cols; i++) {
        const x = 8 + i * (W - 16) / cols;
        g.beginPath(); g.moveTo(x, 5); g.lineTo(x + (W - 16) / cols / 2, bh * .55); g.lineTo(x, bh - 1); g.stroke();
      }
    } else if (o.back === 'chan') {
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 2;
      for (let x = 14; x < W - 8; x += 15) {
        g.beginPath(); g.moveTo(x, 7); g.lineTo(x, bh - 1); g.stroke();
      }
    } else if (o.back === 'camel') {
      g.beginPath();
      g.moveTo(W * 0.22, 6);
      g.quadraticCurveTo(W / 2, -H * 0.1, W * 0.78, 6);
      g.lineTo(W * 0.78, 10); g.lineTo(W * 0.22, 10); g.closePath();
      g.fillStyle = HP.shade(c, 0.95); g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1; g.stroke();
    }
    if (o.futon) {
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, bh + 4); g.lineTo(W - 6, bh + 4); g.stroke();
      g.strokeStyle = '#8b939c';
      g.strokeRect(4, 4, 3, H - 8); g.strokeRect(W - 7, 4, 3, H - 8);
    }
    const n = o.n || 3, cw = (W - 24) / n;
    for (let i = 0; i < n; i++)
      p.cushion(g, 10 + i * cw + 2, H * 0.36, cw - 4, H * (o.skirt ? 0.44 : 0.52), HP.shade(c, 1.12));
    if (o.skirt) p.fabric(g, 4, H - 11, W - 8, 9, 3, HP.shade(c, 0.72));
    if (o.recline) {
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(12, H - 7); g.lineTo(W * 0.38, H - 7); g.stroke();
      p.cushion(g, 10, H - 12, W * 0.32, 7, HP.shade(c, 1.05));
      g.fillStyle = '#555c66'; g.fillRect(W - 16, H * 0.5, 8, 3);
    }
    if (o.arm === 'roll') {
      [[9], [W - 9]].forEach(([x]) => {
        g.beginPath(); g.ellipse(x, H / 2, 7, H * 0.42, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.88); g.fill();
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
        g.beginPath(); g.arc(x, 9, 4.5, 0, 7);
        g.fillStyle = HP.shade(c, 0.72); g.fill(); g.stroke();
      });
    } else if (o.arm && o.arm !== 'none') {
      const low = o.arm === 'low', aw = low ? 8 : 12;
      const ay = low ? H * 0.28 : 4, ah = low ? H * 0.62 : H - 8;
      p.fabric(g, 2, ay, aw, ah, 5, HP.shade(c, 0.9));
      p.fabric(g, W - 2 - aw, ay, aw, ah, 5, HP.shade(c, 0.9));
    }
    p.pillow(g, 16, H * 0.13, 13, HP.shade(c, 1.3), -0.2);
    p.pillow(g, W - 30, H * 0.13, 13, HP.shade(c, 1.3), 0.2);
  };
}

function chaiseDraw(g, W, H, v) {
  const p = P(), c = this.colors[v];
  p.fabric(g, 4, 4, W - 8, H - 8, 9, HP.shade(c, 0.82));
  p.cushion(g, W * 0.3, 10, W * 0.62, H - 20, HP.shade(c, 1.12));
  p.fabric(g, 4, 4, W * 0.3, H * 0.5, 8, c);                         // raised back corner
  p.fabric(g, 4, 4, W * 0.22, H - 8, 7, HP.shade(c, 0.9));           // side arm
  p.pillow(g, W * 0.16, H * 0.12, 14, HP.shade(c, 1.3), -0.2);
}

function daybedDraw(g, W, H, v) {
  const p = P(), c = this.colors[v];
  p.fabric(g, 4, 4, W - 8, H - 8, 8, HP.shade(c, 0.85));
  p.cushion(g, 9, 9, W - 18, H - 18, HP.shade(c, 1.1));
  p.fabric(g, 4, 4, W - 8, 9, 4, c);                                 // back rail
  p.pillow(g, 16, H * 0.3, 14, HP.shade(c, 1.3), -0.4);
  p.pillow(g, W - 30, H * 0.3, 14, HP.shade(c, 1.3), 0.4);
  p.pillow(g, W * 0.42, H * 0.55, 15, HP.shade(c, 1.2), 0.1);
}

function tubDraw(g, W, H, v) {
  const p = P(), c = this.colors[v], r = Math.min(W, H);
  g.beginPath(); g.arc(W / 2, H / 2, r * 0.46, 0, 7);
  g.fillStyle = HP.shade(c, 0.85); g.fill();
  g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2 + r * 0.06, r * 0.3, 0, 7);      // seat well
  g.fillStyle = HP.shade(c, 1.1); g.fill();
  g.strokeStyle = HP.shade(c, 0.7); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2 - r * 0.15, r * 0.18, 0, 7);     // wrap back
  g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 5; g.stroke();
}

function wingDraw(g, W, H, v) {
  const p = P(), c = this.colors[v];
  p.fabric(g, 8, H * 0.24, W - 16, H * 0.66, 8, HP.shade(c, 0.82));
  p.fabric(g, 8, 4, W - 16, H * 0.26, 7, c);                         // tall back
  p.fabric(g, 3, 4, 10, H * 0.5, 4, HP.shade(c, 0.9));               // wings
  p.fabric(g, W - 13, 4, 10, H * 0.5, 4, HP.shade(c, 0.9));
  p.cushion(g, 12, H * 0.34, W - 24, H * 0.42, HP.shade(c, 1.12));
}

function reclineDraw(g, W, H, v) {
  const p = P(), c = this.colors[v];
  p.fabric(g, 6, H * 0.26, W - 12, H * 0.5, 8, HP.shade(c, 0.82));
  p.fabric(g, 6, 4, W - 12, H * 0.28, 7, c);
  p.cushion(g, 10, H * 0.32, W - 20, H * 0.36, HP.shade(c, 1.12));
  p.fabric(g, 4, 6, 9, H * 0.62, 5, HP.shade(c, 0.9));
  p.fabric(g, W - 13, 6, 9, H * 0.62, 5, HP.shade(c, 0.9));
  p.cushion(g, 10, H * 0.74, W - 20, H * 0.2, HP.shade(c, 1.05));    // footrest
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(10, H * 0.72); g.lineTo(W - 10, H * 0.72); g.stroke();
  g.fillStyle = '#555c66'; g.fillRect(W - 13, H * 0.45, 9, 3);       // lever
}

function papasanDraw(g, W, H, v) {
  const p = P(), c = this.colors[v], r = Math.min(W, H) / 2;
  g.strokeStyle = '#8a6844'; g.lineWidth = 3;
  g.beginPath(); g.arc(W / 2, H / 2, r * 0.94, 0, 7); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, r * 0.72, 0, 7); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, r * 0.6, 0, 7);
  g.fillStyle = c; g.fill();
  g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, r * 0.3, 0, 7);
  g.fillStyle = HP.shade(c, 1.1); g.fill();
}

function poufDraw(round) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    if (round) {
      const r = Math.min(W, H) * 0.44;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7);
      g.fillStyle = p.lg(g, W / 2 - r, H / 2 - r, r * 2, r * 2, HP.shade(c, 1.12), HP.shade(c, 0.82)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.setLineDash([3, 3]);
      g.beginPath(); g.arc(W / 2, H / 2, r * 0.7, 0, 7); g.stroke();
      g.setLineDash([]);
    } else {
      p.cushion(g, 6, 6, W - 12, H - 12, c);
    }
    g.fillStyle = HP.shade(c, 0.7);
    g.beginPath(); g.arc(W / 2, H / 2, 3, 0, 7); g.fill();           // button
  };
}

function plantDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H);
    if (kind === 'cactus') {
      p.pot(g, cx, cy + r * 0.16, r * 0.15);
      g.fillStyle = c;
      g.beginPath(); g.ellipse(cx, cy - r * 0.08, r * 0.12, r * 0.2, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx - r * 0.16, cy - r * 0.02, r * 0.06, r * 0.11, 0.5, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + r * 0.16, cy - r * 0.02, r * 0.06, r * 0.11, -0.5, 0, 7); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, cy - r * 0.26); g.lineTo(cx, cy + r * 0.1); g.stroke();
      return;
    }
    p.pot(g, cx, cy, r * 0.2);
    if (kind === 'snake') {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.beginPath(); g.ellipse(r * 0.3, 0, r * 0.3, r * 0.045, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + (i % 3) * 0.12); g.fill();
        g.restore();
      }
    } else if (kind === 'monstera') {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.4;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.beginPath(); g.ellipse(r * 0.32, 0, r * 0.32, r * 0.16, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + (i % 3) * 0.1); g.fill();
        g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(r * 0.08, 0); g.lineTo(r * 0.6, 0); g.stroke();
        g.restore();
      }
    } else if (kind === 'fiddle') {
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + 0.5;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2, r * 0.16, r * 0.22, a, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + (i % 3) * 0.1); g.fill();
      }
      g.fillStyle = '#6b4f33'; g.beginPath(); g.arc(cx, cy, r * 0.05, 0, 7); g.fill();
    } else if (kind === 'bonsai') {
      g.strokeStyle = '#6b4f33'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy + r * 0.1);
      g.quadraticCurveTo(cx - r * 0.15, cy - r * 0.1, cx + r * 0.05, cy - r * 0.22); g.stroke();
      [[-0.16, -0.26, 0.14], [0.1, -0.3, 0.16], [0.02, -0.16, 0.12]].forEach(([dx, dy, rr], i) => {
        g.beginPath(); g.arc(cx + dx * r, cy + dy * r, rr * r, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + i * 0.1); g.fill();
      });
    } else if (kind === 'orchid') {
      p.leaves(g, cx, cy + r * 0.06, r * 0.16, c, 4);
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + r * 0.05, cy - r * 0.3, cx + r * 0.2, cy - r * 0.36); g.stroke();
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#e8a0c8';
        g.beginPath(); g.arc(cx + r * (0.08 + i * 0.045), cy - r * (0.3 + i * 0.02), 3.5, 0, 7); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(cx + r * (0.08 + i * 0.045), cy - r * (0.3 + i * 0.02), 1.2, 0, 7); g.fill();
      }
    } else if (kind === 'palm') {
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.beginPath(); g.ellipse(r * 0.3, 0, r * 0.3, r * 0.07, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + (i % 3) * 0.1); g.fill();
        g.restore();
      }
      g.fillStyle = '#6b4f33'; g.beginPath(); g.arc(cx, cy, r * 0.07, 0, 7); g.fill();
    } else {                                                          // pothos
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI * 2 / 10, d = r * (0.28 + (i % 3) * 0.08);
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.09, r * 0.06, a, 0, 7);
        g.fillStyle = HP.shade(c, 0.9 + (i % 3) * 0.1); g.fill();
      }
    }
  };
}

function lampDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H);
    const glow = (x, y, rr) => {
      const gr = g.createRadialGradient(x, y, 1, x, y, rr);
      gr.addColorStop(0, 'rgba(255,225,150,.5)'); gr.addColorStop(1, 'rgba(255,225,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    };
    if (kind === 'arc') {
      glow(W * 0.7, H * 0.2, r * 0.4);
      g.beginPath(); g.ellipse(W * 0.2, H * 0.85, r * 0.14, r * 0.08, 0, 0, 7);
      g.fillStyle = '#3a3f47'; g.fill();
      g.strokeStyle = '#8b939c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W * 0.2, H * 0.8);
      g.quadraticCurveTo(W * 0.35, H * 0.1, W * 0.68, H * 0.18); g.stroke();
      g.beginPath(); g.arc(W * 0.7, H * 0.2, r * 0.11, 0, 7);
      g.fillStyle = c; g.fill(); g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
    } else if (kind === 'tripod') {
      glow(cx, cy, r * 0.45);
      g.strokeStyle = '#555c66'; g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + 0.5;
        g.beginPath(); g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, r * 0.24, 0, 7);
      g.fillStyle = c; g.fill(); g.strokeStyle = HP.shade(c, 0.6); g.stroke();
    } else if (kind === 'torch') {
      glow(cx, H * 0.28, r * 0.45);
      g.beginPath(); g.ellipse(cx, H * 0.88, r * 0.16, r * 0.07, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.7); g.fill();
      g.fillStyle = HP.shade(c, 0.85); g.fillRect(cx - 2, H * 0.35, 4, H * 0.52);
      g.beginPath();
      g.moveTo(cx - r * 0.16, H * 0.34); g.lineTo(cx + r * 0.16, H * 0.34);
      g.lineTo(cx + r * 0.08, H * 0.16); g.lineTo(cx - r * 0.08, H * 0.16); g.closePath();
      g.fillStyle = c; g.fill(); g.strokeStyle = HP.shade(c, 0.55); g.stroke();
    } else if (kind === 'table') {
      p.wood(g, W * 0.2, H * 0.55, W * 0.6, H * 0.35, '#8a6844');
      g.fillStyle = HP.shade(c, 0.8); g.fillRect(cx - 2, H * 0.3, 4, H * 0.26);
      g.beginPath();
      g.moveTo(cx - r * 0.16, H * 0.3); g.lineTo(cx + r * 0.16, H * 0.3);
      g.lineTo(cx + r * 0.1, H * 0.12); g.lineTo(cx - r * 0.1, H * 0.12); g.closePath();
      g.fillStyle = c; g.fill();
      glow(cx, H * 0.2, r * 0.35);
    } else if (kind === 'paper') {
      glow(cx, H * 0.32, r * 0.5);
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, H * 0.9); g.lineTo(cx, H * 0.55); g.stroke();
      g.beginPath(); g.ellipse(cx, H * 0.88, r * 0.12, r * 0.05, 0, 0, 7);
      g.fillStyle = '#3a3f47'; g.fill();
      g.beginPath(); g.arc(cx, H * 0.32, r * 0.3, 0, 7);
      g.fillStyle = '#f5e8c8'; g.fill();
      g.strokeStyle = c; g.lineWidth = 1; g.stroke();
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.ellipse(cx, H * 0.32, Math.abs(i) * r * 0.11 + 2, r * 0.3, 0, 0, 7); g.stroke();
      }
    } else if (kind === 'mush') {
      glow(cx, H * 0.35, r * 0.4);
      g.fillStyle = HP.shade(c, 0.85); g.fillRect(cx - 3, H * 0.42, 6, H * 0.42);
      g.beginPath(); g.ellipse(cx, H * 0.86, r * 0.14, r * 0.06, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.7); g.fill();
      g.beginPath(); g.ellipse(cx, H * 0.32, r * 0.26, r * 0.18, 0, Math.PI, 0);
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
    } else if (kind === 'candlelamp') {
      p.box(g, W * 0.28, H * 0.25, W * 0.44, H * 0.55, 4, 'rgba(220,225,230,.5)');
      g.strokeStyle = '#3a3f47'; g.lineWidth = 2;
      P().RR(g, W * 0.28, H * 0.25, W * 0.44, H * 0.55, 4); g.stroke();
      glow(cx, cy, r * 0.4);
      g.fillStyle = '#f5e8c8'; g.fillRect(cx - 3, H * 0.45, 6, H * 0.22);
      g.fillStyle = '#e8963c'; g.beginPath(); g.arc(cx, H * 0.42, 2.5, 0, 7); g.fill();
      g.strokeStyle = '#3a3f47';
      g.beginPath(); g.arc(cx, H * 0.2, r * 0.1, Math.PI, 0); g.stroke();
    } else {                                                          // banker
      p.wood(g, W * 0.3, H * 0.6, W * 0.4, H * 0.28, '#6b4f33');
      g.strokeStyle = '#c9a44e'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx, H * 0.62); g.lineTo(cx, H * 0.38); g.stroke();
      g.beginPath(); g.ellipse(cx, H * 0.32, r * 0.22, r * 0.12, 0, 0, 7);
      g.fillStyle = c; g.fill(); g.strokeStyle = HP.shade(c, 0.5); g.stroke();
      glow(cx, H * 0.36, r * 0.35);
    }
  };
}

function artDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    const frame = (x, y, w, h) => {
      p.box(g, x, y, w, h, 2, c);
      g.fillStyle = '#f5f2ea'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      return [x + 3, y + 3, w - 6, h - 6];
    };
    if (kind === 'triptych') {
      for (let i = 0; i < 3; i++) {
        const [x, y, w, h] = frame(4 + i * (W - 8) / 3, 5, (W - 8) / 3 - 4, H - 10);
        g.fillStyle = HP.shade(c, 0.8 + i * 0.15);
        g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.28, 0, 7); g.fill();
      }
      return;
    }
    const [x, y, w, h] = frame(4, 4, W - 8, H - 8);
    if (kind === 'abstract') {
      g.fillStyle = HP.shade(c, 0.9);
      g.beginPath(); g.ellipse(x + w * 0.35, y + h * 0.4, w * 0.28, h * 0.32, 0.4, 0, 7); g.fill();
      g.fillStyle = HP.shade(c, 1.15);
      g.beginPath(); g.arc(x + w * 0.68, y + h * 0.62, w * 0.14, 0, 7); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + w * 0.15, y + h * 0.8); g.lineTo(x + w * 0.85, y + h * 0.25); g.stroke();
    } else if (kind === 'geo') {
      g.fillStyle = HP.shade(c, 0.85);
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + h); g.fill();
      g.fillStyle = HP.shade(c, 1.2);
      g.fillRect(x + w * 0.55, y + h * 0.15, w * 0.3, h * 0.3);
      g.beginPath(); g.arc(x + w * 0.3, y + h * 0.68, w * 0.13, 0, 7); g.fill();
    } else if (kind === 'land') {
      g.fillStyle = '#a8c8d8'; g.fillRect(x, y, w, h * 0.55);
      g.fillStyle = HP.shade(c, 0.9);
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.35, y + h * 0.4); g.lineTo(x + w * 0.65, y + h); g.fill();
      g.fillStyle = HP.shade(c, 0.7);
      g.beginPath(); g.moveTo(x + w * 0.4, y + h); g.lineTo(x + w * 0.75, y + h * 0.55); g.lineTo(x + w, y + h); g.fill();
      g.fillStyle = '#e8c832'; g.beginPath(); g.arc(x + w * 0.75, y + h * 0.25, w * 0.09, 0, 7); g.fill();
    } else if (kind === 'botan') {
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const bx = x + w * (0.25 + i * 0.25);
        g.beginPath(); g.moveTo(bx, y + h * 0.85);
        g.quadraticCurveTo(bx + 4, y + h * 0.5, bx - 2, y + h * 0.2); g.stroke();
        for (let j = 0; j < 3; j++) {
          g.beginPath(); g.ellipse(bx + (j % 2 ? 4 : -4), y + h * (0.3 + j * 0.2), 4, 2.5, (j % 2 ? 0.5 : -0.5), 0, 7);
          g.fillStyle = HP.shade(c, 0.9 + j * 0.1); g.fill();
        }
      }
    } else if (kind === 'neon') {
      g.fillStyle = '#1a1e26'; g.fillRect(x, y, w, h);
      g.strokeStyle = c; g.lineWidth = 3; g.shadowColor = c; g.shadowBlur = 6;
      g.beginPath(); g.moveTo(x + w * 0.15, y + h * 0.6);
      g.bezierCurveTo(x + w * 0.4, y + h * 0.2, x + w * 0.6, y + h * 0.9, x + w * 0.85, y + h * 0.4);
      g.stroke(); g.shadowBlur = 0;
    } else if (kind === 'photo') {
      for (let i = 0; i < 4; i++) {
        const px = x + (i % 2) * w * 0.52, py = y + Math.floor(i / 2) * h * 0.52;
        g.fillStyle = ['#a8c8d8', '#c8d8a8', '#d8b8a8', '#b8a8d8'][i];
        g.fillRect(px, py, w * 0.44, h * 0.44);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(px, py, w * 0.44, h * 0.44);
      }
    } else {                                                          // line art
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x + w * 0.3, y + h * 0.2);
      g.bezierCurveTo(x + w * 0.7, y + h * 0.15, x + w * 0.75, y + h * 0.5, x + w * 0.5, y + h * 0.6);
      g.bezierCurveTo(x + w * 0.3, y + h * 0.68, x + w * 0.35, y + h * 0.85, x + w * 0.6, y + h * 0.85);
      g.stroke();
    }
  };
}

function mirrorDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
    const glass = p.lg(g, 0, 0, W, H, '#dfeaf0', '#a8c0cc');
    if (kind === 'sun') {
      g.strokeStyle = '#c9a44e'; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * W * 0.22, cy + Math.sin(a) * W * 0.22);
        g.lineTo(cx + Math.cos(a) * W * 0.44, cy + Math.sin(a) * W * 0.44); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, Math.min(W, H) * 0.2, 0, 7);
      g.fillStyle = glass; g.fill();
      g.strokeStyle = '#c9a44e'; g.lineWidth = 2.5; g.stroke();
    } else if (kind === 'oval') {
      g.beginPath(); g.ellipse(cx, cy, W * 0.3, H * 0.44, 0, 0, 7);
      g.fillStyle = glass; g.fill();
      g.strokeStyle = c; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx - 3, cy - 4, W * 0.2, H * 0.3, 0, Math.PI * 1.2, Math.PI * 1.7); g.stroke();
    } else if (kind === 'arch') {
      g.beginPath();
      g.moveTo(W * 0.2, H - 6); g.lineTo(W * 0.2, H * 0.35);
      g.arc(cx, H * 0.35, W * 0.3, Math.PI, 0);
      g.lineTo(W * 0.8, H - 6); g.closePath();
      g.fillStyle = glass; g.fill();
      g.strokeStyle = c; g.lineWidth = 4; g.stroke();
    } else {                                                          // wavy
      g.beginPath();
      g.moveTo(W * 0.25, 6);
      g.bezierCurveTo(W * 0.1, H * 0.3, W * 0.35, H * 0.45, W * 0.2, H * 0.65);
      g.bezierCurveTo(W * 0.1, H * 0.85, W * 0.4, H - 4, W * 0.5, H - 6);
      g.bezierCurveTo(W * 0.7, H - 4, W * 0.9, H * 0.8, W * 0.78, H * 0.55);
      g.bezierCurveTo(W * 0.92, H * 0.35, W * 0.7, H * 0.15, W * 0.75, 8);
      g.closePath();
      g.fillStyle = glass; g.fill();
      g.strokeStyle = c; g.lineWidth = 3; g.stroke();
    }
  };
}

function clockDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
    if (kind === 'grand') {
      p.wood(g, W * 0.22, 3, W * 0.56, H - 6, c);
      g.beginPath(); g.arc(cx, H * 0.2, W * 0.18, 0, 7);
      g.fillStyle = '#f5f2ea'; g.fill();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(cx, H * 0.2); g.lineTo(cx, H * 0.12); g.stroke();
      g.beginPath(); g.moveTo(cx, H * 0.2); g.lineTo(cx + W * 0.08, H * 0.2); g.stroke();
      g.strokeStyle = '#c9a44e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, H * 0.35); g.lineTo(cx, H * 0.75); g.stroke();
      g.fillStyle = '#c9a44e'; g.beginPath(); g.arc(cx, H * 0.78, 5, 0, 7); g.fill();
      return;
    }
    const r = Math.min(W, H) * 0.4;
    g.beginPath(); g.arc(cx, cy, r + 3, 0, 7); g.fillStyle = c; g.fill();
    g.beginPath(); g.arc(cx, cy, r, 0, 7);
    g.fillStyle = '#f5f2ea'; g.fill();
    g.strokeStyle = '#3a3f47'; g.lineWidth = 1.5; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, rr = r * (i % 3 === 0 ? 0.62 : 0.78);
      g.strokeStyle = '#3a3f47'; g.lineWidth = i % 3 === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.stroke();
    }
    g.strokeStyle = '#2c2f33'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - r * 0.55); g.stroke();
    g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * 0.45, cy + r * 0.2); g.stroke();
    g.fillStyle = '#2c2f33'; g.beginPath(); g.arc(cx, cy, 2.5, 0, 7); g.fill();
  };
}

function rugDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v];
    if (kind === 'hide') {
      g.beginPath();
      g.moveTo(W * 0.2, H * 0.3);
      g.bezierCurveTo(W * 0.05, H * 0.1, W * 0.4, 2, W * 0.55, H * 0.15);
      g.bezierCurveTo(W * 0.75, 4, W * 0.98, H * 0.25, W * 0.85, H * 0.5);
      g.bezierCurveTo(W * 0.95, H * 0.7, W * 0.7, H * 0.9, W * 0.55, H * 0.82);
      g.bezierCurveTo(W * 0.35, H * 0.95, W * 0.05, H * 0.75, W * 0.15, H * 0.55);
      g.closePath();
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = HP.shade(c, 0.7);
      [[0.35, 0.35, 0.12], [0.6, 0.6, 0.1], [0.55, 0.3, 0.07], [0.3, 0.65, 0.08]].forEach(([dx, dy, rr]) => {
        g.beginPath(); g.ellipse(W * dx, H * dy, W * rr, H * rr * 0.8, dx * 2, 0, 7); g.fill();
      });
      return;
    }
    p.fabric(g, 3, 3, W - 6, H - 6, kind === 'shag' ? 12 : 6, c);
    if (kind === 'shag') {
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 40; i++) {
        const x = 8 + (i * 47) % (W - 16), y = 8 + (i * 31) % (H - 16);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 2); g.stroke();
      }
      g.strokeStyle = 'rgba(0,0,0,.15)';
      for (let i = 0; i < 40; i++) {
        const x = 8 + (i * 53) % (W - 16), y = 8 + (i * 37) % (H - 16);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 3); g.stroke();
      }
    } else if (kind === 'persian') {
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 4;
      P().RR(g, 7, 7, W - 14, H - 14, 4); g.stroke();
      g.strokeStyle = HP.shade(c, 1.2); g.lineWidth = 1.5;
      P().RR(g, 13, 13, W - 26, H - 26, 3); g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.18, H * 0.22, 0, 0, 7);
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.09, H * 0.11, 0, 0, 7); g.stroke();
      [[0.14, 0.14], [0.86, 0.14], [0.14, 0.86], [0.86, 0.86]].forEach(([dx, dy]) => {
        g.fillStyle = HP.shade(c, 1.25);
        g.beginPath(); g.arc(W * dx, H * dy, 3, 0, 7); g.fill();
      });
    } else if (kind === 'jute') {
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let x = 8; x < W - 6; x += 7) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x, H - 5); g.stroke(); }
      for (let y = 8; y < H - 6; y += 7) { g.beginPath(); g.moveTo(5, y); g.lineTo(W - 5, y); g.stroke(); }
    } else if (kind === 'geo') {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = HP.shade(c, i % 2 ? 0.75 : 1.15);
        g.fillRect(8 + i * (W - 16) / 4, 8, (W - 16) / 4 - 2, H - 16);
      }
      g.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(10 + i * (W - 20) / 6, H * 0.4);
        g.lineTo(16 + i * (W - 20) / 6, H * 0.4);
        g.lineTo(13 + i * (W - 20) / 6, H * 0.28);
        g.fill();
      }
    } else if (kind === 'braid') {
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = HP.shade(c, 0.7 + i * 0.14); g.lineWidth = 5;
        P().RR(g, 8 + i * 7, 8 + i * 7, W - 16 - i * 14, H - 16 - i * 14, 10); g.stroke();
      }
    } else {                                                          // play road rug
      g.strokeStyle = '#8f8578'; g.lineWidth = 10;
      P().RR(g, W * 0.15, H * 0.2, W * 0.7, H * 0.6, 14); g.stroke();
      g.strokeStyle = '#f5f2ea'; g.lineWidth = 1.5; g.setLineDash([5, 5]);
      P().RR(g, W * 0.15, H * 0.2, W * 0.7, H * 0.6, 14); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#5d8a5d'; g.fillRect(W * 0.3, H * 0.35, W * 0.4, H * 0.3);
    }
  };
}

function topDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
    if (kind === 'vase') {
      g.beginPath(); g.ellipse(cx, cy + 4, W * 0.2, H * 0.24, 0, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.2, cy - H * 0.2, W * 0.4, H * 0.5, HP.shade(c, 1.2), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#5d8a50';
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(cx, cy - 2);
        g.quadraticCurveTo(cx + i * 8, cy - H * 0.25, cx + i * 12, cy - H * 0.38); g.stroke();
      }
      ['#e8a0b8', '#f0d090', '#e8a0b8'].forEach((k, i) => {
        g.fillStyle = k;
        g.beginPath(); g.arc(cx + (i - 1) * 12, cy - H * 0.38, 4, 0, 7); g.fill();
      });
    } else if (kind === 'candles') {
      p.box(g, W * 0.15, H * 0.52, W * 0.7, H * 0.3, 4, '#8a6844');
      [[-0.22, 0.28, 0.11], [0.05, 0.2, 0.09], [0.24, 0.32, 0.13]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(cx + dx * W, cy + dy * H, r * W, 0, 7);
        g.fillStyle = '#f5efe0'; g.fill(); g.strokeStyle = '#c9bfa8'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#e8963c'; g.beginPath(); g.arc(cx + dx * W, cy + dy * H, 2, 0, 7); g.fill();
      });
    } else if (kind === 'books') {
      ['#a03a3a', '#3a5f8a', '#5d8a5d'].forEach((k, i) => {
        g.save(); g.translate(cx, cy); g.rotate((i - 1) * 0.12);
        p.box(g, -W * 0.28 + i * 3, -H * 0.3 + i * H * 0.18, W * 0.56, H * 0.16, 2, k);
        g.restore();
      });
      g.fillStyle = '#f5f2ea'; g.fillRect(cx - W * 0.2, cy + H * 0.2, W * 0.4, 3);
    } else if (kind === 'bowl') {
      g.beginPath(); g.arc(cx, cy, W * 0.34, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.34, cy - W * 0.34, W * 0.68, W * 0.68, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(cx, cy, W * 0.26, 0, 7);
      g.fillStyle = HP.shade(c, 0.55); g.fill();
      ['#e8963c', '#e05252', '#e8c832', '#e8963c', '#8aa84d'].forEach((k, i) => {
        const a = i * Math.PI * 2 / 5;
        g.fillStyle = k;
        g.beginPath(); g.arc(cx + Math.cos(a) * W * 0.13, cy + Math.sin(a) * W * 0.13, W * 0.07, 0, 7); g.fill();
      });
    } else if (kind === 'terra') {
      g.beginPath(); g.arc(cx, cy, W * 0.32, 0, 7);
      g.fillStyle = 'rgba(200,220,230,.45)'; g.fill();
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 1.5; g.stroke();
      p.leaves(g, cx, cy + 3, W * 0.14, c, 5);
      g.fillStyle = '#c9b48f'; g.beginPath(); g.arc(cx, cy + W * 0.1, 4, 0, 7); g.fill();
    } else if (kind === 'diffuser') {
      p.box(g, cx - W * 0.12, cy - H * 0.05, W * 0.24, H * 0.32, 4,
        p.lg(g, cx - W * 0.12, cy - H * 0.05, W * 0.24, H * 0.32, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.strokeStyle = '#8a6844'; g.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + i * 6, cy - H * 0.42); g.stroke();
      }
    } else if (kind === 'frame') {
      g.save(); g.translate(cx, cy); g.rotate(-0.12);
      p.wood(g, -W * 0.26, -H * 0.3, W * 0.52, H * 0.6, '#6b4f33');
      g.fillStyle = '#a8c8d8'; g.fillRect(-W * 0.18, -H * 0.2, W * 0.36, H * 0.3);
      g.fillStyle = '#5d8a5d'; g.beginPath(); g.arc(0, H * 0.02, W * 0.07, 0, 7); g.fill();
      g.restore();
    } else if (kind === 'succulent') {
      p.pot(g, cx, cy, W * 0.2);
      p.leaves(g, cx, cy, W * 0.24, c, 7);
    } else if (kind === 'alarm') {
      p.box(g, cx - W * 0.22, cy - H * 0.18, W * 0.44, H * 0.36, 8, c);
      g.fillStyle = '#f5f2ea'; g.beginPath(); g.arc(cx, cy, W * 0.14, 0, 7); g.fill();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - W * 0.09); g.stroke();
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + W * 0.07, cy); g.stroke();
      g.fillStyle = c;
      g.beginPath(); g.arc(cx - W * 0.14, cy - H * 0.24, 4, 0, 7); g.fill();
      g.beginPath(); g.arc(cx + W * 0.14, cy - H * 0.24, 4, 0, 7); g.fill();
    } else if (kind === 'knot') {
      g.strokeStyle = c; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - W * 0.18, cy + H * 0.2);
      g.bezierCurveTo(cx - W * 0.3, cy - H * 0.3, cx + W * 0.25, cy - H * 0.35, cx + W * 0.1, cy);
      g.bezierCurveTo(cx, cy + H * 0.2, cx + W * 0.28, cy + H * 0.1, cx + W * 0.18, cy + H * 0.3);
      g.stroke();
      g.fillStyle = '#3a3f47'; g.fillRect(cx - W * 0.2, cy + H * 0.32, W * 0.4, 4);
    } else {                                                          // incense
      p.box(g, cx - W * 0.3, cy + H * 0.15, W * 0.6, H * 0.12, 3, '#8a6844');
      g.strokeStyle = '#c9a44e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - W * 0.1, cy + H * 0.15); g.lineTo(cx + W * 0.18, cy - H * 0.3); g.stroke();
      g.strokeStyle = 'rgba(180,190,200,.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx + W * 0.18, cy - H * 0.3);
      g.bezierCurveTo(cx + W * 0.28, cy - H * 0.45, cx + W * 0.05, cy - H * 0.5, cx + W * 0.15, cy - H * 0.62);
      g.stroke();
      g.fillStyle = '#e8963c'; g.beginPath(); g.arc(cx + W * 0.18, cy - H * 0.3, 2, 0, 7); g.fill();
    }
  };
}

function floorDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
    if (kind === 'basket') {
      g.beginPath(); g.arc(cx, cy, W * 0.36, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.36, cy - W * 0.36, W * 0.72, W * 0.72, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = HP.shade(c, 0.7);
      for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(cx, cy, W * 0.36 * i / 4, 0, 7); g.stroke(); }
      g.fillStyle = '#d8cfc0'; g.beginPath(); g.arc(cx - 4, cy - 2, W * 0.12, 0, 7); g.fill();
      g.fillStyle = '#a8b8c8'; g.beginPath(); g.arc(cx + 6, cy + 4, W * 0.1, 0, 7); g.fill();
    } else if (kind === 'plantstand') {
      g.strokeStyle = '#3a3f47'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + 0.5;
        g.beginPath(); g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * W * 0.4, cy + Math.sin(a) * W * 0.4); g.stroke();
      }
      p.pot(g, cx, cy, W * 0.22);
      p.leaves(g, cx, cy, W * 0.3, c, 6);
    } else if (kind === 'magrack') {
      g.strokeStyle = '#8a6844'; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(W * 0.2, H * 0.15); g.lineTo(W * 0.35, H * 0.85);
      g.moveTo(W * 0.35, H * 0.15); g.lineTo(W * 0.2, H * 0.85);
      g.moveTo(W * 0.65, H * 0.15); g.lineTo(W * 0.8, H * 0.85);
      g.moveTo(W * 0.8, H * 0.15); g.lineTo(W * 0.65, H * 0.85); g.stroke();
      ['#a03a3a', '#3a5f8a', '#c9a44e'].forEach((k, i) => {
        g.fillStyle = k; g.fillRect(W * (0.4 + i * 0.08), H * (0.3 + i * 0.05), W * 0.1, H * 0.45);
      });
    } else if (kind === 'winerack') {
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.strokeStyle = HP.shade(c, 0.4); g.lineWidth = 1;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(W * (0.25 + i * 0.25), H * (0.22 + r * 0.28), W * 0.08, 0, 7);
        g.fillStyle = HP.shade(c, 0.55); g.fill(); g.stroke();
        g.fillStyle = '#5d3a4a';
        g.beginPath(); g.arc(W * (0.25 + i * 0.25), H * (0.22 + r * 0.28), 3, 0, 7); g.fill();
      }
    } else if (kind === 'crate') {
      p.wood(g, 5, H * 0.35, W - 10, H * 0.55, c);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#1b1e22' : '#2c2f33';
        g.fillRect(W * (0.15 + i * 0.12), H * 0.1, W * 0.06, H * 0.3);
      }
      g.fillStyle = '#e05252'; g.fillRect(W * 0.5, H * 0.14, W * 0.06, H * 0.1);
    } else if (kind === 'speaker') {
      p.box(g, W * 0.25, H * 0.15, W * 0.5, H * 0.7, 4,
        p.lg(g, W * 0.25, H * 0.15, W * 0.5, H * 0.7, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.beginPath(); g.arc(cx, H * 0.62, W * 0.16, 0, 7);
      g.fillStyle = '#2c2f33'; g.fill(); g.strokeStyle = '#555c66'; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.arc(cx, H * 0.3, W * 0.08, 0, 7);
      g.fillStyle = '#2c2f33'; g.fill();
    } else if (kind === 'scratch') {
      g.beginPath(); g.arc(cx, cy + H * 0.25, W * 0.3, 0, 7);
      g.fillStyle = HP.shade(c, 0.9); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#c9b48f'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(cx, cy + H * 0.22); g.lineTo(cx, cy - H * 0.25); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.moveTo(cx - 4, cy - H * 0.2 + i * 6); g.lineTo(cx + 4, cy - H * 0.17 + i * 6); g.stroke();
      }
      g.fillStyle = '#e05252'; g.beginPath(); g.arc(cx + W * 0.2, cy - H * 0.28, 3, 0, 7); g.fill();
    } else if (kind === 'dogbowl') {
      g.beginPath(); g.ellipse(cx, cy, W * 0.32, H * 0.28, 0, 0, 7);
      g.fillStyle = '#d8cfc0'; g.fill();
      [0.32, 0.68].forEach(dx => {
        g.beginPath(); g.arc(W * dx, cy, W * 0.13, 0, 7);
        g.fillStyle = c; g.fill();
        g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.arc(W * dx, cy, W * 0.07, 0, 7);
        g.fillStyle = '#8a6844'; g.fill();
      });
    } else if (kind === 'logbasket') {
      g.beginPath(); g.ellipse(cx, cy + H * 0.1, W * 0.36, H * 0.3, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.9); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#d8b06a';
        g.beginPath(); g.arc(cx - W * 0.2 + i * W * 0.13, cy - H * 0.05, W * 0.06, 0, 7); g.fill();
        g.strokeStyle = '#8a6844'; g.lineWidth = 1; g.stroke();
      }
    } else if (kind === 'floorvase') {
      g.beginPath(); g.ellipse(cx, cy + H * 0.18, W * 0.22, H * 0.28, 0, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.22, cy - H * 0.1, W * 0.44, H * 0.56, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#8a6844';
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(cx, cy - H * 0.05);
        g.quadraticCurveTo(cx + i * 6, cy - H * 0.3, cx + i * 10, cy - H * 0.45); g.stroke();
      }
    } else {                                                          // lantern
      p.box(g, W * 0.28, H * 0.2, W * 0.44, H * 0.6, 4, 'rgba(215,225,230,.45)');
      g.strokeStyle = '#3a3f47'; g.lineWidth = 2;
      P().RR(g, W * 0.28, H * 0.2, W * 0.44, H * 0.6, 4); g.stroke();
      const gr = g.createRadialGradient(cx, cy, 1, cx, cy, W * 0.4);
      gr.addColorStop(0, 'rgba(255,220,140,.6)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#f5e8c8'; g.fillRect(cx - 4, H * 0.5, 8, H * 0.22);
      g.fillStyle = '#e8963c'; g.beginPath(); g.arc(cx, H * 0.48, 3, 0, 7); g.fill();
    }
  };
}

function statueDeco(kind) {
  return function (g, W, H, v) {
    const p = P(), c = this.colors[v], cx = W / 2;
    if (kind === 'fount') {
      g.beginPath(); g.arc(cx, H / 2, W * 0.38, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.38, H * 0.1, W * 0.76, H * 0.8, HP.shade(c, 1.1), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, H / 2, W * 0.28, 0, 7); g.fillStyle = '#5eb8d8'; g.fill();
      g.beginPath(); g.arc(cx, H / 2, W * 0.1, 0, 7); g.fillStyle = HP.shade(c, 0.7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.arc(cx, H / 2, W * (0.14 + i * 0.04), i, i + 2); g.stroke();
      }
      return;
    }
    p.box(g, W * 0.28, H * 0.6, W * 0.44, H * 0.32, 3, '#8b8b83');
    if (kind === 'bust') {
      g.beginPath(); g.ellipse(cx, H * 0.28, W * 0.16, H * 0.2, 0, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.16, H * 0.1, W * 0.32, H * 0.45, HP.shade(c, 1.2), HP.shade(c, 0.85)); g.fill();
      g.beginPath(); g.ellipse(cx, H * 0.52, W * 0.24, H * 0.12, 0, 0, 7); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
    } else if (kind === 'column') {
      g.strokeStyle = c; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - 6, H * 0.58);
      g.bezierCurveTo(cx + 12, H * 0.42, cx - 12, H * 0.3, cx + 6, H * 0.14); g.stroke();
      g.fillStyle = HP.shade(c, 1.2); g.beginPath(); g.arc(cx + 6, H * 0.13, 4, 0, 7); g.fill();
    } else {                                                          // ceramic figure
      g.beginPath(); g.ellipse(cx, H * 0.35, W * 0.14, H * 0.26, 0.15, 0, 7);
      g.fillStyle = p.lg(g, cx - W * 0.15, H * 0.1, W * 0.3, H * 0.55, HP.shade(c, 1.25), HP.shade(c, 0.8)); g.fill();
      g.beginPath(); g.arc(cx + W * 0.03, H * 0.12, W * 0.08, 0, 7); g.fill();
    }
  };
}

function shojiDraw(g, W, H, v) {
  const p = P(), c = this.colors[v];
  p.wood(g, 2, 3, W - 4, H - 6, c);
  for (let i = 0; i < 3; i++) {
    const px = 6 + i * (W - 12) / 3, pw = (W - 12) / 3 - 3;
    g.fillStyle = '#f0ece0'; g.fillRect(px, 8, pw, H - 16);
    g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
    g.strokeRect(px, 8, pw, H - 16);
    g.beginPath(); g.moveTo(px + pw / 2, 8); g.lineTo(px + pw / 2, H - 8); g.stroke();
    for (let j = 1; j < 3; j++) {
      g.beginPath(); g.moveTo(px, 8 + j * (H - 16) / 3); g.lineTo(px + pw, 8 + j * (H - 16) / 3); g.stroke();
    }
  }
}

HP.CATALOG = [
  /* ---------------- BUILD ---------------- */
  { id: 'stairs', name: 'Stairs', cat: 'Build', w: 2, h: 4, colors: ['#9a7b52', '#6b7078', '#b09a80'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.shadow(g, 3, 3, W - 6, H - 6, 4);
      p.wood(g, 3, 3, W - 6, H - 6, c);
      // treads across the width
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2;
      const n = Math.floor(H / 16);
      for (let i = 1; i <= n; i++) {
        const y = 4 + (H - 8) * i / (n + 1);
        g.beginPath(); g.moveTo(8, y); g.lineTo(W - 8, y); g.stroke();
      }
      // side stringers
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 3;
      g.beginPath(); g.moveTo(5, 4); g.lineTo(5, H - 4); g.stroke();
      g.beginPath(); g.moveTo(W - 5, 4); g.lineTo(W - 5, H - 4); g.stroke();
      // direction arrow (down = descending)
      g.strokeStyle = '#2e3138'; g.fillStyle = '#2e3138'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 14); g.stroke();
      g.beginPath(); g.moveTo(W / 2 - 6, H - 20); g.lineTo(W / 2, H - 8); g.lineTo(W / 2 + 6, H - 20); g.closePath(); g.fill();
      g.font = 'bold 9px sans-serif'; g.textAlign = 'center';
      g.fillText('UP', W / 2, 16);
    } },

  /* ---------------- LIVING ---------------- */
  { id: 'sofa2', name: 'Sofa 2-Seat', cat: 'Living', w: 3, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68', '#c9b48f', '#5d4a68', '#4a6b8a'], draw: sofa(2) },
  { id: 'sofa3', name: 'Sofa 3-Seat', cat: 'Living', w: 4, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68', '#c9b48f', '#5d4a68', '#4a6b8a'], draw: sofa(3) },
  { id: 'sofaL', name: 'L-Sofa', cat: 'Living', w: 4, h: 3, colors: ['#8a90a0', '#9c6f63', '#5f7d74', '#b0764f', '#3a5f5d', '#8f8578'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H - H / 3 - 4, W - 8, H / 3 + 4, 10, HP.shade(c, 0.82)); // long seat
      p.fabric(g, 4, 4, W / 2.6, H - 8, 10, HP.shade(c, 0.82));               // chaise arm
      p.fabric(g, 4, 4, W - 8, H * 0.22, 8, c);                              // backrest top (left part)
      p.cushion(g, W / 2.6 + 8, H - H / 3 + 2, W - W / 2.6 - 20, H / 3 - 12, HP.shade(c, 1.12));
      p.cushion(g, 10, H * 0.3, W / 2.6 - 22, H - H / 3 - H * 0.34, HP.shade(c, 1.12));
      p.pillow(g, 16, H * 0.1, 14, HP.shade(c, 1.3), -0.2);
    } },
  { id: 'armchair', name: 'Armchair', cat: 'Living', w: 2, h: 2, colors: ['#8a6f5c', '#5d7484', '#7a6a8c', '#a06558', '#718a68', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 5, H * 0.3, W - 10, H * 0.64, 9, HP.shade(c, 0.82));
      p.fabric(g, 5, 5, W - 10, H * 0.32, 8, c);
      p.cushion(g, 11, H * 0.38, W - 22, H * 0.44, HP.shade(c, 1.12));
      p.fabric(g, 3, 5, 10, H - 10, 5, HP.shade(c, 0.9));
      p.fabric(g, W - 13, 5, 10, H - 10, 5, HP.shade(c, 0.9));
    } },
  { id: 'coffeeR', name: 'Coffee Table', cat: 'Living', w: 2, h: 1, colors: ['#a4805c', '#6b6f76', '#3f3a34'], draw: tableWood(true) },
  { id: 'coffeeRound', name: 'Round Table', cat: 'Living', w: 2, h: 2, colors: ['#a4805c', '#ded6c8', '#3f3a34'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = Math.min(W, H) / 2 - 6;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7);
      g.fillStyle = p.lg(g, W / 2 - r, H / 2 - r, r * 2, r * 2, HP.shade(c, 1.15), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, r * 0.35, 0, 7); g.stroke();
    } },
  { id: 'tvstand', name: 'TV + Stand', cat: 'Living', w: 3, h: 1, colors: ['#6f543c', '#454a52', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, H * 0.42, W - 8, H * 0.54, c);                            // cabinet
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2, H * 0.44); g.lineTo(W / 2, H * 0.94); g.stroke();
      const t = p.lg(g, 8, 4, W - 16, H * 0.36, '#3a4048', '#14171b');
      p.box(g, 8, 4, W - 16, H * 0.36, 3, t);                                // TV screen
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.beginPath(); g.moveTo(12, 4); g.lineTo(W * 0.42, 4); g.lineTo(W * 0.26, H * 0.4); g.lineTo(12, H * 0.4); g.fill();
    } },
  { id: 'rugA', name: 'Rug Modern', cat: 'Living', w: 4, h: 3, colors: ['#9db4c0', '#c2a18b', '#a8b09a'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 3, 3, W - 6, H - 6, 8, c);
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 3;
      P().RR(g, 10, 10, W - 20, H - 20, 5); g.stroke();
      g.strokeStyle = HP.shade(c, 1.15); g.lineWidth = 1.5;
      P().RR(g, 18, 18, W - 36, H - 36, 3); g.stroke();
    } },
  { id: 'rugRound', name: 'Rug Round', cat: 'Living', w: 3, h: 3, colors: ['#b7a4c9', '#a3bfb5', '#c9b48f'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = Math.min(W, H) / 2 - 5;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7); g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.78); g.lineWidth = 3;
      g.beginPath(); g.arc(W / 2, H / 2, r - 7, 0, 7); g.stroke();
      g.strokeStyle = HP.shade(c, 1.2); g.lineWidth = 1.5;
      g.beginPath(); g.arc(W / 2, H / 2, r - 15, 0, 7); g.stroke();
    } },
  { id: 'bookshelf', name: 'Bookshelf', cat: 'Living', w: 3, h: 1, colors: ['#7a5b3f', '#4a4f57', '#a08055'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.fillStyle = HP.shade(c, 0.55);
      g.fillRect(6, 6, W - 12, H - 12);
      const bc = ['#b04a3e', '#4a6b8a', '#c9a44e', '#5d8a5d', '#8a5d8a', '#d0d0c8'];
      let x = 8, i = 0;
      while (x < W - 14) {
        const bw = 6 + ((i * 37) % 7);
        g.fillStyle = bc[i % bc.length];
        g.fillRect(x, 8 + ((i * 13) % 5), bw, H - 18 - ((i * 13) % 5));
        x += bw + 2; i++;
      }
    } },
  { id: 'plantBig', name: 'Plant Large', cat: 'Living', w: 1, h: 1, colors: ['#4e7d45', '#5d8a50', '#3f6d55'],
    draw(g, W, H, v) {
      const p = P();
      p.leaves(g, W / 2, H / 2 - 3, W * 0.42, this.colors[v], 9);
      p.pot(g, W / 2, H / 2 + W * 0.18, W * 0.2);
    } },
  { id: 'plantSm', name: 'Plant Small', cat: 'Living', w: 1, h: 1, colors: ['#6d9c5f', '#7fae62', '#5d8a72'],
    draw(g, W, H, v) {
      const p = P();
      p.leaves(g, W / 2, H / 2, W * 0.34, this.colors[v], 7);
      p.pot(g, W / 2, H / 2 + W * 0.14, W * 0.17);
    } },
  { id: 'floorlamp', name: 'Floor Lamp', cat: 'Living', w: 1, h: 1, colors: ['#e8c86e', '#d8dbe0', '#c99a6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      const gr = g.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W * 0.5);
      gr.addColorStop(0, 'rgba(255,220,130,.5)'); gr.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7); g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.13, 0, 7); g.fillStyle = HP.shade(c, 0.6); g.fill();
    } },
  { id: 'sidetable', name: 'Side Table', cat: 'Living', w: 1, h: 1, colors: ['#a4805c', '#3f3a34', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = W * 0.42;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7);
      g.fillStyle = p.lg(g, W / 2 - r, H / 2 - r, r * 2, r * 2, HP.shade(c, 1.12), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.68); g.lineWidth = 2; g.stroke();
    } },
  { id: 'piano', name: 'Piano', cat: 'Living', w: 3, h: 2, colors: ['#23252b', '#5d4033', '#e8e4dc'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      // grand-piano-ish curved body
      p.shadow(g, 4, 4, W - 8, H - 8, 10);
      g.beginPath();
      g.moveTo(6, 6); g.lineTo(W - 8, 6);
      g.quadraticCurveTo(W - 2, H * 0.55, W - 22, H - 6);
      g.lineTo(6, H - 6); g.closePath();
      g.fillStyle = p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.2), HP.shade(c, 0.7)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      // keys strip
      g.fillStyle = '#f2eee4'; g.fillRect(8, H - 16, W * 0.45, 10);
      g.strokeStyle = '#333'; g.lineWidth = 1;
      for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(8 + i * W * 0.45 / 7, H - 16); g.lineTo(8 + i * W * 0.45 / 7, H - 6); g.stroke(); }
    } },
  { id: 'fireplace', name: 'Fireplace', cat: 'Living', w: 2, h: 1, colors: ['#8d6e5c', '#5b5f6b', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, 3, W - 6, H - 6, 3, p.lg(g, 3, 3, W - 6, H - 6, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; P().RR(g, 3, 3, W - 6, H - 6, 3); g.stroke();
      // firebox opening on the front edge
      g.fillStyle = '#241d18'; P().RR(g, W * 0.25, H - 18, W * 0.5, 14, 4); g.fill();
      const fg = g.createRadialGradient(W / 2, H - 10, 1, W / 2, H - 10, 10);
      fg.addColorStop(0, '#ffb74d'); fg.addColorStop(1, 'rgba(255,100,40,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(W / 2, H - 10, 9, 0, 7); g.fill();
      // brick ticks
      g.strokeStyle = 'rgba(0,0,0,.15)';
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * i / 4, 4); g.lineTo(W * i / 4, H * 0.5); g.stroke(); }
    } },
  { id: 'pooltable', name: 'Pool Table', cat: 'Living', w: 4, h: 2, colors: ['#3f6d55', '#5d4a68', '#7a4a3e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, '#6b4f33');
      p.box(g, 12, 10, W - 24, H - 20, 6, c);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; P().RR(g, 12, 10, W - 24, H - 20, 6); g.stroke();
      // pockets
      g.fillStyle = '#181a1d';
      [[12, 10], [W / 2, 8], [W - 12, 10], [12, H - 10], [W / 2, H - 8], [W - 12, H - 10]]
        .forEach(pt => { g.beginPath(); g.arc(pt[0], pt[1], 4, 0, 7); g.fill(); });
      // balls
      const bc = ['#fff', '#e8c832', '#e05252', '#4060b0'];
      bc.forEach((b, i) => {
        g.fillStyle = b;
        g.beginPath(); g.arc(W * (0.35 + i * 0.08), H * 0.55 - (i % 2) * 6, 3.5, 0, 7); g.fill();
      });
    } },
  { id: 'aquarium', name: 'Aquarium', cat: 'Living', w: 2, h: 1, colors: ['#4d8ea8', '#3f7a94', '#5aa8be'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, H - 8, W - 6, 6, '#4a3f34');                        // stand
      p.box(g, 3, 3, W - 6, H - 12, 3, p.lg(g, 3, 3, W - 6, H - 12, HP.shade(c, 1.25), c));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; P().RR(g, 3, 3, W - 6, H - 12, 3); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(6, 5, 8, H - 18); // glass glare
      g.fillStyle = '#e8a04c';                                          // fish
      g.beginPath(); g.ellipse(W * 0.55, H * 0.4, 6, 3, 0.3, 0, 7); g.fill();
      g.fillStyle = '#d06868';
      g.beginPath(); g.ellipse(W * 0.72, H * 0.6, 5, 2.5, -0.2, 0, 7); g.fill();
      g.fillStyle = '#6a9e5f'; g.fillRect(W * 0.2, H * 0.55, 4, 8);     // plant
    } },
  { id: 'bench', name: 'Bench', cat: 'Living', w: 2, h: 1, colors: ['#9a774f', '#5b5f6b', '#7d8fa3'], joins: true,
    draw(g, W, H, v, m) {
      const p = P(), c = this.colors[v];
      const x0 = (m & 4) ? 0 : 4, x1 = (m & 1) ? W : W - 8;
      p.fabric(g, x0, 6, x1 - x0, H - 12, 6, c);
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 8); g.stroke();
    } },
  { id: 'ottoman', name: 'Ottoman', cat: 'Living', w: 1, h: 1, colors: ['#a07858', '#7d8fa3', '#718a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 5, 5, W - 10, H - 10, 8, c);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.setLineDash([3, 3]);
      P().RR(g, 9, 9, W - 18, H - 18, 5); g.stroke(); g.setLineDash([]);
    } },

  /* ---------------- KITCHEN & DINING ---------------- */
  { id: 'counter', name: 'Counter', cat: 'Kitchen', w: 2, h: 1, colors: ['#c8bfae', '#8b93a0', '#6e5844'], draw: kitchenUnit('plain') },
  { id: 'counter3', name: 'Counter Long', cat: 'Kitchen', w: 3, h: 1, colors: ['#c8bfae', '#8b93a0', '#6e5844'], draw: kitchenUnit('plain') },
  { id: 'stove', name: 'Stove', cat: 'Kitchen', w: 2, h: 1, colors: ['#c8bfae', '#8b93a0', '#6e5844'], draw: kitchenUnit('stove') },
  { id: 'ksink', name: 'Sink', cat: 'Kitchen', w: 2, h: 1, colors: ['#c8bfae', '#8b93a0', '#6e5844'], draw: kitchenUnit('sink') },
  { id: 'fridge', name: 'Fridge', cat: 'Kitchen', w: 2, h: 2, colors: ['#c8bfae', '#8b93a0', '#dfe5ea'], draw: kitchenUnit('fridge') },
  { id: 'dishwash', name: 'Dishwasher', cat: 'Kitchen', w: 1, h: 1, colors: ['#c8bfae', '#8b93a0', '#6e5844'], draw: kitchenUnit('dish') },
  { id: 'tableDin', name: 'Dining Table', cat: 'Kitchen', w: 4, h: 2, colors: ['#9a774f', '#5b4a3a', '#d6c9b2'],
    draw(g, W, H, v) {
      tableWood(false).call(this, g, W, H, v);
      // placemats
      const c = this.colors[v];
      g.fillStyle = 'rgba(255,255,255,.25)';
      for (let i = 0; i < 3; i++) {
        g.fillRect(W * (0.18 + i * 0.27) - 9, 9, 18, 9);
        g.fillRect(W * (0.18 + i * 0.27) - 9, H - 18, 18, 9);
      }
      g.fillStyle = HP.shade('#ffffff', 1); // plates
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(W * (0.18 + i * 0.27), H * 0.28, 6, 0, 7); g.fill();
        g.beginPath(); g.arc(W * (0.18 + i * 0.27), H * 0.72, 6, 0, 7); g.fill();
      }
    } },
  { id: 'tableRound', name: 'Round Dining', cat: 'Kitchen', w: 3, h: 3, colors: ['#9a774f', '#5b4a3a', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = Math.min(W, H) / 2 - 5;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7);
      g.fillStyle = p.lg(g, W / 2 - r, H / 2 - r, r * 2, r * 2, HP.shade(c, 1.14), HP.shade(c, 0.82)); g.fill();
      g.strokeStyle = HP.shade(c, 0.68); g.lineWidth = 2; g.stroke();
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(W / 2, H / 2, r * i / 4.5, 0, 7); g.stroke(); }
      g.fillStyle = '#fff';
      [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], 6, 0, 7); g.fill();
      });
    } },
  { id: 'chair', name: 'Chair', cat: 'Kitchen', w: 1, h: 1, colors: ['#9a774f', '#7d8fa3', '#a06558'], draw: chairDraw(true) },
  { id: 'microwave', name: 'Microwave', cat: 'Kitchen', w: 1, h: 1, colors: ['#454a52', '#c9ced4', '#2f333a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 8, W - 10, H - 16, 3, p.lg(g, 5, 8, W - 10, H - 16, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.fillStyle = '#1b1e22'; g.fillRect(9, 12, W * 0.55, H - 24);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(11, 14, 6, H - 28);
      g.fillStyle = '#6a7078'; g.fillRect(W * 0.66, 12, W * 0.24, H - 24);
    } },

  /* ---------------- BEDROOM ---------------- */
  { id: 'bedSingle', name: 'Single Bed', cat: 'Bedroom', w: 2, h: 4, colors: ['#7d8fa3', '#a07858', '#8a7ba0'], draw: bedDraw(1) },
  { id: 'bedDouble', name: 'Double Bed', cat: 'Bedroom', w: 3, h: 4, colors: ['#7d8fa3', '#a07858', '#8a7ba0'], draw: bedDraw(2) },
  { id: 'bedQueen', name: 'Queen Bed', cat: 'Bedroom', w: 4, h: 4, colors: ['#7d8fa3', '#a07858', '#8a7ba0'], draw: bedDraw(2) },
  { id: 'nightstand', name: 'Nightstand', cat: 'Bedroom', w: 1, h: 1, colors: ['#8a6844', '#4a4f57', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 6, 6, W - 12, H - 12, c);
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(8, H / 2); g.lineTo(W - 8, H / 2); g.stroke();
      g.fillStyle = HP.shade(c, 0.5);
      g.beginPath(); g.arc(W / 2, H * 0.32, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.7, 3, 0, 7); g.fill();
    } },
  { id: 'wardrobe', name: 'Wardrobe', cat: 'Bedroom', w: 3, h: 1, colors: ['#8a6844', '#5b5f6b', '#c9b896'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) {
        g.beginPath(); g.moveTo(W * i / 3, 5); g.lineTo(W * i / 3, H - 5); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.5);
      [0.32, 0.38, 0.65, 0.71].forEach(f => g.fillRect(W * f, H / 2 - 4, 3, 8));
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(5, 5, W - 10, 5);
    } },
  { id: 'wardrobeBig', name: 'Wardrobe XL', cat: 'Bedroom', w: 4, h: 1, colors: ['#8a6844', '#5b5f6b', '#c9b896'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(W * i / 4, 5); g.lineTo(W * i / 4, H - 5); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.5);
      [0.23, 0.28, 0.48, 0.53, 0.73, 0.78].forEach(f => g.fillRect(W * f, H / 2 - 4, 3, 8));
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(5, 5, W - 10, 5);
    } },
  { id: 'dresser', name: 'Dresser', cat: 'Bedroom', w: 3, h: 1, colors: ['#8a6844', '#7a6a8c', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        g.beginPath(); g.moveTo(W * i / 3 + 4, 7); g.lineTo(W * i / 3 + 4, H - 7); g.stroke();
        g.beginPath(); g.moveTo(W * i / 3 - 4, 7); g.lineTo(W * i / 3 - 4, H - 7); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.5);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W * (i + 0.5) / 3, H / 2, 3, 0, 7); g.fill(); }
    } },
  { id: 'vanity', name: 'Vanity', cat: 'Bedroom', w: 2, h: 1, colors: ['#d6c9b2', '#8a6844', '#b090a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, H * 0.3, W - 8, H * 0.66, c);
      p.box(g, W * 0.28, 4, W * 0.44, H * 0.3, 3, p.lg(g, 0, 4, 0, H * 0.3, '#e8f0f5', '#a9c0cf')); // mirror
      g.strokeStyle = HP.shade(c, 0.7);
      P().RR(g, W * 0.28, 4, W * 0.44, H * 0.3, 3); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.62, 8, 0, 7); g.fillStyle = '#e8e2d8'; g.fill();
      g.stroke();
    } },

  /* ---------------- BATHROOM ---------------- */
  { id: 'toilet', name: 'Toilet', cat: 'Bathroom', w: 1, h: 2, colors: ['#e8ecf0', '#cfd8de', '#dcd2c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.16, 4, W * 0.68, H * 0.3, 4, HP.shade(c, 0.95));                 // tank
      g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.3, H * 0.3, 0, 0, 7);
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.18, H * 0.19, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.88); g.fill();
    } },
  { id: 'bsink', name: 'Bath Vanity', cat: 'Bathroom', w: 2, h: 1, colors: ['#e8ecf0', '#8b93a0', '#6e5844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 3, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.05), HP.shade(c, 0.88)));
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.22, H * 0.28, 0, 0, 7);
      g.fillStyle = '#eef3f6'; g.fill();
      g.strokeStyle = '#9aa4ab'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.13, H * 0.17, 0, 0, 7); g.stroke();
      g.fillStyle = '#5b636a'; g.fillRect(W / 2 - 1, 5, 2, 8);
    } },
  { id: 'bathtub', name: 'Bathtub', cat: 'Bathroom', w: 2, h: 4, colors: ['#eef2f5', '#d8e4ea', '#cfd8de'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 14, c);
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 2;
      P().RR(g, 4, 4, W - 8, H - 8, 14); g.stroke();
      p.box(g, 10, 12, W - 20, H - 24, 10, p.lg(g, 10, 12, W - 20, H - 24, '#cfe2ea', '#a8c4d0')); // water
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.beginPath(); g.ellipse(W * 0.4, H * 0.3, W * 0.12, H * 0.1, 0.3, 0, 7); g.fill();
      g.fillStyle = '#7c858c'; g.beginPath(); g.arc(W / 2, 10, 4, 0, 7); g.fill();
    } },
  { id: 'shower', name: 'Shower', cat: 'Bathroom', w: 2, h: 2, colors: ['#bcd6e2', '#a8c4d8', '#cfd8de'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 3, '#e8ecf0');
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 2;
      P().RR(g, 4, 4, W - 8, H - 8, 3); g.stroke();
      g.fillStyle = c; g.fillRect(7, 7, W - 14, H - 14);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.moveTo(7, H - 7); g.lineTo(W - 7, 7); g.lineTo(W - 20, 7); g.lineTo(7, H - 20); g.fill(); // glass sheen
      g.fillStyle = '#5b636a';
      g.beginPath(); g.arc(W / 2, H / 2, 5, 0, 7); g.fill();                              // drain
      g.strokeStyle = '#9aa4ab'; g.beginPath(); g.arc(W / 2, H / 2, 8, 0, 7); g.stroke();
      g.fillStyle = '#8fa4b0'; g.beginPath(); g.arc(W - 9, 9, 4, 0, 7); g.fill();         // showerhead
    } },
  { id: 'washer', name: 'Washer', cat: 'Bathroom', w: 1, h: 1, colors: ['#e8ecf0', '#c9ced4', '#8b93a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 4, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.05), HP.shade(c, 0.85)));
      g.fillStyle = '#33383e'; g.fillRect(8, 7, W - 16, 5);
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.24, 0, 7); g.fillStyle = '#45494e'; g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.17, 0, 7); g.fillStyle = '#9ab4c4'; g.fill();
      g.beginPath(); g.arc(W / 2 - 2, H * 0.62 - 2, W * 0.08, 0, 7); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    } },
  { id: 'towelrack', name: 'Towel Rack', cat: 'Bathroom', w: 1, h: 1, hangs: true, colors: ['#7ba3b8', '#b8a07b', '#9cb87b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#8b939c';
      g.fillRect(8, 10, W - 16, 4); g.fillRect(8, H - 14, W - 16, 4);
      p.fabric(g, 12, 6, W - 24, H - 12, 3, c);
      g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 8); g.stroke();
    } },

  /* ---------------- OFFICE ---------------- */
  { id: 'desk', name: 'Desk + PC', cat: 'Office', w: 3, h: 2, colors: ['#9a774f', '#454a52', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      p.box(g, W / 2 - 12, 8, 24, 16, 2, '#23272c');                            // monitor
      g.fillStyle = '#5d8aa8'; g.fillRect(W / 2 - 10, 10, 20, 12);              // screen
      g.fillStyle = '#d8d2c6'; g.fillRect(W / 2 - 14, H * 0.45, 28, 10);        // keyboard
      g.fillStyle = HP.shade(c, 0.5); g.fillRect(W / 2 + 18, H * 0.45, 8, 8);   // mouse
      g.fillStyle = '#2c2f33'; g.fillRect(W - 20, H - 26, 12, 18);              // tower
    } },
  { id: 'offchair', name: 'Office Chair', cat: 'Office', w: 1, h: 1, colors: ['#3a3f47', '#5d7484', '#7a5252'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI / 2;
        g.beginPath(); g.moveTo(W / 2, H / 2);
        g.lineTo(W / 2 + Math.cos(a) * W * 0.4, H / 2 + Math.sin(a) * H * 0.4); g.stroke();
      }
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.27, 0, 7); g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; g.stroke();
      p.fabric(g, W * 0.3, H * 0.08, W * 0.4, H * 0.2, 4, HP.shade(c, 0.85));   // backrest
    } },
  { id: 'filecab', name: 'File Cabinet', cat: 'Office', w: 1, h: 1, colors: ['#7c858c', '#5b5f6b', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 4, W - 12, H - 8, 3, p.lg(g, 6, 4, W - 12, H - 8, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(8, H * i / 3); g.lineTo(W - 8, H * i / 3); g.stroke(); }
      g.fillStyle = HP.shade(c, 0.5);
      for (let i = 0; i < 3; i++) g.fillRect(W / 2 - 6, H * (i + 0.5) / 3 - 2, 12, 3);
    } },
  { id: 'bookcase', name: 'Bookcase XL', cat: 'Office', w: 4, h: 1, colors: ['#7a5b3f', '#4a4f57', '#a08055'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.fillStyle = HP.shade(c, 0.55); g.fillRect(6, 6, W - 12, H - 12);
      const bc = ['#b04a3e', '#4a6b8a', '#c9a44e', '#5d8a5d', '#8a5d8a', '#d0d0c8'];
      let x = 8, i = 0;
      while (x < W - 14) {
        const bw = 6 + ((i * 37) % 8);
        g.fillStyle = bc[(i * 2) % bc.length];
        g.fillRect(x, 8 + ((i * 11) % 6), bw, H - 18 - ((i * 11) % 6));
        x += bw + 2; i++;
      }
    } },
  { id: 'bunkbed', name: 'Bunk Bed', cat: 'Bedroom', w: 2, h: 4, colors: ['#7d8fa3', '#8a6844', '#5d7484'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, '#8a6844');
      p.fabric(g, 8, 8, W - 16, H / 2 - 12, 4, c);                 // top bunk
      p.fabric(g, 8, H / 2 + 4, W - 16, H / 2 - 12, 4, HP.shade(c, 0.92)); // bottom bunk
      p.pillow(g, 10, 10, W * 0.24, '#fff', 0);
      p.pillow(g, 10, H / 2 + 6, W * 0.24, '#fff', 0);
      // ladder
      g.strokeStyle = '#6b4f33'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W - 6, H * 0.44); g.lineTo(W - 6, H * 0.56); g.stroke();
      g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const y = H * 0.44 + i * H * 0.06;
        g.beginPath(); g.moveTo(W - 10, y); g.lineTo(W - 3, y); g.stroke();
      }
    } },
  { id: 'crib', name: 'Crib', cat: 'Bedroom', w: 2, h: 3, colors: ['#d8c8b0', '#b8c8d8', '#d8b8c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      p.fabric(g, 10, 10, W - 20, H - 20, 5, '#f5f0e6');
      // rails
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) {
        g.beginPath(); g.moveTo(6 + i * (W - 12) / 5, 6); g.lineTo(6 + i * (W - 12) / 5, H - 6); g.stroke();
      }
      g.fillStyle = '#e8b8b0';                                     // tiny pillow
      P().RR(g, W / 2 - 7, 12, 14, 10, 4); g.fill();
    } },

  /* ---------------- KITCHEN extras ---------------- */
  { id: 'island', name: 'Kitchen Island', cat: 'Kitchen', w: 3, h: 1, colors: ['#c8bfae', '#8b93a0', '#5d6a5a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, 3, W - 6, H - 6, 3, p.lg(g, 3, 3, W - 6, H - 6, '#e2ddd2', '#b7b1a5'));
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; P().RR(g, 3, 3, W - 6, H - 6, 3); g.stroke();
      p.box(g, 7, 7, W - 14, H - 14, 2, p.lg(g, 7, 7, W - 14, H - 14, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.fillStyle = '#45494e';                                       // cooktop inset
      g.fillRect(W * 0.6, H * 0.3, W * 0.25, H * 0.4);
      g.strokeStyle = '#7c858c';
      P().RR(g, W * 0.14, H * 0.3, W * 0.2, H * 0.4, 3); g.stroke(); // prep sink
    } },
  { id: 'barstool', name: 'Bar Stool', cat: 'Kitchen', w: 1, h: 1, colors: ['#6b4f33', '#3a3f47', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2;
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.36, 0, 7); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7);
      g.fillStyle = p.lg(g, 0, 0, W, H, HP.shade(c, 1.15), HP.shade(c, 0.85)); g.fill();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.09, 0, 7); g.fillStyle = HP.shade(c, 0.5); g.fill();
    } },

  /* ---------------- OFFICE extras ---------------- */
  { id: 'gamingdesk', name: 'Gaming Desk', cat: 'Office', w: 3, h: 2, colors: ['#2f333a', '#454a52', '#5d4033'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 4, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.6); P().RR(g, 4, 4, W - 8, H - 8, 4); g.stroke();
      // dual monitors
      p.box(g, W / 2 - 26, 8, 24, 15, 2, '#181b20');
      p.box(g, W / 2 + 2, 8, 24, 15, 2, '#181b20');
      g.fillStyle = '#4fc3f7'; g.fillRect(W / 2 - 24, 10, 20, 11);
      g.fillStyle = '#b388ff'; g.fillRect(W / 2 + 4, 10, 20, 11);
      // RGB strip along front edge
      const rg = g.createLinearGradient(6, 0, W - 6, 0);
      rg.addColorStop(0, '#ff5370'); rg.addColorStop(0.5, '#4fc3f7'); rg.addColorStop(1, '#b388ff');
      g.fillStyle = rg; g.fillRect(6, H - 8, W - 12, 3);
      g.fillStyle = '#d8d2c6'; g.fillRect(W / 2 - 13, H * 0.5, 26, 9); // keyboard
      // PC tower with glow
      p.box(g, W - 18, H - 26, 12, 20, 2, '#22252b');
      g.fillStyle = '#4fc3f7'; g.fillRect(W - 15, H - 22, 6, 3);
    } },
  { id: 'gamingchair', name: 'Gaming Chair', cat: 'Office', w: 1, h: 1, colors: ['#3a3f47', '#7a3a3f', '#3a5f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 6, 8, W - 12, H - 14, 6, c);
      p.fabric(g, 8, 3, W - 16, 8, 4, HP.shade(c, 0.8));             // headrest
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(8, H * 0.4); g.lineTo(W - 8, H * 0.4); g.stroke();
    } },
  { id: 'treadmill', name: 'Treadmill', cat: 'Office', w: 1, h: 2, colors: ['#3a3f47', '#5b5f6b', '#2f333a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 4, W - 10, H - 8, 4, p.lg(g, 5, 4, W - 10, H - 8, HP.shade(c, 1.1), HP.shade(c, 0.75)));
      g.fillStyle = '#22252a'; g.fillRect(9, H * 0.35, W - 18, H * 0.55); // belt
      g.strokeStyle = '#555c66'; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(10, H * 0.35 + i * H * 0.13); g.lineTo(W - 10, H * 0.35 + i * H * 0.13); g.stroke(); }
      p.box(g, 7, 5, W - 14, 8, 2, '#181b20');                       // console
    } },

  /* ---------------- OUTDOOR ---------------- */
  { id: 'bbq', name: 'BBQ Grill', cat: 'Outdoor', w: 2, h: 1, colors: ['#3a3f47', '#7a4a3e', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 6, W - 8, H - 12, 5, p.lg(g, 4, 6, W - 8, H - 12, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.strokeStyle = HP.shade(c, 0.55); P().RR(g, 4, 6, W - 8, H - 12, 5); g.stroke();
      g.fillStyle = '#181a1d'; g.fillRect(8, 10, W * 0.55, H - 20);  // grill
      g.strokeStyle = '#555c66'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10, 12 + i * (H - 24) / 3); g.lineTo(8 + W * 0.55 - 4, 12 + i * (H - 24) / 3); g.stroke(); }
      g.fillStyle = '#8b939c';
      for (let i = 0; i < 3; i++) g.fillRect(W * 0.68, 11 + i * 8, 9, 3); // knobs/shelf
    } },
  { id: 'lounger', name: 'Sun Lounger', cat: 'Outdoor', w: 1, h: 2, colors: ['#d8cfc0', '#7ba3b8', '#9cb87b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 5, 4, W - 10, H - 8, 5, HP.shade(c, 0.9));          // frame pad
      p.fabric(g, 7, 4, W - 14, H * 0.35, 4, c);                      // raised back
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(7, 6 + i * H * 0.2); g.lineTo(W - 7, 6 + i * H * 0.2); g.stroke(); }
    } },
  { id: 'patiotable', name: 'Patio Set', cat: 'Outdoor', w: 3, h: 3, colors: ['#a89885', '#5d6a5a', '#8a6f5c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
      // 4 chairs around a round table
      [[cx, 9], [cx, H - 9], [9, cy], [W - 9, cy]].forEach(pt => {
        g.beginPath(); g.arc(pt[0], pt[1], 7, 0, 7);
        g.fillStyle = p.lg(g, pt[0] - 7, pt[1] - 7, 14, 14, HP.shade(c, 1.05), HP.shade(c, 0.8));
        g.fill(); g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      });
      g.beginPath(); g.arc(cx, cy, Math.min(W, H) * 0.3, 0, 7);
      g.fillStyle = p.lg(g, cx - 16, cy - 16, 32, 32, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fillStyle = '#8b5a3a'; g.fill(); // parasol hole
    } },
  { id: 'coatrack', name: 'Coat Rack', cat: 'Outdoor', w: 1, h: 1, colors: ['#6b4f33', '#3a3f47', '#a4805c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.beginPath(); g.moveTo(W / 2, H / 2);
        g.lineTo(W / 2 + Math.cos(a) * W * 0.34, H / 2 + Math.sin(a) * H * 0.34); g.stroke();
      }
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.16, 0, 7);
      g.fillStyle = p.lg(g, 0, 0, W, H, HP.shade(c, 1.2), HP.shade(c, 0.8)); g.fill();
    } },

  /* ---------------- LIVING extras ---------------- */
  { id: 'sofaU', name: 'Sectional Sofa', cat: 'Living', w: 5, h: 3, colors: ['#7d8fa3', '#a06558', '#6d7a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 4, W - 8, H * 0.3, 9, c);                                  // back
      p.fabric(g, 4, 4, W * 0.15, H - 8, 8, HP.shade(c, 0.85));                 // L arm
      p.fabric(g, W * 0.85, 4, W * 0.15 - 4, H - 8, 8, HP.shade(c, 0.85));      // R arm
      for (let i = 0; i < 3; i++)
        p.cushion(g, W * 0.19 + i * W * 0.2 + 2, H * 0.36, W * 0.2 - 4, H * 0.3, HP.shade(c, 1.1));
      p.cushion(g, W * 0.19 + 2, H * 0.7, W * 0.2 - 4, H * 0.26, HP.shade(c, 1.02));   // L chaise
      p.cushion(g, W * 0.59 + 2, H * 0.7, W * 0.22 - 4, H * 0.26, HP.shade(c, 1.02));  // R chaise
      p.pillow(g, W * 0.2, H * 0.08, 13, HP.shade(c, 1.3), -0.15);
      p.pillow(g, W * 0.72, H * 0.08, 13, HP.shade(c, 1.3), 0.15);
    } },
  { id: 'tvwall', name: 'TV Wall Unit', cat: 'Living', w: 5, h: 1, colors: ['#6f543c', '#3a3f47', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      p.box(g, W * 0.3, 6, W * 0.4, H - 12, 2, '#14171b');                       // big screen
      g.fillStyle = 'rgba(120,170,220,.25)'; g.fillRect(W * 0.32, 8, W * 0.36, H - 16);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(W * 0.32, 8, 8, H - 16);
      [0.06, 0.24, 0.73, 0.9].forEach(f => {                                     // side shelves
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
        g.strokeRect(W * f, 8, W * 0.12, H - 16);
        g.fillStyle = ['#b04a3e', '#4a6b8a'][Math.round(f) % 2];
        g.fillRect(W * f + 3, 11, W * 0.12 - 6, 5);
      });
    } },
  { id: 'chaise', name: 'Chaise Lounge', cat: 'Living', w: 1, h: 2, colors: ['#8a6f5c', '#7d8fa3', '#718a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 5, 4, W - 10, H - 8, 8, HP.shade(c, 0.85));
      p.cushion(g, 9, H * 0.38, W - 18, H * 0.55, HP.shade(c, 1.08));
      p.cushion(g, 9, 8, W - 18, H * 0.28, c);                                  // raised head
      p.pillow(g, W * 0.3, 12, 12, HP.shade(c, 1.25), 0.1);
    } },
  { id: 'console', name: 'Console Table', cat: 'Living', w: 2, h: 1, colors: ['#9a774f', '#3f3a34', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 8, W - 8, H - 16, c);
      g.fillStyle = HP.shade(c, 0.55);
      [[8, H - 8], [W - 8, H - 8]].forEach(pt => { g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill(); });
      g.fillStyle = '#8fb8a0'; g.fillRect(W * 0.42, H * 0.22, W * 0.16, H * 0.3); // vase
      g.fillStyle = '#5d8a5d'; g.fillRect(W * 0.44, H * 0.1, W * 0.12, H * 0.16); // plant in vase
    } },
  { id: 'shoecab', name: 'Shoe Cabinet', cat: 'Living', w: 2, h: 1, colors: ['#8a6844', '#454a52', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H / 2); g.lineTo(W - 6, H / 2); g.stroke();
      // shoes peeking (little toe-box pairs)
      g.fillStyle = HP.shade(c, 0.4);
      for (let i = 0; i < 4; i++) {
        g.fillRect(W * 0.12 + i * W * 0.22, H * 0.62, 7, 5);
        g.fillRect(W * 0.12 + i * W * 0.22 + 8, H * 0.62, 7, 5);
      }
    } },
  { id: 'floormirror', name: 'Mirror', cat: 'Living', w: 1, h: 1, hangs: true, colors: ['#a89885', '#3a3f47', '#c9b896'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 4, W - 10, H - 8, 3, HP.shade(c, 0.9));                        // frame
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; P().RR(g, 5, 4, W - 10, H - 8, 3); g.stroke();
      const mg = p.lg(g, 8, 7, W - 16, H - 14, '#dcebf4', '#9cb8cc');
      p.box(g, 8, 7, W - 16, H - 14, 2, mg);
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.moveTo(10, H - 9); g.lineTo(W - 14, 9); g.lineTo(W - 8, 9); g.lineTo(16, H - 9); g.fill();
    } },
  { id: 'wallart', name: 'Painting', cat: 'Living', w: 1, h: 1, hangs: true, colors: ['#c9713d', '#4a6b8a', '#8a5d8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 5, W - 10, H - 10, 2, '#5d4a33');                              // frame
      p.box(g, 8, 8, W - 16, H - 16, 1, '#f0ece2');                              // canvas
      g.fillStyle = c;
      g.beginPath(); g.arc(W * 0.35, H * 0.4, W * 0.16, 0, 7); g.fill();
      g.fillStyle = HP.shade(c, 0.75);
      g.beginPath(); g.moveTo(W * 0.55, H * 0.75); g.lineTo(W * 0.75, H * 0.3); g.lineTo(W * 0.85, H * 0.75); g.fill();
    } },
  { id: 'barcart', name: 'Bar Cart', cat: 'Living', w: 1, h: 1, colors: ['#a4805c', '#3a3f47', '#6d5a45'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 5, W - 10, H - 10, c);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(7, H * 0.55); g.lineTo(W - 7, H * 0.55); g.stroke(); // shelf line
      const bc = ['#7a4a3e', '#4a6b8a', '#c9a44e', '#5d8a5d'];
      bc.forEach((b, i) => {
        g.fillStyle = b;
        g.fillRect(W * 0.14 + i * W * 0.2, H * 0.15, W * 0.1, H * 0.3);          // bottles
      });
      g.fillStyle = '#dfe5ea';
      g.beginPath(); g.arc(W * 0.3, H * 0.75, 4, 0, 7); g.fill();                // glasses
      g.beginPath(); g.arc(W * 0.55, H * 0.75, 4, 0, 7); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.arc(8, H - 6, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W - 8, H - 6, 3, 0, 7); g.fill();                     // wheels
    } },
  { id: 'petbed', name: 'Pet Bed', cat: 'Living', w: 1, h: 1, colors: ['#a07858', '#7d8fa3', '#718a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.42, H * 0.36, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.85); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.28, H * 0.22, 0, 0, 7);
      g.fillStyle = HP.shade(c, 1.05); g.fill();
    } },
  { id: 'cattree', name: 'Cat Tree', cat: 'Living', w: 1, h: 1, colors: ['#b09a80', '#8a8a80', '#7d8fa3'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.2, H * 0.6, W * 0.6, H * 0.32, HP.shade(c, 0.85));         // base
      g.fillStyle = HP.shade(c, 0.7);
      g.fillRect(W * 0.45, H * 0.3, W * 0.1, H * 0.32);                          // post
      p.box(g, W * 0.25, H * 0.12, W * 0.5, H * 0.22, 3, c);                     // platform
      g.strokeStyle = HP.shade(c, 0.6); P().RR(g, W * 0.25, H * 0.12, W * 0.5, H * 0.22, 3); g.stroke();
    } },
  { id: 'beanbag', name: 'Bean Bag', cat: 'Living', w: 1, h: 1, colors: ['#a06558', '#7d8fa3', '#8a7ba0'], walkable: false,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2 + 2, W * 0.4, H * 0.36, 0.1, 0, 7);
      g.fillStyle = p.lg(g, W * 0.15, H * 0.15, W * 0.7, H * 0.7, HP.shade(c, 1.15), HP.shade(c, 0.8));
      g.fill(); g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2 + 1, W * 0.16, H * 0.12, 0.1, 0, 7); // dimple
      g.fillStyle = HP.shade(c, 0.8); g.fill();
    } },
  { id: 'hifi', name: 'Hi-Fi + Speakers', cat: 'Living', w: 2, h: 1, colors: ['#3a3f47', '#6f543c', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      [0.04, 0.78].forEach(f => {                                                // speaker pair
        p.box(g, W * f, 6, W * 0.18, H - 12, 3, HP.shade(c, 0.8));
        g.fillStyle = '#22252a';
        g.beginPath(); g.arc(W * (f + 0.09), H * 0.35, W * 0.05, 0, 7); g.fill();
        g.beginPath(); g.arc(W * (f + 0.09), H * 0.68, W * 0.06, 0, 7); g.fill();
      });
      p.wood(g, W * 0.28, 8, W * 0.44, H - 16, c);                               // deck
      g.fillStyle = '#181a1d'; g.fillRect(W * 0.32, 12, W * 0.2, H - 24);        // turntable platter
      g.fillStyle = '#333'; g.beginPath(); g.arc(W * 0.42, H / 2, H * 0.22, 0, 7); g.fill();
    } },

  /* ---------------- KITCHEN extras 2 ---------------- */
  { id: 'pantry', name: 'Pantry Cabinet', cat: 'Kitchen', w: 2, h: 1, colors: ['#8a6844', '#454a52', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 3, W - 8, H - 6, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(W / 2, 5); g.lineTo(W / 2, H - 5); g.stroke();     // double doors
      g.fillStyle = HP.shade(c, 0.45);
      g.fillRect(W / 2 - 5, H / 2 - 4, 3, 8); g.fillRect(W / 2 + 2, H / 2 - 4, 3, 8); // handles
    } },
  { id: 'kitcart', name: 'Kitchen Cart', cat: 'Kitchen', w: 2, h: 1, colors: ['#9a774f', '#5b5f6b', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 5, W - 10, H - 10, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, H * 0.5); g.lineTo(W - 8, H * 0.5); g.stroke(); // shelf
      g.fillStyle = '#e8e2d8'; g.fillRect(W * 0.15, H * 0.15, W * 0.2, H * 0.25); // towels/shelf items
      g.fillStyle = '#8fb8a0'; g.fillRect(W * 0.6, H * 0.15, W * 0.2, H * 0.25);
      g.fillStyle = '#2c2f33';
      [[7, H - 5], [W - 7, H - 5]].forEach(pt => { g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill(); });
    } },
  { id: 'tableDin6', name: 'Dining Table 6', cat: 'Kitchen', w: 5, h: 2, colors: ['#9a774f', '#5b4a3a', '#d6c9b2'],
    draw(g, W, H, v) {
      tableWood(false).call(this, g, W, H, v);
      g.fillStyle = 'rgba(255,255,255,.25)';
      for (let i = 0; i < 3; i++) {
        g.fillRect(W * (0.14 + i * 0.28) - 8, 8, 16, 8);
        g.fillRect(W * (0.14 + i * 0.28) - 8, H - 16, 16, 8);
      }
      g.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(W * (0.14 + i * 0.28), H * 0.27, 5, 0, 7); g.fill();
        g.beginPath(); g.arc(W * (0.14 + i * 0.28), H * 0.73, 5, 0, 7); g.fill();
      }
      g.fillStyle = '#8fb8a0'; g.fillRect(W / 2 - 10, H * 0.44, 20, H * 0.12);   // centerpiece
    } },
  { id: 'buffet', name: 'Sideboard', cat: 'Kitchen', w: 3, h: 1, colors: ['#8a6844', '#4a4f57', '#c9b896'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(W * i / 3, 6); g.lineTo(W * i / 3, H - 6); g.stroke(); }
      g.fillStyle = HP.shade(c, 0.5);
      for (let i = 0; i < 3; i++) g.fillRect(W * (i + 0.5) / 3 - 5, H / 2 - 3, 10, 4);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(W * 0.5, H * 0.25, 4, 0, 7); g.fill();                // bowl decor
    } },
  { id: 'winecab', name: 'Wine Cabinet', cat: 'Kitchen', w: 1, h: 1, colors: ['#6f543c', '#3a3f47', '#8a6844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 4, W - 10, H - 8, c);
      g.fillStyle = '#3a2e22';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        g.beginPath(), g.arc(W * (0.32 + i * 0.36), H * (0.3 + j * 0.36), W * 0.11, 0, 7), g.fill();
      g.fillStyle = '#7a2e3a';                                                 // bottle ends
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        g.beginPath(), g.arc(W * (0.32 + i * 0.36), H * (0.3 + j * 0.36), W * 0.06, 0, 7), g.fill();
    } },
  { id: 'trashbin', name: 'Trash Bin', cat: 'Kitchen', w: 1, h: 1, colors: ['#7c858c', '#454a52', '#8a8a6d'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.34, 0, 7);
      g.fillStyle = HP.shade(c, 0.95); g.fill();
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.22, 0, 7);
      g.fillStyle = HP.shade(c, 1.1); g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1.5; g.stroke();           // lid
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(W / 2 - 5, H / 2 - 2, 10, 4);   // pedal mark
    } },

  /* ---------------- BEDROOM extras ---------------- */
  { id: 'bedKing', name: 'King Bed', cat: 'Bedroom', w: 5, h: 4, colors: ['#7d8fa3', '#a07858', '#8a7ba0'], draw: bedDraw(2) },
  { id: 'daybed', name: 'Daybed', cat: 'Bedroom', w: 3, h: 1, colors: ['#a07858', '#7d8fa3', '#8a7ba0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, '#8a6844');
      p.fabric(g, 8, 8, W - 16, H - 16, 5, '#f2ede4');
      p.fabric(g, 8, 8, W - 16, H * 0.28, 4, HP.shade(c, 0.9));                  // back rail
      for (let i = 0; i < 3; i++)                                                // bolsters
        p.pillow(g, 12 + i * (W * 0.3), 10, 12, c, 0);
      p.fabric(g, 8, H * 0.5, W - 16, H * 0.42, 4, c);                           // cushion
    } },
  { id: 'bedbench', name: 'Bed Bench', cat: 'Bedroom', w: 2, h: 1, colors: ['#a07858', '#7d8fa3', '#6d7a68'], joins: true,
    draw(g, W, H, v, m) {
      const p = P(), c = this.colors[v];
      const x0 = (m & 4) ? 2 : 6, x1 = (m & 1) ? W - 2 : W - 6;
      p.fabric(g, x0, 10, x1 - x0, H - 20, 7, c);
      g.fillStyle = HP.shade(c, 0.5);
      [[10, H - 8], [10, 10]].forEach(pt => {
        if (!(m & 4)) { g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill(); }
      });
      [[W - 10, H - 8], [W - 10, 10]].forEach(pt => {
        if (!(m & 1)) { g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill(); }
      });
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.setLineDash([3, 3]);
      P().RR(g, 10, 14, W - 20, H - 28, 4); g.stroke(); g.setLineDash([]);
    } },
  { id: 'hamper', name: 'Laundry Hamper', cat: 'Bedroom', w: 1, h: 1, colors: ['#b09a80', '#7d8fa3', '#8a8a80'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.36, H * 0.3, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.9); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.26, H * 0.2, 0, 0, 7);
      g.fillStyle = '#e8e2d8'; g.fill();                                         // laundry inside
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.2, H * (0.3 + i * 0.12)); g.lineTo(W * 0.8, H * (0.3 + i * 0.12)); g.stroke(); }
    } },
  { id: 'divider', name: 'Room Divider', cat: 'Bedroom', w: 2, h: 1, colors: ['#d6c9b2', '#8a6844', '#5d7484'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 3; i++) {                                              // 3 folded panels
        const x = W * 0.08 + i * W * 0.3;
        p.box(g, x, 6 + (i % 2) * 4, W * 0.26, H - 12 - (i % 2) * 8, 2,
          p.lg(g, x, 6, W * 0.26, H - 12, HP.shade(c, 1.1), HP.shade(c, 0.85)));
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
        g.strokeRect(x + 3, 9 + (i % 2) * 4, W * 0.26 - 6, H - 18 - (i % 2) * 8);
      }
    } },

  /* ---------------- BATHROOM extras ---------------- */
  { id: 'bsink2', name: 'Double Vanity', cat: 'Bathroom', w: 3, h: 1, colors: ['#e8ecf0', '#8b93a0', '#6e5844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 3, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.05), HP.shade(c, 0.88)));
      [0.28, 0.72].forEach(f => {
        g.beginPath(); g.ellipse(W * f, H * 0.55, W * 0.13, H * 0.22, 0, 0, 7);
        g.fillStyle = '#eef3f6'; g.fill();
        g.strokeStyle = '#9aa4ab'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#5b636a'; g.fillRect(W * f - 1, 6, 2, 7);
      });
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;
      g.beginPath(); g.moveTo(6, H * 0.18); g.lineTo(W - 6, H * 0.18); g.stroke(); // mirror strip
    } },
  { id: 'dryer', name: 'Dryer', cat: 'Bathroom', w: 1, h: 1, colors: ['#e8ecf0', '#c9ced4', '#8b93a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 4, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.05), HP.shade(c, 0.85)));
      g.fillStyle = '#33383e'; g.fillRect(8, 7, W - 16, 5);
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.24, 0, 7); g.fillStyle = '#45494e'; g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.17, 0, 7); g.fillStyle = '#c4cfd8'; g.fill();
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.65, 8, W * 0.2, 3);              // lint tray
    } },
  { id: 'bathmat', name: 'Bath Mat', cat: 'Bathroom', w: 2, h: 1, colors: ['#bcd6e2', '#a8bfa8', '#d8c8b8'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 3, 6, W - 6, H - 12, 5, c);
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 2;
      P().RR(g, 9, 11, W - 18, H - 22, 3); g.stroke();
    } },
  { id: 'linen', name: 'Linen Cabinet', cat: 'Bathroom', w: 1, h: 1, colors: ['#e8ecf0', '#8a6844', '#8b93a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 4, W - 10, H - 8, c);
      const tc = ['#a8c8d8', '#e8d8c8', '#d8e8d8'];
      tc.forEach((t, i) => {                                                     // folded towels
        g.fillStyle = t;
        g.fillRect(W * 0.2, H * (0.18 + i * 0.24), W * 0.6, H * 0.16);
        g.strokeStyle = 'rgba(0,0,0,.15)'; g.strokeRect(W * 0.2, H * (0.18 + i * 0.24), W * 0.6, H * 0.16);
      });
    } },

  /* ---------------- OFFICE extras 2 ---------------- */
  { id: 'deskL', name: 'L-Desk', cat: 'Office', w: 3, h: 3, colors: ['#9a774f', '#454a52', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H * 0.42, c);                                       // top wing
      p.wood(g, 4, 4, W * 0.42, H - 8, c);                                       // left wing
      p.box(g, W * 0.45, 10, 22, 14, 2, '#23272c');                              // monitor
      g.fillStyle = '#5d8aa8'; g.fillRect(W * 0.45 + 2, 12, 18, 10);
      g.fillStyle = '#d8d2c6'; g.fillRect(10, H * 0.52, 24, 9);                  // keyboard on wing
      g.fillStyle = '#454a52'; g.fillRect(W - 16, H * 0.55, 8, 10);              // mug
    } },
  { id: 'printer', name: 'Printer Stand', cat: 'Office', w: 1, h: 1, colors: ['#e8ecf0', '#454a52', '#8a6844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 6, 6, W - 12, H - 12, HP.shade(c, 0.9));
      p.box(g, 9, 9, W - 18, H * 0.5, 2, p.lg(g, 9, 9, W - 18, H * 0.5, '#f0f3f6', '#b8bec6')); // printer
      g.fillStyle = '#fff'; g.fillRect(W * 0.3, H * 0.66, W * 0.4, H * 0.18);    // paper out
      g.strokeStyle = '#b8bec6'; g.strokeRect(W * 0.3, H * 0.66, W * 0.4, H * 0.18);
    } },
  { id: 'whiteboard', name: 'Whiteboard', cat: 'Office', w: 2, h: 1, colors: ['#eef2f5', '#dfe5ea', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 8, W - 10, H - 16, 3, p.lg(g, 5, 8, W - 10, H - 16, '#ffffff', c));
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 2; P().RR(g, 5, 8, W - 10, H - 16, 3); g.stroke();
      g.strokeStyle = '#4060b0'; g.lineWidth = 1.5;                              // scribbles
      g.beginPath(); g.moveTo(W * 0.15, H * 0.4); g.quadraticCurveTo(W * 0.4, H * 0.15, W * 0.55, H * 0.5); g.stroke();
      g.strokeStyle = '#b04040';
      g.beginPath(); g.moveTo(W * 0.6, H * 0.35); g.lineTo(W * 0.85, H * 0.6); g.stroke();
      g.fillStyle = '#8fa4b0'; g.fillRect(W * 0.3, H - 12, W * 0.4, 4);          // tray
    } },
  { id: 'fan', name: 'Standing Fan', cat: 'Office', w: 1, h: 1, colors: ['#dfe5ea', '#8b93a0', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.8, W * 0.22, H * 0.12, 0, 0, 7);     // base
      g.fillStyle = HP.shade(c, 0.8); g.fill();
      g.strokeStyle = c; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W / 2, H * 0.8); g.lineTo(W / 2, H * 0.42); g.stroke(); // stand
      for (let i = 0; i < 3; i++) {                                              // blades
        const a = i * Math.PI * 2 / 3;
        g.beginPath(); g.ellipse(W / 2 + Math.cos(a) * W * 0.14, H * 0.32 + Math.sin(a) * W * 0.14,
          W * 0.16, W * 0.08, a, 0, 7);
        g.fillStyle = HP.shade(c, 0.95); g.fill();
      }
      g.beginPath(); g.arc(W / 2, H * 0.32, W * 0.09, 0, 7); g.fillStyle = HP.shade(c, 0.7); g.fill();
    } },
  { id: 'radiator', name: 'Radiator', cat: 'Office', w: 1, h: 1, hangs: true, colors: ['#dfe5ea', '#c9ced4', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 10, W - 8, H - 20, 3, p.lg(g, 4, 10, W - 8, H - 20, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      for (let i = 1; i < 6; i++) {
        const x = 4 + (W - 8) * i / 6;
        g.beginPath(); g.moveTo(x, 12); g.lineTo(x, H - 12); g.stroke();
      }
    } },
  { id: 'robotvac', name: 'Robot Vacuum', cat: 'Office', w: 1, h: 1, colors: ['#3a3f47', '#dfe5ea', '#7a5252'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7);
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.18, 0, 7);
      g.strokeStyle = HP.shade(c, 1.3); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.38, 2.5, 0, 7); g.fillStyle = '#4fc3f7'; g.fill(); // LED
    } },

  /* ---------------- KIDS ---------------- */
  { id: 'playmat', name: 'Play Mat', cat: 'Kids', w: 3, h: 3, colors: ['#e8a0a8', '#a0c8e8', '#a8d8a8'], walkable: true,
    draw(g, W, H, v) {
      const pc = ['#e8a0a8', '#f0d090', '#a0c8e8', '#a8d8a8', '#d8b0e0', '#f0b890'];
      const n = 3;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = pc[(i * n + j) % pc.length];
        P().RR(g, 4 + i * (W - 8) / n, 4 + j * (H - 8) / n, (W - 8) / n - 2, (H - 8) / n - 2, 4); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.arc(4 + i * (W - 8) / n + (W - 8) / n / 2, 4 + j * (H - 8) / n + (H - 8) / n / 2, 5, 0, 7); g.fill();
      }
    } },
  { id: 'teepee', name: 'Play Tent', cat: 'Kids', w: 2, h: 2, colors: ['#e8d8c0', '#d8b8c8', '#b8d8c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();
      g.moveTo(W / 2, 6); g.lineTo(W - 8, H - 8); g.lineTo(8, H - 8); g.closePath();
      g.fillStyle = p.lg(g, 8, 6, W - 16, H - 14, HP.shade(c, 1.1), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;                        // stripes
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(W / 2 - i * 10, H * 0.3 + i * 10); g.lineTo(W / 2 + i * 10, H * 0.3 + i * 10); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.5);                                            // doorway
      g.beginPath(); g.moveTo(W / 2, H * 0.55); g.lineTo(W / 2 + 10, H - 8); g.lineTo(W / 2 - 10, H - 8); g.fill();
    } },
  { id: 'kidsdesk', name: 'Kids Desk', cat: 'Kids', w: 2, h: 1, colors: ['#d8b06a', '#a0c8e8', '#e8a0a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 6, W - 10, H - 12, c);
      g.fillStyle = '#fff'; g.fillRect(W * 0.18, H * 0.2, W * 0.4, H * 0.5);     // paper
      const cc = ['#e05252', '#4060b0', '#5d8a5d'];
      cc.forEach((k, i) => { g.fillStyle = k; g.fillRect(W * (0.66 + i * 0.1), H * 0.25, 4, H * 0.4); }); // crayons
    } },
  { id: 'toybox', name: 'Toy Box', cat: 'Kids', w: 2, h: 1, colors: ['#e8a05a', '#a0c8e8', '#a8d8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 6, W - 10, H - 12, c);
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(8, H * 0.4, W - 16, 4);         // lid seam
      const tc = ['#e05252', '#4060b0', '#e8c832', '#5d8a5d'];
      tc.forEach((t, i) => {
        g.fillStyle = t;
        g.beginPath(); g.arc(W * (0.2 + i * 0.2), H * 0.72, 5, 0, 7); g.fill();  // toys peeking
      });
    } },
  { id: 'rockchair', name: 'Rocking Chair', cat: 'Kids', w: 1, h: 2, colors: ['#8a6f5c', '#7d8fa3', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 3;                         // rockers
      g.beginPath(); g.arc(W / 2, H * 0.5, H * 0.44, -0.5, 0.5); g.stroke();
      p.fabric(g, 8, H * 0.3, W - 16, H * 0.5, 6, c);                            // seat
      p.fabric(g, 10, H * 0.06, W - 20, H * 0.26, 5, HP.shade(c, 0.85));         // backrest
      p.fabric(g, 4, H * 0.34, 8, H * 0.36, 4, HP.shade(c, 0.8));                // arms
      p.fabric(g, W - 12, H * 0.34, 8, H * 0.36, 4, HP.shade(c, 0.8));
    } },
  { id: 'ballpit', name: 'Ball Pit', cat: 'Kids', w: 2, h: 2, colors: ['#e8a0a8', '#a0c8e8', '#f0d090'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 4, W - 8, H - 8, 12, c);                                    // rim
      g.fillStyle = '#fdf8ee';
      P().RR(g, 10, 10, W - 20, H - 20, 8); g.fill();
      const bc = ['#e05252', '#4060b0', '#e8c832', '#5d8a5d', '#e08040'];
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, r = (W - 36) * 0.4 * ((i * 7) % 10) / 10;
        g.fillStyle = bc[i % bc.length];
        g.beginPath(); g.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 4, 0, 7); g.fill();
      }
    } },

  /* ---------------- GYM ---------------- */
  { id: 'exbike', name: 'Exercise Bike', cat: 'Gym', w: 1, h: 2, colors: ['#3a3f47', '#7a4a3e', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 3;                                        // frame
      g.beginPath(); g.moveTo(W / 2, H * 0.15); g.lineTo(W / 2, H * 0.6); g.stroke();
      g.beginPath(); g.moveTo(W / 2, H * 0.6); g.lineTo(W * 0.35, H * 0.85); g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.85, W * 0.3, H * 0.12, 0, 0, 7);     // flywheel base
      g.fillStyle = HP.shade(c, 0.75); g.fill();
      p.fabric(g, W * 0.32, H * 0.08, W * 0.36, H * 0.14, 4, '#2c2f33');         // seat
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.3, H * 0.3); g.lineTo(W * 0.7, H * 0.3); g.stroke(); // handlebar
    } },
  { id: 'weightbench', name: 'Weight Bench', cat: 'Gym', w: 1, h: 2, colors: ['#3a3f47', '#7a4a3e', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, W * 0.3, H * 0.2, W * 0.4, H * 0.6, 4, '#2c2f33');             // pad
      g.strokeStyle = c; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W * 0.2, H * 0.12); g.lineTo(W * 0.8, H * 0.12); g.stroke(); // barbell
      g.fillStyle = '#22252a';
      g.beginPath(); g.arc(W * 0.18, H * 0.12, 6, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.82, H * 0.12, 6, 0, 7); g.fill();               // plates
      g.fillStyle = c;
      g.fillRect(W * 0.42, H * 0.8, W * 0.16, H * 0.14);                         // foot
    } },
  { id: 'dumbbells', name: 'Dumbbell Rack', cat: 'Gym', w: 2, h: 1, colors: ['#3a3f47', '#5b5f6b', '#2f333a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 6, W - 10, H - 12, 3, HP.shade(c, 0.9));                       // rack
      g.strokeStyle = HP.shade(c, 0.55); P().RR(g, 5, 6, W - 10, H - 12, 3); g.stroke();
      for (let i = 0; i < 4; i++) {                                              // dumbbell pairs
        const x = W * (0.16 + i * 0.22);
        g.fillStyle = '#22252a';
        g.beginPath(); g.arc(x, H * 0.35, 4, 0, 7); g.fill();
        g.beginPath(); g.arc(x + 10, H * 0.35, 4, 0, 7); g.fill();
        g.strokeStyle = '#555c66'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, H * 0.35); g.lineTo(x + 10, H * 0.35); g.stroke();
        g.beginPath(); g.arc(x, H * 0.68, 5, 0, 7); g.fill();
        g.beginPath(); g.arc(x + 10, H * 0.68, 5, 0, 7); g.fill();
        g.beginPath(); g.moveTo(x, H * 0.68); g.lineTo(x + 10, H * 0.68); g.stroke();
      }
    } },
  { id: 'yogamat', name: 'Yoga Mat', cat: 'Gym', w: 1, h: 2, colors: ['#8a5d8a', '#5d8a8a', '#8a8a5d'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 6, 4, W - 12, H - 8, 4, c);
      g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(8, H * 0.2); g.lineTo(W - 8, H * 0.2); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.55, W * 0.14, 0, 7); g.stroke();         // mandala hint
    } },
  { id: 'punchbag', name: 'Punching Bag', cat: 'Gym', w: 1, h: 1, colors: ['#7a3a3f', '#3a3f47', '#6d5a45'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 2;                                // chain
      g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W / 2, H * 0.28); g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.3, H * 0.36, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.2, H * 0.2, W * 0.6, H * 0.7, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;
      g.beginPath(); g.moveTo(W * 0.24, H * 0.45); g.lineTo(W * 0.76, H * 0.45); g.stroke();
    } },

  /* ---------------- UTILITY ---------------- */
  { id: 'workbench', name: 'Workbench', cat: 'Utility', w: 3, h: 1, colors: ['#8a6844', '#5b5f6b', '#6d5a45'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 5, W - 8, H - 10, c);
      g.fillStyle = '#8b939c';                                                   // vice
      g.fillRect(W - 20, 8, 12, 10);
      g.fillStyle = '#b8bec6'; g.fillRect(W - 22, 10, 4, 6);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;                         // tool outlines
      g.beginPath(); g.moveTo(W * 0.15, H * 0.3); g.lineTo(W * 0.35, H * 0.3); g.stroke();
      g.strokeRect(W * 0.15, H * 0.55, W * 0.15, H * 0.25);
      g.fillStyle = '#e8c832'; g.fillRect(W * 0.45, H * 0.55, W * 0.1, H * 0.25); // drill
    } },
  { id: 'shelfunit', name: 'Storage Shelf', cat: 'Utility', w: 2, h: 1, colors: ['#7c858c', '#8a6844', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 2, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H * 0.38); g.lineTo(W - 6, H * 0.38); g.stroke();
      g.beginPath(); g.moveTo(6, H * 0.68); g.lineTo(W - 6, H * 0.68); g.stroke();
      const bx = ['#b0906a', '#a8a294', '#8b9cae'];
      for (let i = 0; i < 3; i++) {                                              // boxes on shelves
        g.fillStyle = bx[i];
        g.fillRect(W * (0.12 + i * 0.28), H * 0.45, W * 0.2, H * 0.18);
      }
      g.fillStyle = '#b0906a'; g.fillRect(W * 0.2, H * 0.12, W * 0.22, H * 0.2);
      g.fillStyle = '#8b9cae'; g.fillRect(W * 0.55, H * 0.12, W * 0.22, H * 0.2);
    } },
  { id: 'bicycle', name: 'Bicycle', cat: 'Utility', w: 1, h: 2, colors: ['#3a3f47', '#7a4a3e', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2;                         // wheels
      g.beginPath(); g.arc(W / 2, H * 0.2, W * 0.3, 0, 7); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.8, W * 0.3, 0, 7); g.stroke();
      g.strokeStyle = c; g.lineWidth = 2.5;                                      // frame
      g.beginPath();
      g.moveTo(W / 2, H * 0.2); g.lineTo(W / 2, H * 0.55);
      g.lineTo(W / 2, H * 0.8);
      g.moveTo(W / 2, H * 0.55); g.lineTo(W / 2, H * 0.35); g.stroke();
      g.fillStyle = '#22252a';
      g.fillRect(W * 0.3, H * 0.5, W * 0.4, 4);                                  // saddle
      g.strokeStyle = c; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.25, H * 0.16); g.lineTo(W * 0.75, H * 0.16); g.stroke(); // handlebar
    } },
  { id: 'ironboard', name: 'Ironing Board', cat: 'Utility', w: 1, h: 2, colors: ['#a8b8c8', '#d8c8b8', '#c8a8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                             // board shape (tapered)
      g.moveTo(W * 0.2, H * 0.1); g.lineTo(W * 0.8, H * 0.1);
      g.lineTo(W * 0.68, H * 0.85); g.lineTo(W * 0.32, H * 0.85); g.closePath();
      g.fillStyle = p.lg(g, W * 0.2, H * 0.1, W * 0.6, H * 0.75, HP.shade(c, 1.1), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#7c858c'; g.lineWidth = 2;                                // legs X
      g.beginPath(); g.moveTo(W * 0.3, H * 0.75); g.lineTo(W * 0.7, H * 0.92);
      g.moveTo(W * 0.7, H * 0.75); g.lineTo(W * 0.3, H * 0.92); g.stroke();
    } },

  /* ---------------- OUTDOOR extras ---------------- */
  { id: 'pool', name: 'Pool', cat: 'Outdoor', w: 4, h: 6, colors: ['#4da8cc', '#58b8d8', '#3f98bc'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 2, 2, W - 4, H - 4, 8, '#d8d2c6');                                // coping
      const wg = p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.25), HP.shade(c, 0.85));
      p.box(g, 6, 6, W - 12, H - 12, 5, wg);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5;                 // water shimmer
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(14, 16 + i * (H - 32) / 4);
        g.quadraticCurveTo(W / 2, 10 + i * (H - 32) / 4, W - 14, 16 + i * (H - 32) / 4);
        g.stroke();
      }
      g.strokeStyle = '#8b939c'; g.lineWidth = 2;                                // ladder
      g.beginPath(); g.moveTo(W - 16, 8); g.lineTo(W - 16, 20); g.stroke();
      g.beginPath(); g.moveTo(W - 10, 8); g.lineTo(W - 10, 20); g.stroke();
    } },
  { id: 'hottub', name: 'Hot Tub', cat: 'Outdoor', w: 2, h: 2, colors: ['#8a6844', '#5b5f6b', '#3f3a34'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.38, 0, 7);
      g.fillStyle = p.lg(g, W * 0.15, H * 0.15, W * 0.7, H * 0.7, '#6ec8e0', '#3f98bc'); g.fill();
      g.strokeStyle = '#2e7888'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)';                                      // bubbles
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8, r = Math.min(W, H) * 0.25;
        g.beginPath(); g.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 2.5, 0, 7); g.fill();
      }
    } },
  { id: 'parasol', name: 'Parasol', cat: 'Outdoor', w: 2, h: 2, colors: ['#e8a05a', '#7ba3b8', '#e8e0d0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4;
      for (let i = 0; i < 8; i++) {                                              // segments
        g.beginPath(); g.moveTo(cx, cy);
        g.arc(cx, cy, r, i * Math.PI / 4, (i + 1) * Math.PI / 4); g.closePath();
        g.fillStyle = i % 2 ? c : HP.shade(c, 1.18); g.fill();
      }
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fillStyle = '#6b4f33'; g.fill();  // pole
    } },
  { id: 'planter', name: 'Planter Box', cat: 'Outdoor', w: 2, h: 1, colors: ['#8a6844', '#5b5f6b', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 6, W - 8, H - 12, c);
      g.fillStyle = '#4a3828'; g.fillRect(8, 10, W - 16, H - 20);                // soil
      for (let i = 0; i < 3; i++)
        p.leaves(g, W * (0.2 + i * 0.3), H / 2, W * 0.12, '#5d8a50', 5);
    } },
  { id: 'tree', name: 'Tree', cat: 'Outdoor', w: 2, h: 2, colors: ['#4e7d45', '#5d8a50', '#3f6d55'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.44, 0, 7);
      g.fillStyle = HP.shade(c, 0.85); g.fill();
      for (let i = 0; i < 10; i++) {                                             // foliage blobs
        const a = i * 0.63, r = Math.min(W, H) * 0.28;
        g.beginPath(); g.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, Math.min(W, H) * 0.16, 0, 7);
        g.fillStyle = HP.shade(c, 0.95 + (i % 3) * 0.08); g.fill();
      }
      g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.1, 0, 7);
      g.fillStyle = '#6b4f33'; g.fill();                                         // trunk
    } },
  { id: 'hedge', name: 'Hedge', cat: 'Outdoor', w: 2, h: 1, colors: ['#4e7d45', '#3f6d55', '#5d8a50'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, 8, W - 6, H - 16, 8, p.lg(g, 3, 8, W - 6, H - 16, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      P().RR(g, 3, 8, W - 6, H - 16, 8); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(W * i / 5, 10); g.lineTo(W * i / 5, H - 10); g.stroke(); }
    } },
  { id: 'fountain', name: 'Fountain', cat: 'Outdoor', w: 2, h: 2, colors: ['#a8a294', '#8b93a0', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.44;
      g.beginPath(); g.arc(cx, cy, r, 0, 7);
      g.fillStyle = p.lg(g, cx - r, cy - r, r * 2, r * 2, HP.shade(c, 1.1), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.75, 0, 7);
      g.fillStyle = '#5eb8d8'; g.fill();                                         // water
      g.beginPath(); g.arc(cx, cy, r * 0.3, 0, 7);
      g.fillStyle = HP.shade(c, 0.9); g.fill();                                  // center column
      g.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 6; i++) {                                              // spray
        const a = i * Math.PI / 3;
        g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, 2, 0, 7); g.fill();
      }
    } },
  { id: 'firepit', name: 'Fire Pit', cat: 'Outdoor', w: 1, h: 1, colors: ['#6d5a45', '#5b5f6b', '#8a6f5c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2;
      g.beginPath(); g.arc(cx, cy, W * 0.4, 0, 7);
      g.fillStyle = HP.shade(c, 0.85); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, cy, W * 0.26, 0, 7);
      g.fillStyle = '#2a2018'; g.fill();
      const fg = g.createRadialGradient(cx, cy, 1, cx, cy, W * 0.22);
      fg.addColorStop(0, '#ffb74d'); fg.addColorStop(1, 'rgba(255,100,40,.15)');
      g.fillStyle = fg; g.beginPath(); g.arc(cx, cy, W * 0.2, 0, 7); g.fill();
    } },
  { id: 'swingset', name: 'Swing Set', cat: 'Outdoor', w: 3, h: 2, colors: ['#8a6844', '#5b5f6b', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 3;                                        // frame
      g.beginPath(); g.moveTo(8, 8); g.lineTo(8, H - 8); g.stroke();
      g.beginPath(); g.moveTo(W - 8, 8); g.lineTo(W - 8, H - 8); g.stroke();
      g.beginPath(); g.moveTo(8, 8); g.lineTo(W - 8, 8); g.stroke();             // top bar
      [0.35, 0.65].forEach(f => {                                                // swings
        g.strokeStyle = '#555c66'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(W * f - 6, 10); g.lineTo(W * f - 6, H * 0.5); g.stroke();
        g.beginPath(); g.moveTo(W * f + 6, 10); g.lineTo(W * f + 6, H * 0.5); g.stroke();
        g.fillStyle = '#3a3f47'; g.fillRect(W * f - 8, H * 0.5, 16, 6);          // seat
      });
    } },
  { id: 'sandbox', name: 'Sandbox', cat: 'Outdoor', w: 2, h: 2, colors: ['#e8d8a8', '#d8c898', '#c8b888'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, '#8a6844');
      p.box(g, 8, 8, W - 16, H - 16, 3, p.lg(g, 8, 8, W - 16, H - 16, HP.shade(c, 1.1), c));
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (let i = 0; i < 12; i++) {                                             // sand speckle
        g.beginPath(); g.arc(12 + (i * 29) % (W - 24), 12 + (i * 17) % (H - 24), 1.5, 0, 7); g.fill();
      }
      g.fillStyle = '#e05252'; g.fillRect(W * 0.3, H * 0.35, 8, 8);              // bucket
      g.fillStyle = '#4060b0'; g.beginPath(); g.arc(W * 0.65, H * 0.6, 5, 0, 7); g.fill(); // ball
    } },
  { id: 'doghouse', name: 'Dog House', cat: 'Outdoor', w: 1, h: 1, colors: ['#8a6844', '#a06558', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 6, 8, W - 12, H - 12, c);
      g.fillStyle = HP.shade(c, 0.7);                                            // roof ridge
      g.beginPath(); g.moveTo(6, H * 0.3); g.lineTo(W / 2, 4); g.lineTo(W - 6, H * 0.3); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H * 0.3); g.lineTo(W / 2, 4); g.lineTo(W - 6, H * 0.3); g.stroke();
      g.fillStyle = '#2a2018';                                                   // doorway
      g.beginPath(); g.arc(W / 2, H * 0.68, W * 0.18, Math.PI, 0); g.fill();
      g.fillRect(W / 2 - W * 0.18, H * 0.68, W * 0.36, H * 0.14);
    } },
  { id: 'hammock', name: 'Hammock', cat: 'Outdoor', w: 1, h: 3, colors: ['#e8d8c0', '#a0c8e8', '#a8d8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#6b4f33';                                                   // posts
      g.beginPath(); g.arc(W / 2, 8, 5, 0, 7); g.fill();
      g.beginPath(); g.arc(W / 2, H - 8, 5, 0, 7); g.fill();
      g.beginPath();                                                             // fabric sling
      g.moveTo(W / 2, 12);
      g.quadraticCurveTo(W * 0.95, H / 2, W / 2, H - 12);
      g.quadraticCurveTo(W * 0.05, H / 2, W / 2, 12);
      g.fillStyle = p.lg(g, W * 0.1, 12, W * 0.8, H - 24, HP.shade(c, 1.1), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;                        // weave
      for (let i = 1; i < 6; i++) {
        g.beginPath(); g.moveTo(W * 0.3, H * i / 6); g.lineTo(W * 0.7, H * i / 6); g.stroke();
      }
    } },
  { id: 'car', name: 'Car', cat: 'Outdoor', w: 2, h: 4, colors: ['#7a8ca8', '#a05050', '#4a4f57', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.shadow(g, 4, 4, W - 8, H - 8, 12);
      p.box(g, 4, 4, W - 8, H - 8, 14, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; P().RR(g, 4, 4, W - 8, H - 8, 14); g.stroke();
      p.box(g, 8, H * 0.2, W - 16, H * 0.18, 5, '#2a3540');                      // windshield
      p.box(g, 8, H * 0.72, W - 16, H * 0.14, 5, '#2a3540');                     // rear window
      p.box(g, 10, H * 0.42, W - 20, H * 0.24, 6, HP.shade(c, 1.05));            // roof
      g.fillStyle = '#1b1e22';                                                   // wheels
      [[4, H * 0.16], [W - 4, H * 0.16], [4, H * 0.8], [W - 4, H * 0.8]].forEach(pt =>
        g.fillRect(pt[0] - 3, pt[1] - 6, 6, 12));
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(6, 6, 8, H - 12);         // sheen
    } },
  { id: 'wbins', name: 'Wheelie Bins', cat: 'Outdoor', w: 1, h: 1, colors: ['#4a6b4a', '#3a4a6b', '#6b6b3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.08, H * 0.15, W * 0.36, H * 0.7, 3, p.lg(g, W * 0.08, H * 0.15, W * 0.36, H * 0.7, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      p.box(g, W * 0.54, H * 0.15, W * 0.36, H * 0.7, 3, p.lg(g, W * 0.54, H * 0.15, W * 0.36, H * 0.7, HP.shade(c, 1.25), HP.shade(c, 0.95)));
      g.fillStyle = HP.shade(c, 0.6);
      g.fillRect(W * 0.08, H * 0.15, W * 0.36, H * 0.12);
      g.fillRect(W * 0.54, H * 0.15, W * 0.36, H * 0.12);                        // lids
    } },

  /* ---------------- LIVING extras 2 ---------------- */
  { id: 'runner', name: 'Runner Rug', cat: 'Living', w: 1, h: 3, colors: ['#a06558', '#7d8fa3', '#8a7ba0'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 3, W - 8, H - 6, 4, c);
      g.strokeStyle = HP.shade(c, 0.78); g.lineWidth = 2;
      P().RR(g, 8, 8, W - 16, H - 16, 3); g.stroke();
      g.strokeStyle = HP.shade(c, 1.15); g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(9, H * i / 5); g.lineTo(W - 9, H * i / 5); g.stroke(); }
    } },
  { id: 'clock', name: 'Grandfather Clock', cat: 'Living', w: 1, h: 1, colors: ['#6f543c', '#3f3a34', '#8a6844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.22, 4, W * 0.56, H - 8, c);
      g.beginPath(); g.arc(W / 2, H * 0.25, W * 0.18, 0, 7);
      g.fillStyle = '#f0e8d8'; g.fill();
      g.strokeStyle = '#3a2e22'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(W / 2, H * 0.25); g.lineTo(W / 2 + W * 0.09, H * 0.2); g.stroke();
      g.beginPath(); g.moveTo(W / 2, H * 0.25); g.lineTo(W / 2, H * 0.14); g.stroke();
      g.fillStyle = HP.shade(c, 0.5); g.fillRect(W * 0.3, H * 0.5, W * 0.4, H * 0.4); // pendulum window
      g.fillStyle = '#c9a44e'; g.fillRect(W / 2 - 2, H * 0.52, 4, H * 0.28);
    } },
  { id: 'statue', name: 'Sculpture', cat: 'Living', w: 1, h: 1, colors: ['#d8d2c6', '#a8a294', '#8b8b83'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.2, H * 0.7, W * 0.6, H * 0.25, 2, HP.shade(c, 0.85));        // plinth
      g.beginPath();
      g.moveTo(W * 0.35, H * 0.7);
      g.quadraticCurveTo(W * 0.15, H * 0.35, W * 0.5, H * 0.2);
      g.quadraticCurveTo(W * 0.85, H * 0.3, W * 0.6, H * 0.7);
      g.closePath();
      g.fillStyle = p.lg(g, W * 0.2, H * 0.2, W * 0.6, H * 0.5, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
    } },
  { id: 'vase', name: 'Floor Vase', cat: 'Living', w: 1, h: 1, colors: ['#7ba3b8', '#b08a6a', '#5d6a5a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.28, H * 0.34, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.2, H * 0.3, W * 0.6, H * 0.6, HP.shade(c, 1.2), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      p.leaves(g, W / 2, H * 0.22, W * 0.2, '#5d8a50', 6);                        // branches
    } },
  { id: 'umbstand', name: 'Umbrella Stand', cat: 'Living', w: 1, h: 1, colors: ['#454a52', '#8a6844', '#7ba3b8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.28, H * 0.3, 0, 0, 7);
      g.fillStyle = HP.shade(c, 0.9); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2; g.stroke();
      const uc = ['#e05252', '#4060b0', '#5d8a5d'];
      uc.forEach((u, i) => {
        g.strokeStyle = u; g.lineWidth = 3;
        const x = W * (0.32 + i * 0.18);
        g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x, H * 0.62); g.stroke();
      });
    } },
  { id: 'china', name: 'China Cabinet', cat: 'Kitchen', w: 3, h: 1, colors: ['#8a6844', '#4a4f57', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      p.box(g, 7, 7, W - 14, H - 14, 2, p.lg(g, 7, 7, W - 14, H - 14, '#dcebf4', '#9cb8cc')); // glass
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(7 + i * (W - 14) / 3, 7); g.lineTo(7 + i * (W - 14) / 3, H - 7); g.stroke(); }
      g.fillStyle = '#eef3f6';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * (0.16 + i * 0.22), H * 0.55, 4, 0, 7); g.fill(); } // plates
    } },

  /* ---------------- KIDS extras ---------------- */
  { id: 'changetable', name: 'Changing Table', cat: 'Kids', w: 2, h: 1, colors: ['#d8c8b0', '#b8c8d8', '#d8b8c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 5, W - 8, H - 10, c);
      p.fabric(g, 8, 8, W - 16, H * 0.5, 5, '#f5f0e6');                           // pad
      g.fillStyle = '#e8b8b0'; g.fillRect(W * 0.4, 10, W * 0.2, H * 0.3);
      g.fillStyle = '#a8c8d8'; g.fillRect(W * 0.15, H * 0.7, W * 0.7, H * 0.2);   // supplies bin
    } },
  { id: 'highchair', name: 'High Chair', cat: 'Kids', w: 1, h: 1, colors: ['#d8b06a', '#a0c8e8', '#e8a0a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2.5;                        // legs
      [[0.3, 0.75], [0.7, 0.75]].forEach(pt => {
        g.beginPath(); g.moveTo(W * pt[0], H * 0.5); g.lineTo(W * pt[0], H * pt[1]); g.stroke();
      });
      p.fabric(g, W * 0.18, H * 0.15, W * 0.64, H * 0.4, 5, c);                   // seat
      p.box(g, W * 0.14, H * 0.08, W * 0.72, H * 0.14, 3, HP.shade(c, 0.8));      // tray
    } },
  { id: 'easel', name: 'Art Easel', cat: 'Kids', w: 1, h: 1, colors: ['#d8b06a', '#8a6844', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2.5;                        // tripod legs
      g.beginPath(); g.moveTo(W / 2, H * 0.15); g.lineTo(W * 0.22, H * 0.9);
      g.moveTo(W / 2, H * 0.15); g.lineTo(W * 0.78, H * 0.9); g.stroke();
      p.box(g, W * 0.2, H * 0.2, W * 0.6, H * 0.45, 2, '#fff');                   // canvas
      g.strokeStyle = '#e05252'; g.lineWidth = 1.5;                               // doodle
      g.beginPath(); g.arc(W * 0.45, H * 0.4, W * 0.12, 0, 7); g.stroke();
      g.strokeStyle = '#4060b0';
      g.beginPath(); g.moveTo(W * 0.3, H * 0.55); g.lineTo(W * 0.7, H * 0.55); g.stroke();
    } },
  { id: 'rockhorse', name: 'Rocking Horse', cat: 'Kids', w: 1, h: 1, colors: ['#a4805c', '#a06558', '#7ba3b8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 3;                         // rocker
      g.beginPath(); g.arc(W / 2, H * 0.3, H * 0.55, 0.15, Math.PI - 0.15); g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.34, H * 0.2, 0, 0, 7);      // body
      g.fillStyle = p.lg(g, W * 0.2, H * 0.35, W * 0.6, H * 0.4, HP.shade(c, 1.1), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(W * 0.72, H * 0.38, W * 0.12, 0, 7); g.fill();         // head
      g.fillStyle = '#22252a'; g.beginPath(); g.arc(W * 0.75, H * 0.36, 2, 0, 7); g.fill();
    } },
  { id: 'dollhouse', name: 'Dollhouse', cat: 'Kids', w: 2, h: 1, colors: ['#d8b8c8', '#b8c8d8', '#d8c8b0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 5, W - 10, H - 10, 2, p.lg(g, 5, 5, W - 10, H - 10, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(W / 2, 5); g.lineTo(W / 2, H - 5); g.stroke();      // two rooms
      g.beginPath(); g.moveTo(5, H * 0.5); g.lineTo(W - 5, H * 0.5); g.stroke();
      g.fillStyle = '#a06558'; g.fillRect(W * 0.15, H * 0.15, W * 0.15, H * 0.15); // tiny furniture
      g.fillStyle = '#5d8a5d'; g.fillRect(W * 0.65, H * 0.6, W * 0.15, H * 0.15);
      g.fillStyle = '#3f3a34';                                                   // roof line
      g.fillRect(5, 5, W - 10, 3);
    } },

  /* ---------------- GARAGE ---------------- */
  { id: 'motorcycle', name: 'Motorcycle', cat: 'Garage', w: 1, h: 2, colors: ['#3a3f47', '#7a4a3e', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#1b1e22';                                                   // wheels
      g.beginPath(); g.ellipse(W / 2, H * 0.15, W * 0.22, H * 0.12, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W / 2, H * 0.85, W * 0.22, H * 0.12, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W / 2, H * 0.5, W * 0.26, H * 0.32, 0, 0, 7);      // body
      g.fillStyle = p.lg(g, W * 0.25, H * 0.2, W * 0.5, H * 0.6, HP.shade(c, 1.2), HP.shade(c, 0.75)); g.fill();
      g.fillStyle = '#2a3540'; g.fillRect(W * 0.35, H * 0.25, W * 0.3, H * 0.12); // windshield
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.25, H * 0.2); g.lineTo(W * 0.75, H * 0.2); g.stroke(); // handlebar
    } },
  { id: 'toolchest', name: 'Tool Chest', cat: 'Garage', w: 1, h: 1, colors: ['#a03a3a', '#3a5f8a', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 5, W - 12, H - 10, 3, p.lg(g, 6, 5, W - 12, H - 10, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(8, 5 + i * (H - 10) / 4); g.lineTo(W - 8, 5 + i * (H - 10) / 4); g.stroke(); }
      g.fillStyle = '#c9ced4';
      for (let i = 0; i < 4; i++) g.fillRect(W / 2 - 7, 8 + i * (H - 10) / 4, 14, 3); // handles
      g.fillStyle = '#222'; g.beginPath(); g.arc(9, H - 5, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W - 9, H - 5, 3, 0, 7); g.fill();                      // casters
    } },
  { id: 'tires', name: 'Tire Stack', cat: 'Garage', w: 1, h: 1, colors: ['#2c2f33', '#3a3f47', '#45494e'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(W / 2, H * (0.7 - i * 0.2), W * 0.32, 0, 7);
        g.fillStyle = HP.shade(c, 0.9 + i * 0.1); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.arc(W / 2, H * (0.7 - i * 0.2), W * 0.15, 0, 7);
        g.fillStyle = '#14161a'; g.fill();
      }
    } },
  { id: 'pegboard', name: 'Tool Wall', cat: 'Garage', w: 2, h: 1, colors: ['#8a6844', '#5b5f6b', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 6, W - 8, H - 12, HP.shade(c, 1.05));
      g.fillStyle = 'rgba(0,0,0,.2)';                                             // peg dots
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++)
        g.fillRect(10 + i * (W - 20) / 8, H * 0.3 + j * H * 0.3, 2, 2);
      g.strokeStyle = '#c9ced4'; g.lineWidth = 2;                                 // hanging tools
      g.beginPath(); g.moveTo(W * 0.25, H * 0.35); g.lineTo(W * 0.25, H * 0.65); g.stroke();
      g.beginPath(); g.arc(W * 0.25, H * 0.32, 4, 0, 7); g.stroke();              // wrench
      g.fillStyle = '#e8c832'; g.fillRect(W * 0.5, H * 0.35, W * 0.08, H * 0.3);  // hammer
      g.strokeStyle = '#555c66';
      g.beginPath(); g.moveTo(W * 0.75, H * 0.3); g.lineTo(W * 0.75, H * 0.7); g.stroke(); // saw
    } },
  { id: 'bball', name: 'Basketball Hoop', cat: 'Garage', w: 1, h: 1, colors: ['#3a3f47', '#7a4a3e', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H * 0.75, W * 0.22, 0, 7);                      // base
      g.fillStyle = HP.shade(c, 0.8); g.fill();
      g.strokeStyle = c; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W / 2, H * 0.75); g.lineTo(W / 2, H * 0.3); g.stroke();
      p.box(g, W * 0.22, H * 0.08, W * 0.56, H * 0.22, 2, '#eef2f5');             // backboard
      g.strokeStyle = '#e05252'; g.lineWidth = 2;
      g.beginPath(); g.arc(W / 2, H * 0.3, W * 0.12, 0, Math.PI); g.stroke();     // rim
    } },
  { id: 'evcharger', name: 'EV Charger', cat: 'Garage', w: 1, h: 1, colors: ['#4a6b8a', '#3a3f47', '#5d8a5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.25, H * 0.12, W * 0.5, H * 0.6, 4, p.lg(g, W * 0.25, H * 0.12, W * 0.5, H * 0.6, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.35, H * 0.22, W * 0.3, H * 0.15); // display
      g.strokeStyle = '#22252a'; g.lineWidth = 2.5;                               // cable loop
      g.beginPath(); g.arc(W / 2, H * 0.78, W * 0.22, 0, 7); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.78, W * 0.13, 0, 7); g.stroke();
    } },

  /* ---------------- GARDEN ---------------- */
  { id: 'greenhouse', name: 'Greenhouse', cat: 'Garden', w: 3, h: 4, colors: ['#a8c4b0', '#8fa8b8', '#b8c8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.shadow(g, 4, 4, W - 8, H - 8, 4);
      p.box(g, 4, 4, W - 8, H - 8, 4, 'rgba(190,215,195,.55)');                    // glass shell
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; P().RR(g, 4, 4, W - 8, H - 8, 4); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5;                   // glass glare
      g.beginPath(); g.moveTo(10, H - 10); g.lineTo(W * 0.4, 6); g.stroke();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1;                          // frame ribs
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(4 + i * (W - 8) / 4, 5); g.lineTo(4 + i * (W - 8) / 4, H - 5); g.stroke(); }
      g.beginPath(); g.moveTo(5, H * 0.5); g.lineTo(W - 5, H * 0.5); g.stroke();
      for (let i = 0; i < 2; i++) {                                              // plants inside
        p.leaves(g, W * (0.3 + i * 0.4), H * 0.3, W * 0.1, '#5d8a50', 5);
        p.leaves(g, W * (0.3 + i * 0.4), H * 0.72, W * 0.1, '#4e7d45', 5);
      }
      g.fillStyle = '#8a6844'; g.fillRect(W * 0.42, H - 12, W * 0.16, 8);          // door
    } },
  { id: 'shed', name: 'Garden Shed', cat: 'Garden', w: 3, h: 2, colors: ['#8a6844', '#5d6a5a', '#7a6a8c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2.5;                         // roof ridge
      g.beginPath(); g.moveTo(4, H / 2); g.lineTo(W - 4, H / 2); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;                          // roof planks
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(4 + i * (W - 8) / 6, 4); g.lineTo(4 + i * (W - 8) / 6, H - 4); g.stroke(); }
      p.box(g, W * 0.42, H * 0.55, W * 0.16, H * 0.4, 1, HP.shade(c, 0.6));        // door
      g.fillStyle = '#d8d2c6'; g.beginPath(); g.arc(W * 0.55, H * 0.75, 2, 0, 7); g.fill();
    } },
  { id: 'potting', name: 'Potting Bench', cat: 'Garden', w: 2, h: 1, colors: ['#8a6844', '#5d6a5a', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 5, W - 8, H - 10, c);
      g.fillStyle = '#4a3828'; g.fillRect(W * 0.12, H * 0.2, W * 0.3, H * 0.35);   // soil tray
      const pc2 = ['#c98a5e', '#96582f', '#b07040'];
      pc2.forEach((pc, i) => {                                                    // pots
        g.fillStyle = pc;
        g.beginPath(); g.arc(W * (0.55 + i * 0.15), H * 0.35, W * 0.06, 0, 7); g.fill();
      });
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.15, H * 0.65, W * 0.25, H * 0.15); // tools/trowel
      p.leaves(g, W * 0.68, H * 0.72, W * 0.12, '#5d8a50', 5);
    } },
  { id: 'growshelf', name: 'Grow Shelf', cat: 'Garden', w: 2, h: 1, colors: ['#5b5f6b', '#8a6844', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 2, HP.shade(c, 0.95));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H * 0.36); g.lineTo(W - 6, H * 0.36); g.stroke();
      g.beginPath(); g.moveTo(6, H * 0.68); g.lineTo(W - 6, H * 0.68); g.stroke();
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#8a6844'; g.fillRect(W * (0.12 + i * 0.3), H * 0.42, W * 0.22, H * 0.18); // trays
        p.leaves(g, W * (0.23 + i * 0.3), H * 0.48, W * 0.06, '#6d9c5f', 4);
      }
      g.fillStyle = '#e8f0e0'; g.fillRect(W * 0.15, H * 0.12, W * 0.7, H * 0.1);   // grow light
    } },
  { id: 'seedlings', name: 'Seedling Trays', cat: 'Garden', w: 1, h: 1, colors: ['#5d8a50', '#4e7d45', '#6d9c5f'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 6, W - 10, H - 12, 3, '#4a3828');                                // tray
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = '#2e2418';
        g.fillRect(W * (0.14 + i * 0.28), H * (0.18 + j * 0.4), W * 0.2, H * 0.28);
        g.strokeStyle = c; g.lineWidth = 2;                                       // sprouts
        g.beginPath(); g.moveTo(W * (0.24 + i * 0.28), H * (0.32 + j * 0.4));
        g.lineTo(W * (0.24 + i * 0.28), H * (0.24 + j * 0.4)); g.stroke();
      }
    } },
  { id: 'tomato', name: 'Tomato Plant', cat: 'Garden', w: 1, h: 1, colors: ['#5d8a50', '#4e7d45', '#6d9c5f'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.pot(g, W / 2, H * 0.72, W * 0.22);
      p.leaves(g, W / 2, H * 0.38, W * 0.26, c, 7);
      g.fillStyle = '#e05252';                                                    // tomatoes
      [[0.35, 0.3], [0.62, 0.42], [0.5, 0.22], [0.42, 0.5]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], 3.5, 0, 7); g.fill();
      });
    } },
  { id: 'flowerbed', name: 'Flower Bed', cat: 'Garden', w: 2, h: 1, colors: ['#e8a0b8', '#b8a0e8', '#f0d090'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 6, W - 8, H - 12, '#8a6844');
      g.fillStyle = '#4a3828'; g.fillRect(8, 10, W - 16, H - 20);
      const fc = [c, '#e05252', '#f0d090', '#b8a0e8'];
      for (let i = 0; i < 4; i++) {
        const x = W * (0.16 + i * 0.22);
        g.fillStyle = fc[i % fc.length];
        for (let p2 = 0; p2 < 5; p2++) {
          const a = p2 * Math.PI * 2 / 5;
          g.beginPath(); g.arc(x + Math.cos(a) * 3.5, H / 2 + Math.sin(a) * 3.5, 2.5, 0, 7); g.fill();
        }
        g.fillStyle = '#e8c832';
        g.beginPath(); g.arc(x, H / 2, 2, 0, 7); g.fill();
      }
    } },
  { id: 'compost', name: 'Compost Bin', cat: 'Garden', w: 1, h: 1, colors: ['#4a3f34', '#3f4a34', '#5b4a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 5, W - 12, H - 10, 4, p.lg(g, 6, 5, W - 12, H - 10, HP.shade(c, 1.1), HP.shade(c, 0.75)));
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1;
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(7, 5 + i * (H - 10) / 3); g.lineTo(W - 7, 5 + i * (H - 10) / 3); g.stroke(); }
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(9, 8, W - 18, 5);                 // lid
      g.fillStyle = '#6d8a4d'; g.fillRect(W * 0.3, H * 0.55, W * 0.4, H * 0.15);   // green scraps
    } },
  { id: 'rainbarrel', name: 'Rain Barrel', cat: 'Garden', w: 1, h: 1, colors: ['#4a6b8a', '#5d6a5a', '#6d5a45'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.34, H * 0.4, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.32, W * 0.26, H * 0.14, 0, 0, 7);      // top opening
      g.fillStyle = '#3a5a78'; g.fill();
      g.fillStyle = '#c9a44e'; g.fillRect(W * 0.46, H * 0.62, W * 0.08, H * 0.12); // tap
    } },
  { id: 'wheelbarrow', name: 'Wheelbarrow', cat: 'Garden', w: 1, h: 2, colors: ['#5d8a5d', '#a06558', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H * 0.85, W * 0.14, 0, 7);                       // wheel
      g.fillStyle = '#22252a'; g.fill();
      g.strokeStyle = '#555c66'; g.lineWidth = 2; g.stroke();
      g.beginPath();                                                              // bucket (trapezoid)
      g.moveTo(W * 0.2, H * 0.15); g.lineTo(W * 0.8, H * 0.15);
      g.lineTo(W * 0.68, H * 0.75); g.lineTo(W * 0.32, H * 0.75); g.closePath();
      g.fillStyle = p.lg(g, W * 0.2, H * 0.15, W * 0.6, H * 0.6, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#4a3828';                                                    // soil inside
      g.beginPath(); g.ellipse(W / 2, H * 0.4, W * 0.22, H * 0.22, 0, 0, 7); g.fill();
      g.strokeStyle = '#8a6844'; g.lineWidth = 2;                                 // handles
      g.beginPath(); g.moveTo(W * 0.3, H * 0.15); g.lineTo(W * 0.28, H * 0.02); g.stroke();
      g.beginPath(); g.moveTo(W * 0.7, H * 0.15); g.lineTo(W * 0.72, H * 0.02); g.stroke();
    } },
  { id: 'mower', name: 'Lawn Mower', cat: 'Garden', w: 1, h: 1, colors: ['#5d8a5d', '#a06558', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#22252a';                                                    // wheels
      [[0.2, 0.25], [0.8, 0.25], [0.2, 0.72], [0.8, 0.72]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.09, 0, 7); g.fill();
      });
      p.box(g, W * 0.24, H * 0.2, W * 0.52, H * 0.55, 4,
        p.lg(g, W * 0.24, H * 0.2, W * 0.52, H * 0.55, HP.shade(c, 1.15), HP.shade(c, 0.75))); // deck
      g.fillStyle = '#3a3f47'; g.fillRect(W * 0.38, H * 0.32, W * 0.24, H * 0.2);  // engine
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.3, H * 0.2); g.lineTo(W * 0.22, H * 0.02); g.stroke(); // handle
      g.beginPath(); g.moveTo(W * 0.7, H * 0.2); g.lineTo(W * 0.78, H * 0.02); g.stroke();
    } },
  { id: 'clothesline', name: 'Clothesline', cat: 'Garden', w: 2, h: 1, colors: ['#dfe5ea', '#a8b8c8', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#555c66';
      g.fillRect(8, H * 0.1, 4, H * 0.8); g.fillRect(W - 12, H * 0.1, 4, H * 0.8); // posts
      g.strokeStyle = '#8b939c'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(8, H * 0.35); g.lineTo(W - 8, H * 0.35); g.stroke();
      g.beginPath(); g.moveTo(8, H * 0.55); g.lineTo(W - 8, H * 0.55); g.stroke();
      const cl = ['#e8ecf0', '#a8c8d8', '#f0d090', '#e8a0a8'];
      cl.forEach((k, i) => {                                                      // hanging clothes
        g.fillStyle = k;
        g.fillRect(W * (0.18 + i * 0.2), H * (i % 2 ? 0.55 : 0.35), W * 0.14, H * 0.3);
      });
    } },
  { id: 'firewood', name: 'Firewood Stack', cat: 'Garden', w: 1, h: 1, colors: ['#8a6844', '#6b4f33', '#a4805c'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      const rows = [[0.28, 0.75], [0.5, 0.75], [0.72, 0.75], [0.38, 0.5], [0.62, 0.5], [0.5, 0.28]];
      rows.forEach((pt, i) => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.13, 0, 7);
        g.fillStyle = HP.shade(c, 0.85 + (i % 3) * 0.1); g.fill();
        g.strokeStyle = '#4a3828'; g.lineWidth = 1; g.stroke();
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.06, 0, 7);
        g.strokeStyle = '#6b5335'; g.stroke();
      });
    } },
  { id: 'garch', name: 'Garden Arch', cat: 'Garden', w: 2, h: 1, colors: ['#8a6844', '#5b5f6b', '#5d8a50'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 4;
      g.beginPath(); g.moveTo(W * 0.2, H * 0.9); g.lineTo(W * 0.2, H * 0.1); g.stroke();
      g.beginPath(); g.moveTo(W * 0.8, H * 0.9); g.lineTo(W * 0.8, H * 0.1); g.stroke();
      g.beginPath(); g.moveTo(W * 0.2, H * 0.1); g.lineTo(W * 0.8, H * 0.1); g.stroke();
      p.leaves(g, W * 0.28, H * 0.14, W * 0.09, '#5d8a50', 5);                    // climbing roses
      p.leaves(g, W * 0.55, H * 0.1, W * 0.1, '#4e7d45', 5);
      g.fillStyle = '#e8a0b8';
      g.beginPath(); g.arc(W * 0.38, H * 0.12, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.68, H * 0.1, 3, 0, 7); g.fill();
    } },
  { id: 'birdbath', name: 'Bird Bath', cat: 'Garden', w: 1, h: 1, colors: ['#a8a294', '#8b93a0', '#d8d2c6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.85, W * 0.16, H * 0.1, 0, 0, 7);      // base
      g.fillStyle = HP.shade(c, 0.8); g.fill();
      g.fillStyle = HP.shade(c, 0.85); g.fillRect(W * 0.44, H * 0.4, W * 0.12, H * 0.45); // column
      g.beginPath(); g.ellipse(W / 2, H * 0.35, W * 0.34, H * 0.2, 0, 0, 7);       // bowl
      g.fillStyle = p.lg(g, W * 0.2, H * 0.2, W * 0.6, H * 0.3, HP.shade(c, 1.1), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.33, W * 0.24, H * 0.12, 0, 0, 7);      // water
      g.fillStyle = '#5eb8d8'; g.fill();
    } },
  { id: 'mailbox', name: 'Mailbox', cat: 'Garden', w: 1, h: 1, colors: ['#a05050', '#4a6b8a', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#555c66'; g.fillRect(W * 0.46, H * 0.45, W * 0.08, H * 0.5);  // post
      p.box(g, W * 0.24, H * 0.15, W * 0.52, H * 0.34, 6,
        p.lg(g, W * 0.24, H * 0.15, W * 0.52, H * 0.34, HP.shade(c, 1.15), HP.shade(c, 0.75))); // box
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(W * 0.24, H * 0.28, W * 0.52, 3); // slot
      g.fillStyle = '#e8c832'; g.fillRect(W * 0.68, H * 0.18, W * 0.06, H * 0.14); // flag
    } },
  { id: 'trampoline', name: 'Trampoline', cat: 'Garden', w: 2, h: 2, colors: ['#3a4a6b', '#4a6b8a', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.44;
      g.beginPath(); g.arc(cx, cy, r, 0, 7);                                       // frame+net pad
      g.fillStyle = HP.shade(c, 1.1); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.72, 0, 7);                                // mat
      g.fillStyle = '#2c3038'; g.fill();
      g.strokeStyle = '#e05252'; g.lineWidth = 1.5; g.stroke();                    // springs ring
      g.strokeStyle = 'rgba(255,255,255,.25)';
      g.beginPath(); g.moveTo(cx - r * 0.4, cy); g.lineTo(cx + r * 0.4, cy); g.stroke();
      g.beginPath(); g.moveTo(cx, cy - r * 0.4); g.lineTo(cx, cy + r * 0.4); g.stroke();
    } },
  { id: 'picnic', name: 'Picnic Table', cat: 'Garden', w: 2, h: 2, colors: ['#9a774f', '#6b4f33', '#8a8a80'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.1, H * 0.3, W * 0.8, H * 0.4, c);                            // tabletop
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.1 + i * W * 0.2, H * 0.32); g.lineTo(W * 0.1 + i * W * 0.2, H * 0.68); g.stroke(); }
      p.wood(g, W * 0.12, H * 0.08, W * 0.76, H * 0.12, HP.shade(c, 0.85));        // benches
      p.wood(g, W * 0.12, H * 0.8, W * 0.76, H * 0.12, HP.shade(c, 0.85));
    } },
  { id: 'poolfloat', name: 'Pool Float', cat: 'Garden', w: 1, h: 1, colors: ['#e8a0b8', '#a0d8e8', '#f0d090'], walkable: true,
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.38, 0, 7);
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.18, 0, 7);
      g.fillStyle = 'rgba(120,190,220,.9)'; g.fill();                              // hole (water shows)
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 1.5; g.stroke();
    } },

  /* ---------------- GAMES ---------------- */
  { id: 'pingpong', name: 'Ping Pong', cat: 'Games', w: 5, h: 3, colors: ['#3f6d8a', '#3f6d55', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 4, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.strokeStyle = '#eef2f5'; g.lineWidth = 1.5;
      P().RR(g, 8, 8, W - 16, H - 16, 2); g.stroke();                              // boundary lines
      g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W / 2, H - 4); g.stroke();       // net line
      g.strokeStyle = '#c9ced4'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W / 2, 6); g.lineTo(W / 2, H - 6); g.stroke();
      g.fillStyle = '#e08040'; g.beginPath(); g.arc(W * 0.3, H * 0.4, 3, 0, 7); g.fill(); // ball
      g.fillStyle = '#a03a3a'; g.beginPath(); g.arc(W * 0.72, H * 0.62, 5, 0, 7); g.fill(); // paddle
    } },
  { id: 'foosball', name: 'Foosball', cat: 'Games', w: 3, h: 2, colors: ['#6b4f33', '#3a3f47', '#5d6a5a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 3, 3, W - 6, H - 6, c);
      p.box(g, 10, 8, W - 20, H - 16, 3, '#4e7d45');                               // pitch
      g.strokeStyle = '#eef2f5'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2, 9); g.lineTo(W / 2, H - 9); g.stroke();
      for (let i = 0; i < 4; i++) {                                                // rods
        const x = W * (0.25 + i * 0.17);
        g.strokeStyle = '#c9ced4'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 4); g.lineTo(x, H - 4); g.stroke();
        g.fillStyle = i % 2 ? '#e05252' : '#4060b0';
        g.fillRect(x - 2, H * 0.35, 4, 5); g.fillRect(x - 2, H * 0.6, 4, 5);       // players
      }
    } },
  { id: 'airhockey', name: 'Air Hockey', cat: 'Games', w: 3, h: 2, colors: ['#e8ecf0', '#a8c8d8', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, 3, W - 6, H - 6, 6, p.lg(g, 3, 3, W - 6, H - 6, HP.shade(c, 1.05), HP.shade(c, 0.85)));
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 1;
      g.beginPath(); g.arc(W / 2, H / 2, H * 0.28, 0, 7); g.stroke();              // center circle
      g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W / 2, H - 4); g.stroke();
      g.fillStyle = '#e05252';
      g.beginPath(); g.arc(W * 0.3, H * 0.4, 5, 0, 7); g.fill();                   // mallets
      g.beginPath(); g.arc(W * 0.72, H * 0.62, 5, 0, 7); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(W / 2, H / 2 + 3, 3, 0, 7); g.fill(); // puck
    } },
  { id: 'dartboard', name: 'Dartboard', cat: 'Games', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#6f543c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 6, 6, W - 12, H - 12, HP.shade(c, 0.9));                           // surround
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7);
      g.fillStyle = '#2a2d33'; g.fill();
      const rc = ['#e05252', '#5d8a5d', '#2a2d33'];
      [0.24, 0.17, 0.1].forEach((r, i) => {
        g.beginPath(); g.arc(W / 2, H / 2, W * r, 0, 7);
        g.fillStyle = rc[i]; g.fill();
      });
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.04, 0, 7); g.fillStyle = '#e8c832'; g.fill(); // bull
    } },
  { id: 'arcade', name: 'Arcade Machine', cat: 'Games', w: 1, h: 2, colors: ['#3a3f47', '#5d4a68', '#7a4a3e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 4, W - 10, H - 8, 4, p.lg(g, 5, 4, W - 10, H - 8, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      p.box(g, 9, 8, W - 18, H * 0.35, 2, '#181b20');                              // screen
      g.fillStyle = '#4fc3f7';
      g.fillRect(11, 10, W - 22, H * 0.35 - 6);
      g.fillStyle = '#e05252'; g.fillRect(W * 0.4, H * 0.18, W * 0.2, H * 0.1);    // game graphic
      p.box(g, 9, H * 0.55, W - 18, H * 0.18, 2, HP.shade(c, 0.7));                // control deck
      g.fillStyle = '#e8c832'; g.beginPath(); g.arc(W * 0.35, H * 0.64, 3, 0, 7); g.fill(); // joystick
      g.fillStyle = '#e05252'; g.beginPath(); g.arc(W * 0.6, H * 0.64, 2.5, 0, 7); g.fill();
    } },
  { id: 'chess', name: 'Chess Table', cat: 'Games', w: 1, h: 1, colors: ['#9a774f', '#3f3a34', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 ? '#3f3a34' : '#f0ece2';
        g.fillRect(8 + i * (W - 16) / 8, 8 + j * (H - 16) / 8, (W - 16) / 8, (H - 16) / 8);
      }
      g.strokeStyle = HP.shade(c, 0.6); g.strokeRect(8, 8, W - 16, H - 16);
      g.fillStyle = '#222'; g.beginPath(); g.arc(W * 0.2, H * 0.85, 3, 0, 7); g.fill(); // captured
      g.fillStyle = '#eee'; g.beginPath(); g.arc(W * 0.35, H * 0.85, 3, 0, 7); g.fill();
    } },

  /* ---------------- MUSIC ---------------- */
  { id: 'drums', name: 'Drum Kit', cat: 'Music', w: 2, h: 2, colors: ['#a03a3a', '#3a5f8a', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.28, 0, 7);                       // bass drum
      g.fillStyle = p.lg(g, W * 0.2, H * 0.35, W * 0.6, H * 0.55, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.2, 0, 7); g.stroke();
      [[0.28, 0.3], [0.72, 0.3]].forEach(pt => {                                   // toms
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.13, 0, 7);
        g.fillStyle = HP.shade(c, 0.95); g.fill();
        g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      });
      [[0.15, 0.55], [0.85, 0.5]].forEach(pt => {                                  // cymbals
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.14, 0, 7);
        g.fillStyle = '#d8b45a'; g.fill();
        g.strokeStyle = '#a8843a'; g.lineWidth = 1; g.stroke();
      });
      g.beginPath(); g.arc(W / 2, H * 0.3, W * 0.11, 0, 7);                        // snare
      g.fillStyle = '#c9ced4'; g.fill(); g.strokeStyle = '#8b939c'; g.stroke();
    } },
  { id: 'guitars', name: 'Guitars + Amp', cat: 'Music', w: 1, h: 1, colors: ['#a06558', '#3a3f47', '#d8a05a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.08, H * 0.5, W * 0.36, H * 0.42, 3, '#2c2f33');               // amp
      g.strokeStyle = '#555c66'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(W * 0.12, H * (0.58 + i * 0.1)); g.lineTo(W * 0.4, H * (0.58 + i * 0.1)); g.stroke(); }
      g.beginPath();                                                               // guitar body
      g.ellipse(W * 0.66, H * 0.66, W * 0.16, H * 0.2, -0.3, 0, 7);
      g.fillStyle = p.lg(g, W * 0.5, H * 0.45, W * 0.35, H * 0.4, HP.shade(c, 1.2), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#3a2e22'; g.lineWidth = 4;                                  // neck
      g.beginPath(); g.moveTo(W * 0.7, H * 0.55); g.lineTo(W * 0.82, H * 0.18); g.stroke();
      g.fillStyle = '#3a2e22'; g.beginPath(); g.arc(W * 0.83, H * 0.16, W * 0.06, 0, 7); g.fill(); // headstock
    } },
  { id: 'synth', name: 'Keyboard', cat: 'Music', w: 2, h: 1, colors: ['#3a3f47', '#5d4a68', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2.5;                         // stand legs
      g.beginPath(); g.moveTo(W * 0.2, H * 0.65); g.lineTo(W * 0.35, H * 0.95);
      g.moveTo(W * 0.8, H * 0.65); g.lineTo(W * 0.65, H * 0.95); g.stroke();
      p.box(g, 5, H * 0.2, W - 10, H * 0.5, 3, p.lg(g, 5, H * 0.2, W - 10, H * 0.5, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#f0ece2'; g.fillRect(9, H * 0.32, W - 18, H * 0.3);           // keys
      g.fillStyle = '#222';
      for (let i = 0; i < 12; i++) g.fillRect(11 + i * (W - 22) / 12, H * 0.32, 3, H * 0.18);
    } },

  /* ---------------- LIVING extras 3 ---------------- */
  { id: 'doormat', name: 'Doormat', cat: 'Living', w: 1, h: 1, colors: ['#8a7a5a', '#6d6d5a', '#7a5a5a'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = HP.shade(c, 0.9); g.fillRect(4, 8, W - 8, H - 16);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 2;
      g.strokeRect(7, 11, W - 14, H - 22);
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(7, 11 + i * (H - 22) / 5); g.lineTo(W - 7, 11 + i * (H - 22) / 5); g.stroke(); }
    } },
  { id: 'woodstove', name: 'Wood Stove', cat: 'Living', w: 1, h: 1, colors: ['#2c2f33', '#5b4a3a', '#45494e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#22252a'; g.fillRect(W * 0.44, 4, W * 0.12, H * 0.3);        // flue
      p.box(g, 6, H * 0.3, W - 12, H * 0.6, 4, p.lg(g, 6, H * 0.3, W - 12, H * 0.6, HP.shade(c, 1.15), HP.shade(c, 0.7)));
      g.strokeStyle = HP.shade(c, 0.5); P().RR(g, 6, H * 0.3, W - 12, H * 0.6, 4); g.stroke();
      g.fillStyle = '#181a1d'; P().RR(g, W * 0.28, H * 0.5, W * 0.44, H * 0.28, 3); g.fill();
      const fg = g.createRadialGradient(W / 2, H * 0.64, 1, W / 2, H * 0.64, 8);
      fg.addColorStop(0, '#ffb74d'); fg.addColorStop(1, 'rgba(255,100,40,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(W / 2, H * 0.64, 7, 0, 7); g.fill();
    } },
  { id: 'cinemaseats', name: 'Cinema Seats', cat: 'Living', w: 3, h: 1, colors: ['#7a3a3f', '#3a3f47', '#5d4a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 3; i++) {
        const x = W * 0.05 + i * W * 0.32;
        p.fabric(g, x, 4, W * 0.28, H - 8, 6, c);                                 // seat back
        p.cushion(g, x + 3, H * 0.45, W * 0.28 - 6, H * 0.45, HP.shade(c, 1.08)); // cushion
      }
      g.fillStyle = HP.shade(c, 0.6);
      for (let i = 0; i < 2; i++) {                                                // armrests w/ cupholders
        g.fillRect(W * (0.33 + i * 0.32) - 3, 6, 6, H - 12);
        g.fillStyle = '#222'; g.beginPath(); g.arc(W * (0.33 + i * 0.32), H * 0.5, 3, 0, 7); g.fill();
        g.fillStyle = HP.shade(c, 0.6);
      }
    } },
  { id: 'projscreen', name: 'Cinema Screen', cat: 'Living', w: 3, h: 1, colors: ['#f0f2f5', '#e8ecf0', '#dfe5ea'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#22252a'; g.fillRect(3, H * 0.28, W - 6, H * 0.14);           // housing
      p.box(g, 6, H * 0.4, W - 12, H * 0.5, 1, '#f4f6f8');                          // screen
      g.strokeStyle = '#8b939c'; g.lineWidth = 1; g.strokeRect(6, H * 0.4, W - 12, H * 0.5);
      g.fillStyle = 'rgba(150,180,220,.25)'; g.fillRect(8, H * 0.43, W - 16, H * 0.2); // projected glow
    } },
  { id: 'ceilingfan', name: 'Ceiling Fan', cat: 'Living', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#d8d2c6'], walkable: true,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 4; i++) {                                                // blades
        g.save(); g.translate(W / 2, H / 2); g.rotate(i * Math.PI / 2);
        g.beginPath(); g.ellipse(W * 0.28, 0, W * 0.26, W * 0.09, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.9); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.12, 0, 7);
      g.fillStyle = p.lg(g, 0, 0, W, H, HP.shade(c, 1.2), HP.shade(c, 0.7)); g.fill();
      g.fillStyle = '#e8d8a8'; g.beginPath(); g.arc(W / 2, H / 2, W * 0.05, 0, 7); g.fill(); // light
    } },
  { id: 'birdcage', name: 'Bird Cage', cat: 'Living', w: 1, h: 1, colors: ['#c9a44e', '#8b939c', '#a4805c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.36, 0, 7);
      g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;                           // bars
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI / 5;
        g.beginPath(); g.moveTo(W / 2 - Math.cos(a) * W * 0.34, H / 2 - Math.sin(a) * W * 0.34);
        g.lineTo(W / 2 + Math.cos(a) * W * 0.34, H / 2 + Math.sin(a) * W * 0.34); g.stroke();
      }
      g.fillStyle = '#e8c832'; g.beginPath(); g.arc(W / 2, H / 2 + 3, W * 0.1, 0, 7); g.fill(); // bird
      g.fillStyle = '#e08040'; g.beginPath(); g.arc(W / 2 + 4, H / 2, 2, 0, 7); g.fill();       // beak
    } },
  { id: 'hamster', name: 'Hamster Cage', cat: 'Living', w: 1, h: 1, colors: ['#a8c8d8', '#d8b8c8', '#a8d8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 7, W - 10, H - 14, 3, p.lg(g, 5, 7, W - 10, H - 14, HP.shade(c, 1.1), HP.shade(c, 0.9)));
      g.strokeStyle = 'rgba(0,0,0,.15)';
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(5 + i * (W - 10) / 5, 8); g.lineTo(5 + i * (W - 10) / 5, H - 8); g.stroke(); }
      g.strokeStyle = '#8b939c'; g.lineWidth = 1.5;                                // wheel
      g.beginPath(); g.arc(W * 0.68, H * 0.4, W * 0.12, 0, 7); g.stroke();
      g.fillStyle = '#e8d8b0'; g.fillRect(8, H * 0.6, W - 16, H * 0.28);           // bedding
      g.fillStyle = '#b08a5a'; g.beginPath(); g.arc(W * 0.3, H * 0.7, 3, 0, 7); g.fill(); // hamster
    } },

  /* ---------------- KITCHEN extras 3 ---------------- */
  { id: 'barcounter', name: 'Bar Counter', cat: 'Kitchen', w: 3, h: 1, colors: ['#6f543c', '#3a3f47', '#8b6a4a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, 5, W - 6, H * 0.55, 3, p.lg(g, 3, 5, W - 6, H * 0.55, '#3a3028', '#241e18')); // dark front
      p.wood(g, 3, 3, W - 6, H * 0.5, c);                                          // top overhang
      g.fillStyle = '#c9a44e';
      for (let i = 0; i < 3; i++) g.fillRect(W * (0.2 + i * 0.28), H * 0.12, W * 0.08, H * 0.2); // taps
      g.fillStyle = '#dfe5ea';
      g.beginPath(); g.arc(W * 0.15, H * 0.3, 4, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.85, H * 0.3, 4, 0, 7); g.fill();                  // glasses
    } },

  /* ---------------- BEDROOM extras 2 ---------------- */
  { id: 'canopy', name: '4-Poster Bed', cat: 'Bedroom', w: 4, h: 4, colors: ['#8a7ba0', '#a07858', '#5d7484'],
    draw(g, W, H, v) {
      bedDraw(2).call(this, g, W, H, v);
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#6b4f33'; g.lineWidth = 2.5;                                // canopy frame
      g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = '#4a3828';                                                     // posts
      [[4, 4], [W - 4, 4], [4, H - 4], [W - 4, H - 4]].forEach(pt => {
        g.beginPath(); g.arc(pt[0], pt[1], 4, 0, 7); g.fill();
      });
      g.fillStyle = HP.shade(c, 1.2);                                              // drape folds
      g.fillRect(4, 4, W - 8, 4);
      g.fillRect(4, 4, 4, H * 0.3); g.fillRect(W - 8, 4, 4, H * 0.3);
    } },

  /* ---------------- BATHROOM extras 2 ---------------- */
  { id: 'bidet', name: 'Bidet', cat: 'Bathroom', w: 1, h: 2, colors: ['#e8ecf0', '#cfd8de', '#dcd2c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#8fa4b0'; g.fillRect(W * 0.4, 5, W * 0.2, 8);                 // faucet
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.3, H * 0.36, 0, 0, 7);
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.19, H * 0.26, 0, 0, 7);
      g.fillStyle = '#cfe2ea'; g.fill();                                           // water basin
      g.stroke();
    } },
  { id: 'bathscale', name: 'Bath Scale', cat: 'Bathroom', w: 1, h: 1, colors: ['#dfe5ea', '#8b93a0', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.25, H * 0.2, W * 0.5, H * 0.6, 4, p.lg(g, W * 0.25, H * 0.2, W * 0.5, H * 0.6, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.fillStyle = '#22252a'; g.fillRect(W * 0.38, H * 0.28, W * 0.24, H * 0.14); // display
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.41, H * 0.3, W * 0.18, H * 0.08);
    } },

  /* ---------------- OFFICE extras 3 ---------------- */
  { id: 'globe', name: 'Globe', cat: 'Office', w: 1, h: 1, colors: ['#4a8ab0', '#4a9a8a', '#4a7ab0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8a6844'; g.lineWidth = 3;                                  // stand arc
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.38, -0.4, Math.PI + 0.4); g.stroke();
      g.fillStyle = '#8a6844'; g.fillRect(W * 0.3, H * 0.82, W * 0.4, H * 0.08);   // base
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7);
      g.fillStyle = c; g.fill();
      g.fillStyle = '#8aa86a';                                                     // continents
      g.beginPath(); g.ellipse(W * 0.42, H * 0.42, W * 0.1, H * 0.14, 0.4, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W * 0.6, H * 0.6, W * 0.08, H * 0.1, -0.3, 0, 7); g.fill();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, 7); g.stroke();
    } },
  { id: 'safe', name: 'Safe', cat: 'Office', w: 1, h: 1, colors: ['#3a3f47', '#5b5f6b', '#2f333a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 7, 6, W - 14, H - 12, 3, p.lg(g, 7, 6, W - 14, H - 12, HP.shade(c, 1.15), HP.shade(c, 0.7)));
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; P().RR(g, 10, 9, W - 20, H - 18, 2); g.stroke();
      g.beginPath(); g.arc(W * 0.35, H * 0.4, W * 0.12, 0, 7);                     // dial
      g.strokeStyle = '#c9ced4'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W * 0.35, H * 0.4, 3, 0, 7); g.fillStyle = '#c9ced4'; g.fill();
      g.strokeStyle = '#c9ced4'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W * 0.65, H * 0.4); g.lineTo(W * 0.75, H * 0.4); g.stroke(); // handle
    } },
  { id: 'watercooler', name: 'Water Cooler', cat: 'Office', w: 1, h: 1, colors: ['#dfe5ea', '#a8c8d8', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.28, H * 0.42, W * 0.44, H * 0.5, 4, p.lg(g, W * 0.28, H * 0.42, W * 0.44, H * 0.5, HP.shade(c, 1.05), HP.shade(c, 0.85)));
      g.beginPath(); g.ellipse(W / 2, H * 0.26, W * 0.24, H * 0.22, 0, 0, 7);      // bottle
      g.fillStyle = 'rgba(140,200,235,.8)'; g.fill();
      g.strokeStyle = '#7ba8be'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#4060b0'; g.fillRect(W * 0.4, H * 0.55, W * 0.08, H * 0.12);  // cold tap
      g.fillStyle = '#b04040'; g.fillRect(W * 0.52, H * 0.55, W * 0.08, H * 0.12); // hot tap
    } },
  { id: 'drafting', name: 'Drafting Table', cat: 'Office', w: 2, h: 1, colors: ['#9a774f', '#5b5f6b', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 3;                           // legs
      g.beginPath(); g.moveTo(W * 0.15, H * 0.3); g.lineTo(W * 0.25, H * 0.9);
      g.moveTo(W * 0.85, H * 0.3); g.lineTo(W * 0.75, H * 0.9); g.stroke();
      p.wood(g, 5, 6, W - 10, H * 0.62, c);                                        // tilted top
      g.fillStyle = '#f0ece2'; g.fillRect(W * 0.15, H * 0.14, W * 0.55, H * 0.4);  // plans paper
      g.strokeStyle = '#4060b0'; g.lineWidth = 1;                                  // blueprint lines
      g.strokeRect(W * 0.2, H * 0.2, W * 0.3, H * 0.25);
      g.beginPath(); g.arc(W * 0.55, H * 0.32, 4, 0, 7); g.stroke();
      g.fillStyle = '#555c66'; g.fillRect(W * 0.78, H * 0.15, 4, H * 0.4);         // ruler
    } },
  { id: 'telescope', name: 'Telescope', cat: 'Office', w: 1, h: 1, colors: ['#dfe5ea', '#3a3f47', '#c9a44e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 2.5;                                // tripod
      g.beginPath(); g.moveTo(W / 2, H * 0.5); g.lineTo(W * 0.25, H * 0.92);
      g.moveTo(W / 2, H * 0.5); g.lineTo(W * 0.75, H * 0.92);
      g.moveTo(W / 2, H * 0.5); g.lineTo(W / 2, H * 0.95); g.stroke();
      g.save(); g.translate(W / 2, H * 0.4); g.rotate(-0.5);                       // tube
      p.box(g, -W * 0.32, -H * 0.09, W * 0.64, H * 0.18, 4,
        p.lg(g, -W * 0.32, -H * 0.09, W * 0.64, H * 0.18, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#2a3540'; g.beginPath(); g.arc(W * 0.3, 0, H * 0.08, 0, 7); g.fill(); // lens
      g.restore();
      g.beginPath(); g.arc(W / 2, H * 0.5, 4, 0, 7); g.fillStyle = '#555c66'; g.fill();    // mount
    } },
  { id: 'serverrack', name: 'Server Rack', cat: 'Office', w: 1, h: 1, colors: ['#2c2f33', '#3a3f47', '#45494e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 7, 4, W - 14, H - 8, 3, p.lg(g, 7, 4, W - 14, H - 8, HP.shade(c, 1.2), HP.shade(c, 0.8)));
      g.strokeStyle = '#555c66'; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(9, 4 + i * (H - 8) / 5); g.lineTo(W - 9, 4 + i * (H - 8) / 5); g.stroke(); }
      const lc = ['#4fc3f7', '#5d8a5d', '#e8c832'];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = lc[i % 3];
        g.fillRect(10 + (i % 4) * 6, 7 + Math.floor(i / 4) * (H * 0.4), 3, 3);     // LEDs
      }
    } },

  /* ---------------- UTILITY extras ---------------- */
  { id: 'dryrack', name: 'Drying Rack', cat: 'Utility', w: 2, h: 1, colors: ['#dfe5ea', '#a8b8c8', '#c9ced4'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(W * 0.1, H * 0.15); g.lineTo(W * 0.25, H * 0.9);     // X-frame legs
      g.moveTo(W * 0.25, H * 0.15); g.lineTo(W * 0.1, H * 0.9);
      g.moveTo(W * 0.75, H * 0.15); g.lineTo(W * 0.9, H * 0.9);
      g.moveTo(W * 0.9, H * 0.15); g.lineTo(W * 0.75, H * 0.9); g.stroke();
      const cl = ['#e8ecf0', '#a8c8d8', '#e8a0a8', '#f0d090'];
      cl.forEach((k, i) => {
        g.fillStyle = k;
        g.fillRect(W * (0.3 + i * 0.13), H * 0.18, W * 0.11, H * 0.55);            // hanging clothes
      });
    } },
  { id: 'utilsink', name: 'Utility Sink', cat: 'Utility', w: 1, h: 1, colors: ['#e8ecf0', '#8b93a0', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 6, W - 12, H - 12, 4, p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      p.box(g, 12, 12, W - 24, H - 24, 4, '#c9d4da');                              // deep basin
      g.strokeStyle = '#8fa4b0'; P().RR(g, 12, 12, W - 24, H - 24, 4); g.stroke();
      g.fillStyle = '#5b636a'; g.fillRect(W / 2 - 1, 8, 2, 6);                     // faucet
    } },
  { id: 'vacuum', name: 'Vacuum Cleaner', cat: 'Utility', w: 1, h: 1, colors: ['#a05050', '#4a6b8a', '#454a52'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 3;                           // wand
      g.beginPath(); g.moveTo(W / 2, H * 0.12); g.lineTo(W / 2, H * 0.6); g.stroke();
      p.box(g, W * 0.22, H * 0.55, W * 0.56, H * 0.3, 4,                           // head
        p.lg(g, W * 0.22, H * 0.55, W * 0.56, H * 0.3, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#222'; g.fillRect(W * 0.26, H * 0.78, W * 0.48, 3);           // brush bar
      g.fillStyle = '#dfe5ea'; g.fillRect(W * 0.44, H * 0.05, W * 0.12, H * 0.1);  // handle
    } },
  { id: 'freezer', name: 'Chest Freezer', cat: 'Utility', w: 2, h: 1, colors: ['#e8ecf0', '#c9ced4', '#dfe5ea'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 5, W - 8, H - 10, 4, p.lg(g, 4, 5, W - 8, H - 10, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, H * 0.4); g.lineTo(W - 6, H * 0.4); g.stroke();   // lid seam
      g.fillStyle = HP.shade(c, 0.7); g.fillRect(W * 0.4, H * 0.4, W * 0.2, 4);    // handle
      g.fillStyle = '#5d8a5d'; g.fillRect(W - 16, 8, 6, 6);                        // power LED
    } },
  { id: 'waterheater', name: 'Water Heater', cat: 'Utility', w: 1, h: 1, colors: ['#dfe5ea', '#a8a294', '#8b93a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.34, H * 0.42, 0, 0, 7);         // cylinder
      g.fillStyle = p.lg(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, HP.shade(c, 1.1), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#c9854e'; g.lineWidth = 2;                                  // pipes
      g.beginPath(); g.moveTo(W * 0.4, 4); g.lineTo(W * 0.4, H * 0.2); g.stroke();
      g.strokeStyle = '#7ba3b8';
      g.beginPath(); g.moveTo(W * 0.6, 4); g.lineTo(W * 0.6, H * 0.2); g.stroke();
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.44, H * 0.45, W * 0.12, H * 0.1);  // panel
    } },
  { id: 'sewing', name: 'Sewing Machine', cat: 'Utility', w: 2, h: 1, colors: ['#e8ecf0', '#d8b8c8', '#8b93a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 5, 8, W - 10, H - 16, '#9a774f');                                  // table
      p.box(g, W * 0.35, 10, W * 0.45, H * 0.4, 4,                                 // machine body
        p.lg(g, W * 0.35, 10, W * 0.45, H * 0.4, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.fillStyle = HP.shade(c, 0.8); g.fillRect(W * 0.35, H * 0.55, W * 0.12, H * 0.2); // arm
      g.fillStyle = '#222'; g.fillRect(W * 0.41, H * 0.5, 2, H * 0.1);             // needle
      g.fillStyle = '#e8a0b8'; g.fillRect(W * 0.12, H * 0.5, W * 0.15, H * 0.25);  // fabric
      g.strokeStyle = '#e8a0b8'; g.lineWidth = 2;
      g.beginPath(); g.arc(W * 0.82, H * 0.25, 4, 0, 7); g.stroke();               // thread spool
    } },
  { id: 'printer3d', name: '3D Printer', cat: 'Utility', w: 1, h: 1, colors: ['#454a52', '#3a5f8a', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 6, W - 12, H - 12, 3, p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.strokeStyle = '#22252a'; g.lineWidth = 2;
      g.strokeRect(10, 10, W - 20, H - 20);                                        // gantry frame
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(10, H * 0.4); g.lineTo(W - 10, H * 0.4); g.stroke(); // gantry rail
      g.fillStyle = '#e08040'; g.fillRect(W * 0.45, H * 0.36, W * 0.1, H * 0.12);  // print head
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.35, H * 0.62, W * 0.3, H * 0.2);   // object being printed
    } },

  /* ---------------- GARAGE extras ---------------- */
  { id: 'carlift', name: 'Car Lift', cat: 'Garage', w: 2, h: 4, colors: ['#5b5f6b', '#a03a3a', '#3a5f8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      [[6, 6], [W - 6, 6], [6, H - 6], [W - 6, H - 6]].forEach(pt => {             // posts
        p.box(g, pt[0] - 6, pt[1] - 6, 12, 12, 2, HP.shade(c, 0.9));
      });
      g.fillStyle = HP.shade(c, 0.75);                                             // arms
      [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]].forEach(a => {
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 4;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + a[2] * W * 0.22, a[1] + a[3] * H * 0.12); g.stroke();
      });
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.setLineDash([4, 3]);  // car outline guide
      P().RR(g, W * 0.15, H * 0.12, W * 0.7, H * 0.76, 10); g.stroke(); g.setLineDash([]);
    } },
  { id: 'ladder', name: 'Ladder', cat: 'Garage', w: 1, h: 2, colors: ['#a89885', '#c9854e', '#8b939c'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.9); g.lineWidth = 4;                           // rails
      g.beginPath(); g.moveTo(W * 0.3, 6); g.lineTo(W * 0.3, H - 6); g.stroke();
      g.beginPath(); g.moveTo(W * 0.7, 6); g.lineTo(W * 0.7, H - 6); g.stroke();
      g.strokeStyle = HP.shade(c, 1.1); g.lineWidth = 3;                           // rungs
      for (let i = 1; i < 7; i++) {
        const y = 8 + i * (H - 16) / 7;
        g.beginPath(); g.moveTo(W * 0.28, y); g.lineTo(W * 0.72, y); g.stroke();
      }
    } },
  { id: 'generator', name: 'Generator', cat: 'Garage', w: 1, h: 1, colors: ['#a06558', '#5b5f6b', '#8a8a5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 7, W - 10, H - 14, 4, p.lg(g, 5, 7, W - 10, H - 14, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#2c2f33'; g.fillRect(W * 0.15, H * 0.2, W * 0.4, H * 0.25);   // engine
      g.strokeStyle = '#555c66'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(W * 0.17, H * (0.24 + i * 0.07)); g.lineTo(W * 0.5, H * (0.24 + i * 0.07)); g.stroke(); }
      g.fillStyle = '#222';                                                        // outlets
      g.beginPath(); g.arc(W * 0.68, H * 0.3, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.68, H * 0.45, 3, 0, 7); g.fill();
      g.strokeStyle = '#555c66'; g.lineWidth = 3;                                  // frame bars
      g.beginPath(); g.moveTo(4, 6); g.lineTo(W - 4, 6); g.stroke();
    } },
  { id: 'compressor', name: 'Air Compressor', cat: 'Garage', w: 1, h: 1, colors: ['#a03a3a', '#4a6b8a', '#e8b04a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.65, W * 0.36, H * 0.26, 0, 0, 7);      // tank
      g.fillStyle = p.lg(g, W * 0.15, H * 0.4, W * 0.7, H * 0.5, HP.shade(c, 1.15), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#3a3f47'; g.fillRect(W * 0.35, H * 0.18, W * 0.3, H * 0.22);  // motor
      g.beginPath(); g.arc(W * 0.72, H * 0.3, W * 0.1, 0, 7);                      // gauge
      g.fillStyle = '#eef2f5'; g.fill(); g.strokeStyle = '#555c66'; g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.arc(W * 0.28, H * 0.9, 4, 0, 7); g.fill(); // wheel
    } },
  { id: 'kayak', name: 'Kayak', cat: 'Garage', w: 1, h: 3, colors: ['#e08040', '#4a8ab0', '#5d8a5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                               // hull
      g.moveTo(W / 2, 4);
      g.quadraticCurveTo(W * 0.95, H * 0.3, W * 0.72, H * 0.62);
      g.quadraticCurveTo(W * 0.6, H * 0.85, W / 2, H - 4);
      g.quadraticCurveTo(W * 0.4, H * 0.85, W * 0.28, H * 0.62);
      g.quadraticCurveTo(W * 0.05, H * 0.3, W / 2, 4);
      g.fillStyle = p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.2), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.52, W * 0.18, H * 0.16, 0, 0, 7);      // cockpit
      g.fillStyle = '#2a2520'; g.fill();
    } },
  { id: 'golfbag', name: 'Golf Bag', cat: 'Garage', w: 1, h: 1, colors: ['#5d4a68', '#4a6b4a', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      const cs = ['#c9ced4', '#8b939c', '#e8c832'];
      cs.forEach((k, i) => {                                                       // club tops
        g.strokeStyle = k; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(W * (0.3 + i * 0.18), H * 0.12); g.lineTo(W * (0.3 + i * 0.18), H * 0.4); g.stroke();
      });
      p.box(g, W * 0.22, H * 0.35, W * 0.56, H * 0.55, 8,                          // bag
        p.lg(g, W * 0.22, H * 0.35, W * 0.56, H * 0.55, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(W * 0.3, H * 0.55, W * 0.4, H * 0.12); // pocket
    } },
  { id: 'surfboard', name: 'Surfboard', cat: 'Garage', w: 1, h: 2, colors: ['#f0d090', '#e8a0a8', '#a0c8e8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.28, H * 0.46, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.22, H * 0.05, W * 0.56, H * 0.9, HP.shade(c, 1.15), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#e05252'; g.lineWidth = 3;                                  // stripe
      g.beginPath(); g.moveTo(W / 2, H * 0.08); g.lineTo(W / 2, H * 0.92); g.stroke();
      g.fillStyle = '#4060b0';
      g.beginPath(); g.moveTo(W / 2, H * 0.82); g.lineTo(W / 2 - 4, H * 0.92); g.lineTo(W / 2 + 4, H * 0.92); g.fill(); // fin
    } },
  { id: 'scooter', name: 'Scooter', cat: 'Garage', w: 1, h: 1, colors: ['#3a3f47', '#a06558', '#4a6b8a'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.fillStyle = '#1b1e22';
      g.beginPath(); g.arc(W / 2, H * 0.82, W * 0.12, 0, 7); g.fill();             // wheels
      g.beginPath(); g.arc(W / 2, H * 0.25, W * 0.12, 0, 7); g.fill();
      g.strokeStyle = c; g.lineWidth = 4;                                          // deck
      g.beginPath(); g.moveTo(W / 2, H * 0.3); g.lineTo(W / 2, H * 0.78); g.stroke();
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 3;                           // stem
      g.beginPath(); g.moveTo(W / 2, H * 0.25); g.lineTo(W / 2, H * 0.08); g.stroke();
      g.beginPath(); g.moveTo(W * 0.3, H * 0.1); g.lineTo(W * 0.7, H * 0.1); g.stroke(); // handlebar
    } },

  /* ---------------- GYM extras ---------------- */
  { id: 'sauna', name: 'Sauna', cat: 'Gym', w: 2, h: 3, colors: ['#b08a5a', '#8a6844', '#9a774f'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.fillStyle = HP.shade(c, 0.7);                                              // interior
      g.fillRect(9, 9, W - 18, H - 18);
      p.wood(g, 10, 10, W - 20, H * 0.3, HP.shade(c, 1.1));                        // bench
      p.wood(g, 10, H * 0.45, W * 0.4, H * 0.45, HP.shade(c, 1.05));               // L bench
      g.fillStyle = '#3a3f47';                                                     // stove
      p.box(g, W * 0.62, H * 0.6, W * 0.28, H * 0.28, 3, '#3a3f47');
      g.fillStyle = '#6d6d6d';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * (0.68 + (i % 2) * 0.12), H * (0.68 + Math.floor(i / 2) * 0.1), 3, 0, 7); g.fill(); }
      g.fillStyle = '#8a6844'; g.fillRect(W * 0.42, H - 12, W * 0.16, 8);          // door
    } },
  { id: 'massage', name: 'Massage Table', cat: 'Gym', w: 1, h: 2, colors: ['#d8cfc0', '#a8bfa8', '#a8b8c8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8a6844'; g.lineWidth = 3;                                  // legs
      [[0.3, 0.2], [0.7, 0.2], [0.3, 0.8], [0.7, 0.8]].forEach(pt => {
        g.beginPath(); g.moveTo(W * pt[0], H * (pt[1] - 0.06)); g.lineTo(W * pt[0], H * (pt[1] + 0.08)); g.stroke();
      });
      p.fabric(g, 7, 6, W - 14, H - 12, 8, c);                                     // table
      g.beginPath(); g.arc(W / 2, H * 0.16, W * 0.12, 0, 7);                       // face hole
      g.fillStyle = '#f5f0e6'; g.fill(); g.strokeStyle = HP.shade(c, 0.7); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(W * 0.3, H * 0.55, W * 0.4, H * 0.2);       // towel
    } },

  /* ---------------- GAMES extras ---------------- */
  { id: 'pinball', name: 'Pinball', cat: 'Games', w: 1, h: 2, colors: ['#5d4a68', '#a03a3a', '#3a5f8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 2;                                  // legs
      [[0.15, 0.12], [0.85, 0.12], [0.15, 0.95], [0.85, 0.95]].forEach(pt =>
        { g.beginPath(); g.moveTo(W * pt[0], H * pt[1]); g.lineTo(W * pt[0], H * (pt[1] + 0.04)); g.stroke(); });
      p.box(g, 5, 4, W - 10, H - 8, 4, p.lg(g, 5, 4, W - 10, H - 8, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      p.box(g, 9, 8, W - 18, H * 0.6, 3, '#1a2030');                               // playfield
      const bc = ['#e05252', '#e8c832', '#4fc3f7', '#5d8a5d'];
      bc.forEach((b, i) => {
        g.fillStyle = b;
        g.beginPath(); g.arc(W * (0.3 + (i % 2) * 0.4), H * (0.2 + Math.floor(i / 2) * 0.25), 4, 0, 7); g.fill();
      });
      g.fillStyle = '#c9ced4'; g.beginPath(); g.arc(W / 2, H * 0.55, 3, 0, 7); g.fill(); // ball
      g.fillStyle = HP.shade(c, 0.6); g.fillRect(7, H * 0.75, W - 14, H * 0.18);   // flipper deck
    } },

  /* ---------------- MUSIC extras ---------------- */
  { id: 'jukebox', name: 'Jukebox', cat: 'Music', w: 1, h: 1, colors: ['#a03a5a', '#3a5f8a', '#6b4f33'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.18, H * 0.15, W * 0.64, H * 0.75, 10,
        p.lg(g, W * 0.18, H * 0.15, W * 0.64, H * 0.75, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.beginPath(); g.arc(W / 2, H * 0.35, W * 0.24, Math.PI, 0);                 // arch top
      g.strokeStyle = '#e8c832'; g.lineWidth = 3; g.stroke();
      const rg = g.createLinearGradient(W * 0.3, 0, W * 0.7, 0);                   // neon trim
      rg.addColorStop(0, '#ff5370'); rg.addColorStop(0.5, '#4fc3f7'); rg.addColorStop(1, '#b388ff');
      g.strokeStyle = rg; g.lineWidth = 2;
      P().RR(g, W * 0.26, H * 0.24, W * 0.48, H * 0.58, 6); g.stroke();
      g.fillStyle = '#f0e0b8';
      for (let i = 0; i < 3; i++) g.fillRect(W * 0.34, H * (0.42 + i * 0.12), W * 0.32, H * 0.06); // song cards
    } },

  /* ---------------- KIDS extras 2 ---------------- */
  { id: 'toykitchen', name: 'Toy Kitchen', cat: 'Kids', w: 1, h: 1, colors: ['#e8a0a8', '#a0c8e8', '#d8b06a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 5, W - 12, H - 10, 4, p.lg(g, 6, 5, W - 12, H - 10, HP.shade(c, 1.15), HP.shade(c, 0.85)));
      g.fillStyle = '#45494e';                                                     // burners
      g.beginPath(); g.arc(W * 0.35, H * 0.35, 4, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.62, H * 0.35, 4, 0, 7); g.fill();
      g.fillStyle = '#c9d4da'; g.fillRect(W * 0.3, H * 0.6, W * 0.4, H * 0.22);    // oven door
      g.strokeStyle = '#8fa4b0'; g.strokeRect(W * 0.3, H * 0.6, W * 0.4, H * 0.22);
    } },

  /* ---------------- FENCES & BOUNDARIES ---------------- */
  { id: 'fencewood', name: 'Wood Fence', cat: 'Fences', w: 4, h: 1, colors: ['#9a774f', '#8a6844', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 2, H * 0.3, W - 4, H * 0.4, c);                                    // panel
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      for (let i = 1; i < 12; i++) {                                               // vertical planks
        const x = 4 + i * (W - 8) / 12;
        g.beginPath(); g.moveTo(x, H * 0.32); g.lineTo(x, H * 0.68); g.stroke();
      }
      [0.12, 0.88].forEach(f => {                                                  // posts
        p.box(g, W * f - 4, H * 0.18, 8, H * 0.64, 2, HP.shade(c, 0.8));
      });
    } },
  { id: 'picket', name: 'Picket Fence', cat: 'Fences', w: 4, h: 1, colors: ['#f0ede4', '#e8e0d0', '#d8cfc0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.75); g.lineWidth = 3;                          // rails
      g.beginPath(); g.moveTo(4, H * 0.4); g.lineTo(W - 4, H * 0.4); g.stroke();
      g.beginPath(); g.moveTo(4, H * 0.65); g.lineTo(W - 4, H * 0.65); g.stroke();
      for (let i = 0; i < 14; i++) {                                               // pickets
        const x = 6 + i * (W - 12) / 13;
        g.fillStyle = HP.shade(c, 0.95 + (i % 2) * 0.08);
        g.fillRect(x - 2.5, H * 0.2, 5, H * 0.6);
        g.beginPath(); g.moveTo(x - 2.5, H * 0.2); g.lineTo(x, H * 0.12); g.lineTo(x + 2.5, H * 0.2); g.fill(); // point
      }
    } },
  { id: 'ironfence', name: 'Iron Fence', cat: 'Fences', w: 4, h: 1, colors: ['#3a3f47', '#2c2f33', '#45494e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 2.5;                                        // rails
      g.beginPath(); g.moveTo(4, H * 0.3); g.lineTo(W - 4, H * 0.3); g.stroke();
      g.beginPath(); g.moveTo(4, H * 0.72); g.lineTo(W - 4, H * 0.72); g.stroke();
      for (let i = 0; i < 15; i++) {                                               // bars + finials
        const x = 6 + i * (W - 12) / 14;
        g.strokeStyle = HP.shade(c, 1.1); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, H * 0.25); g.lineTo(x, H * 0.8); g.stroke();
        g.fillStyle = HP.shade(c, 1.3);
        g.beginPath(); g.moveTo(x - 3, H * 0.25); g.lineTo(x, H * 0.12); g.lineTo(x + 3, H * 0.25); g.fill();
      }
      [0.08, 0.92].forEach(f => {                                                  // stone posts
        p.box(g, W * f - 5, H * 0.08, 10, H * 0.84, 2, '#a8a294');
      });
    } },
  { id: 'gardwall', name: 'Garden Wall', cat: 'Fences', w: 4, h: 1, colors: ['#a89078', '#b0785a', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.22, W - 6, H * 0.56, 3,
        p.lg(g, 3, H * 0.22, W - 6, H * 0.56, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1;                          // brick courses
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(5, H * 0.22 + i * H * 0.19); g.lineTo(W - 5, H * 0.22 + i * H * 0.19); g.stroke(); }
      for (let i = 0; i < 10; i++) {
        const x = 6 + i * (W - 12) / 10;
        const off = (i % 2) * 6;
        g.beginPath(); g.moveTo(x + off, H * 0.22); g.lineTo(x + off, H * 0.41); g.stroke();
        g.beginPath(); g.moveTo(x + 6 - off, H * 0.41); g.lineTo(x + 6 - off, H * 0.6); g.stroke();
      }
      g.fillStyle = HP.shade(c, 1.2); g.fillRect(3, H * 0.16, W - 6, H * 0.12);    // coping stones
    } },
  { id: 'gate', name: 'Garden Gate', cat: 'Fences', w: 2, h: 1, colors: ['#9a774f', '#f0ede4', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.2, 7, H * 0.6, 2, HP.shade(c, 0.75));                      // posts
      p.box(g, W - 10, H * 0.2, 7, H * 0.6, 2, HP.shade(c, 0.75));
      p.wood(g, 12, H * 0.28, W - 24, H * 0.44, c);                                // gate leaf
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 2;                          // diagonal brace
      g.beginPath(); g.moveTo(14, H * 0.3); g.lineTo(W - 14, H * 0.68); g.stroke();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 2;                                  // hinges + latch
      g.fillRect(12, H * 0.34, 4, 4); g.fillRect(12, H * 0.58, 4, 4);
      g.fillStyle = '#c9a44e'; g.fillRect(W - 18, H * 0.44, 5, 6);
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.setLineDash([3, 3]);    // swing arc
      g.beginPath(); g.arc(12, H * 0.5, W * 0.55, -0.9, 0.9); g.stroke(); g.setLineDash([]);
    } },
  { id: 'hedgefence', name: 'Hedge Row', cat: 'Fences', w: 4, h: 1, colors: ['#4e7d45', '#3f6d55', '#5d8a50'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 8; i++) {                                                // hedge blobs
        g.beginPath();
        g.ellipse(4 + i * (W - 8) / 7, H / 2 + ((i % 2) * 4 - 2), (W - 8) / 7 + 3, H * 0.32, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.88 + (i % 3) * 0.08); g.fill();
      }
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1;
      P().RR(g, 3, H * 0.2, W - 6, H * 0.6, 8); g.stroke();
    } },
  { id: 'brickfence', name: 'Brick Wall', cat: 'Fences', w: 4, h: 1, colors: ['#b0705a', '#9a5f4a', '#c08068'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.22, W - 6, H * 0.56, 3,
        p.lg(g, 3, H * 0.22, W - 6, H * 0.56, HP.shade(c, 1.08), HP.shade(c, 0.82)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1;                          // brick courses
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(5, H * 0.22 + i * H * 0.19); g.lineTo(W - 5, H * 0.22 + i * H * 0.19); g.stroke(); }
      for (let i = 0; i < 10; i++) {
        const x = 6 + i * (W - 12) / 10, off = (i % 2) * 6;
        g.beginPath(); g.moveTo(x + off, H * 0.22); g.lineTo(x + off, H * 0.41); g.stroke();
        g.beginPath(); g.moveTo(x + 6 - off, H * 0.41); g.lineTo(x + 6 - off, H * 0.6); g.stroke();
      }
      g.fillStyle = '#efe9da'; g.fillRect(3, H * 0.16, W - 6, H * 0.12);           // light coping
    } },
  { id: 'whitefencewall', name: 'Plastered Wall', cat: 'Fences', w: 4, h: 1, colors: ['#efe9da', '#e2d9c8', '#ddd5c2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.22, W - 6, H * 0.56, 3,
        p.lg(g, 3, H * 0.22, W - 6, H * 0.56, HP.shade(c, 1.03), HP.shade(c, 0.9)));
      g.fillStyle = HP.shade(c, 0.92); g.fillRect(3, H * 0.16, W - 6, H * 0.12);   // coping
      [0.1, 0.9].forEach(f => p.box(g, W * f - 5, H * 0.12, 10, H * 0.72, 2, HP.shade(c, 0.95)));
    } },
  { id: 'bamboofence', name: 'Bamboo Screen', cat: 'Fences', w: 4, h: 1, colors: ['#c9a55f', '#b08f4e', '#dcc184'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      for (let i = 0; i < 16; i++) {                                               // bamboo sticks
        const x = 5 + i * (W - 10) / 15;
        g.strokeStyle = HP.shade(c, 0.9 + (i % 3) * 0.08); g.lineWidth = 4;
        g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x, H * 0.85); g.stroke();
      }
      g.strokeStyle = '#8a6f3a'; g.lineWidth = 2;                                  // lashings
      g.beginPath(); g.moveTo(3, H * 0.3); g.lineTo(W - 3, H * 0.3); g.stroke();
      g.beginPath(); g.moveTo(3, H * 0.7); g.lineTo(W - 3, H * 0.7); g.stroke();
    } },
  { id: 'reedfence', name: 'Reed Screen', cat: 'Fences', w: 4, h: 1, colors: ['#d0bd90', '#c0ab7e', '#e0cf9f'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      for (let i = 0; i < 20; i++) {
        const x = 4 + i * (W - 8) / 19;
        g.strokeStyle = HP.shade(c, 0.88 + (i % 4) * 0.07); g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, H * (0.18 + (i % 3) * 0.03)); g.lineTo(x, H * 0.82); g.stroke();
      }
      g.strokeStyle = '#9a8560'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(3, H * 0.32); g.lineTo(W - 3, H * 0.32); g.stroke();
      g.beginPath(); g.moveTo(3, H * 0.68); g.lineTo(W - 3, H * 0.68); g.stroke();
    } },
  { id: 'chainlink', name: 'Chain Link Fence', cat: 'Fences', w: 4, h: 1, colors: ['#aab4bb', '#8a949b', '#c0c9cf'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 1.4;                                        // diamond mesh
      for (let x = -H; x < W + H; x += 8) {
        g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x + H * 0.7, H * 0.85); g.stroke();
        g.beginPath(); g.moveTo(x, H * 0.85); g.lineTo(x + H * 0.7, H * 0.15); g.stroke();
      }
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 2.5;                         // top rail
      g.beginPath(); g.moveTo(3, H * 0.16); g.lineTo(W - 3, H * 0.16); g.stroke();
      [0.1, 0.9].forEach(f => p.box(g, W * f - 3, H * 0.08, 6, H * 0.84, 2, '#8a949b'));
    } },
  { id: 'latticefence', name: 'Lattice Trellis', cat: 'Fences', w: 4, h: 1, colors: ['#caa96f', '#e8dcc0', '#a8873f'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.18, W - 6, H * 0.64, 2,
        p.lg(g, 3, H * 0.18, W - 6, H * 0.64, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.4;                         // crisscross
      for (let x = -H; x < W + H; x += 9) {
        g.beginPath(); g.moveTo(x, H * 0.2); g.lineTo(x + H * 0.6, H * 0.8); g.stroke();
        g.beginPath(); g.moveTo(x, H * 0.8); g.lineTo(x + H * 0.6, H * 0.2); g.stroke();
      }
      P().RR(g, 3, H * 0.18, W - 6, H * 0.64, 2);
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; g.stroke();
    } },
  { id: 'ranchfence', name: 'Ranch Rail', cat: 'Fences', w: 4, h: 1, colors: ['#8a6844', '#9a774f', '#6f4f33'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 5; g.lineCap = 'round';                     // 3 open rails
      for (const f of [0.28, 0.5, 0.72]) { g.beginPath(); g.moveTo(4, H * f); g.lineTo(W - 4, H * f); g.stroke(); }
      [0.12, 0.5, 0.88].forEach(f => p.box(g, W * f - 4, H * 0.14, 8, H * 0.72, 2, HP.shade(c, 0.8)));
    } },
  { id: 'metalfence', name: 'Metal Panel Fence', cat: 'Fences', w: 4, h: 1, colors: ['#96a2b0', '#7a8694', '#aab6c4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 3, H * 0.2, W - 6, H * 0.6, 2,
        p.lg(g, 3, H * 0.2, W - 6, H * 0.6, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;                        // corrugation ribs
      for (let i = 1; i < 14; i++) {
        const x = 4 + i * (W - 8) / 14;
        g.beginPath(); g.moveTo(x, H * 0.22); g.lineTo(x, H * 0.78); g.stroke();
      }
      [0.08, 0.92].forEach(f => p.box(g, W * f - 4, H * 0.12, 8, H * 0.76, 2, '#6a7684'));
    } },
  { id: 'glassfence', name: 'Glass Balustrade', cat: 'Fences', w: 4, h: 1, colors: ['#8cc8dc', '#a8d8e8', '#7ab8cc'],
    draw(g, W, H, v) {
      const p = P();
      g.fillStyle = 'rgba(140,200,220,.45)'; g.fillRect(4, H * 0.2, W - 8, H * 0.6);  // pane
      g.strokeStyle = 'rgba(120,180,200,.9)'; g.lineWidth = 2;
      g.strokeRect(4, H * 0.2, W - 8, H * 0.6);
      g.strokeStyle = 'rgba(240,250,252,.9)'; g.lineWidth = 1.5;                    // glint
      g.beginPath(); g.moveTo(8, H * 0.7); g.lineTo(W * 0.4, H * 0.28); g.stroke();
      [0.08, 0.5, 0.92].forEach(f => p.box(g, W * f - 3, H * 0.12, 6, H * 0.76, 2, '#9aa4ab'));
    } },
  { id: 'ropefence', name: 'Post & Rope', cat: 'Fences', w: 4, h: 1, colors: ['#d0c4a8', '#8a6844', '#e0d4b8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 3;                                          // sagging ropes
      g.beginPath(); g.moveTo(W * 0.1, H * 0.3); g.quadraticCurveTo(W * 0.5, H * 0.52, W * 0.9, H * 0.3); g.stroke();
      g.beginPath(); g.moveTo(W * 0.1, H * 0.55); g.quadraticCurveTo(W * 0.5, H * 0.77, W * 0.9, H * 0.55); g.stroke();
      [0.1, 0.5, 0.9].forEach(f => p.box(g, W * f - 4, H * 0.14, 8, H * 0.72, 2, '#8a6844'));
    } },
  { id: 'stoneedge', name: 'Fieldstone Edge', cat: 'Fences', w: 4, h: 1, colors: ['#a8a294', '#948c7c', '#bcb4a4'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      for (let i = 0; i < 12; i++) {                                               // scattered stones
        const x = 6 + i * (W - 12) / 11, y = H * 0.5 + ((i % 3) - 1) * H * 0.13;
        g.fillStyle = HP.shade(c, 0.88 + (i % 4) * 0.07);
        g.beginPath(); g.ellipse(x, y, 6 + (i % 2) * 2, 4.5 + (i % 3), 0, 0, 7); g.fill();
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
      }
    } },

  /* ---------------- DRIVEWAY & STREET ---------------- */
  { id: 'carport', name: 'Carport', cat: 'Garage', w: 4, h: 5, colors: ['#5b5f6b', '#8a6844', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(pt => {             // posts
        p.box(g, pt[0] - 5, pt[1] - 5, 10, 10, 2, HP.shade(c, 0.8));
      });
      p.box(g, 6, 6, W - 12, H - 12, 3, p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.1), HP.shade(c, 0.85))); // roof
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;                         // roof seams
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(8 + i * (W - 16) / 5, 7); g.lineTo(8 + i * (W - 16) / 5, H - 7); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(6, H - 14, W - 12, 8);           // roof edge shade
    } },
  { id: 'lamppost', name: 'Lamp Post', cat: 'Garden', w: 1, h: 1, colors: ['#3a3f47', '#8a6844', '#5b5f6b'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      const gr = g.createRadialGradient(W / 2, H * 0.3, 2, W / 2, H * 0.3, W * 0.45);
      gr.addColorStop(0, 'rgba(255,220,130,.55)'); gr.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);                                    // glow
      g.fillStyle = HP.shade(c, 0.9); g.fillRect(W * 0.45, H * 0.3, W * 0.1, H * 0.6); // post
      g.beginPath(); g.arc(W / 2, H * 0.26, W * 0.16, 0, 7);                       // lantern head
      g.fillStyle = '#f0e0a8'; g.fill();
      g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.92, W * 0.18, H * 0.06, 0, 0, 7);      // base
      g.fillStyle = c; g.fill();
    } },
  { id: 'pathlight', name: 'Path Light', cat: 'Garden', w: 1, h: 1, colors: ['#45494e', '#8a6844', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      const gr = g.createRadialGradient(W / 2, H * 0.55, 1, W / 2, H * 0.55, W * 0.35);
      gr.addColorStop(0, 'rgba(255,220,130,.5)'); gr.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = c; g.fillRect(W * 0.44, H * 0.55, W * 0.12, H * 0.35);         // stem
      p.box(g, W * 0.3, H * 0.4, W * 0.4, H * 0.2, 3, '#f0e0a8');                  // light head
      g.strokeStyle = c; P().RR(g, W * 0.3, H * 0.4, W * 0.4, H * 0.2, 3); g.stroke();
    } },
  { id: 'flagpole', name: 'Flagpole', cat: 'Garden', w: 1, h: 1, colors: ['#c9ced4', '#a03a3a', '#4a6b8a'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.9, W * 0.16, H * 0.06, 0, 0, 7);       // base
      g.fillStyle = '#8b939c'; g.fill();
      g.strokeStyle = '#c9ced4'; g.lineWidth = 3;                                  // pole
      g.beginPath(); g.moveTo(W / 2, H * 0.9); g.lineTo(W / 2, H * 0.12); g.stroke();
      g.fillStyle = c;                                                             // flag
      g.beginPath();
      g.moveTo(W / 2, H * 0.12);
      g.quadraticCurveTo(W * 0.78, H * 0.16, W * 0.72, H * 0.28);
      g.quadraticCurveTo(W * 0.68, H * 0.36, W / 2, H * 0.34);
      g.closePath(); g.fill();
      g.fillStyle = '#e8c832'; g.beginPath(); g.arc(W / 2, H * 0.08, 3, 0, 7); g.fill(); // finial
    } },
  { id: 'acunit', name: 'AC Unit', cat: 'Garden', w: 1, h: 1, colors: ['#c9ced4', '#a8a294', '#8b939c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 6, W - 10, H - 12, 3, p.lg(g, 5, 6, W - 10, H - 12, HP.shade(c, 1.08), HP.shade(c, 0.8)));
      g.beginPath(); g.arc(W / 2, H * 0.45, W * 0.3, 0, 7);                        // fan grill
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      for (let i = 0; i < 4; i++) {                                                // fan blades
        const a = i * Math.PI / 2 + 0.4;
        g.beginPath(); g.moveTo(W / 2, H * 0.45);
        g.lineTo(W / 2 + Math.cos(a) * W * 0.26, H * 0.45 + Math.sin(a) * W * 0.26); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.5); g.fillRect(W * 0.3, H * 0.82, W * 0.4, 3);   // vent line
    } },
  { id: 'satellite', name: 'Satellite Dish', cat: 'Garden', w: 1, h: 1, colors: ['#dfe5ea', '#8b939c', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 3;                                  // mount arm
      g.beginPath(); g.moveTo(W * 0.35, H * 0.85); g.lineTo(W * 0.45, H * 0.45); g.stroke();
      g.beginPath(); g.ellipse(W * 0.55, H * 0.38, W * 0.34, H * 0.24, -0.5, 0, 7); // dish
      g.fillStyle = p.lg(g, W * 0.25, H * 0.15, W * 0.6, H * 0.45, HP.shade(c, 1.12), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.55, H * 0.38); g.lineTo(W * 0.78, H * 0.18); g.stroke(); // feed arm
      g.fillStyle = '#3a3f47'; g.beginPath(); g.arc(W * 0.8, H * 0.16, 3, 0, 7); g.fill();
    } },
  { id: 'solarpanel', name: 'Solar Panels', cat: 'Garden', w: 3, h: 2, colors: ['#2a3a5c', '#1e2e4a', '#3a4a6c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 2;                                  // tilt frame
      g.beginPath(); g.moveTo(8, H - 8); g.lineTo(8, H * 0.4); g.stroke();
      g.beginPath(); g.moveTo(W - 8, H - 8); g.lineTo(W - 8, H * 0.4); g.stroke();
      for (let i = 0; i < 3; i++) {                                                // panel rows
        p.box(g, 6 + i * (W - 12) / 3, H * 0.15, (W - 12) / 3 - 3, H * 0.6, 1,
          p.lg(g, 6, H * 0.15, W - 12, H * 0.6, HP.shade(c, 1.3), c));
        g.strokeStyle = '#8fa8cc'; g.lineWidth = 1;
        for (let j = 1; j < 4; j++) {
          g.beginPath(); g.moveTo(6 + i * (W - 12) / 3, H * 0.15 + j * H * 0.15);
          g.lineTo(6 + i * (W - 12) / 3 + (W - 12) / 3 - 3, H * 0.15 + j * H * 0.15); g.stroke();
        }
      }
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(6, H * 0.15, W - 12, 8);    // glare
    } },

  /* ---------------- POOL & RECREATION ---------------- */
  { id: 'roundpool', name: 'Round Pool', cat: 'Outdoor', w: 3, h: 3, colors: ['#4da8cc', '#58b8d8', '#3f98bc'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.46;
      g.beginPath(); g.arc(cx, cy, r, 0, 7);
      g.fillStyle = '#8b939c'; g.fill();                                           // steel wall
      g.beginPath(); g.arc(cx, cy, r * 0.88, 0, 7);
      g.fillStyle = p.lg(g, cx - r, cy - r, r * 2, r * 2, HP.shade(c, 1.25), HP.shade(c, 0.85)); g.fill(); // water
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, r * 0.6, 0.3, 2.4); g.stroke();                 // shimmer
      g.beginPath(); g.arc(cx, cy, r * 0.35, 3.4, 5.5); g.stroke();
      g.strokeStyle = '#c9ced4'; g.lineWidth = 3;                                  // ladder
      g.beginPath(); g.moveTo(cx + r * 0.7, cy - r * 0.7); g.lineTo(cx + r * 0.55, cy - r * 0.45); g.stroke();
    } },
  { id: 'diveboard', name: 'Diving Board', cat: 'Outdoor', w: 1, h: 2, colors: ['#e8e0d0', '#a8b8c8', '#d8cfc0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.25, H * 0.6, W * 0.5, H * 0.3, 3, '#8b939c');                 // base stand
      p.box(g, W * 0.32, H * 0.05, W * 0.36, H * 0.75, 3,
        p.lg(g, W * 0.32, H * 0.05, W * 0.36, H * 0.75, HP.shade(c, 1.1), HP.shade(c, 0.85))); // board
      g.strokeStyle = HP.shade(c, 0.6); P().RR(g, W * 0.32, H * 0.05, W * 0.36, H * 0.75, 3); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.2)';                                            // grip lines
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.34, H * (0.12 + i * 0.12)); g.lineTo(W * 0.66, H * (0.12 + i * 0.12)); g.stroke(); }
    } },
  { id: 'outshower', name: 'Outdoor Shower', cat: 'Outdoor', w: 1, h: 1, colors: ['#8a6844', '#5b5f6b', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.15, H * 0.6, W * 0.7, H * 0.32, HP.shade(c, 0.9));           // deck
      g.strokeStyle = '#8b939c'; g.lineWidth = 4;                                  // post
      g.beginPath(); g.moveTo(W / 2, H * 0.6); g.lineTo(W / 2, H * 0.15); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.15, W * 0.14, 0, Math.PI);                 // shower head
      g.fillStyle = '#c9ced4'; g.fill();
      g.fillStyle = '#5eb8d8';                                                     // water droplets
      for (let i = 0; i < 5; i++) g.fillRect(W * (0.32 + i * 0.09), H * (0.28 + (i % 2) * 0.08), 2, 4);
    } },
  { id: 'pergola', name: 'Pergola', cat: 'Outdoor', w: 3, h: 3, colors: ['#8a6844', '#5b5f6b', '#a89885'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(pt => {             // posts
        p.box(g, pt[0] - 5, pt[1] - 5, 10, 10, 2, HP.shade(c, 0.8));
      });
      g.strokeStyle = c; g.lineWidth = 4;                                          // beams
      g.beginPath(); g.moveTo(8, 8); g.lineTo(W - 8, 8); g.stroke();
      g.beginPath(); g.moveTo(8, H - 8); g.lineTo(W - 8, H - 8); g.stroke();
      g.strokeStyle = HP.shade(c, 0.85); g.lineWidth = 3;                          // slats
      for (let i = 1; i < 7; i++) {
        const y = 8 + i * (H - 16) / 7;
        g.beginPath(); g.moveTo(8, y); g.lineTo(W - 8, y); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.06)';                                             // slat shadows
      for (let i = 1; i < 7; i++) g.fillRect(10, 10 + i * (H - 16) / 7, W - 20, 3);
    } },
  { id: 'outsofa', name: 'Outdoor Sofa', cat: 'Outdoor', w: 3, h: 1, colors: ['#8a7a68', '#5d6a5a', '#7d8fa3'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, '#a89885');                                    // wicker base
      p.fabric(g, 8, 8, W - 16, H * 0.4, 4, c);                                    // back cushions
      p.cushion(g, 8, H * 0.52, (W - 20) / 2, H * 0.4, HP.shade(c, 1.12));
      p.cushion(g, 12 + (W - 20) / 2, H * 0.52, (W - 20) / 2, H * 0.4, HP.shade(c, 1.12));
    } },
  { id: 'pond', name: 'Pond', cat: 'Outdoor', w: 3, h: 2, colors: ['#4a8a7a', '#4a7a9a', '#3f6d55'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                               // organic blob
      g.moveTo(W * 0.12, H * 0.5);
      g.quadraticCurveTo(W * 0.08, H * 0.1, W * 0.45, H * 0.12);
      g.quadraticCurveTo(W * 0.85, H * 0.05, W * 0.9, H * 0.45);
      g.quadraticCurveTo(W * 0.95, H * 0.85, W * 0.55, H * 0.88);
      g.quadraticCurveTo(W * 0.2, H * 0.92, W * 0.12, H * 0.5);
      g.fillStyle = p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.25), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = '#6d5a45'; g.lineWidth = 3; g.stroke();                      // stone edge
      const lp = [[0.35, 0.4], [0.6, 0.6], [0.72, 0.35]];
      lp.forEach(pt => {                                                           // lily pads
        g.fillStyle = '#5d9a4d';
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.07, 0.4, 6); g.fill();
      });
      g.fillStyle = '#e8a0b8'; g.beginPath(); g.arc(W * 0.62, H * 0.58, 3, 0, 7); g.fill(); // flower
    } },
  { id: 'palmtree', name: 'Palm Tree', cat: 'Outdoor', w: 2, h: 2, colors: ['#5d9a5d', '#4e8a4e', '#6daa5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 8; i++) {                                                // fronds radiating
        const a = i * Math.PI / 4;
        g.save(); g.translate(W / 2, H / 2); g.rotate(a);
        g.beginPath(); g.ellipse(W * 0.3, 0, W * 0.32, W * 0.09, 0, 0, 7);
        g.fillStyle = HP.shade(c, 0.9 + (i % 2) * 0.15); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.12, 0, 7);                          // crown
      g.fillStyle = '#6b5335'; g.fill();
      g.fillStyle = '#8a6844';
      g.beginPath(); g.arc(W * 0.46, H * 0.54, W * 0.05, 0, 7); g.fill();          // coconuts
      g.beginPath(); g.arc(W * 0.56, H * 0.48, W * 0.05, 0, 7); g.fill();
    } },
  { id: 'topiary', name: 'Topiary', cat: 'Outdoor', w: 1, h: 1, colors: ['#4e7d45', '#5d8a50', '#3f6d55'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.pot(g, W / 2, H * 0.75, W * 0.2);
      g.fillStyle = '#6b4f33'; g.fillRect(W * 0.46, H * 0.45, W * 0.08, H * 0.25); // stem
      for (let i = 0; i < 3; i++) {                                                // clipped spheres
        g.beginPath(); g.arc(W / 2, H * (0.42 - i * 0.18), W * (0.24 - i * 0.05), 0, 7);
        g.fillStyle = p.lg(g, W * 0.3, H * (0.3 - i * 0.18), W * 0.4, W * 0.4, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      }
    } },
  { id: 'veggie', name: 'Veggie Patch', cat: 'Garden', w: 3, h: 1, colors: ['#5d8a50', '#4e7d45', '#8a6d45'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 6, W - 8, H - 12, '#8a6844');                                   // raised bed
      g.fillStyle = '#3e2e20'; g.fillRect(8, 10, W - 16, H - 20);                  // soil
      const vc = ['#5d8a50', '#e08040', '#8aa84d'];
      for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
        if (vc[r] === '#e08040') {                                                 // carrots (dots)
          g.fillStyle = '#e08040';
          g.beginPath(); g.arc(W * (0.14 + i * 0.18), H * (0.35 + r * 0.4), 3, 0, 7); g.fill();
          g.strokeStyle = '#5d8a50'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(W * (0.14 + i * 0.18), H * (0.35 + r * 0.4) - 3);
          g.lineTo(W * (0.14 + i * 0.18), H * (0.35 + r * 0.4) - 7); g.stroke();
        } else {
          p.leaves(g, W * (0.14 + i * 0.18), H * (0.35 + r * 0.4), W * 0.06, vc[r], 4);
        }
      }
    } },
  { id: 'gnome', name: 'Garden Gnome', cat: 'Garden', w: 1, h: 1, colors: ['#a03a3a', '#4a6b8a', '#5d8a5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                               // hat
      g.moveTo(W * 0.3, H * 0.5); g.lineTo(W / 2, H * 0.12); g.lineTo(W * 0.7, H * 0.5); g.closePath();
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.55, W * 0.16, 0, 7);                       // face
      g.fillStyle = '#f0d0b0'; g.fill();
      g.fillStyle = '#f0f0e8';                                                     // beard
      g.beginPath(); g.moveTo(W * 0.32, H * 0.58);
      g.quadraticCurveTo(W / 2, H * 0.98, W * 0.68, H * 0.58); g.fill();
      g.fillStyle = '#4a6b8a'; g.fillRect(W * 0.35, H * 0.78, W * 0.3, H * 0.15);  // body
    } },
  { id: 'scarecrow', name: 'Scarecrow', cat: 'Garden', w: 1, h: 1, colors: ['#d8b06a', '#a06558', '#8a6844'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.strokeStyle = '#8a6844'; g.lineWidth = 4;                                  // pole cross
      g.beginPath(); g.moveTo(W / 2, H * 0.9); g.lineTo(W / 2, H * 0.3); g.stroke();
      g.beginPath(); g.moveTo(W * 0.18, H * 0.45); g.lineTo(W * 0.82, H * 0.45); g.stroke();
      g.fillStyle = c;                                                             // shirt
      g.beginPath(); g.moveTo(W * 0.3, H * 0.42); g.lineTo(W * 0.7, H * 0.42);
      g.lineTo(W * 0.62, H * 0.72); g.lineTo(W * 0.38, H * 0.72); g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.28, W * 0.14, 0, 7);                       // head
      g.fillStyle = '#f0d8a8'; g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.2, W * 0.18, Math.PI, 0);                  // hat
      g.fillStyle = '#8a6844'; g.fill();
      g.fillRect(W * 0.28, H * 0.19, W * 0.44, 4);
      g.fillStyle = '#e8c832';                                                     // straw poking out
      for (let i = 0; i < 3; i++) g.fillRect(W * (0.22 + i * 0.04), H * 0.42, 2, 6);
      for (let i = 0; i < 3; i++) g.fillRect(W * (0.72 + i * 0.04), H * 0.42, 2, 6);
    } },
  { id: 'goal', name: 'Soccer Goal', cat: 'Outdoor', w: 3, h: 2, colors: ['#e8ecf0', '#dfe5ea', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = 'rgba(120,160,120,.25)';                                       // net depth
      g.fillRect(8, H * 0.15, W - 16, H * 0.55);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;                          // net mesh
      for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(8 + i * (W - 16) / 8, H * 0.15); g.lineTo(8 + i * (W - 16) / 8, H * 0.7); g.stroke(); }
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(8, H * 0.15 + i * H * 0.14); g.lineTo(W - 8, H * 0.15 + i * H * 0.14); g.stroke(); }
      g.strokeStyle = c; g.lineWidth = 4;                                          // frame
      g.beginPath(); g.moveTo(8, H * 0.15); g.lineTo(W - 8, H * 0.15); g.stroke(); // crossbar
      g.beginPath(); g.moveTo(8, H * 0.15); g.lineTo(8, H * 0.72); g.stroke();
      g.beginPath(); g.moveTo(W - 8, H * 0.15); g.lineTo(W - 8, H * 0.72); g.stroke();
      g.beginPath(); g.moveTo(8, H * 0.15); g.lineTo(16, H * 0.05); g.stroke();    // depth braces
      g.beginPath(); g.moveTo(W - 8, H * 0.15); g.lineTo(W - 16, H * 0.05); g.stroke();
    } },
  { id: 'volleyball', name: 'Volleyball Net', cat: 'Outdoor', w: 3, h: 1, colors: ['#e8ecf0', '#a8c8d8', '#f0d090'],
    draw(g, W, H, v) {
      g.fillStyle = '#555c66';
      g.fillRect(8, H * 0.2, 4, H * 0.6); g.fillRect(W - 12, H * 0.2, 4, H * 0.6); // posts
      g.strokeStyle = '#8b939c'; g.lineWidth = 1.5;                                // net
      g.strokeRect(12, H * 0.25, W - 24, H * 0.5);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
      for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(12 + i * (W - 24) / 10, H * 0.25); g.lineTo(12 + i * (W - 24) / 10, H * 0.75); g.stroke(); }
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(12, H * 0.25 + i * H * 0.17); g.lineTo(W - 12, H * 0.25 + i * H * 0.17); g.stroke(); }
      g.fillStyle = '#f0f0e8';                                                     // ball
      g.beginPath(); g.arc(W * 0.55, H * 0.15, 4, 0, 7); g.fill();
    } },
  { id: 'skateramp', name: 'Skate Ramp', cat: 'Outdoor', w: 2, h: 1, colors: ['#8a8a94', '#6b6f78', '#a8a294'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                               // quarter-pipe profile
      g.moveTo(6, H - 8); g.lineTo(W * 0.4, H - 8);
      g.quadraticCurveTo(W * 0.55, H - 8, W * 0.62, H * 0.3);
      g.lineTo(W - 6, H * 0.3); g.lineTo(W - 6, H - 8); g.closePath();
      g.fillStyle = p.lg(g, 6, H * 0.3, W - 12, H * 0.7, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#e05252'; g.fillRect(W * 0.6, H * 0.22, W * 0.38, H * 0.08);  // coping edge
      g.strokeStyle = 'rgba(0,0,0,.2)';
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.62 + i * 4, H * 0.34); g.lineTo(W * 0.62 + i * 4, H - 8); g.stroke(); }
    } },
  { id: 'slide', name: 'Slide', cat: 'Outdoor', w: 1, h: 2, colors: ['#e08040', '#e8c832', '#4a8ab0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8b939c'; g.lineWidth = 2.5;                                // ladder
      g.beginPath(); g.moveTo(W * 0.3, H * 0.05); g.lineTo(W * 0.3, H * 0.4); g.stroke();
      g.beginPath(); g.moveTo(W * 0.7, H * 0.05); g.lineTo(W * 0.7, H * 0.4); g.stroke();
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.3, H * i * 0.1); g.lineTo(W * 0.7, H * i * 0.1); g.stroke(); }
      g.beginPath();                                                               // slide chute
      g.moveTo(W * 0.32, H * 0.4);
      g.quadraticCurveTo(W * 0.3, H * 0.7, W * 0.28, H * 0.95);
      g.lineTo(W * 0.72, H * 0.95);
      g.quadraticCurveTo(W * 0.7, H * 0.7, W * 0.68, H * 0.4); g.closePath();
      g.fillStyle = p.lg(g, W * 0.28, H * 0.4, W * 0.44, H * 0.55, HP.shade(c, 1.2), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
    } },
  { id: 'playhouse', name: 'Playhouse', cat: 'Outdoor', w: 2, h: 2, colors: ['#e8a0a8', '#a0c8e8', '#d8b06a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 5, W - 10, H - 10, 3, p.lg(g, 5, 5, W - 10, H - 10, HP.shade(c, 1.12), HP.shade(c, 0.85)));
      g.fillStyle = HP.shade(c, 0.6);                                              // roof triangle
      g.beginPath(); g.moveTo(5, H * 0.35); g.lineTo(W / 2, 5); g.lineTo(W - 5, H * 0.35); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      p.box(g, W * 0.4, H * 0.55, W * 0.2, H * 0.4, 2, '#6b4f33');                 // door
      g.fillStyle = '#c9e0f0'; g.fillRect(W * 0.15, H * 0.45, W * 0.16, H * 0.16); // windows
      g.fillRect(W * 0.7, H * 0.45, W * 0.16, H * 0.16);
      g.strokeStyle = '#8fa4b0'; g.strokeRect(W * 0.15, H * 0.45, W * 0.16, H * 0.16);
      g.strokeRect(W * 0.7, H * 0.45, W * 0.16, H * 0.16);
    } },
  { id: 'treehouse', name: 'Treehouse', cat: 'Outdoor', w: 3, h: 3, colors: ['#8a6844', '#6b4f33', '#a4805c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 8; i++) {                                                // tree foliage
        const a = i * Math.PI / 4;
        g.beginPath(); g.ellipse(W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * H * 0.3,
          W * 0.14, W * 0.14, 0, 0, 7);
        g.fillStyle = HP.shade('#4e7d45', 0.9 + (i % 3) * 0.08); g.fill();
      }
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.28, 0, 7);                          // trunk area
      g.fillStyle = '#6b4f33'; g.fill();
      p.wood(g, W * 0.28, H * 0.28, W * 0.44, H * 0.44, c);                        // platform house
      g.fillStyle = '#c9e0f0'; g.fillRect(W * 0.36, H * 0.36, W * 0.12, H * 0.12); // window
      g.fillStyle = '#3f3a34'; g.fillRect(W * 0.3, H * 0.3, W * 0.4, 3);           // roof edge
      g.strokeStyle = '#c9854e'; g.lineWidth = 2;                                  // rope ladder
      g.beginPath(); g.moveTo(W * 0.75, H * 0.6); g.lineTo(W * 0.82, H * 0.85); g.stroke();
      g.beginPath(); g.moveTo(W * 0.72, H * 0.66); g.lineTo(W * 0.84, H * 0.66); g.stroke();
    } },
  { id: 'ridemower', name: 'Ride-on Mower', cat: 'Garage', w: 1, h: 2, colors: ['#5d8a5d', '#e8b04a', '#a03a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#1b1e22';                                                     // wheels
      g.beginPath(); g.arc(W * 0.25, H * 0.25, W * 0.14, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.75, H * 0.25, W * 0.14, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.25, H * 0.78, W * 0.17, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.75, H * 0.78, W * 0.17, 0, 7); g.fill();
      p.box(g, W * 0.28, H * 0.3, W * 0.44, H * 0.4, 5,                            // body
        p.lg(g, W * 0.28, H * 0.3, W * 0.44, H * 0.4, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#3a3f47'; g.fillRect(W * 0.35, H * 0.62, W * 0.3, H * 0.14);  // seat
      g.strokeStyle = '#22252a'; g.lineWidth = 2;
      g.beginPath(); g.arc(W / 2, H * 0.42, W * 0.12, 0, 7); g.stroke();           // steering wheel
    } },
  { id: 'rabbithutch', name: 'Rabbit Hutch', cat: 'Garden', w: 2, h: 1, colors: ['#8a6844', '#a4805c', '#6b4f33'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 5, W - 8, H - 10, c);
      p.box(g, 8, 9, W * 0.4, H - 18, 3, HP.shade(c, 0.6));                        // closed den
      g.strokeStyle = '#8b939c'; g.lineWidth = 1;                                  // wire run
      g.strokeRect(W * 0.48, 9, W * 0.44, H - 18);
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.48 + i * W * 0.11, 9); g.lineTo(W * 0.48 + i * W * 0.11, H - 9); g.stroke(); }
      g.fillStyle = '#f0ece2';                                                     // rabbit
      g.beginPath(); g.ellipse(W * 0.68, H * 0.55, W * 0.08, H * 0.15, 0.2, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W * 0.71, H * 0.32, W * 0.03, H * 0.12, 0.1, 0, 7); g.fill(); // ears
    } },
  { id: 'chickencoop', name: 'Chicken Coop', cat: 'Garden', w: 2, h: 2, colors: ['#a06558', '#8a6844', '#5d6a5a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8b939c'; g.lineWidth = 1;                                  // wire run
      g.strokeRect(W * 0.4, 8, W * 0.56, H - 16);
      g.setLineDash([3, 3]);
      g.strokeRect(W * 0.45, 13, W * 0.46, H - 26); g.setLineDash([]);
      p.wood(g, 6, 8, W * 0.42, H - 16, c);                                        // coop house
      g.fillStyle = HP.shade(c, 0.6);
      g.beginPath(); g.moveTo(6, H * 0.35); g.lineTo(W * 0.27, 8); g.lineTo(W * 0.48, H * 0.35); g.fill(); // roof
      g.fillStyle = '#2a2520'; g.beginPath(); g.arc(W * 0.27, H * 0.55, 4, 0, 7); g.fill(); // entrance
      g.fillStyle = '#f0ece2';                                                     // chickens
      g.beginPath(); g.arc(W * 0.62, H * 0.5, 4, 0, 7); g.fill();
      g.fillStyle = '#e8b04a'; g.beginPath(); g.arc(W * 0.78, H * 0.65, 3.5, 0, 7); g.fill();
    } },
  { id: 'beehive', name: 'Beehive', cat: 'Garden', w: 1, h: 1, colors: ['#e8c850', '#d8b06a', '#c9a44e'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 3; i++) {                                                // stacked boxes
        p.box(g, W * (0.28 - i * 0.03), H * (0.62 - i * 0.2), W * (0.44 + i * 0.06), H * 0.22, 2,
          p.lg(g, 0, H * (0.62 - i * 0.2), W, H * 0.22, HP.shade(c, 1.1), HP.shade(c, 0.85)));
      }
      g.fillStyle = '#8a6844';                                                     // roof
      g.beginPath(); g.moveTo(W * 0.22, H * 0.28); g.lineTo(W / 2, H * 0.1); g.lineTo(W * 0.78, H * 0.28); g.fill();
      g.fillStyle = '#3a3020'; g.fillRect(W * 0.44, H * 0.62, W * 0.12, H * 0.08); // entrance
      g.fillStyle = '#3a3020';                                                     // bees
      [[0.15, 0.3], [0.85, 0.45], [0.2, 0.7]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], 2, 0, 7); g.fill();
      });
    } },
  { id: 'patioheater', name: 'Patio Heater', cat: 'Outdoor', w: 1, h: 1, colors: ['#8b939c', '#5b5f6b', '#a08055'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.9, W * 0.2, H * 0.08, 0, 0, 7);        // base
      g.fillStyle = HP.shade(c, 0.8); g.fill();
      g.fillStyle = HP.shade(c, 0.9); g.fillRect(W * 0.46, H * 0.35, W * 0.08, H * 0.55); // pole
      g.beginPath(); g.ellipse(W / 2, H * 0.25, W * 0.3, H * 0.18, 0, 0, 7);        // mushroom cap
      g.fillStyle = p.lg(g, W * 0.25, H * 0.1, W * 0.5, H * 0.3, HP.shade(c, 1.15), HP.shade(c, 0.7)); g.fill();
      const hg = g.createRadialGradient(W / 2, H * 0.38, 1, W / 2, H * 0.38, W * 0.25);
      hg.addColorStop(0, 'rgba(255,180,80,.7)'); hg.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = hg; g.beginPath(); g.arc(W / 2, H * 0.38, W * 0.25, 0, 7); g.fill(); // heat glow
    } },
  { id: 'gardwell', name: 'Garden Well', cat: 'Garden', w: 1, h: 1, colors: ['#a8a294', '#8a6844', '#8b8b83'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8a6844'; g.lineWidth = 2.5;                                // posts + roof
      g.beginPath(); g.moveTo(W * 0.22, H * 0.15); g.lineTo(W * 0.22, H * 0.6); g.stroke();
      g.beginPath(); g.moveTo(W * 0.78, H * 0.15); g.lineTo(W * 0.78, H * 0.6); g.stroke();
      g.fillStyle = '#6b4f33';
      g.beginPath(); g.moveTo(W * 0.14, H * 0.22); g.lineTo(W / 2, H * 0.02); g.lineTo(W * 0.86, H * 0.22); g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.34, 0, 7);                       // stone ring
      g.fillStyle = p.lg(g, W * 0.2, H * 0.3, W * 0.6, H * 0.6, HP.shade(c, 1.1), HP.shade(c, 0.75)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.62, W * 0.2, 0, 7);                        // water
      g.fillStyle = '#3a5a6a'; g.fill();
      g.strokeStyle = '#8b939c'; g.lineWidth = 1.5;                                // crank + rope
      g.beginPath(); g.moveTo(W * 0.22, H * 0.45); g.lineTo(W * 0.78, H * 0.45); g.stroke();
      g.fillStyle = '#8a6844'; g.fillRect(W * 0.46, H * 0.42, W * 0.08, H * 0.12); // bucket
    } },
  { id: 'birdfeeder', name: 'Bird Feeder', cat: 'Garden', w: 1, h: 1, colors: ['#8a6844', '#a03a3a', '#5d6a5a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 2.5;                                // shepherd's hook pole
      g.beginPath(); g.moveTo(W * 0.35, H * 0.9); g.lineTo(W * 0.35, H * 0.3);
      g.arcTo(W * 0.35, H * 0.15, W * 0.5, H * 0.15, H * 0.15); g.stroke();
      p.box(g, W * 0.42, H * 0.2, W * 0.3, H * 0.35, 4,                            // feeder house
        p.lg(g, W * 0.42, H * 0.2, W * 0.3, H * 0.35, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.fillStyle = HP.shade(c, 0.6);
      g.beginPath(); g.moveTo(W * 0.4, H * 0.28); g.lineTo(W * 0.57, H * 0.12); g.lineTo(W * 0.74, H * 0.28); g.fill(); // roof
      g.fillStyle = '#e8c850'; g.beginPath(); g.arc(W * 0.57, H * 0.42, 3, 0, 7); g.fill(); // bird
    } },

  /* ---------------- MODULAR SOFA (pieces connect into any sectional shape) ---------------- */
  { id: 'modseat', name: 'Sofa Seat', cat: 'Modular', w: 2, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68'],
    draw(g, W, H, v) {                              // no arms — connects on both sides
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H * 0.3, W - 8, H * 0.66, 6, HP.shade(c, 0.82));
      p.fabric(g, 4, 4, W - 8, H * 0.32, 6, c);
      p.cushion(g, 8, H * 0.4, W - 16, H * 0.5, HP.shade(c, 1.12));
    } },
  { id: 'modarmL', name: 'Sofa Arm ←', cat: 'Modular', w: 2, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H * 0.3, W - 8, H * 0.66, 6, HP.shade(c, 0.82));
      p.fabric(g, 4, 4, W - 8, H * 0.32, 6, c);
      p.cushion(g, 16, H * 0.4, W - 24, H * 0.5, HP.shade(c, 1.12));
      p.fabric(g, 2, 4, 12, H - 8, 5, HP.shade(c, 0.9));          // left arm
    } },
  { id: 'modarmR', name: 'Sofa Arm →', cat: 'Modular', w: 2, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H * 0.3, W - 8, H * 0.66, 6, HP.shade(c, 0.82));
      p.fabric(g, 4, 4, W - 8, H * 0.32, 6, c);
      p.cushion(g, 8, H * 0.4, W - 24, H * 0.5, HP.shade(c, 1.12));
      p.fabric(g, W - 14, 4, 12, H - 8, 5, HP.shade(c, 0.9));     // right arm
    } },
  { id: 'modcorner', name: 'Sofa Corner', cat: 'Modular', w: 2, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68'],
    draw(g, W, H, v) {                              // backs on top + left; rotate for other corners
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H * 0.3, W - 8, H * 0.66, 6, HP.shade(c, 0.82));
      p.fabric(g, 4, 4, W - 8, H * 0.32, 6, c);                   // top back
      p.fabric(g, 4, 4, W * 0.28, H - 8, 6, c);                   // left back
      p.cushion(g, W * 0.32, H * 0.4, W * 0.64, H * 0.5, HP.shade(c, 1.12));
      p.pillow(g, W * 0.3, H * 0.1, 13, HP.shade(c, 1.3), -0.2);
    } },
  { id: 'modchaise', name: 'Chaise Module', cat: 'Modular', w: 2, h: 2, colors: ['#7d8fa3', '#a06558', '#718a68'],
    draw(g, W, H, v) {                              // open seat — attaches to a seat's front
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 4, W - 8, H - 8, 8, HP.shade(c, 0.88));
      p.cushion(g, 8, 8, W - 16, H * 0.62, HP.shade(c, 1.12));
      p.pillow(g, W * 0.3, H * 0.68, 16, HP.shade(c, 1.25), 0.1);
    } },
  { id: 'modtable', name: 'Sofa Table Module', cat: 'Modular', w: 2, h: 2, colors: ['#9a774f', '#5b4a3a', '#d6c9b2'],
    draw(g, W, H, v) {                              // wooden console between/behind seats
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(8, H * 0.5); g.lineTo(W - 8, H * 0.5); g.stroke();
      g.fillStyle = '#8fb8a0'; g.fillRect(W * 0.4, H * 0.15, W * 0.2, H * 0.22);   // vase
      g.fillStyle = '#e8e2d8';
      g.beginPath(); g.arc(W * 0.35, H * 0.72, 4, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.65, H * 0.72, 4, 0, 7); g.fill();                  // cups
    } },

  /* ---------------- SOFA COLLECTION (styles × brands × colors) ---------------- */
  { id: 'chester2', name: 'Chesterfield 2', cat: 'Living', brand: 'Heritage', w: 3, h: 2, colors: LEAT, draw: sofaPro({ n: 2, arm: 'roll', back: 'tuft', leg: 'wood' }) },
  { id: 'chester3', name: 'Chesterfield 3', cat: 'Living', brand: 'Heritage', w: 4, h: 2, colors: LEAT, draw: sofaPro({ n: 3, arm: 'roll', back: 'tuft', leg: 'wood' }) },
  { id: 'tuxedo3', name: 'Tuxedo Sofa', cat: 'Living', brand: 'Velluto', w: 4, h: 2, colors: VELV, draw: sofaPro({ n: 3, arm: 'track', back: 'tuft', leg: 'metal' }) },
  { id: 'camel3', name: 'Camelback Sofa', cat: 'Living', brand: 'Heritage', w: 4, h: 2, colors: FABC, draw: sofaPro({ n: 3, arm: 'roll', back: 'camel', leg: 'wood', skirt: true }) },
  { id: 'english3', name: 'English Roll-Arm', cat: 'Living', brand: 'Heritage', w: 4, h: 2, colors: FABC, draw: sofaPro({ n: 3, arm: 'roll', back: 'plain', skirt: true }) },
  { id: 'midcen3', name: 'Mid-Century 3', cat: 'Living', brand: 'Nordvik', w: 4, h: 2, colors: FABC, draw: sofaPro({ n: 3, arm: 'low', back: 'tuft', leg: 'wood' }) },
  { id: 'track2', name: 'Track-Arm 2', cat: 'Living', brand: 'CasaModa', w: 3, h: 2, colors: FABC, draw: sofaPro({ n: 2, arm: 'track', back: 'plain', leg: 'metal' }) },
  { id: 'track3', name: 'Track-Arm 3', cat: 'Living', brand: 'CasaModa', w: 4, h: 2, colors: FABC, draw: sofaPro({ n: 3, arm: 'track', back: 'plain', leg: 'metal' }) },
  { id: 'track4', name: 'Grand Sofa 4', cat: 'Living', brand: 'CasaModa', w: 5, h: 2, colors: FABC, draw: sofaPro({ n: 4, arm: 'track', back: 'plain', leg: 'metal' }) },
  { id: 'velvet3', name: 'Velvet Sofa', cat: 'Living', brand: 'Velluto', w: 4, h: 2, colors: VELV, draw: sofaPro({ n: 3, arm: 'low', back: 'chan', leg: 'metal' }) },
  { id: 'boucle3', name: 'Boucle Sofa', cat: 'Living', brand: 'Aria', w: 4, h: 2, colors: BOUC, draw: sofaPro({ n: 3, arm: 'low', back: 'plain' }) },
  { id: 'armless3', name: 'Armless Sofa', cat: 'Living', brand: 'Aria', w: 3, h: 2, colors: BOUC, draw: sofaPro({ n: 2, arm: 'none', back: 'plain', leg: 'wood' }) },
  { id: 'futon', name: 'Futon', cat: 'Living', brand: 'UrbanForm', w: 3, h: 2, colors: FABC, draw: sofaPro({ n: 2, arm: 'none', back: 'plain', leg: 'metal', futon: true }) },
  { id: 'sleeper', name: 'Sleeper Sofa', cat: 'Living', brand: 'Softline', w: 4, h: 2, colors: FABC, draw: sofaPro({ n: 3, arm: 'track', back: 'plain', skirt: true }) },
  { id: 'loveseat2', name: 'Loveseat', cat: 'Living', brand: 'Softline', w: 2, h: 2, colors: FABC, draw: sofaPro({ n: 1, arm: 'roll', back: 'plain' }) },
  { id: 'settee', name: 'Settee', cat: 'Living', brand: 'Heritage', w: 3, h: 2, colors: VELV, draw: sofaPro({ n: 2, arm: 'low', back: 'tuft', leg: 'wood' }) },
  { id: 'reclinerSofa', name: 'Recliner Sofa', cat: 'Living', brand: 'Softline', w: 4, h: 2, colors: LEAT, draw: sofaPro({ n: 3, arm: 'track', back: 'chan', recline: true }) },
  { id: 'curvedSofa', name: 'Curved Sofa', cat: 'Living', brand: 'Velluto', w: 4, h: 2, colors: VELV,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, H * 0.28, W - 8, H * 0.68, 18, HP.shade(c, 0.82));
      g.beginPath(); g.ellipse(W / 2, 8, W * 0.4, H * 0.24, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.1, 0, W * 0.8, H * 0.3, HP.shade(c, 1.05), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      const cw = (W - 30) / 3;
      for (let i = 0; i < 3; i++) {
        g.save(); g.translate(15 + i * cw + cw / 2, H * 0.56); g.rotate((i - 1) * 0.12);
        p.cushion(g, -cw / 2 + 2, -H * 0.2, cw - 4, H * 0.38, HP.shade(c, 1.12));
        g.restore();
      }
      p.pillow(g, 18, H * 0.16, 13, HP.shade(c, 1.3), -0.3);
      p.pillow(g, W - 32, H * 0.16, 13, HP.shade(c, 1.3), 0.3);
    } },
  { id: 'recamier', name: 'Recamier Chaise', cat: 'Living', brand: 'Heritage', w: 2, h: 3, colors: VELV, draw: chaiseDraw },
  { id: 'daybed2', name: 'Studio Daybed', cat: 'Living', brand: 'Nordvik', w: 2, h: 3, colors: FABC, draw: daybedDraw },
  { id: 'tubchair', name: 'Tub Chair', cat: 'Living', brand: 'CasaModa', w: 2, h: 2, colors: VELV, draw: tubDraw },
  { id: 'wingback', name: 'Wingback Chair', cat: 'Living', brand: 'Heritage', w: 2, h: 2, colors: LEAT, draw: wingDraw },
  { id: 'recliner', name: 'Recliner', cat: 'Living', brand: 'Softline', w: 2, h: 2, colors: LEAT, draw: reclineDraw },
  { id: 'papasan', name: 'Papasan Chair', cat: 'Living', brand: 'TerraHome', w: 2, h: 2, colors: FABC, draw: papasanDraw },
  { id: 'clubchair', name: 'Club Chair', cat: 'Living', brand: 'Heritage', w: 2, h: 2, colors: LEAT, draw: sofaPro({ n: 1, arm: 'roll', back: 'plain' }) },
  { id: 'slipper', name: 'Slipper Chair', cat: 'Living', brand: 'Aria', w: 2, h: 2, colors: BOUC, draw: sofaPro({ n: 1, arm: 'none', back: 'plain', leg: 'wood' }) },
  { id: 'accentchair', name: 'Accent Chair', cat: 'Living', brand: 'Nordvik', w: 2, h: 2, colors: FABC, draw: sofaPro({ n: 1, arm: 'low', back: 'plain', leg: 'wood' }) },
  { id: 'swivelchair', name: 'Swivel Chair', cat: 'Living', brand: 'CasaModa', w: 2, h: 2, colors: FABC,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8b939c'; g.lineWidth = 3;
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.44, 0, 7); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, 4, 0, 7); g.fillStyle = '#555c66'; g.fill();
      p.fabric(g, W * 0.14, H * 0.3, W * 0.72, H * 0.55, 14, HP.shade(c, 0.85));
      p.fabric(g, W * 0.14, 4, W * 0.72, H * 0.3, 10, c);
    } },
  { id: 'rocker', name: 'Rocking Chair', cat: 'Living', brand: 'TerraHome', w: 2, h: 2, colors: FABC,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#6b4f33'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W * 0.15, H - 8);
      g.quadraticCurveTo(W / 2, H - 2, W * 0.85, H - 8); g.stroke();
      p.fabric(g, 8, H * 0.3, W - 16, H * 0.5, 6, HP.shade(c, 0.85));
      p.fabric(g, 8, 4, W - 16, H * 0.3, 6, c);
      p.cushion(g, 12, H * 0.36, W - 24, H * 0.34, HP.shade(c, 1.12));
      p.fabric(g, 4, H * 0.3, 8, H * 0.5, 4, HP.shade(c, 0.9));
      p.fabric(g, W - 12, H * 0.3, 8, H * 0.5, 4, HP.shade(c, 0.9));
    } },
  { id: 'poufround', name: 'Pouf Round', cat: 'Living', brand: 'TerraHome', w: 1, h: 1, colors: TERR, draw: poufDraw(true) },
  { id: 'poufsq', name: 'Pouf Square', cat: 'Living', brand: 'TerraHome', w: 1, h: 1, colors: FABC, draw: poufDraw(false) },
  { id: 'ottomanTuft', name: 'Tufted Ottoman', cat: 'Living', brand: 'Velluto', w: 2, h: 2, colors: VELV,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.cushion(g, 5, 5, W - 10, H - 10, c);
      g.fillStyle = 'rgba(0,0,0,.15)';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        g.beginPath(); g.arc(W * (0.25 + i * 0.25), H * (0.25 + j * 0.25), 2, 0, 7); g.fill();
      }
      g.fillStyle = '#6b4f33';
      [[9, 9], [W - 9, 9], [9, H - 9], [W - 9, H - 9]].forEach(pt => {
        g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill();
      });
    } },
  { id: 'ottomanStor', name: 'Storage Ottoman', cat: 'Living', brand: 'Softline', w: 2, h: 1, colors: FABC,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 4, W - 8, H - 8, 6, HP.shade(c, 0.9));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      P().RR(g, 7, 7, W - 14, H - 14, 4); g.stroke();
      g.fillStyle = HP.shade(c, 1.2); g.fillRect(W * 0.42, H / 2 - 2, W * 0.16, 4);
    } },
  { id: 'footstool', name: 'Footstool', cat: 'Living', brand: 'Nordvik', w: 1, h: 1, colors: FABC,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#6b4f33';
      [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]].forEach(pt => {
        g.beginPath(); g.arc(pt[0], pt[1], 3, 0, 7); g.fill();
      });
      p.cushion(g, 6, 6, W - 12, H - 12, c);
    } },
  { id: 'entrybench', name: 'Entry Bench', cat: 'Living', brand: 'Nordvik', w: 3, h: 1, colors: FABC, joins: true,
    draw(g, W, H, v, m) {
      const p = P(), c = this.colors[v];
      const x0 = (m & 4) ? 0 : 4, x1 = (m & 1) ? W : W - 8;
      p.wood(g, x0, 4, x1 - x0, H - 8, '#8a6844');
      p.cushion(g, x0 + 4, 8, x1 - x0 - 8, H - 16, c);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(10, H - 8 - i * 4 + 12); g.lineTo(W - 10, H - 8 - i * 4 + 12); g.stroke();
      }
    } },

  /* ---------------- DECOR — plants ---------------- */
  { id: 'plsnake', name: 'Snake Plant', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('snake') },
  { id: 'plmonstera', name: 'Monstera', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('monstera') },
  { id: 'plfiddle', name: 'Fiddle-Leaf Fig', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('fiddle') },
  { id: 'plcactus', name: 'Cactus Trio', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('cactus') },
  { id: 'plbonsai', name: 'Bonsai', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: GRE, draw: plantDeco('bonsai') },
  { id: 'plorchid', name: 'Orchid', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: GRE, draw: plantDeco('orchid') },
  { id: 'plpalm', name: 'Parlor Palm', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('palm') },
  { id: 'plpothos', name: 'Pothos', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: plantDeco('pothos') },

  /* ---------------- DECOR — lighting ---------------- */
  { id: 'lamparc', name: 'Arc Floor Lamp', cat: 'Decor', brand: 'CasaModa', w: 1, h: 1, colors: METL, draw: lampDeco('arc') },
  { id: 'lamptripod', name: 'Tripod Lamp', cat: 'Decor', brand: 'Nordvik', w: 1, h: 1, colors: BOUC, draw: lampDeco('tripod') },
  { id: 'lamptorch', name: 'Torchiere', cat: 'Decor', brand: 'UrbanForm', w: 1, h: 1, colors: METL, draw: lampDeco('torch') },
  { id: 'lamptable', name: 'Table Lamp', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: FABC, draw: lampDeco('table') },
  { id: 'lamppaper', name: 'Paper Lantern', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: ['#c9a44e', '#a06558', '#8b939c', '#5d4a68'], draw: lampDeco('paper') },
  { id: 'lampmush', name: 'Mushroom Lamp', cat: 'Decor', brand: 'CasaModa', w: 1, h: 1, colors: ['#e8963c', '#f5efe0', '#a8c8d8', '#e8a0b8', '#5d8a5d'], draw: lampDeco('mush') },
  { id: 'lampcandle', name: 'Candle Lantern', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: METL, draw: lampDeco('candlelamp') },
  { id: 'lampbanker', name: 'Banker Lamp', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: ['#2f5d45', '#3a5f8a', '#8a3a4a', '#5d4a68'], draw: lampDeco('banker') },

  /* ---------------- DECOR — wall art ---------------- */
  { id: 'artabstract', hangs: true, name: 'Abstract Art', cat: 'Decor', brand: 'Aria', w: 2, h: 1, colors: ['#3a3f47', '#8a6844', '#e8e2d6', '#c9a44e'], draw: artDeco('abstract') },
  { id: 'artgeo', hangs: true, name: 'Geo Art', cat: 'Decor', brand: 'Aria', w: 2, h: 1, colors: ['#3a3f47', '#a06558', '#4a6b8a', '#8a6844'], draw: artDeco('geo') },
  { id: 'artland', hangs: true, name: 'Landscape Art', cat: 'Decor', brand: 'Heritage', w: 2, h: 1, colors: ['#8a7a5c', '#5d7484', '#6d8a5d', '#a08a6a'], draw: artDeco('land') },
  { id: 'artbotan', hangs: true, name: 'Botanical Print', cat: 'Decor', brand: 'TerraHome', w: 2, h: 1, colors: GRE, draw: artDeco('botan') },
  { id: 'artline', hangs: true, name: 'Line Art', cat: 'Decor', brand: 'Aria', w: 2, h: 1, colors: ['#3a3f47', '#a06558', '#4a6b8a', '#c9a44e'], draw: artDeco('line') },
  { id: 'arttriptych', hangs: true, name: 'Triptych Set', cat: 'Decor', brand: 'Velluto', w: 3, h: 1, colors: ['#3a3f47', '#8a6844', '#5d4a68', '#a06558'], draw: artDeco('triptych') },
  { id: 'artneon', hangs: true, name: 'Neon Sign', cat: 'Decor', brand: 'UrbanForm', w: 2, h: 1, colors: ['#ff5370', '#4fc3f7', '#b388ff', '#e8c832', '#5dd8a0'], draw: artDeco('neon') },
  { id: 'artphoto', hangs: true, name: 'Photo Wall', cat: 'Decor', brand: 'CasaModa', w: 2, h: 2, colors: ['#3a3f47', '#8a6844', '#e8e2d6'], draw: artDeco('photo') },

  /* ---------------- DECOR — mirrors & clocks ---------------- */
  { id: 'mirsun', name: 'Sunburst Mirror', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: ['#c9a44e', '#8b939c', '#8a6844'], draw: mirrorDeco('sun') },
  { id: 'miroval', name: 'Oval Mirror', cat: 'Decor', brand: 'Heritage', w: 1, h: 2, colors: ['#c9a44e', '#3a3f47', '#8a6844', '#e8e2d6'], draw: mirrorDeco('oval') },
  { id: 'mirarch', name: 'Arch Mirror', cat: 'Decor', brand: 'Aria', w: 1, h: 2, colors: ['#3a3f47', '#c9a44e', '#8a6844', '#8b939c'], draw: mirrorDeco('arch') },
  { id: 'mirwavy', name: 'Wavy Mirror', cat: 'Decor', brand: 'CasaModa', w: 1, h: 2, colors: ['#e8a0b8', '#a8c8d8', '#c9a44e', '#3a3f47'], draw: mirrorDeco('wavy') },
  { id: 'clkround', name: 'Wall Clock', cat: 'Decor', brand: 'CasaModa', w: 1, h: 1, colors: ['#3a3f47', '#e8e2d6', '#c9a44e', '#8a6844'], draw: clockDeco('round') },
  { id: 'clkroman', name: 'Roman Clock', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#a06558'], draw: clockDeco('roman') },
  { id: 'clkgrand', name: 'Grandfather Clock', cat: 'Decor', brand: 'Heritage', w: 1, h: 2, colors: ['#6b4f33', '#8a6844', '#3a3f47'], draw: clockDeco('grand') },

  /* ---------------- DECOR — rugs ---------------- */
  { id: 'rugshag', name: 'Shag Rug', cat: 'Decor', brand: 'Softline', w: 4, h: 3, walkable: true, colors: ['#e8e2d6', '#d8c8bc', '#c9c2b2', '#b8a8c8', '#a8b8c8'], draw: rugDeco('shag') },
  { id: 'rugpersian', name: 'Persian Rug', cat: 'Decor', brand: 'Heritage', w: 4, h: 3, walkable: true, colors: ['#8a3a4a', '#3a5f8a', '#8a6a3a', '#5d4a68'], draw: rugDeco('persian') },
  { id: 'rugjute', name: 'Jute Rug', cat: 'Decor', brand: 'TerraHome', w: 4, h: 3, walkable: true, colors: ['#c9b48f', '#b8a078', '#d8cfc0', '#a89885'], draw: rugDeco('jute') },
  { id: 'ruggeo', name: 'Geo Rug', cat: 'Decor', brand: 'Aria', w: 4, h: 3, walkable: true, colors: FABC, draw: rugDeco('geo') },
  { id: 'rughide', name: 'Hide Rug', cat: 'Decor', brand: 'UrbanForm', w: 3, h: 2, walkable: true, colors: ['#a89078', '#6b4a33', '#d8cfc0', '#3a3f47'], draw: rugDeco('hide') },
  { id: 'rugbraid', name: 'Braided Rug', cat: 'Decor', brand: 'TerraHome', w: 3, h: 3, walkable: true, colors: TERR, draw: rugDeco('braid') },
  { id: 'rugplay', name: 'Road Play Rug', cat: 'Decor', brand: 'Softline', w: 4, h: 3, walkable: true, colors: ['#8fb8d8', '#a8c8a8', '#d8b8b8'], draw: rugDeco('play') },

  /* ---------------- DECOR — tabletop ---------------- */
  { id: 'topvase', name: 'Flower Vase', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: ['#a8c8d8', '#e8a0b8', '#5d8a5d', '#3a3f47', '#e8e2d6'], draw: topDeco('vase') },
  { id: 'topcandles', name: 'Candle Trio', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#c9a44e'], draw: topDeco('candles') },
  { id: 'topbooks', name: 'Book Stack', cat: 'Decor', brand: 'Nordvik', w: 1, h: 1, colors: ['#a03a3a', '#3a5f8a', '#5d8a5d'], draw: topDeco('books') },
  { id: 'topbowl', name: 'Fruit Bowl', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: ['#8a6844', '#e8e2d6', '#3a3f47', '#a8c8d8'], draw: topDeco('bowl') },
  { id: 'topterra', name: 'Terrarium', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: GRE, draw: topDeco('terra') },
  { id: 'topdiffuser', name: 'Reed Diffuser', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: ['#b8a8c8', '#a8c8d8', '#c9a44e', '#5d8a5d'], draw: topDeco('diffuser') },
  { id: 'topframe', name: 'Photo Frame', cat: 'Decor', brand: 'CasaModa', w: 1, h: 1, colors: ['#6b4f33', '#3a3f47', '#c9a44e'], draw: topDeco('frame') },
  { id: 'topsucculent', name: 'Succulent', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: GRE, draw: topDeco('succulent') },
  { id: 'topalarm', name: 'Alarm Clock', cat: 'Decor', brand: 'Nordvik', w: 1, h: 1, colors: ['#e8c832', '#3a3f47', '#e8a0b8', '#a8c8d8'], draw: topDeco('alarm') },
  { id: 'topknot', name: 'Knot Sculpture', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: ['#c9a44e', '#3a3f47', '#8b939c', '#a06558'], draw: topDeco('knot') },
  { id: 'topincense', name: 'Incense Holder', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: ['#8a6844', '#3a3f47'], draw: topDeco('incense') },

  /* ---------------- DECOR — floor pieces ---------------- */
  { id: 'flbasket', name: 'Blanket Basket', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: ['#c9b48f', '#a89885', '#8f8578', '#6b4f33'], draw: floorDeco('basket') },
  { id: 'flplantstand', name: 'Plant Stand', cat: 'Decor', brand: 'Nordvik', w: 1, h: 1, colors: GRE, draw: floorDeco('plantstand') },
  { id: 'flmagrack', name: 'Magazine Rack', cat: 'Decor', brand: 'CasaModa', w: 1, h: 1, colors: ['#8a6844', '#3a3f47'], draw: floorDeco('magrack') },
  { id: 'flwinerack', name: 'Wine Rack', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#a06558'], draw: floorDeco('winerack') },
  { id: 'flcrate', name: 'Vinyl Crate', cat: 'Decor', brand: 'UrbanForm', w: 1, h: 1, colors: ['#8a6844', '#5b5f6b', '#a06558'], draw: floorDeco('crate') },
  { id: 'flspeaker', name: 'Bookshelf Speaker', cat: 'Decor', brand: 'UrbanForm', w: 1, h: 1, colors: ['#3a3f47', '#8a6844', '#5b5f6b'], draw: floorDeco('speaker') },
  { id: 'flscratch', name: 'Scratching Post', cat: 'Decor', brand: 'Softline', w: 1, h: 1, colors: ['#c9b48f', '#8f8578', '#a06558'], draw: floorDeco('scratch') },
  { id: 'fldogbowl', name: 'Pet Bowls', cat: 'Decor', brand: 'Softline', w: 1, h: 1, colors: ['#a8c8d8', '#e8a0b8', '#8b939c', '#5d8a5d'], draw: floorDeco('dogbowl') },
  { id: 'fllogbasket', name: 'Log Basket', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: ['#6b4f33', '#8a6844', '#5b5f6b'], draw: floorDeco('logbasket') },
  { id: 'flvase', name: 'Floor Vase', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: ['#a8c8d8', '#e8e2d6', '#3a3f47', '#a06558', '#5d8a5d'], draw: floorDeco('floorvase') },
  { id: 'fllantern', name: 'Floor Lantern', cat: 'Decor', brand: 'TerraHome', w: 1, h: 1, colors: METL, draw: floorDeco('lantern') },

  /* ---------------- DECOR — sculptures & screens ---------------- */
  { id: 'stbust', name: 'Bust Statue', cat: 'Decor', brand: 'Heritage', w: 1, h: 1, colors: ['#e8e2d6', '#c9c2b2', '#8b939c', '#5b5f6b'], draw: statueDeco('bust') },
  { id: 'stcolumn', name: 'Spiral Sculpture', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: ['#c9a44e', '#3a3f47', '#8b939c', '#a06558'], draw: statueDeco('column') },
  { id: 'stceramic', name: 'Ceramic Figure', cat: 'Decor', brand: 'Velluto', w: 1, h: 1, colors: ['#a8c8d8', '#e8a0b8', '#e8e2d6', '#5d8a5d'], draw: statueDeco('ceramic') },
  { id: 'stfount', name: 'Zen Fountain', cat: 'Decor', brand: 'Aria', w: 1, h: 1, colors: ['#8b8b83', '#a8a294', '#5b5f6b'], draw: statueDeco('fount') },
  { id: 'shoji', name: 'Shoji Screen', cat: 'Decor', brand: 'Aria', w: 3, h: 1, colors: ['#8a6844', '#5b5f6b', '#a89885'], draw: shojiDraw },
  { id: 'tapestry', name: 'Wall Tapestry', cat: 'Decor', brand: 'TerraHome', w: 2, h: 1, colors: TERR,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.fabric(g, 4, 4, W - 8, H - 8, 3, c);
      g.fillStyle = HP.shade(c, 1.15);                                          // diamond motif
      g.beginPath(); g.moveTo(W / 2, H * 0.2); g.lineTo(W * 0.65, H / 2); g.lineTo(W / 2, H * 0.8); g.lineTo(W * 0.35, H / 2); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      P().RR(g, 8, 8, W - 16, H - 16, 2); g.stroke();
      g.strokeStyle = HP.shade(c, 0.75);                                        // fringe
      for (let x = 8; x < W - 8; x += 8) {
        g.beginPath(); g.moveTo(x, H - 4); g.lineTo(x, H - 1); g.stroke();
      }
      g.fillStyle = '#8a6844'; g.fillRect(4, 2, W - 8, 3);                      // hanging rod
    } },

  /* ---------------- AIR CONDITIONING (indoor) ---------------- */
  { id: 'acwall', name: 'Wall Split AC', cat: 'Utility', brand: 'Nordvik', w: 2, h: 1, colors: ['#f0f2f4', '#dfe5ea', '#c9ced4', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, H * 0.18, W - 12, H * 0.56, 8,
        p.lg(g, 6, H * 0.18, W - 12, H * 0.56, HP.shade(c, 1.05), HP.shade(c, 0.88)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(10, H * 0.6); g.lineTo(W - 10, H * 0.6); g.stroke(); // vent flap
      g.strokeStyle = 'rgba(140,190,220,.7)'; g.lineWidth = 1;
      for (let i = 1; i < 6; i++) {                                               // airflow lines
        g.beginPath(); g.moveTo(14 + i * (W - 28) / 6, H * 0.74);
        g.quadraticCurveTo(14 + i * (W - 28) / 6 + 3, H * 0.85, 14 + i * (W - 28) / 6, H * 0.96); g.stroke();
      }
      g.fillStyle = '#4fc3f7'; g.fillRect(W - 22, H * 0.3, 8, 5);                  // display
    } },
  { id: 'acportable', name: 'Portable AC', cat: 'Utility', brand: 'CasaModa', w: 1, h: 1, colors: ['#f0f2f4', '#dfe5ea', '#8b939c', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#1b1e22';                                                    // castor wheels
      [[0.28, 0.88], [0.72, 0.88]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], 4, 0, 7); g.fill();
      });
      p.box(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, 6,
        p.lg(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;                        // vent slats
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(W * 0.3, H * (0.26 + i * 0.07)); g.lineTo(W * 0.7, H * (0.26 + i * 0.07)); g.stroke();
      }
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.4, H * 0.62, W * 0.2, H * 0.1);   // display
      g.strokeStyle = '#8b939c'; g.lineWidth = 4; g.lineCap = 'round';            // exhaust hose
      g.beginPath(); g.moveTo(W * 0.8, H * 0.3); g.quadraticCurveTo(W * 0.98, H * 0.2, W * 0.92, H * 0.05); g.stroke();
    } },
  { id: 'actower', name: 'Tower AC', cat: 'Utility', brand: 'Velluto', w: 1, h: 2, colors: ['#f0f2f4', '#dfe5ea', '#a8b8c8', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.94, W * 0.3, H * 0.05, 0, 0, 7);      // base foot
      g.fillStyle = HP.shade(c, 0.75); g.fill();
      p.box(g, W * 0.24, H * 0.04, W * 0.52, H * 0.9, 10,
        p.lg(g, W * 0.24, H * 0.04, W * 0.52, H * 0.9, HP.shade(c, 1.08), HP.shade(c, 0.82)));
      g.fillStyle = HP.shade(c, 0.55);                                            // vent column
      p.box(g, W * 0.34, H * 0.1, W * 0.32, H * 0.55, 5, HP.shade(c, 0.55));
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        g.beginPath(); g.moveTo(W * 0.37, H * (0.14 + i * 0.07)); g.lineTo(W * 0.63, H * (0.14 + i * 0.07)); g.stroke();
      }
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.4, H * 0.72, W * 0.2, H * 0.05);  // display
    } },
  { id: 'acceiling', name: 'Ceiling Cassette AC', cat: 'Utility', brand: 'Aria', w: 2, h: 2, colors: ['#f0f2f4', '#dfe5ea', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 6, 6, W - 12, H - 12, 4,
        p.lg(g, 6, 6, W - 12, H - 12, HP.shade(c, 1.05), HP.shade(c, 0.9)));
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1.5;
      P().RR(g, 10, 10, W - 20, H - 20, 3); g.stroke();
      for (let i = 0; i < 4; i++) {                                               // 4-way vents
        g.fillStyle = HP.shade(c, 0.7);
        const t = [[W / 2 - 14, 10, 28, 6], [W / 2 - 14, H - 16, 28, 6], [10, H / 2 - 14, 6, 28], [W - 16, H / 2 - 14, 6, 28]];
        g.fillRect(t[i][0], t[i][1], t[i][2], t[i][3]);
      }
      g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.14, 0, 7);            // center panel
      g.fillStyle = HP.shade(c, 0.92); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
      g.fillStyle = '#4fc3f7'; g.fillRect(W / 2 - 3, H / 2 - 2, 6, 4);            // indicator
    } },
  { id: 'acwindow', name: 'Window AC Unit', cat: 'Utility', brand: 'UrbanForm', w: 2, h: 1, colors: ['#e8ecf0', '#c9ced4', '#8b939c', '#f0f2f4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 5, W - 10, H - 10, 4,
        p.lg(g, 5, 5, W - 10, H - 10, HP.shade(c, 1.08), HP.shade(c, 0.85)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;                        // grille
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.moveTo(9, 9 + i * (H - 22) / 5); g.lineTo(W * 0.62, 9 + i * (H - 22) / 5); g.stroke();
      }
      g.beginPath(); g.arc(W * 0.78, H * 0.4, W * 0.13, 0, 7);                    // fan circle
      g.stroke();
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.7, H * 0.68, W * 0.2, H * 0.12);  // control panel
    } },

  /* ---------------- KITCHEN APPLIANCES (countertop) ---------------- */
  { id: 'toaster', name: 'Toaster', cat: 'Kitchen', brand: 'CasaModa', w: 1, h: 1, colors: ['#dfe5ea', '#a8b8c8', '#e8963c', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.2, H * 0.3, W * 0.6, H * 0.5, 8,
        p.lg(g, W * 0.2, H * 0.3, W * 0.6, H * 0.5, HP.shade(c, 1.15), HP.shade(c, 0.8)));
      g.fillStyle = '#2c2f33';                                                    // slots
      g.fillRect(W * 0.3, H * 0.34, W * 0.14, H * 0.4);
      g.fillRect(W * 0.56, H * 0.34, W * 0.14, H * 0.4);
      g.fillStyle = '#d8b06a';                                                    // toast
      g.fillRect(W * 0.31, H * 0.26, W * 0.12, H * 0.14);
      g.fillStyle = '#555c66'; g.fillRect(W * 0.82, H * 0.4, 4, H * 0.2);         // lever
    } },
  { id: 'kettle', name: 'Kettle', cat: 'Kitchen', brand: 'Nordvik', w: 1, h: 1, colors: ['#dfe5ea', '#a06558', '#3a3f47', '#8fb8a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.24, H * 0.3, 0, 0, 7);      // body
      g.fillStyle = p.lg(g, W * 0.26, H * 0.25, W * 0.48, H * 0.6, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(W * 0.72, H * 0.42); g.lineTo(W * 0.88, H * 0.28);  // spout
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 4; g.stroke();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 3;                                 // handle
      g.beginPath(); g.arc(W * 0.36, H * 0.5, W * 0.14, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
      g.fillStyle = '#2c2f33'; g.fillRect(W * 0.42, H * 0.2, W * 0.16, 4);        // lid
    } },
  { id: 'coffeemach', name: 'Coffee Machine', cat: 'Kitchen', brand: 'Velluto', w: 1, h: 1, colors: ['#3a3f47', '#dfe5ea', '#a06558', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.22, H * 0.08, W * 0.56, H * 0.5, 4,
        p.lg(g, W * 0.22, H * 0.08, W * 0.56, H * 0.5, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.fillStyle = '#22252a'; g.fillRect(W * 0.3, H * 0.14, W * 0.4, H * 0.12);  // top panel
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.36, H * 0.16, 6, 4);              // display
      g.beginPath(); g.arc(W / 2, H * 0.78, W * 0.2, 0, 7);                       // carafe
      g.fillStyle = '#8fa4b0'; g.fill(); g.strokeStyle = '#555c66'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.78, W * 0.13, 0, 7); g.fillStyle = '#3a2a1a'; g.fill(); // coffee
      g.fillStyle = '#555c66'; g.fillRect(W * 0.46, H * 0.56, W * 0.08, H * 0.08); // spout
    } },
  { id: 'blender', name: 'Blender', cat: 'Kitchen', brand: 'CasaModa', w: 1, h: 1, colors: ['#dfe5ea', '#e8963c', '#a06558', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.28, H * 0.62, W * 0.44, H * 0.3, 4,
        p.lg(g, W * 0.28, H * 0.62, W * 0.44, H * 0.3, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      g.fillStyle = '#22252a'; g.beginPath(); g.arc(W / 2, H * 0.77, 3, 0, 7); g.fill(); // dial
      p.box(g, W * 0.34, H * 0.12, W * 0.32, H * 0.5, 3, 'rgba(200,220,230,.55)'); // jar
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 1.5; P().RR(g, W * 0.34, H * 0.12, W * 0.32, H * 0.5, 3); g.stroke();
      g.fillStyle = '#e8963c'; g.fillRect(W * 0.38, H * 0.34, W * 0.24, H * 0.22); // juice
      g.fillStyle = '#3a3f47'; g.fillRect(W * 0.36, H * 0.08, W * 0.28, H * 0.06); // lid
    } },
  { id: 'airfryer', name: 'Air Fryer', cat: 'Kitchen', brand: 'UrbanForm', w: 1, h: 1, colors: ['#3a3f47', '#dfe5ea', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, 10,
        p.lg(g, W * 0.2, H * 0.15, W * 0.6, H * 0.7, HP.shade(c, 1.15), HP.shade(c, 0.75)));
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;                        // drawer
      P().RR(g, W * 0.28, H * 0.38, W * 0.44, H * 0.4, 5); g.stroke();
      g.fillStyle = HP.shade(c, 0.5); g.fillRect(W * 0.42, H * 0.5, W * 0.16, 5); // handle
      g.fillStyle = '#22252a'; g.fillRect(W * 0.3, H * 0.2, W * 0.4, H * 0.12);   // panel
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.38, H * 0.23, W * 0.24, H * 0.05);
    } },
  { id: 'mixer', name: 'Stand Mixer', cat: 'Kitchen', brand: 'Heritage', w: 1, h: 1, colors: ['#a03a3a', '#dfe5ea', '#3a5f8a', '#5d8a5d', '#e8c832'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.22, H * 0.6, W * 0.56, H * 0.28, 4, HP.shade(c, 0.8));       // base
      g.beginPath(); g.ellipse(W * 0.42, H * 0.35, W * 0.26, H * 0.22, 0, 0, 7);  // head
      g.fillStyle = p.lg(g, W * 0.2, H * 0.15, W * 0.5, H * 0.4, HP.shade(c, 1.2), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(W * 0.68, H * 0.62, W * 0.16, 0, 7);                   // bowl
      g.fillStyle = '#c9ced4'; g.fill(); g.strokeStyle = '#8b939c'; g.stroke();
      g.strokeStyle = '#555c66'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.6, H * 0.42); g.lineTo(W * 0.68, H * 0.55); g.stroke(); // arm
    } },
  { id: 'ricecooker', name: 'Rice Cooker', cat: 'Kitchen', brand: 'Aria', w: 1, h: 1, colors: ['#f0f2f4', '#dfe5ea', '#e8a0b8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.3, H * 0.32, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.2, H * 0.25, W * 0.6, H * 0.6, HP.shade(c, 1.08), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.36, W * 0.24, H * 0.1, 0, 0, 7);      // lid
      g.fillStyle = HP.shade(c, 1.15); g.fill(); g.stroke();
      g.fillStyle = '#3a3f47'; g.fillRect(W * 0.4, H * 0.66, W * 0.2, H * 0.1);   // panel
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.44, H * 0.69, W * 0.12, H * 0.04);
    } },
  { id: 'rangehood', name: 'Range Hood', cat: 'Kitchen', brand: 'UrbanForm', w: 2, h: 1, colors: ['#c9ced4', '#3a3f47', '#dfe5ea'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = HP.shade(c, 0.9); g.fillRect(W * 0.4, 4, W * 0.2, H * 0.3);   // chimney
      g.beginPath();                                                              // canopy trapezoid
      g.moveTo(W * 0.2, H * 0.34); g.lineTo(W * 0.8, H * 0.34);
      g.lineTo(W - 6, H - 6); g.lineTo(6, H - 6); g.closePath();
      g.fillStyle = p.lg(g, 6, H * 0.3, W - 12, H * 0.7, HP.shade(c, 1.1), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.2)';                                           // filter lines
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(W * (0.25 + i * 0.15), H * 0.6); g.lineTo(W * (0.22 + i * 0.15), H - 9); g.stroke();
      }
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.46, H * 0.42, W * 0.08, 4);       // light
    } },
  { id: 'fridgeXL', name: 'French-Door Fridge', cat: 'Kitchen', brand: 'Velluto', w: 2, h: 2, colors: ['#dfe5ea', '#3a3f47', '#c9ced4', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 4, 4, W - 8, H - 8, 5, p.lg(g, 4, 4, W - 8, H - 8, HP.shade(c, 1.08), HP.shade(c, 0.82)));
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H * 0.62); g.stroke();   // french split
      g.beginPath(); g.moveTo(6, H * 0.66); g.lineTo(W - 6, H * 0.66); g.stroke();// freezer drawer
      g.fillStyle = '#8b939c';                                                    // handles
      g.fillRect(W * 0.4, 10, 3, H * 0.4); g.fillRect(W * 0.58, 10, 3, H * 0.4);
      g.fillRect(W * 0.4, H * 0.7, W * 0.2, 4);
      g.fillStyle = '#22252a'; g.fillRect(W * 0.44, H * 0.3, W * 0.12, H * 0.18); // water dispenser
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(7, 6, 6, H - 12);          // sheen
    } },

  /* ---------------- GYM extras 2 ---------------- */
  { id: 'rower', name: 'Rowing Machine', cat: 'Gym', brand: 'UrbanForm', w: 1, h: 4, colors: ['#3a3f47', '#5b5f6b', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 5;                                         // rail
      g.beginPath(); g.moveTo(W / 2, H * 0.15); g.lineTo(W / 2, H * 0.95); g.stroke();
      g.beginPath(); g.arc(W / 2, H * 0.12, W * 0.28, 0, 7);                      // flywheel
      g.fillStyle = p.lg(g, W * 0.2, 0, W * 0.6, H * 0.25, HP.shade(c, 1.1), HP.shade(c, 0.7)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.56, H * 0.06, W * 0.2, H * 0.05); // display arm
      p.box(g, W * 0.34, H * 0.45, W * 0.32, H * 0.12, 4, '#2c2f33');             // seat
      g.strokeStyle = '#555c66'; g.lineWidth = 3;                                 // footrests
      g.beginPath(); g.moveTo(W * 0.2, H * 0.3); g.lineTo(W * 0.4, H * 0.34);
      g.moveTo(W * 0.8, H * 0.3); g.lineTo(W * 0.6, H * 0.34); g.stroke();
      g.strokeStyle = '#c9a44e'; g.lineWidth = 2;                                 // handle + strap
      g.beginPath(); g.moveTo(W * 0.3, H * 0.22); g.lineTo(W * 0.7, H * 0.22); g.stroke();
      g.beginPath(); g.moveTo(W / 2, H * 0.22); g.lineTo(W / 2, H * 0.16); g.stroke();
    } },
  { id: 'elliptical', name: 'Elliptical', cat: 'Gym', brand: 'Softline', w: 1, h: 3, colors: ['#3a3f47', '#8b939c', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 5;                                         // frame
      g.beginPath(); g.moveTo(W / 2, H * 0.1); g.lineTo(W / 2, H * 0.9); g.stroke();
      g.beginPath(); g.ellipse(W / 2, H * 0.88, W * 0.3, H * 0.06, 0, 0, 7); g.stroke(); // base
      g.beginPath(); g.arc(W / 2, H * 0.28, W * 0.16, 0, 7);                      // wheel
      g.fillStyle = HP.shade(c, 0.7); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 3;                          // pedal arms
      g.beginPath(); g.moveTo(W / 2, H * 0.28); g.lineTo(W * 0.28, H * 0.6);
      g.moveTo(W / 2, H * 0.28); g.lineTo(W * 0.72, H * 0.6); g.stroke();
      g.fillStyle = '#2c2f33';
      g.fillRect(W * 0.2, H * 0.58, W * 0.16, H * 0.08);                          // pedals
      g.fillRect(W * 0.64, H * 0.58, W * 0.16, H * 0.08);
      g.strokeStyle = '#555c66'; g.lineWidth = 2.5;                               // handles
      g.beginPath(); g.moveTo(W / 2, H * 0.18); g.lineTo(W * 0.3, H * 0.05);
      g.moveTo(W / 2, H * 0.18); g.lineTo(W * 0.7, H * 0.05); g.stroke();
    } },
  { id: 'kettlebells', name: 'Kettlebell Set', cat: 'Gym', brand: 'UrbanForm', w: 1, h: 1, colors: ['#3a3f47', '#a03a3a', '#4a6b8a', '#5d8a5d'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      [[0.28, 0.68, 0.16], [0.55, 0.55, 0.2], [0.78, 0.75, 0.13]].forEach(([dx, dy, r]) => {
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 3;
        g.beginPath(); g.arc(W * dx, H * dy - H * r * 0.9, W * r * 0.55, Math.PI, 0); g.stroke(); // handle
        g.beginPath(); g.arc(W * dx, H * dy, W * r, 0, 7);
        g.fillStyle = c; g.fill();
        g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1; g.stroke();
      });
    } },
  { id: 'pullupbar', name: 'Pull-Up Bar', cat: 'Gym', brand: 'UrbanForm', w: 2, h: 1, colors: ['#3a3f47', '#8b939c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.15, H * 0.3, W * 0.7, H * 0.4, 3, HP.shade(c, 0.7));         // mount plate
      g.strokeStyle = c; g.lineWidth = 5; g.lineCap = 'round';                    // bar
      g.beginPath(); g.moveTo(W * 0.1, H * 0.15); g.lineTo(W * 0.9, H * 0.15); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(W * 0.25, H * 0.18); g.lineTo(W * 0.25, H * 0.32);  // brackets
      g.moveTo(W * 0.75, H * 0.18); g.lineTo(W * 0.75, H * 0.32); g.stroke();
      g.fillStyle = '#555c66';                                                    // grips
      g.fillRect(W * 0.08, H * 0.11, W * 0.1, H * 0.09);
      g.fillRect(W * 0.82, H * 0.11, W * 0.1, H * 0.09);
    } },
  { id: 'gymball', name: 'Gym Ball', cat: 'Gym', brand: 'Softline', w: 1, h: 1, colors: ['#a8b8c8', '#e8a0b8', '#8fb8a0', '#c9a44e', '#5d4a68'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = Math.min(W, H) * 0.42;
      g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7);
      g.fillStyle = p.lg(g, W / 2 - r, H / 2 - r, r * 2, r * 2, HP.shade(c, 1.2), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2;                    // sheen arc
      g.beginPath(); g.arc(W / 2, H / 2, r * 0.7, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    } },
  { id: 'foamroller', name: 'Foam Roller', cat: 'Gym', brand: 'Softline', w: 1, h: 1, colors: ['#a8b8c8', '#5d4a68', '#8fb8a0', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.save(); g.translate(W / 2, H / 2); g.rotate(-0.5);
      p.box(g, -W * 0.34, -H * 0.14, W * 0.68, H * 0.28, H * 0.14, c);
      g.beginPath(); g.ellipse(W * 0.34, 0, W * 0.06, H * 0.14, 0, 0, 7);         // end cap
      g.fillStyle = HP.shade(c, 1.2); g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.15)';                                          // texture bands
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * W * 0.18, -H * 0.14); g.lineTo(i * W * 0.18, H * 0.14); g.stroke(); }
      g.restore();
    } },
  { id: 'stepplatform', name: 'Step Platform', cat: 'Gym', brand: 'UrbanForm', w: 2, h: 1, colors: ['#3a3f47', '#a06558', '#4a6b8a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 5, 8, W - 10, H - 16, 6, HP.shade(c, 0.7));                        // base
      p.box(g, 8, 10, W - 16, H - 20, 5,
        p.lg(g, 8, 10, W - 16, H - 20, HP.shade(c, 1.1), HP.shade(c, 0.85)));     // top deck
      g.fillStyle = 'rgba(255,255,255,.15)';                                      // grip dots
      for (let i = 0; i < 8; i++) {
        g.beginPath(); g.arc(14 + i * (W - 28) / 7, H / 2, 2, 0, 7); g.fill();
      }
    } },

  /* ---------------- BATHROOM extras ---------------- */
  { id: 'towelwarmer', name: 'Towel Warmer', cat: 'Bathroom', brand: 'Nordvik', w: 1, h: 1, colors: ['#c9ced4', '#3a3f47', '#c9a44e'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.strokeStyle = c; g.lineWidth = 4;                                         // rails
      g.beginPath(); g.moveTo(W * 0.25, H * 0.1); g.lineTo(W * 0.25, H * 0.9);
      g.moveTo(W * 0.75, H * 0.1); g.lineTo(W * 0.75, H * 0.9); g.stroke();
      g.strokeStyle = HP.shade(c, 0.85); g.lineWidth = 3.5;
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.moveTo(W * 0.25, H * (0.15 + i * 0.17)); g.lineTo(W * 0.75, H * (0.15 + i * 0.17)); g.stroke();
      }
      g.fillStyle = '#a8c8d8'; g.fillRect(W * 0.3, H * 0.3, W * 0.4, H * 0.14);   // towels
      g.fillStyle = '#f0ece2'; g.fillRect(W * 0.3, H * 0.55, W * 0.4, H * 0.14);
    } },
  { id: 'showerbench', name: 'Shower Bench', cat: 'Bathroom', brand: 'Aria', w: 1, h: 1, colors: ['#8a6844', '#a8a294', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 3;                          // legs
      [[0.25, 0.2], [0.75, 0.2], [0.25, 0.8], [0.75, 0.8]].forEach(pt => {
        g.beginPath(); g.moveTo(W * pt[0], H * pt[1]); g.lineTo(W * pt[0], H * (pt[1] + 0.1)); g.stroke();
      });
      p.wood(g, W * 0.15, H * 0.2, W * 0.7, H * 0.6, c);
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;                          // slats
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(W * 0.18, H * (0.2 + i * 0.15)); g.lineTo(W * 0.82, H * (0.2 + i * 0.15)); g.stroke();
      }
    } },
  { id: 'bathcaddy', name: 'Bath Caddy', cat: 'Bathroom', brand: 'TerraHome', w: 1, h: 1, colors: ['#8a6844', '#c9b48f', '#5b5f6b'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8fa4b0'; g.lineWidth = 3;                                 // tub edges
      g.beginPath(); g.moveTo(2, H * 0.2); g.lineTo(2, H * 0.8);
      g.moveTo(W - 2, H * 0.2); g.lineTo(W - 2, H * 0.8); g.stroke();
      p.wood(g, 4, H * 0.38, W - 8, H * 0.24, c);                                 // tray across
      g.fillStyle = '#f5efe0'; g.beginPath(); g.arc(W * 0.3, H * 0.5, 5, 0, 7); g.fill(); // candle
      g.fillStyle = '#a03a3a'; g.fillRect(W * 0.55, H * 0.42, W * 0.2, H * 0.16); // book
      g.fillStyle = '#8fa4b0'; g.beginPath(); g.arc(W * 0.82, H * 0.5, 4, 0, 7); g.fill(); // wine glass
    } },
  { id: 'mirrorcab', name: 'Mirror Cabinet', cat: 'Bathroom', brand: 'Aria', w: 1, h: 1, colors: ['#dfe5ea', '#c9ced4', '#8b939c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 8, 6, W - 16, H - 12, 4, c);
      g.fillStyle = p.lg(g, 12, 10, W - 24, H - 20, '#e8f2f8', '#a8c8d8');        // mirror
      g.fillRect(12, 10, W - 24, H - 20);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; P().RR(g, 12, 10, W - 24, H - 20, 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;                    // glare
      g.beginPath(); g.moveTo(16, H - 12); g.lineTo(W * 0.5, 12); g.stroke();
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.48, H * 0.48, 4, 4);              // knob
    } },

  /* ---------------- HALLWAY ---------------- */
  { id: 'halltree', name: 'Hall Tree', cat: 'Living', brand: 'Heritage', w: 2, h: 1, colors: ['#8a6844', '#3a3f47', '#a4805c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H * 0.4, c);                                         // bench base
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, H * 0.24); g.lineTo(W - 8, H * 0.24); g.stroke();
      p.wood(g, 4, H * 0.5, W - 8, H * 0.4, c);                                   // back panel
      const hc = ['#3a5f8a', '#a03a3a', '#5d8a5d'];
      for (let i = 0; i < 3; i++) {                                               // hooks + coats
        const x = W * (0.25 + i * 0.25);
        g.fillStyle = '#c9a44e'; g.beginPath(); g.arc(x, H * 0.58, 3, 0, 7); g.fill();
        g.fillStyle = hc[i];
        g.beginPath(); g.moveTo(x - 7, H * 0.66); g.lineTo(x + 7, H * 0.66);
        g.lineTo(x + 9, H * 0.88); g.lineTo(x - 9, H * 0.88); g.fill();
      }
    } },
  { id: 'coathooks', name: 'Coat Hooks', cat: 'Living', brand: 'Nordvik', w: 2, h: 1, colors: ['#8a6844', '#3a3f47', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 6, H * 0.25, W - 12, H * 0.3, c);                                 // rail
      for (let i = 0; i < 4; i++) {                                               // hooks
        const x = W * (0.15 + i * 0.23);
        g.strokeStyle = '#8b939c'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, H * 0.62, 5, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
      }
      g.fillStyle = '#a03a3a';                                                    // one hat
      g.beginPath(); g.ellipse(W * 0.15, H * 0.72, W * 0.1, H * 0.14, 0, 0, 7); g.fill();
    } },
  { id: 'keytray', name: 'Console + Keys', cat: 'Living', brand: 'CasaModa', w: 2, h: 1, colors: ['#9a774f', '#3a3f47', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.strokeStyle = HP.shade(c, 0.65); g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, H * 0.6); g.lineTo(W - 8, H * 0.6); g.stroke();  // shelf line
      p.box(g, W * 0.15, H * 0.15, W * 0.25, H * 0.3, 3, '#3a3f47');              // tray
      g.fillStyle = '#c9a44e';                                                    // keys
      g.beginPath(); g.arc(W * 0.22, H * 0.28, 3, 0, 7); g.fill();
      g.fillRect(W * 0.24, H * 0.27, 7, 2);
      g.fillStyle = '#5d8a5d'; g.beginPath(); g.arc(W * 0.32, H * 0.3, 3, 0, 7); g.fill();
      g.fillStyle = '#8fb8a0'; g.fillRect(W * 0.55, H * 0.12, W * 0.15, H * 0.26); // plant
      g.fillStyle = '#5d8a5d'; g.beginPath(); g.arc(W * 0.62, H * 0.12, W * 0.08, 0, 7); g.fill();
    } },

  /* ---------------- OFFICE extras ---------------- */
  { id: 'shredder', name: 'Paper Shredder', cat: 'Office', brand: 'UrbanForm', w: 1, h: 1, colors: ['#3a3f47', '#5b5f6b', '#dfe5ea'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.25, H * 0.3, W * 0.5, H * 0.55, 4,
        p.lg(g, W * 0.25, H * 0.3, W * 0.5, H * 0.55, HP.shade(c, 1.1), HP.shade(c, 0.8)));
      p.box(g, W * 0.3, H * 0.15, W * 0.4, H * 0.18, 3, HP.shade(c, 0.7));        // top slot head
      g.fillStyle = '#22252a'; g.fillRect(W * 0.34, H * 0.22, W * 0.32, 4);       // slot
      g.fillStyle = '#f5f2ea'; g.fillRect(W * 0.4, H * 0.05, W * 0.2, H * 0.18);  // paper in
      g.fillStyle = '#e05252'; g.beginPath(); g.arc(W * 0.6, H * 0.26, 2.5, 0, 7); g.fill(); // LED
      g.fillStyle = 'rgba(245,242,234,.5)'; g.fillRect(W * 0.3, H * 0.6, W * 0.4, H * 0.2); // shreds window
    } },
  { id: 'kneelchair', name: 'Kneeling Chair', cat: 'Office', brand: 'Nordvik', w: 1, h: 2, colors: ['#5d7484', '#3a3f47', '#718a68', '#a06558'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#555c66'; g.lineWidth = 3;                                 // frame rails
      g.beginPath(); g.moveTo(W * 0.3, H * 0.15); g.lineTo(W * 0.35, H * 0.85);
      g.moveTo(W * 0.7, H * 0.15); g.lineTo(W * 0.65, H * 0.85); g.stroke();
      p.cushion(g, W * 0.28, H * 0.12, W * 0.44, H * 0.3, c);                     // seat pad
      p.cushion(g, W * 0.32, H * 0.55, W * 0.36, H * 0.28, HP.shade(c, 0.9));     // knee pad
      g.fillStyle = '#1b1e22';                                                    // casters
      g.beginPath(); g.arc(W * 0.32, H * 0.9, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W * 0.68, H * 0.9, 3, 0, 7); g.fill();
    } },
  { id: 'scanner', name: 'Scanner', cat: 'Office', brand: 'CasaModa', w: 1, h: 1, colors: ['#dfe5ea', '#3a3f47', '#c9ced4'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.15, H * 0.25, W * 0.7, H * 0.5, 4, HP.shade(c, 0.8));        // base
      p.box(g, W * 0.15, H * 0.15, W * 0.7, H * 0.22, 4,
        p.lg(g, W * 0.15, H * 0.15, W * 0.7, H * 0.22, HP.shade(c, 1.15), HP.shade(c, 0.9))); // lid
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1;
      P().RR(g, W * 0.2, H * 0.42, W * 0.6, H * 0.26, 2); g.stroke();             // glass bed
      g.fillStyle = '#4fc3f7'; g.fillRect(W * 0.68, H * 0.28, W * 0.08, 3);       // LED
    } },
  { id: 'deskorganizer', name: 'Desk Organizer', cat: 'Office', brand: 'Nordvik', w: 1, h: 1, colors: ['#8a6844', '#3a3f47', '#d6c9b2'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.15, H * 0.2, W * 0.7, H * 0.6, c);
      g.fillStyle = HP.shade(c, 0.55);                                            // compartments
      g.fillRect(W * 0.2, H * 0.26, W * 0.26, H * 0.24);
      g.fillRect(W * 0.54, H * 0.26, W * 0.26, H * 0.24);
      ['#a03a3a', '#3a5f8a', '#5d8a5d'].forEach((k, i) => {                       // pens
        g.strokeStyle = k; g.lineWidth = 2;
        g.beginPath(); g.moveTo(W * (0.26 + i * 0.06), H * 0.26); g.lineTo(W * (0.26 + i * 0.06), H * 0.08); g.stroke();
      });
      g.fillStyle = '#f5f2ea'; g.fillRect(W * 0.56, H * 0.3, W * 0.2, H * 0.16);  // notes
      g.fillStyle = '#c9a44e'; g.fillRect(W * 0.24, H * 0.6, W * 0.5, H * 0.12);  // ruler
    } },

  /* ---------------- KIDS extras 3 ---------------- */
  { id: 'kidstable', name: 'Kids Table Set', cat: 'Kids', brand: 'Softline', w: 2, h: 2, colors: ['#e8a0a8', '#a0c8e8', '#d8b06a', '#8fb8a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#e8c832';                                                    // stools
      [[0.12, 0.5], [0.88, 0.5]].forEach(pt => {
        g.beginPath(); g.arc(W * pt[0], H * pt[1], W * 0.1, 0, 7); g.fill();
        g.strokeStyle = HP.shade('#e8c832', 0.6); g.lineWidth = 1.5; g.stroke();
      });
      p.box(g, W * 0.28, H * 0.22, W * 0.44, H * 0.56, 8,                          // table
        p.lg(g, W * 0.28, H * 0.22, W * 0.44, H * 0.56, HP.shade(c, 1.12), HP.shade(c, 0.9)));
      g.fillStyle = '#f5f2ea'; g.fillRect(W * 0.38, H * 0.3, W * 0.24, H * 0.2);  // paper
      g.fillStyle = '#a03a3a'; g.beginPath(); g.arc(W * 0.62, H * 0.68, 4, 0, 7); g.fill(); // crayons
      g.fillStyle = '#3a5f8a'; g.beginPath(); g.arc(W * 0.42, H * 0.7, 4, 0, 7); g.fill();
    } },
  { id: 'nightlight', name: 'Night Light', cat: 'Kids', brand: 'Softline', w: 1, h: 1, colors: ['#f0d090', '#e8a0b8', '#a0c8e8', '#c8d8a8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      const gr = g.createRadialGradient(W / 2, H * 0.4, 1, W / 2, H * 0.4, W * 0.45);
      gr.addColorStop(0, 'rgba(255,225,150,.55)'); gr.addColorStop(1, 'rgba(255,225,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.beginPath();                                                              // star shape
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? W * 0.1 : W * 0.22;
        const x = W / 2 + Math.cos(a) * rr, y = H * 0.4 + Math.sin(a) * rr;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5; g.stroke();
      p.box(g, W * 0.35, H * 0.7, W * 0.3, H * 0.2, 3, '#8b939c');                // plug base
    } },
  { id: 'beanbag2', name: 'Kids Bean Pod', cat: 'Kids', brand: 'Softline', w: 1, h: 1, colors: ['#e8a0b8', '#a0c8e8', '#d8b06a', '#8fb8a0', '#b8a8d8'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], r = Math.min(W, H) * 0.44;
      g.beginPath();                                                              // squished blob
      g.moveTo(W / 2 - r, H / 2 + r * 0.2);
      g.quadraticCurveTo(W / 2 - r * 1.05, H / 2 - r * 0.6, W / 2 - r * 0.2, H / 2 - r * 0.85);
      g.quadraticCurveTo(W / 2 + r * 0.7, H / 2 - r * 1.05, W / 2 + r, H / 2 + r * 0.1);
      g.quadraticCurveTo(W / 2 + r * 0.7, H / 2 + r * 0.9, W / 2 - r, H / 2 + r * 0.2);
      g.fillStyle = p.lg(g, W * 0.1, H * 0.1, W * 0.8, H * 0.8, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.setLineDash([3, 3]); g.beginPath(); g.arc(W / 2, H / 2, r * 0.55, 0.3, 5); g.stroke(); g.setLineDash([]);
    } },

  /* ---------------- UTILITY extras 2 ---------------- */
  { id: 'laundrybasket', name: 'Laundry Basket', cat: 'Utility', brand: 'TerraHome', w: 1, h: 1, colors: ['#c9b48f', '#a8b8c8', '#e8e2d6', '#8f8578'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.34, H * 0.36, 0, 0, 7);
      g.fillStyle = p.lg(g, W * 0.16, H * 0.2, W * 0.68, H * 0.7, HP.shade(c, 1.12), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = HP.shade(c, 0.7); g.lineWidth = 1;                          // weave
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.34 * i / 4, H * 0.36 * i / 4, 0, 0, 7); g.stroke();
      }
      g.fillStyle = '#f0ece2';                                                    // clothes
      g.beginPath(); g.arc(W * 0.42, H * 0.4, W * 0.1, 0, 7); g.fill();
      g.fillStyle = '#a8c8d8'; g.beginPath(); g.arc(W * 0.6, H * 0.44, W * 0.09, 0, 7); g.fill();
    } },
  { id: 'mopbucket', name: 'Mop & Bucket', cat: 'Utility', brand: 'UrbanForm', w: 1, h: 1, colors: ['#4a8ab0', '#a06558', '#8b939c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#c9a44e'; g.lineWidth = 3;                                 // mop handle
      g.beginPath(); g.moveTo(W * 0.75, H * 0.08); g.lineTo(W * 0.5, H * 0.55); g.stroke();
      g.strokeStyle = '#e8e2d6'; g.lineWidth = 2;                                 // mop strands
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(W * 0.5, H * 0.55); g.lineTo(W * (0.4 + i * 0.07), H * 0.7); g.stroke();
      }
      g.beginPath(); g.ellipse(W * 0.4, H * 0.68, W * 0.28, H * 0.22, 0, 0, 7);   // bucket
      g.fillStyle = p.lg(g, W * 0.12, H * 0.46, W * 0.56, H * 0.45, HP.shade(c, 1.15), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(W * 0.4, H * 0.62, W * 0.2, H * 0.1, 0, 0, 7);     // water
      g.fillStyle = '#5eb8d8'; g.fill();
    } },
  { id: 'stepstool', name: 'Step Stool', cat: 'Utility', brand: 'Nordvik', w: 1, h: 1, colors: ['#9a774f', '#3a3f47', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.18, H * 0.45, W * 0.64, H * 0.4, HP.shade(c, 0.8));         // lower step
      p.wood(g, W * 0.28, H * 0.15, W * 0.44, H * 0.34, c);                       // top step
      g.fillStyle = 'rgba(0,0,0,.15)';                                            // grip lines
      for (let i = 0; i < 3; i++) {
        g.fillRect(W * 0.33, H * (0.2 + i * 0.08), W * 0.34, 2);
      }
    } },
  { id: 'litterbox', name: 'Litter Box', cat: 'Utility', brand: 'Softline', w: 1, h: 1, colors: ['#a8b8c8', '#e8e2d6', '#8fb8a0'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, 8, 8, W - 16, H - 16, 8, c);
      p.box(g, 12, 12, W - 24, H - 24, 6, '#d8cfc0');                             // litter
      g.fillStyle = '#a89078';
      for (let i = 0; i < 8; i++) {                                               // litter bits
        g.beginPath(); g.arc(16 + (i * 29) % (W - 32), 16 + (i * 17) % (H - 32), 1.5, 0, 7); g.fill();
      }
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.7, H * 0.2, W * 0.14, 4);         // scoop
    } },

  /* ---------------- GARDEN / OUTDOOR extras ---------------- */
  { id: 'gardenbench', name: 'Garden Bench', cat: 'Garden', brand: 'Heritage', w: 3, h: 1, colors: ['#8a6844', '#3a5f5d', '#a8a294', '#5b5f6b'], joins: true,
    draw(g, W, H, v, m) {
      const p = P(), c = this.colors[v];
      const x0 = (m & 4) ? 0 : 4, x1 = (m & 1) ? W : W - 8;                       // slats run into neighbours
      g.fillStyle = HP.shade(c, 0.55);                                            // legs, hidden on joined ends
      [[0.12, 0.3], [0.12, 0.7]].forEach(pt => {
        if (!(m & 4)) g.fillRect(W * pt[0] - 4, H * pt[1] - 4, 8, 8);
      });
      [[0.88, 0.3], [0.88, 0.7]].forEach(pt => {
        if (!(m & 1)) g.fillRect(W * pt[0] - 4, H * pt[1] - 4, 8, 8);
      });
      for (let i = 0; i < 3; i++)                                                 // seat slats
        p.box(g, x0, H * (0.35 + i * 0.13), x1 - x0, H * 0.09, 2, HP.shade(c, 0.9 + i * 0.04));
      for (let i = 0; i < 2; i++)                                                 // back slats
        p.box(g, x0, H * (0.1 + i * 0.1), x1 - x0, H * 0.07, 2, HP.shade(c, 0.95));
    } },
  { id: 'birdhouse', name: 'Birdhouse', cat: 'Garden', brand: 'TerraHome', w: 1, h: 1, colors: ['#a06558', '#8a6844', '#5d8a5d', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8b939c'; g.lineWidth = 4;                                 // pole
      g.beginPath(); g.moveTo(W / 2, H * 0.55); g.lineTo(W / 2, H * 0.95); g.stroke();
      p.box(g, W * 0.28, H * 0.28, W * 0.44, H * 0.32, 2, c);                     // house
      g.fillStyle = HP.shade(c, 0.6);                                             // roof
      g.beginPath(); g.moveTo(W * 0.24, H * 0.32); g.lineTo(W / 2, H * 0.12); g.lineTo(W * 0.76, H * 0.32); g.fill();
      g.beginPath(); g.arc(W / 2, H * 0.44, W * 0.07, 0, 7);                      // hole
      g.fillStyle = '#2a2520'; g.fill();
      g.fillStyle = '#8a6844'; g.fillRect(W * 0.46, H * 0.54, W * 0.08, 3);       // perch
    } },
  { id: 'sundial', name: 'Sundial', cat: 'Garden', brand: 'Heritage', w: 1, h: 1, colors: ['#a8a294', '#8b8b83', '#6b6f76'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.32, H * 0.55, W * 0.36, H * 0.36, 3, HP.shade(c, 0.85));     // pedestal
      g.beginPath(); g.arc(W / 2, H * 0.38, W * 0.3, 0, 7);                       // dial face
      g.fillStyle = p.lg(g, W * 0.2, H * 0.08, W * 0.6, W * 0.6, HP.shade(c, 1.15), HP.shade(c, 0.85)); g.fill();
      g.strokeStyle = HP.shade(c, 0.5); g.lineWidth = 1.5; g.stroke();
      for (let i = 0; i < 8; i++) {                                               // hour marks
        const a = i * Math.PI / 4;
        g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * W * 0.22, H * 0.38 + Math.sin(a) * W * 0.22);
        g.lineTo(W / 2 + Math.cos(a) * W * 0.27, H * 0.38 + Math.sin(a) * W * 0.27); g.stroke();
      }
      g.fillStyle = HP.shade(c, 0.45);                                            // gnomon
      g.beginPath(); g.moveTo(W / 2, H * 0.38); g.lineTo(W * 0.56, H * 0.22); g.lineTo(W * 0.62, H * 0.38); g.fill();
    } },
  { id: 'flowerbox', name: 'Flower Box', cat: 'Garden', brand: 'TerraHome', w: 2, h: 1, colors: ['#8a6844', '#a06558', '#5b5f6b', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, H * 0.35, W - 8, H * 0.5, c);                                  // planter box
      g.fillStyle = '#3e2e20'; g.fillRect(8, H * 0.4, W - 16, H * 0.18);          // soil
      const fc = ['#e8a0b8', '#e8c832', '#e05252', '#b8a8d8', '#f0f0e8'];
      for (let i = 0; i < 7; i++) {                                               // flowers
        const x = 12 + i * (W - 24) / 6;
        g.strokeStyle = '#5d8a50'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, H * 0.42); g.lineTo(x, H * 0.22); g.stroke();
        g.fillStyle = fc[i % fc.length];
        g.beginPath(); g.arc(x, H * 0.2, 4, 0, 7); g.fill();
        g.fillStyle = '#e8c832'; g.beginPath(); g.arc(x, H * 0.2, 1.5, 0, 7); g.fill();
      }
    } },
  { id: 'planterTall', name: 'Tall Planter', cat: 'Garden', brand: 'Aria', w: 1, h: 1, colors: ['#3a3f47', '#a8a294', '#8f8578', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.beginPath();                                                              // tapered pot
      g.moveTo(W * 0.3, H * 0.3); g.lineTo(W * 0.7, H * 0.3);
      g.lineTo(W * 0.62, H * 0.9); g.lineTo(W * 0.38, H * 0.9); g.closePath();
      g.fillStyle = p.lg(g, W * 0.3, H * 0.3, W * 0.4, H * 0.6, HP.shade(c, 1.1), HP.shade(c, 0.8)); g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      p.leaves(g, W / 2, H * 0.26, W * 0.26, '#5d8a50', 7);
    } },
  { id: 'cooler', name: 'Patio Cooler', cat: 'Outdoor', brand: 'UrbanForm', w: 1, h: 1, colors: ['#a03a3a', '#4a8ab0', '#dfe5ea', '#5d8a5d'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.18, H * 0.3, W * 0.64, H * 0.5, 5,
        p.lg(g, W * 0.18, H * 0.3, W * 0.64, H * 0.5, HP.shade(c, 1.12), HP.shade(c, 0.8)));
      p.box(g, W * 0.18, H * 0.2, W * 0.64, H * 0.16, 4, HP.shade(c, 1.25));      // lid
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(W * 0.18, H * 0.38); g.lineTo(W * 0.82, H * 0.38); g.stroke();
      g.fillStyle = '#8b939c'; g.fillRect(W * 0.44, H * 0.22, W * 0.12, 4);       // latch
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 3;                          // handle
      g.beginPath(); g.moveTo(W * 0.14, H * 0.5); g.lineTo(W * 0.22, H * 0.55);
      g.moveTo(W * 0.86, H * 0.5); g.lineTo(W * 0.78, H * 0.55); g.stroke();
    } },

  /* ---------------- GAMES extras 2 ---------------- */
  { id: 'cardtable', name: 'Card Table', cat: 'Games', brand: 'Heritage', w: 2, h: 2, colors: ['#3f6d55', '#5d4a68', '#3a5f8a', '#8a3a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, '#6b4f33');                                   // frame
      p.box(g, 10, 10, W - 20, H - 20, 6, c);                                     // felt
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
      P().RR(g, 16, 16, W - 32, H - 32, 4); g.stroke();
      ['#f5f2ea', '#f5f2ea', '#f5f2ea'].forEach((k, i) => {                       // cards
        g.save(); g.translate(W * 0.5 + i * 8 - 8, H * 0.44); g.rotate((i - 1) * 0.15);
        g.fillStyle = k; g.fillRect(-5, -8, 10, 14);
        g.strokeStyle = '#888'; g.lineWidth = 0.8; g.strokeRect(-5, -8, 10, 14);
        g.restore();
      });
      const cc = ['#e05252', '#3a5f8a', '#e8c832', '#f5f2ea'];
      cc.forEach((k, i) => {                                                      // chip stacks
        g.fillStyle = k; g.beginPath(); g.arc(W * (0.22 + i * 0.18), H * 0.7, 4, 0, 7); g.fill();
      });
    } },
  { id: 'poolcues', name: 'Cue Rack', cat: 'Games', brand: 'Heritage', w: 1, h: 1, colors: ['#6b4f33', '#3a3f47', '#8a6844'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, W * 0.2, H * 0.1, W * 0.6, H * 0.14, c);                          // top rail
      p.wood(g, W * 0.2, H * 0.76, W * 0.6, H * 0.14, c);                         // bottom rail
      const wc = ['#c9a44e', '#a06558', '#8fb8a0'];
      for (let i = 0; i < 3; i++) {                                               // cues
        const x = W * (0.3 + i * 0.2);
        g.strokeStyle = wc[i]; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, H * 0.2); g.lineTo(x, H * 0.8); g.stroke();
        g.fillStyle = '#e8e2d6'; g.fillRect(x - 1.5, H * 0.2, 3, 4);              // tip
      }
      g.fillStyle = '#4fc3f7'; g.beginPath(); g.arc(W * 0.85, H * 0.3, 3, 0, 7); g.fill(); // chalk
    } },
  { id: 'chessclock', name: 'Game Shelf', cat: 'Games', brand: 'CasaModa', w: 2, h: 1, colors: ['#8a6844', '#3a3f47', '#a4805c'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.wood(g, 4, 4, W - 8, H - 8, c);
      g.fillStyle = HP.shade(c, 0.55); g.fillRect(8, 8, W - 16, H - 16);
      const gc = ['#a03a3a', '#3a5f8a', '#c9a44e', '#5d8a5d', '#8a5d8a'];
      for (let i = 0; i < 5; i++) {                                               // game boxes
        g.fillStyle = gc[i];
        g.fillRect(11 + i * (W - 26) / 5, 10 + (i % 2) * 4, (W - 26) / 5 - 3, H - 22 - (i % 2) * 4);
      }
    } },

  /* ---------------- MUSIC extras 2 ---------------- */
  { id: 'ampstack', name: 'Amp Stack', cat: 'Music', brand: 'UrbanForm', w: 1, h: 1, colors: ['#2c2f33', '#3a3f47', '#5b4a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      p.box(g, W * 0.2, H * 0.42, W * 0.6, H * 0.42, 3, c);                       // cab
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;                   // grill weave
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(W * 0.24, H * (0.5 + i * 0.08)); g.lineTo(W * 0.76, H * (0.5 + i * 0.08)); g.stroke();
      }
      p.box(g, W * 0.24, H * 0.14, W * 0.52, H * 0.26, 3, HP.shade(c, 1.25));     // head
      for (let i = 0; i < 5; i++) {                                               // knobs
        g.fillStyle = '#c9a44e';
        g.beginPath(); g.arc(W * (0.3 + i * 0.1), H * 0.2, 2, 0, 7); g.fill();
      }
      g.fillStyle = '#e05252'; g.beginPath(); g.arc(W * 0.72, H * 0.2, 2, 0, 7); g.fill(); // pilot light
    } },
  { id: 'micstand', name: 'Mic Stand', cat: 'Music', brand: 'UrbanForm', w: 1, h: 1, colors: ['#3a3f47', '#8b939c'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.beginPath(); g.ellipse(W / 2, H * 0.85, W * 0.22, H * 0.07, 0, 0, 7);     // base
      g.fillStyle = c; g.fill();
      g.strokeStyle = c; g.lineWidth = 3;                                         // pole
      g.beginPath(); g.moveTo(W / 2, H * 0.82); g.lineTo(W / 2, H * 0.28); g.stroke();
      g.strokeStyle = HP.shade(c, 0.8); g.lineWidth = 2.5;                        // boom arm
      g.beginPath(); g.moveTo(W / 2, H * 0.32); g.lineTo(W * 0.78, H * 0.16); g.stroke();
      g.beginPath(); g.arc(W * 0.82, H * 0.14, 5, 0, 7);                          // mic head
      g.fillStyle = '#555c66'; g.fill();
      g.strokeStyle = '#8b939c'; g.lineWidth = 1; g.stroke();
    } },
  { id: 'violinstand', name: 'Cello Stand', cat: 'Music', brand: 'Heritage', w: 1, h: 1, colors: ['#a06558', '#8a5a3a', '#6b4f33'],
    draw(g, W, H, v) {
      const c = this.colors[v];
      g.strokeStyle = '#3a3f47'; g.lineWidth = 2.5;                               // stand frame
      g.beginPath(); g.moveTo(W * 0.3, H * 0.85); g.lineTo(W / 2, H * 0.6); g.lineTo(W * 0.7, H * 0.85); g.stroke();
      g.beginPath();                                                              // cello body
      g.moveTo(W / 2, H * 0.15);
      g.bezierCurveTo(W * 0.72, H * 0.2, W * 0.72, H * 0.42, W / 2, H * 0.45);
      g.bezierCurveTo(W * 0.3, H * 0.5, W * 0.28, H * 0.62, W / 2, H * 0.75);
      g.bezierCurveTo(W * 0.72, H * 0.62, W * 0.7, H * 0.5, W / 2, H * 0.45);
      g.closePath();
      g.fillStyle = c; g.fill();
      g.strokeStyle = HP.shade(c, 0.55); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#2a2520'; g.lineWidth = 1.5;                               // strings/fingerboard
      g.beginPath(); g.moveTo(W / 2, H * 0.12); g.lineTo(W / 2, H * 0.5); g.stroke();
      g.fillStyle = '#2a2520'; g.fillRect(W * 0.46, H * 0.1, W * 0.08, H * 0.14); // neck
    } },

  /* ---------------- LIVING extras (window & storage) ---------------- */
  { id: 'curtains', name: 'Curtains', cat: 'Living', brand: 'Velluto', w: 3, h: 1, hangs: true, colors: ['#a8b8c8', '#e8a0b8', '#8fb8a0', '#d8cfc0', '#5d4a68', '#3a3f47'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.strokeStyle = '#8b939c'; g.lineWidth = 3;                                 // rod
      g.beginPath(); g.moveTo(4, 8); g.lineTo(W - 4, 8); g.stroke();
      g.fillStyle = '#c9a44e';                                                    // finials
      g.beginPath(); g.arc(5, 8, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(W - 5, 8, 3, 0, 7); g.fill();
      [0.14, 0.86].forEach(dx => {                                                // drape panels
        g.fillStyle = p.lg(g, W * dx - W * 0.12, 10, W * 0.24, H - 14, HP.shade(c, 1.1), HP.shade(c, 0.8));
        g.beginPath();
        g.moveTo(W * dx - W * 0.12, 10); g.lineTo(W * dx + W * 0.12, 10);
        g.lineTo(W * dx + W * 0.14, H - 8); g.lineTo(W * dx - W * 0.14, H - 8);
        g.closePath(); g.fill();
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.15)';                                        // folds
        for (let i = -1; i <= 1; i++) {
          g.beginPath(); g.moveTo(W * dx + i * W * 0.06, 12); g.lineTo(W * dx + i * W * 0.07, H - 10); g.stroke();
        }
      });
    } },
  { id: 'credenza', name: 'Credenza', cat: 'Living', brand: 'Nordvik', w: 3, h: 1, colors: ['#9a774f', '#3a3f47', '#d6c9b2', '#5d4a3a'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      g.fillStyle = '#6b4f33';                                                    // tapered legs
      [[0.1, 0.85], [0.3, 0.85], [0.7, 0.85], [0.9, 0.85]].forEach(pt => {
        g.fillRect(W * pt[0] - 2, H * pt[1] - 4, 4, 6);
      });
      p.wood(g, 4, 5, W - 8, H * 0.78, c);
      g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1.5;                        // door splits
      for (let i = 1; i < 3; i++) {
        g.beginPath(); g.moveTo(4 + i * (W - 8) / 3, 7); g.lineTo(4 + i * (W - 8) / 3, H * 0.82); g.stroke();
      }
      g.fillStyle = '#c9a44e';                                                    // pulls
      for (let i = 0; i < 3; i++) g.fillRect(W * (0.24 + i * 0.28), H * 0.4, 6, 3);
      g.fillStyle = '#8fb8a0'; g.fillRect(W * 0.44, H * 0.1, W * 0.12, H * 0.25); // vase on top
    } },
  { id: 'cornershelf', name: 'Corner Shelf', cat: 'Living', brand: 'Nordvik', w: 1, h: 1, colors: ['#9a774f', '#3a3f47', '#e8e2d6'],
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v];
      for (let i = 0; i < 3; i++) {                                               // quarter shelves
        g.beginPath();
        g.moveTo(6, H * (0.3 + i * 0.28)); g.lineTo(W * (0.9 - i * 0.2), H * (0.3 + i * 0.28));
        g.lineTo(6, H * (0.3 + i * 0.28) + (W * (0.9 - i * 0.2) - 6));
        g.closePath();
        g.fillStyle = HP.shade(c, 0.95 - i * 0.05); g.fill();
        g.strokeStyle = HP.shade(c, 0.6); g.lineWidth = 1; g.stroke();
      }
      g.fillStyle = '#8fb8a0'; g.beginPath(); g.arc(W * 0.2, H * 0.34, 4, 0, 7); g.fill(); // small pot
      g.fillStyle = '#a03a3a'; g.fillRect(W * 0.14, H * 0.62, 5, 8);              // book
    } },
  { id: 'sectional5', name: 'U-Sectional 5', cat: 'Living', brand: 'Softline', w: 5, h: 4, colors: FABC,
    draw(g, W, H, v) {
      const p = P(), c = this.colors[v], aw = W * 0.16;
      p.fabric(g, 4, 4, W - 8, H * 0.34, 8, c);                                   // top back
      p.fabric(g, 4, 4, aw, H - 8, 8, HP.shade(c, 0.9));                          // left arm+seat
      p.fabric(g, W - aw - 4, 4, aw, H - 8, 8, HP.shade(c, 0.9));                 // right
      p.cushion(g, aw + 6, H * 0.34, W - aw * 2 - 12, H * 0.24, HP.shade(c, 1.12)); // center seat
      p.cushion(g, 10, H * 0.44, aw - 8, H * 0.44, HP.shade(c, 1.12));            // left chaise seat
      p.cushion(g, W - aw - 2, H * 0.44, aw - 8, H * 0.44, HP.shade(c, 1.12));    // right chaise seat
      p.cushion(g, aw + 6, H * 0.62, W - aw * 2 - 12, H * 0.26, HP.shade(c, 1.08)); // middle pit
      p.pillow(g, aw + 10, H * 0.14, 14, HP.shade(c, 1.3), -0.2);
      p.pillow(g, W - aw - 24, H * 0.14, 14, HP.shade(c, 1.3), 0.2);
      p.pillow(g, W * 0.4, H * 0.2, 13, HP.shade(c, 1.25), 0);
    } },
];
})();
