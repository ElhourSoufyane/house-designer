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

/* wall that blocks walking (doors let you through) */
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
  const f = HP.cur().fences[k];                        // fences block too; gates / step-over edges don't
  return !!(f && f.t !== 'gate' && f.t !== 'rope' && f.t !== 'fieldstone');
}

/* set of cells blocked by furniture (walkable defs like rugs excluded) */
let blockedCells = null, blockedFor = -1;
function blockedSet() {
  if (blockedFor === HP.state.level && blockedCells) return blockedCells;
  blockedCells = new Set();
  for (const it of HP.cur().furniture) {
    const def = HP.itemDef(it.type);
    if (def.walkable) continue;
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
        ? 'Drag anywhere to walk · tap Stop to exit'
        : 'WASD / arrows to walk · Esc to exit';
      hint.classList.remove('hidden');
    }
    HP.status('Walk mode — WASD / arrows, or drag on touch screens');
  } else {
    if (savedCam) HP.camera = savedCam;
    HP.player = null; keys.clear(); joy = null; hideJoy();
    stairsShown = '';
    const ui = document.getElementById('stairs-ui');
    if (ui) { ui.classList.add('hidden'); ui.innerHTML = ''; }
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
  if (len > 0.01) {
    dx /= Math.max(1, len); dy /= Math.max(1, len);
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
  HP.markDirty();
};

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
  const p = HP.player, r = R + 2;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(2, 3, r, r * 0.85, 0, 0, 7); g.fill();
  g.rotate(p.angle);
  // body
  g.beginPath(); g.arc(0, 0, r, 0, 7);
  g.fillStyle = '#4fc3f7'; g.fill();
  g.strokeStyle = '#22749e'; g.lineWidth = 2; g.stroke();
  // facing wedge
  g.fillStyle = '#e8eaf0';
  g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();
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
    // use stairs
    if ((k === 'e' || k === 'enter') && stairsShown) {
      HP.travelFloor(stairsShown.includes('u') ? 1 : -1);
      e.preventDefault(); return;
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k))
      e.preventDefault();
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
};
})();
