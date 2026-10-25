/* walk.js — Play mode: walk through the house with WASD / touch joystick.
   Collision vs walls (doors are passable) and furniture footprints. */
(function () {
HP.playing = false;
HP.player = null;              // {x, y, angle} in world px
const keys = new Set();
let joy = null;                // {ox, oy, dx, dy} screen px
let savedCam = null;
const SPEED = 4.2;             // cells per second
const R = 9;                   // player radius in world px

/* furniture that lights up / toggles in walk mode */
const LIGHTS = new Set(['floorlamp', 'lamppost', 'pathlight', 'lamparc', 'lamptripod',
  'lamptorch', 'lamptable', 'lamppaper', 'lampmush', 'lampcandle', 'lampbanker',
  'artneon', 'topcandles', 'fllantern', 'nightlight', 'fireplace', 'firepit']);
HP.isLamp = t => LIGHTS.has(t);

/* furniture you can sit on / lie down in (walk-mode interact) */
const SEATS = new Set(['sofa2', 'sofa3', 'sofaL', 'sofaU', 'outsofa', 'modseat', 'loveseat2',
  'settee', 'reclinerSofa', 'curvedSofa', 'recliner', 'armchair', 'tubchair', 'clubchair',
  'accentchair', 'swivelchair', 'rockchair', 'rocker', 'chair', 'highchair', 'offchair',
  'gamingchair', 'kneelchair', 'bench', 'gardenbench', 'entrybench', 'showerbench',
  'bedbench', 'weightbench', 'barstool', 'footstool', 'ottoman', 'ottomanTuft', 'ottomanStor',
  'beanbag', 'beanbag2', 'toilet', 'bathtub', 'hottub', 'lounger', 'cinemaseats', 'swingset', 'car']);
const LIES = new Set(['bedSingle', 'bedDouble', 'bedQueen', 'bedKing', 'bunkbed', 'daybed',
  'daybed2', 'futon', 'sleeper', 'hammock', 'crib', 'petbed', 'chaise', 'modchaise']);
HP.seatKind = t => SEATS.has(t) ? 'sit' : LIES.has(t) ? 'lie' : null;

/* wall that blocks walking (open doors let you through, closed ones don't) */
function solidBetween(x, y, nx, ny) {
  const w = HP.cur().walls;
  let k = null;
  if (nx === x + 1) k = 'v,' + (x + 1) + ',' + y;
  else if (nx === x - 1) k = 'v,' + x + ',' + y;
  else if (ny === y + 1) k = 'h,' + x + ',' + (y + 1);
  else if (ny === y - 1) k = 'h,' + x + ',' + y;
  if (!k) return false;
  const s = w[k];
  if (s && s.f !== 'door') return true;
  if (s && s.f === 'door' && s.c) return true;              // closed door blocks
  const f = HP.cur().fences[k];                        // fences block too; gates / step-over edges don't
  return !!(f && f.t !== 'gate' && f.t !== 'rope' && f.t !== 'fieldstone');
}

/* things you can step onto/over in walk mode — thin poles, wall-hung art,
   floor-level stuff. def.walkable covers the rest (rugs, mats, stairs). */
const WALKTHROUGH = new Set([
  // lamps & thin poles — step past/over the base
  'floorlamp', 'lamparc', 'lamptripod', 'lamptorch', 'lamppaper', 'lampmush',
  'lampcandle', 'lampbanker', 'lamptable', 'fllantern', 'nightlight',
  'lamppost', 'pathlight', 'topcandles', 'fan', 'coatrack',
  // bathroom — walk into the shower, step over small fixtures
  'shower', 'towelrack', 'radiator',
  // wall-hung — art, mirrors, curtains sit on/against the wall, floor is free
  'wallart', 'artabstract', 'artgeo', 'artland', 'artbotan', 'artline',
  'arttriptych', 'artneon', 'artphoto', 'floormirror', 'curtains',
  // small ground items — step over
  'plantSm', 'plantBig', 'vase', 'umbstand', 'trashbin', 'robotvac',
  'petbed', 'hamper', 'wbins', 'firepit'
]);

/* set of cells blocked by furniture (walkable defs like rugs excluded) */
let blockedCells = null, blockedFor = -1;
HP.invalidateBlocked = () => { blockedFor = -1; };    // co-op remote edits change furniture
function blockedSet() {
  if (blockedFor === HP.state.level && blockedCells) return blockedCells;
  blockedCells = new Set();
  for (const it of HP.cur().furniture) {
    const def = HP.itemDef(it.type);
    if (def.walkable || WALKTHROUGH.has(it.type)) continue;
    const f = HP.footprint(it);
    for (let y = f.y; y < f.y + f.h; y++)
      for (let x = f.x; x < f.x + f.w; x++)
        blockedCells.add(x + ',' + y);
  }
  blockedFor = HP.state.level;
  return blockedCells;
}

/* can the player circle be at world (nx,ny)? */
function free(nx, ny) {
  const C = HP.CELL, W = HP.GRID_W;
  const cc = HP.w2c({ x: nx, y: ny });
  const bs = blockedSet();
  const x0 = Math.floor((nx - R) / C), x1 = Math.floor((nx + R) / C);
  const y0 = Math.floor((ny - R) / C), y1 = Math.floor((ny + R) / C);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= HP.GRID_H) return false;
    if (bs.has(x + ',' + y)) return false;              // furniture
    if (x === cc.x && y === cc.y) continue;
    if (x === cc.x || y === cc.y) {                     // edge-adjacent cell
      if (solidBetween(cc.x, cc.y, x, y)) return false;
    } else {                                            // diagonal corner
      if (solidBetween(cc.x, cc.y, x, cc.y) && solidBetween(cc.x, cc.y, cc.x, y)) return false;
    }
  }
  return true;
}

function spawn() {
  const p = spawnPoint();
  HP.player = { x: p.x, y: p.y, angle: 0 };
  if (!free(p.x, p.y)) HP.player = { x: p.x + HP.CELL, y: p.y + HP.CELL, angle: 0 };
}

HP.togglePlay = function () {
  HP.playing = !HP.playing;
  document.body.classList.toggle('playing', HP.playing);
  const btn = document.getElementById('btn-play');
  const hint = document.getElementById('play-hint');
  if (HP.playing) {
    HP.pending = null; HP.ghost = null; HP.selected = null; HP.selectedRoom = null;
    savedCam = { ...HP.camera };
    spawn();
    HP.camera.zoom = Math.max(1.15, HP.camera.zoom);
    if (btn) btn.innerHTML = '<svg class="ic"><use href="#i-stop"/></svg>Stop';
    if (hint) {
      hint.textContent = ('ontouchstart' in window)
        ? 'Drag anywhere to walk · tap the button to open doors & lamps'
        : 'WASD / arrows to walk · E to open doors & lamps · Esc to exit';
      hint.classList.remove('hidden');
    }
    HP.status('Walk mode — WASD / arrows, or drag on touch screens');
  } else {
    if (savedCam) HP.camera = savedCam;
    HP.player = null; keys.clear(); joy = null; hideJoy();
    stairsShown = ''; curUse = null; useShown = ''; sitting = null;
    const ui = document.getElementById('stairs-ui');
    if (ui) { ui.classList.add('hidden'); ui.innerHTML = ''; }
    const uu = document.getElementById('use-ui');
    if (uu) { uu.classList.add('hidden'); uu.innerHTML = ''; }
    if (btn) btn.innerHTML = '<svg class="ic"><use href="#i-play"/></svg>Play';
    if (hint) hint.classList.add('hidden');
    HP.status('Ready');
    if (HP.updateZoomUI) HP.updateZoomUI();
    if (HP.refreshContext) HP.refreshContext();
  }
  HP.markDirty();
};

HP.tickPlayer = function (dt) {
  if (!HP.player) return;
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (joy) { dx += joy.dx; dy += joy.dy; }
  const len = Math.hypot(dx, dy);
  if (sitting) {                              // any move input stands you up
    if (len > 0.01) standUp();
  } else if (len > 0.01) {
    dx /= Math.max(1, len); dy /= Math.max(1, len);
    if (HP._rot3 !== undefined) {              // 3D play: input is look-relative
      const c = Math.cos(HP._rot3), s = Math.sin(HP._rot3);
      const tx = dx * c + dy * s, ty = -dx * s + dy * c;
      dx = tx; dy = ty;
    }
    const step = SPEED * HP.CELL * dt;
    const nx = HP.player.x + dx * step, ny = HP.player.y + dy * step;
    if (free(nx, HP.player.y)) HP.player.x = nx;
    if (free(HP.player.x, ny)) HP.player.y = ny;
    HP.player.angle = Math.atan2(dy, dx);
  }
  // camera follows
  HP.camera.x += (HP.player.x - HP.camera.x) * Math.min(1, dt * 8);
  HP.camera.y += (HP.player.y - HP.camera.y) * Math.min(1, dt * 8);
  checkStairs();
  checkUse();
  HP.markDirty();
};

/* ---------- interact: doors + lamps + seats near the player ---------- */
let curUse = null, useShown = '', sitting = null;
Object.defineProperty(HP, 'playerSitting', { get: () => !!sitting });   // sync.js reads this
/* distance from point to item footprint edge (better than centre for big sofas) */
function distToItem(px, py, it) {
  const C = HP.CELL, f = HP.footprint(it);
  const x0 = f.x * C, y0 = f.y * C, x1 = (f.x + f.w) * C, y1 = (f.y + f.h) * C;
  return Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));
}
/* where a player can sit/lie on an item:
   sofas & benches → one cushion per cell along the long axis
   beds & wide lie-downs → two sides (left / right) along the narrow axis */
function seatSpots(it) {
  const C = HP.CELL, f = HP.footprint(it), spots = [];
  if (HP.seatKind(it.type) === 'lie') {
    if (f.w >= f.h) {                                   // wide → left & right halves
      const my = (f.y + f.h / 2) * C;
      spots.push({ x: (f.x + f.w / 4) * C, y: my }, { x: (f.x + f.w * 3 / 4) * C, y: my });
    } else {                                            // tall → top & bottom halves
      const mx = (f.x + f.w / 2) * C;
      spots.push({ x: mx, y: (f.y + f.h / 4) * C }, { x: mx, y: (f.y + f.h * 3 / 4) * C });
    }
  } else if (f.w >= f.h) {
    for (let i = 0; i < f.w; i++) spots.push({ x: (f.x + i + 0.5) * C, y: (f.y + f.h / 2) * C });
  } else {
    for (let i = 0; i < f.h; i++) spots.push({ x: (f.x + f.w / 2) * C, y: (f.y + i + 0.5) * C });
  }
  return spots;
}
/* point on an item you must reach to use it. Center is stricter than the
   closest edge — an edge can peek through a doorway while the item itself
   is still behind the wall, which reads as a bug. */
function itemReach(it) {
  const C = HP.CELL, f = HP.footprint(it);
  return { x: (f.x + f.w / 2) * C, y: (f.y + f.h / 2) * C };
}
/* line of sight: step cell-to-cell along the segment; any solid wall
   (incl. closed doors & blocking fences) crossed = can't use it */
function clearShot(x0, y0, x1, y1) {
  const C = HP.CELL;
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (C * 0.25)));
  let lx = Math.floor(x0 / C), ly = Math.floor(y0 / C);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.floor((x0 + (x1 - x0) * t) / C);
    const cy = Math.floor((y0 + (y1 - y0) * t) / C);
    if (cx !== lx && solidBetween(lx, ly, cx, ly)) return false;
    if (cy !== ly && solidBetween(lx, ly, lx, cy)) return false;
    lx = cx; ly = cy;
  }
  return true;
}
function nearestUse() {
  if (sitting) return { kind: 'stand', label: 'Stand up' };
  const C = HP.CELL, lvl = HP.cur();
  const px = HP.player.x, py = HP.player.y;
  const cx = Math.floor(px / C), cy = Math.floor(py / C);
  let best = null, bd = 1.7 * C;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    for (const k of ['h,' + x + ',' + y, 'h,' + x + ',' + (y + 1), 'v,' + x + ',' + y, 'v,' + (x + 1) + ',' + y]) {
      const s = lvl.walls[k];
      if (!s || s.f !== 'door') continue;
      const p = HP.parseWallKey(k);
      const mx = (p.d === 'h' ? p.x + 0.5 : p.x) * C, my = (p.d === 'h' ? p.y : p.y + 0.5) * C;
      const d = Math.hypot(mx - px, my - py);
      /* the door sits ON the wall — sight-check a point on OUR side of it,
         else a closed door would block its own reach and never open */
      const rx = d > 0 ? mx + (px - mx) / d * Math.min(0.3 * C, d * 0.5) : px;
      const ry = d > 0 ? my + (py - my) / d * Math.min(0.3 * C, d * 0.5) : py;
      if (d < bd && clearShot(px, py, rx, ry)) { bd = d; best = { kind: 'door', key: k, label: (s.c ? 'Open' : 'Close') + ' door' }; }
    }
  }
  for (const it of lvl.furniture) {
    const sk = HP.seatKind(it.type);
    if (sk && distToItem(px, py, it) < bd) {
      const p = itemReach(it);
      if (!clearShot(px, py, p.x, p.y)) continue;
      bd = distToItem(px, py, it);
      const def = HP.itemDef(it.type);
      best = { kind: 'sit', it, label: (sk === 'lie' ? 'Lie on ' : 'Sit on ') + def.name };
      continue;
    }
    if (HP.isLamp(it.type) && distToItem(px, py, it) < bd) {
      const p = itemReach(it);
      if (!clearShot(px, py, p.x, p.y)) continue;
      bd = distToItem(px, py, it);
      const def = HP.itemDef(it.type);
      best = { kind: 'lamp', it, label: (it.on ? 'Turn off ' : 'Turn on ') + def.name };
    }
  }
  return best;
}
function standUp() {
  if (!sitting) return;
  const s = sitting; sitting = null;
  if (free(s.px, s.py)) { HP.player.x = s.px; HP.player.y = s.py; }
  useShown = '';
  HP.markDirty();
}
function checkUse() {
  curUse = nearestUse();
  const lbl = curUse ? curUse.label : '';
  if (lbl === useShown) return;
  useShown = lbl;
  const ui = document.getElementById('use-ui');
  if (!ui) return;
  if (!curUse) { ui.classList.add('hidden'); ui.innerHTML = ''; return; }
  ui.innerHTML = '';
  const b = document.createElement('button');
  b.innerHTML = '<svg class="ic"><use href="#i-door"/></svg>' + curUse.label;
  b.onclick = doUse;
  ui.appendChild(b);
  ui.classList.remove('hidden');
}
function doUse() {
  const u = curUse;
  if (!u) return;
  if (u.kind === 'stand') { standUp(); return; }
  if (u.kind === 'sit') {
    const C = HP.CELL;
    sitting = { it: u.it, px: HP.player.x, py: HP.player.y };
    /* pick the free spot nearest where you're standing — partners get
       different cushions / their own side of the bed instead of stacking */
    const peers = (HP.peerAvatarList ? HP.peerAvatarList() : [])
      .filter(a => a.s && a.lvl === HP.state.level);
    const spots = seatSpots(u.it);
    const free = spots.filter(sp => !peers.some(a => Math.hypot(a.x - sp.x, a.y - sp.y) < C * 0.4));
    const pool = free.length ? free : spots;
    let best = pool[0], bd = Infinity;
    for (const sp of pool) {
      const d = Math.hypot(sp.x - HP.player.x, sp.y - HP.player.y);
      if (d < bd) { bd = d; best = sp; }
    }
    HP.player.x = best.x; HP.player.y = best.y;
    HP.player.angle = Math.PI / 2;            // face "down" like sitting forward
    useShown = '';
    HP.markDirty();
    return;
  }
  if (u.kind === 'door') {
    const w = HP.cur().walls, s = w[u.key];
    if (!s) return;
    s.c = !s.c;
    const p = HP.parseWallKey(u.key);               // mirror a double door's pair
    for (const kk of (p.d === 'h'
      ? ['h,' + (p.x - 1) + ',' + p.y, 'h,' + (p.x + 1) + ',' + p.y]
      : ['v,' + p.x + ',' + (p.y - 1), 'v,' + p.x + ',' + (p.y + 1)])) {
      const s2 = w[kk];
      if (s2 && s2.f === 'door') s2.c = s.c;
    }
    // no invalidateRegions: doors render per-frame now, and open/closed
    // doesn't change room regions (doors block flood-fill either way)
  } else {
    u.it.on = !u.it.on;
  }
  useShown = '';                                     // refresh the prompt label
  HP.markDirty(); HP.saveState();                    // saveState broadcasts to co-op peers
}

/* ---------- stairs: travel between floors ---------- */
function stairsAt(cx, cy) {
  for (const it of HP.cur().furniture) {
    if (it.type !== 'stairs') continue;
    const f = HP.footprint(it);
    if (cx >= f.x && cx < f.x + f.w && cy >= f.y && cy < f.y + f.h) return it;
  }
  return null;
}

let stairsShown = '';                 // which direction set is on screen
function checkStairs() {
  const c = HP.w2c(HP.player);
  const st = stairsAt(c.x, c.y);
  const canUp = HP.state.level < HP.state.levels.length - 1;
  const canDown = HP.state.level > 0;
  const mode = st ? (canUp ? 'u' : '') + (canDown ? 'd' : '') : '';
  if (mode === stairsShown) return;
  stairsShown = mode;
  const ui = document.getElementById('stairs-ui');
  if (!ui) return;
  if (!mode) { ui.classList.add('hidden'); ui.innerHTML = ''; return; }
  ui.innerHTML = '';
  if (canUp) {
    const b = document.createElement('button');
    b.innerHTML = '<svg class="ic"><use href="#i-up"/></svg>Up to Floor ' + (HP.state.level + 2);
    b.onclick = () => HP.travelFloor(1);
    ui.appendChild(b);
  }
  if (canDown) {
    const b = document.createElement('button');
    b.innerHTML = '<svg class="ic"><use href="#i-down"/></svg>Down to Floor ' + HP.state.level;
    b.onclick = () => HP.travelFloor(-1);
    ui.appendChild(b);
  }
  ui.classList.remove('hidden');
}

/* move the player to a stairs footprint centre on a given level */
function stairsLanding(levelIdx, fallback) {
  const lvl = HP.state.levels[levelIdx];
  for (const it of lvl.furniture) {
    if (it.type !== 'stairs') continue;
    const f = HP.footprint(it);
    return { x: (f.x + f.w / 2) * HP.CELL, y: (f.y + f.h / 2) * HP.CELL };
  }
  return fallback;
}

HP.travelFloor = function (dir) {
  const target = HP.state.level + dir;
  if (target < 0 || target >= HP.state.levels.length) return;
  const keep = { x: HP.player.x, y: HP.player.y };
  HP.setLevel(target);
  // land on the stairs of the new floor; if none, try to stay put
  let p = stairsLanding(target, null);
  if (!p) p = free(keep.x, keep.y) ? keep : spawnPoint();
  HP.player.x = p.x; HP.player.y = p.y;
  HP.camera.x = p.x; HP.camera.y = p.y;
  HP.status('Floor ' + (target + 1));
};

function spawnPoint() {
  const { regions } = HP.computeRegions();
  let best = null;
  for (const r of regions) if (!best || r.m2 > best.m2) best = r;
  return best ? { x: best.lx, y: best.ly }
              : { x: HP.GRID_W * HP.CELL / 2, y: HP.GRID_H * HP.CELL / 2 };
}

/* top-down person */
HP.drawPlayer = function (g) {
  const p = HP.player, r = sitting ? (R + 2) * 0.82 : R + 2;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(2, 3, r, r * 0.85, 0, 0, 7); g.fill();
  g.rotate(p.angle);
  // body
  g.beginPath(); g.arc(0, 0, r, 0, 7);
  g.fillStyle = '#4fc3f7'; g.fill();
  g.strokeStyle = '#22749e'; g.lineWidth = 2; g.stroke();
  if (!sitting) {                              // facing wedge — hidden when seated
    g.fillStyle = '#e8eaf0';
    g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();
  }
  g.restore();
};

/* ---------- joystick + keys ---------- */
const joyEl = () => document.getElementById('joy');
function showJoy(x, y) {
  const j = joyEl(); if (!j) return;
  j.style.display = 'block';
  j.style.left = (x - 48) + 'px'; j.style.top = (y - 48) + 'px';
}
function moveJoy(dx, dy) {
  const k = joyEl() && joyEl().querySelector('.knob'); if (!k) return;
  k.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function hideJoy() { const j = joyEl(); if (j) j.style.display = 'none'; }

HP.initWalk = function () {
  const cv = HP.canvas;
  let joyId = null;
  cv.addEventListener('pointerdown', e => {
    if (!HP.playing || joyId !== null) return;
    joyId = e.pointerId;
    try { cv.setPointerCapture(joyId); } catch (_) {}
    const r = cv.getBoundingClientRect();
    joy = { ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0 };
    showJoy(joy.ox, joy.oy); moveJoy(0, 0);
  });
  cv.addEventListener('pointermove', e => {
    if (!HP.playing || e.pointerId !== joyId || !joy) return;
    const r = cv.getBoundingClientRect();
    let dx = e.clientX - r.left - joy.ox, dy = e.clientY - r.top - joy.oy;
    const m = Math.hypot(dx, dy), max = 36;
    if (m > max) { dx *= max / m; dy *= max / m; }
    joy.dx = dx / max; joy.dy = dy / max;
    moveJoy(dx, dy);
  });
  const end = e => {
    if (e.pointerId === joyId) { joyId = null; joy = null; hideJoy(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  document.addEventListener('keydown', e => {
    if (!HP.playing) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    // use stairs / interact
    if (k === 'e' || k === 'enter') {
      if (stairsShown) HP.travelFloor(stairsShown.includes('u') ? 1 : -1);
      else doUse();
      e.preventDefault(); return;
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k))
      e.preventDefault();
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
};
})();
