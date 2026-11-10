/* walk3d.js — first-person controls for the 3D walk mode.
   Pointer-lock mouse look + WASD on desktop; twin virtual sticks on touch.
   Collision = circle-vs-box slide against geom3d wall boxes, furniture
   blockers and closed door leaves.  E / tap toggles the door in view.  */
window.HP = window.HP || {};
(function () {
const K = HP.walk3d = {};
const SPEED = 85, RUN = 140, RADIUS = 6;   /* px units: 1 cell=1m → walk 3 m/s, run 5 m/s */
let yaw = 0, pitch = 0, px = 0, pz = 0;
let keys = {}, locked = false, started = false, paused = false;
let moveT = { x: 0, y: 0 }, lookT = { id: -1, lx: 0, ly: 0 };
let el = {};
let frames = 0, lastFps = 0, fpsT = 0;
let prompt = null;
let velX = 0, velZ = 0, stride = 0, stepIx = 0;   // walk feel
let groundY = 0, wasIn = false;                  // wading: floor under us
let airY = 0, airV = 0, airborne = false, feetY = 0;  // jump
let sitting = null;
Object.defineProperty(HP, 'playerSitting3d', { get: () => !!sitting });

let pushFurniture = false;
try {
  pushFurniture = localStorage.getItem('hp_push_furniture') === 'true';
} catch (_) {}
Object.defineProperty(HP, 'pushFurniture', {
  get: () => pushFurniture,
  set: v => {
    pushFurniture = !!v;
    try { localStorage.setItem('hp_push_furniture', String(pushFurniture)); } catch (_) {}
  }
});

function sitDown(target) {
  if (sitting) return;
  const it = target.it, def = target.def;
  const rot = (it.rot || 0) % 4;
  const sitYaw = rot === 0 ? 0 : rot === 1 ? Math.PI / 2 : rot === 2 ? Math.PI : -Math.PI / 2;
  sitting = {
    it,
    px, pz, yaw, pitch,
    standFeetY: feetY
  };
  px = target.spot.x;
  pz = target.spot.z;
  yaw = sitYaw;
  pitch = 0;
  clearMotion();
  feetY = -12;
}

function standUp() {
  if (!sitting) return;
  const s = sitting;
  sitting = null;
  px = s.px;
  pz = s.pz;
  yaw = s.yaw;
  feetY = s.standFeetY;
  clearMotion();
}

function waterAt(x, z) {                         /* pool basin at a point */
  for (const a of (HP.world3d.waterAreas || []))
    if (x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1) return a;
  return null;
}
/* ground under a point: pool floor/stairs, or the top of a collider
   you're standing on after jumping onto furniture                 */
function groundAt(x, z) {
  const a = waterAt(x, z);
  let y = 0;
  if (a) {
    y = a.floorY;
    const s = a.stairs;
    if (s && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) {
      const d = (s.ax === 'z' ? z - s.from : x - s.from) * s.dir;
      y = d >= s.run ? a.floorY : -s.rise * (1 + Math.floor(Math.max(0, d) / s.tread));
      if (y < a.floorY) y = a.floorY;
    }
  }
  // Ladder climbs (e.g. treehouse ship ladder)
  if (HP.world3d.climbs) {
    for (const c of HP.world3d.climbs) {
      if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) {
        const progress = c.ax === 'z' ? ((z - c.from) * c.dir) / c.run : ((x - c.from) * c.dir) / c.run;
        const clampedProg = Math.max(0, Math.min(1, progress));
        const climbY = c.y0 + clampedProg * (c.y1 - c.y0);
        if (climbY > y) y = climbY;
      }
    }
  }
  // Elevated deck floors (treehouse platform at y = 54.0)
  if (HP.world3d.elevatedDecks) {
    for (const d of HP.world3d.elevatedDecks) {
      if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) {
        if (feetY >= d.deckY - 8) {
          if (d.deckY > y) y = d.deckY;
        }
      }
    }
  }
  for (const b of HP.world3d.colliders)
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 &&
        b.y1 > y && b.y1 <= feetY + 0.5) y = b.y1;
  return y;
}
function floorMat() {                            /* material underfoot */
  if (waterAt(px, pz) && groundY < -8) return 'water';
  const cx = Math.floor(px / HP.CELL), cy = Math.floor(pz / HP.CELL);
  const m = HP.cur().floors[cx + ',' + cy];
  if (m) return m;
  const { regionOf } = HP.computeRegions();
  const id = cx < 0 || cy < 0 || cx >= HP.GRID_W || cy >= HP.GRID_H ? -1 : regionOf[cy * HP.GRID_W + cx];
  return id === -1 ? 'grass' : 'wood';
}

K.enter = function (start) {
  sitting = null;
  px = start.x; pz = start.y;
  { const wa0 = waterAt(px, pz); groundY = wa0 ? wa0.floorY : 0; wasIn = !!wa0;
    airY = airV = 0; airborne = false; feetY = groundY; }
  yaw = start.yaw || 0; pitch = start.pitch !== undefined ? start.pitch : 0;
  K.camElevate = start.elevate !== undefined ? start.elevate : 0;
  started = true;
  paused = false;
  clearMotion();
  el.overlay.style.display = 'none';
  requestLock();
};

K.syncCamera = function () {
  if (!HP.world3d || !HP.world3d.camera) return;
  const cam = HP.world3d.camera;
  if (!K.fly) {
    const elev = K.camElevate || 0;
    cam.position.set(px, (sitting ? (HP.world3d.EYE - 12 + groundY) : (HP.world3d.EYE + feetY)) + elev, pz);
    cam.rotation.y = yaw; cam.rotation.x = pitch;
    cam.rotation.z = 0;
    cam.rotation.order = 'YXZ';
  }
  if (HP.cull3d && HP.cull3d.update) {
    HP.cull3d.update(px, pz, true);
  }
  if (HP.world3d && HP.world3d.render) {
    HP.world3d.render();
  }
};

K.teleport = function (x, z, targetYaw, targetY, targetPitch, targetElevate) {
  sitting = null;
  px = x; pz = z;
  const wa0 = waterAt(px, pz); groundY = wa0 ? wa0.floorY : 0;
  airY = airV = 0; airborne = false;
  feetY = targetY !== undefined ? (groundY = targetY) : groundY;
  if (targetYaw !== undefined) yaw = targetYaw;
  if (targetPitch !== undefined) pitch = targetPitch; else pitch = 0;
  K.camElevate = targetElevate !== undefined ? targetElevate : 0;
  clearMotion();
  K.syncCamera();
};

K.playerPos = function () {
  return {
    x: px,
    y: sitting ? (groundY || 0) : feetY,
    z: pz,
    yaw: yaw,
    pitch: pitch,
    sitting: !!sitting,
    speed: Math.hypot(velX, velZ)
  };
};

function clearMotion() {
  keys = {}; moveT.x = moveT.y = 0; lookT.id = -1;
  velX = velZ = 0;
  if (el.stickLn) el.stickLn.style.transform = '';
}
K.pause = function () {
  if (!started) return;
  paused = true;
  clearMotion();
  showOverlay('PAUSED', isTouch() ? 'tap to keep walking' : 'click to keep walking');
  el.prompt.style.display = 'none';
  document.exitPointerLock && document.exitPointerLock();
};
K.resume = function (spawn) {
  if (!started) { K.enter(spawn); return; }
  paused = false;
  clearMotion();
  prompt = null;
  el.overlay.style.display = 'none';
  requestLock();
  if (HP.sound3d) HP.sound3d.start();
};
K.isPaused = () => paused;

K.boot = function () {
  el.canvas   = document.getElementById('gl');
  el.overlay  = document.getElementById('overlay');
  el.fps      = document.getElementById('fps');
  el.hint     = document.getElementById('hint');
  el.prompt   = document.getElementById('prompt');
  el.stickL   = document.getElementById('stickL');
  el.stickLn  = document.getElementById('stickL-nub');

  let lockTime = 0, lastDx = 0, lastDy = 0, lastMoveT = 0;
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === el.canvas;
    if (locked) { lockTime = performance.now(); lastDx = lastDy = 0; }
    if (!locked && started && !paused && !isTouch() && (typeof location === 'undefined' || (!location.search.includes('showroom') && !location.search.includes('autoenter=1')))) K.pause();
  });
  document.addEventListener('mousemove', e => {
    if (!locked || paused) return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    const now = performance.now();
    /* Chromium on Windows emits a bogus recenter spike (~innerWidth/2 px)
       when the hidden OS cursor hits the window edge during a 360° turn
       or right as pointer lock engages — drop impossible single-frame jumps */
    if (now - lockTime < 45 && Math.hypot(dx, dy) > 30) return;
    if (Math.abs(dx) > 200 || Math.abs(dy) > 200) return;
    if (now - lastMoveT < 80 && Math.abs(lastDx) > 2 && dx * lastDx < 0 && Math.abs(dx) > Math.max(65, Math.abs(lastDx) * 4)) return;
    if (now - lastMoveT < 80 && Math.abs(lastDy) > 2 && dy * lastDy < 0 && Math.abs(dy) > Math.max(65, Math.abs(lastDy) * 4)) return;
    lastDx = dx; lastDy = dy; lastMoveT = now;
    yaw   -= dx * 0.0023;
    yaw    = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    pitch -= dy * 0.0023;
    pitch  = Math.max(-1.45, Math.min(1.45, pitch));
  });
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyP' && started && (typeof location === 'undefined' || !location.search.includes('showroom'))) { if (!e.repeat) K.pause(); return; }
    if (paused) return;
    keys[e.code] = true;
    if (HP.sound3d) HP.sound3d.start();           // first gesture → audio
    if (e.code === 'Space' && !e.defaultPrevented) { if (e.preventDefault) e.preventDefault(); doJump(); }
    if (e.code === 'KeyE') interact();
  });
  document.addEventListener('keyup', e => keys[e.code] = false);
  el.canvas.addEventListener('click', () => {
    if (HP.sound3d) HP.sound3d.start();
    if (!locked && started && !paused) requestLock();
  });
  el.canvas.addEventListener('touchstart', () => { if (HP.sound3d) HP.sound3d.start(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!HP.sound3d) return;
    document.hidden ? HP.sound3d.stop() : HP.sound3d.resume();
  });

  /* touch: left half = move stick, right half = look drag            */
  const T = e => {
    if (paused) return;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2) {
        const r = el.stickL.getBoundingClientRect();
        moveT.x = clamp((t.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
        moveT.y = clamp((t.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
        el.stickLn.style.transform = `translate(${moveT.x * 22}px,${moveT.y * 22}px)`;
      } else if (lookT.id === t.identifier || lookT.id < 0) {
        if (e.type === 'touchstart') { lookT.id = t.identifier; lookT.lx = t.clientX; lookT.ly = t.clientY; }
        else {
          yaw   -= (t.clientX - lookT.lx) * 0.0045;
          pitch -= (t.clientY - lookT.ly) * 0.0045;
          pitch = Math.max(-1.45, Math.min(1.45, pitch));
          lookT.lx = t.clientX; lookT.ly = t.clientY;
        }
      }
    }
    if (e.cancelable) e.preventDefault();
  };
  const TE = e => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2) { moveT.x = moveT.y = 0; el.stickLn.style.transform = ''; }
      if (t.identifier === lookT.id) lookT.id = -1;
    }
  };
  el.canvas.addEventListener('touchstart', T, { passive: false });
  el.canvas.addEventListener('touchmove', T, { passive: false });
  el.canvas.addEventListener('touchend', TE);
  el.canvas.addEventListener('touchcancel', TE);
  el.stickL.addEventListener('touchstart', T, { passive: false });
  el.stickL.addEventListener('touchmove', T, { passive: false });
  el.stickL.addEventListener('touchend', TE);
  el.stickL.addEventListener('touchcancel', TE);
  el.prompt.addEventListener('click', () => interact());
  el.prompt.addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); interact(); }
  });
  addEventListener('blur', () => { keys = {}; moveT.x = moveT.y = 0; });

  lastFps = performance.now();
  requestAnimationFrame(tick);
};

const GRAV = 320, JUMP = 124;                    // ~24px apex ≈ 0.85m hop
function doJump() {
  if (airborne || !started) return;
  if (sitting) { standUp(); return; }
  const wading = !!waterAt(px, pz) && feetY < -8;
  airV = JUMP * (wading ? 0.55 : 1);             // water kills your jump
  airborne = true;
  if (HP.sound3d) HP.sound3d.step(floorMat(), true);
}
K.doJump = doJump;
const isTouch = () => matchMedia('(pointer:coarse)').matches || !!(HP.graphics3d && HP.graphics3d.touch);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function requestLock() {
  if (isTouch() || !el.canvas.requestPointerLock) return;
  try {
    const result = el.canvas.requestPointerLock({ unadjustedMovement: true });
    if (result && result.catch) result.catch(() => {
      try {
        const r2 = el.canvas.requestPointerLock();
        if (r2 && r2.catch) r2.catch(() => {});
      } catch (_) {}
    });
  } catch (_) {
    try { el.canvas.requestPointerLock(); } catch (_2) {}
  }
}

function showOverlay(title, sub) {
  el.overlay.style.display = 'flex';
  el.overlay.querySelector('h1').textContent = title;
  el.overlay.querySelector('p').textContent = sub;
}

/* ---------- collision ---------- */
/* world-space XZ footprint of a door leaf at rotation ang (default:
   current) — an open leaf still blocks where it physically stands   */
function leafBox(d, ang) {
  const th = ang === undefined ? d.pivot.rotation.y : ang;
  if (d.casement) {
    const pts = leafCorners(d, th);
    return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])),
      z0: Math.min(...pts.map(p => p[1])), z1: Math.max(...pts.map(p => p[1])) };
  }
  /* a near-closed leaf blocks the WHOLE doorway slot — the thin slab
     sits at one face, so blocking only its own thickness lets the
     player stand inside the slot beyond its reach (and tunnel past
     its edge).  Once it swings out, only the leaf itself blocks.    */
  if (Math.abs(th) < 0.18)
    return { x0: d.a.x0 - 0.4, x1: d.a.x1 + 0.4, z0: d.a.z0 - 0.4, z1: d.a.z1 + 0.4 };
  const P = d.pivot.position, L = d.leaf, g = L.geometry.parameters;
  const cs = Math.cos(th), sn = Math.sin(th);
  const h = d.a.d === 'h';
  /* leaf's real local rect: u along the door line, v across the zone */
  const u0 = (h ? L.position.x : L.position.z) - (h ? g.width : g.depth) / 2;
  const u1 = u0 + (h ? g.width : g.depth);
  const v0 = (h ? L.position.z : L.position.x) - (h ? g.depth : g.width) / 2;
  const v1 = v0 + (h ? g.depth : g.width);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [u, v] of [[u0, v0], [u0, v1], [u1, v0], [u1, v1]]) {
    const lx = h ? u : v, lz = h ? v : u;
    const wx = P.x + lx * cs + lz * sn;
    const wz = P.z - lx * sn + lz * cs;
    if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
    if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
  }
  return { x0, x1, z0, z1 };
}

/* the leaf's four corners at a hypothetical angle — for swing tests  */
function leafCorners(d, ang) {
  if (d.casement) {
    const root = d.pivot.parent.position, p = d.pivot.position;
    const cs = Math.cos(ang), sn = Math.sin(ang), h = d.a.d === 'h';
    return [[0, -0.9], [d.hinge * d.lw, -0.9], [d.hinge * d.lw, 0.9], [0, 0.9]].map(([u, v]) => {
      const x = h ? u : v, z = h ? v : u;
      return [root.x + p.x + x * cs + z * sn, root.z + p.z - x * sn + z * cs];
    });
  }
  const P = d.pivot.position, L = d.leaf, g = L.geometry.parameters;
  const cs = Math.cos(ang), sn = Math.sin(ang), h = d.a.d === 'h';
  const u0 = (h ? L.position.x : L.position.z) - (h ? g.width : g.depth) / 2;
  const u1 = u0 + (h ? g.width : g.depth);
  const v0 = (h ? L.position.z : L.position.x) - (h ? g.depth : g.width) / 2;
  const v1 = v0 + (h ? g.depth : g.width);
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => {
    const lx = h ? u : v, lz = h ? v : u;
    return [P.x + lx * cs + lz * sn, P.z - lx * sn + lz * cs];
  });
}
/* SAT: rotated leaf rect vs axis-aligned box → penetration depth     */
function leafPen(d, ang, b) {
  const pts = leafCorners(d, ang);
  return rectPen(pts, [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]]);
}
function rectPen(pts, other) {
  const axes = [];
  for (const polygon of [pts, other]) for (let i = 0; i < 2; i++) {
    const p = polygon[i], q = polygon[(i + 1) % 4];
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    if (len > 1e-8) axes.push([-dz / len, dx / len]);
  }
  let pen = 1e9;
  for (const [ax, az] of axes) {
    let pmin = 1e9, pmax = -1e9, bmin = 1e9, bmax = -1e9;
    for (const [x, z] of pts) { const p = x * ax + z * az; if (p < pmin) pmin = p; if (p > pmax) pmax = p; }
    for (const [x, z] of other) {
      const p = x * ax + z * az; if (p < bmin) bmin = p; if (p > bmax) bmax = p;
    }
    const o = Math.min(pmax, bmax) - Math.max(pmin, bmin);
    if (o <= 0) return 0;
    if (o < pen) pen = o;
  }
  return pen;
}
// Resolve the player in the sash's own axes, avoiding a large invisible
// axis-aligned blocker around a diagonally open window.
function resolveCasement(d, nx, nz, angle = d.pivot.rotation.y) {
  const root = d.pivot.parent.position, p = d.pivot.position;
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = nx - root.x - p.x, dz = nz - root.z - p.z;
  const x = dx * cs - dz * sn, z = dx * sn + dz * cs;
  const lo = Math.min(0, d.hinge * d.lw), hi = Math.max(0, d.hinge * d.lw);
  const b = d.a.d === 'h' ? { x0: lo, x1: hi, z0: -0.9, z1: 0.9 }
    : { x0: -0.9, x1: 0.9, z0: lo, z1: hi };
  const [rx, rz] = resolveBox(b, x, z);
  return [root.x + p.x + rx * cs + rz * sn, root.z + p.z - rx * sn + rz * cs];
}
function swingWindow(d, from, to) {
  if (Math.abs(to - from) < 1e-8) return from;
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) * 180));
  let safe = from;
  for (let i = 1; i <= steps; i++) {
    const f = from + (to - from) * i / steps, ang = f * Math.PI / 2 * d.swingDir;
    const pts = leafCorners(d, ang);
    const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]));
    const z0 = Math.min(...pts.map(p => p[1])), z1 = Math.max(...pts.map(p => p[1]));
    const hit = b => b.y1 > d.ly0 && b.y0 < d.ly1 &&
      b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1 &&
      rectPen(pts, [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]]) > 0.001;
    let blocked = HP.world3d.colliders.some(hit) || HP.world3d.geom.boxes.some(hit);
    if (!blocked) for (const other of HP.world3d.doorPivots) {
      if (other === d || other.slide || other.ly1 <= d.ly0 || other.ly0 >= d.ly1) continue;
      if (rectPen(pts, leafCorners(other, other.pivot.rotation.y)) > 0.001) { blocked = true; break; }
    }
    if (!blocked && started && d.ly0 < 50) {
      const [x, z] = resolveCasement(d, px, pz, ang);
      blocked = Math.hypot(x - px, z - pz) > 0.001;
    }
    if (blocked) { d.vel = 0; return safe; }
    safe = f;
  }
  return safe;
}
/* seat the leaf on the face it folds toward — f=+1 folds the default
   side, f=-1 swings the other way so a blocked door opens somewhere */
function setFlip(d, f) {
  d.flip = f;
  if (d.gate || d.window || !d.dep) return;              // centred leaves
  /* the hinge pin must move to the face the leaf folds toward —
     same corner, other edge of the slot                              */
  if (d.a.d === 'h') d.pivot.position.z = f > 0 ? d.a.z0 : d.a.z1;
  else               d.pivot.position.x = f > 0 ? d.a.x0 : d.a.x1;
  const v  = (d.dep / 2 - 0.3) * f;
  const kv = (d.dep - 0.5) * f;
  if (d.a.d === 'h') { d.leaf.position.z = v; d.knob.position.z = kv; }
  else               { d.leaf.position.x = v; d.knob.position.x = kv; }
}
/* test both swing directions for an aperture; keep the roomier side —
   all leaves of a (double) door share the choice                   */
function chooseFlip(d) {
  const fam = HP.world3d.doorPivots.filter(o => o.a === d.a);
  const lim = f => { for (const o of fam) setFlip(o, f);
                     return Math.min(...fam.map(swingLimit)); };
  const plus = lim(1);
  if (plus < 2.6) {
    const minus = lim(-1);
    if (minus > plus + 0.1) { d.a.flip = -1; return; }
  }
  d.a.flip = 1;
  lim(1);                                   // restore default side
}
/* furthest the leaf can swing before ~2px inside a static solid —
   doors can't fold through walls or furniture                      */
function swingLimit(d) {
  const dir = (d.a.d === 'h' ? 1 : -1) * (d.li === 1 ? -1 : 1) * (d.flip || 1);
  const cs = HP.world3d.colliders || [];
  let good = 0;
  for (let deg = 6; deg <= 166; deg += 4) {
    const ang = deg * Math.PI / 180 * dir;
    let blocked = false;
    for (const b of cs) {
      if (b.mv !== undefined) continue;                 // light items get shoved aside
      if (b.y1 <= (d.ly0 || 0) || b.y0 >= (d.ly1 || 60)) continue; // outside the leaf's band
      if (leafPen(d, ang, b) > 2) { blocked = true; break; }
    }
    if (blocked) break;
    good = deg;
  }
  return Math.max(good, 8) * Math.PI / 180;   // always at least a crack
}
/* Captive window tracks have hard end stops. Sweep the full sash
   (including handle) against solids at its actual height, in both
   directions; moved furniture can obstruct closing as well as opening. */
function slideWindow(d, from, to) {
  const origin = d.pivot.parent.position;
  const travel = Math.hypot(d.slide.x, d.slide.y, d.slide.z);
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) * travel / 0.25));
  let safe = from;
  for (let i = 1; i <= steps; i++) {
    const f = from + (to - from) * i / steps;
    const x = origin.x + d.base.x + d.slide.x * f;
    const y = origin.y + d.base.y + d.slide.y * f;
    const z = origin.z + d.base.z + d.slide.z * f;
    const hits = b => x + d.halfX > b.x0 + 0.001 && x - d.halfX < b.x1 - 0.001 &&
      y + d.halfY > b.y0 + 0.001 && y - d.halfY < b.y1 - 0.001 &&
      z + d.halfZ > b.z0 + 0.001 && z - d.halfZ < b.z1 - 0.001;
    if ((HP.world3d.colliders || []).some(hits) ||
        (HP.world3d.geom.boxes || []).some(hits)) {
      d.vel = 0;
      return safe;
    }
    safe = f;
  }
  return safe;
}
function collide(nx, nz, vx, vz) {
  if (sitting) return [nx, nz];
  /* player circle vs every static box + door leaves — two passes so
     pushes from one box get re-checked against the rest             */
  for (let pass = 0; pass < 2; pass++) {
    for (const b of HP.world3d.colliders) {
      if (b.y1 <= feetY + 0.5) continue;   /* feet above it → it's a floor */
      if (b.y0 !== undefined && b.y0 >= feetY + 42) continue; /* overhead beam / canopy */
      const [rx, rz] = resolveBox(b, nx, nz);
      if ((rx !== nx || rz !== nz) && b.mv !== undefined && (vx || vz) && pushFurniture) {
        /* shove light furniture — it slides away, you muscle past it */
        const m = HP.world3d.movers[b.mv];
        m.vx = clamp(m.vx - (rx - nx) * 12, -150, 150);
        m.vz = clamp(m.vz - (rz - nz) * 12, -150, 150);
        nx += (rx - nx) * 0.55; nz += (rz - nz) * 0.55;
        continue;
      }
      nx = rx; nz = rz;
    }
    if (HP.world3d && HP.world3d.garageDoors) {
      for (const gd of HP.world3d.garageDoors) {
        if (gd.open < 0.65) {
          const [rx, rz] = resolveBox(gd.box, nx, nz);
          nx = rx; nz = rz;
        }
      }
    }
    for (const d of HP.world3d.doorPivots) {
      if (d.window && !d.casement) continue;           // lift sashes stay above the sill
      const [rx, rz] = d.casement ? resolveCasement(d, nx, nz) : resolveBox(leafBox(d), nx, nz);
      if (!d.window && (rx !== nx || rz !== nz) && (vx || vz)) {
        /* pressing into a leaf from its SWING side shoves it open —
           the pull side holds firm like a real hinged door         */
        /* you push from the side OPPOSITE the fold — the leaf opens
           away from you like a real door                            */
        const pushSide = d.a.d === 'h'
          ? ((d.flip || 1) > 0 ? pz > d.a.z1 : pz < d.a.z0)
          : ((d.flip || 1) > 0 ? px > d.a.x1 : px < d.a.x0);
        if (pushSide && d.open < 0.85) { d.vel = Math.min((d.vel || 0) + 0.55, 2.6); d.holdT = 3.5; }
        else if (d.open > 0.3) d.holdT = 3.5;     // already open — don't shut on you
      }
      nx = rx; nz = rz;
    }
  }
  /* stay on the lot */
  nx = clamp(nx, RADIUS, HP.GRID_W * HP.CELL - RADIUS);
  nz = clamp(nz, RADIUS, HP.GRID_H * HP.CELL - RADIUS);
  return [nx, nz];
}
/* circle (px,pz,R) vs box — push out along the smallest exit vector */
function resolveBox(b, nx, nz) {
  const cx = clamp(nx, b.x0, b.x1), cz = clamp(nz, b.z0, b.z1);
  const dx = nx - cx, dz = nz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= RADIUS * RADIUS) return [nx, nz];
  if (d2 > 1e-9) {                        // edge/corner graze → push along normal
    const k = (RADIUS - Math.sqrt(d2)) / Math.sqrt(d2);
    return [nx + dx * k, nz + dz * k];
  }
  /* centre inside the box → exit along the shallowest axis */
  const ax = Math.min(nx - b.x0, b.x1 - nx), az = Math.min(nz - b.z0, b.z1 - nz);
  if (ax < az) return [nx + (nx - b.x0 < b.x1 - nx ? -(ax + RADIUS) : ax + RADIUS), nz];
  return [nx, nz + (nz - b.z0 < b.z1 - nz ? -(az + RADIUS) : az + RADIUS)];
}

/* ---------- door + gadget interaction ---------- */
function nearestThing() {
  let best = null, bd = 70;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (sitting) {
    return { kind: 'seat', isSitting: true, label: 'Stand up' };
  }
  for (const it of (HP.cur().furniture || [])) {
    const sk = HP.seatKind ? HP.seatKind(it.type) : null;
    if (!sk) continue;
    const def = HP.itemDef(it.type);
    if (!def) continue;
    const spots = HP.itemSeatSpots ? HP.itemSeatSpots(it, def) : [];
    for (const sp of spots) {
      const dx = sp.x - px, dz = sp.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 48 || dist < 1) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot > 0.25 && dist < bd) {
        bd = dist;
        best = {
          kind: 'seat', it, def, sk, spot: sp,
          label: (sk === 'lie' ? 'Lie down' : 'Sit') + ' — ' + (def.name || it.type)
        };
      }
    }
  }
  if (HP.world3d.climbs) {
    for (const c of HP.world3d.climbs) {
      const atTop = feetY >= (c.y1 - 10);
      const targetSpot = atTop ? c.deckSpot : c.groundSpot;
      const dx = targetSpot.x - px, dz = targetSpot.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 42 && dist < bd) {
        bd = dist;
        best = {
          kind: 'climb',
          climb: c,
          atTop,
          label: atTop ? 'Climb down Treehouse' : 'Climb up to Treehouse Deck'
        };
      }
    }
  }
  if (HP.world3d && HP.world3d.garageDoors) {
    for (const gd of HP.world3d.garageDoors) {
      const dx = gd.cx - px, dz = gd.cz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 75 || dist < 1) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot > 0.30 && dist < bd) {
        bd = dist;
        best = {
          kind: 'garagedoor',
          door: gd,
          label: (gd.target === 1 || gd.open > 0.5) ? 'Close Garage Door' : 'Open Garage Door'
        };
      }
    }
  }
  for (const d of HP.world3d.doorPivots) {
    const a = d.a;
    const dx = a.cx - px, dz = a.cz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > bd || dist < 1) continue;
    const dot = (dx * fx + dz * fz) / dist;        // must face it
    if (dot > 0.55 && dist < bd) { bd = dist; best = d; }
  }
  /* switchable gadgets (lamps, TV, fireplace) compete on distance   */
  for (const g2 of (HP.life3d ? HP.life3d.interactables : [])) {
    const dx = g2.x - px, dz = g2.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > bd || dist < 1) continue;
    const dot = (dx * fx + dz * fz) / dist;
    if (dot > 0.55 && dist < bd) { bd = dist; best = g2; }
  }
  /* showroom inspection labels */
  if (HP.showroomItems) {
    for (const it of HP.showroomItems) {
      const d = HP.itemDef(it.type);
      const cx = (it.x + (it.w || (d && d.w) || 1) / 2) * HP.CELL;
      const cz = (it.y + (it.h || (d && d.h) || 1) / 2) * HP.CELL;
      const dx = cx - px, dz = cz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 85 || dist < 1) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot > 0.5 && dist < bd) { bd = dist; best = { item: it, def: d, isShowroom: true }; }
    }
  }
  return best;
}
function interact() {
  if (paused || !started) return;
  const d = nearestThing();
  if (!d || d.isShowroom) return;
  if (d.kind === 'climb') {
    if (d.atTop) {
      px = d.climb.groundSpot.x;
      pz = d.climb.groundSpot.z;
      groundY = feetY = d.climb.y0;
      airY = 0;
    } else {
      px = d.climb.deckSpot.x;
      pz = d.climb.deckSpot.z;
      groundY = feetY = d.climb.y1;
      airY = 0;
    }
    return;
  }
  if (d.kind === 'garagedoor') {
    const gd = d.door;
    gd.target = gd.target === 1 ? 0 : 1;
    if (HP.sound3d) {
      gd.target === 1 ? HP.sound3d.door(true, false) : HP.sound3d.door(false, false);
    }
    return;
  }
  if (d.kind === 'seat') {
    if (d.isSitting) { standUp(); return; }
    sitDown(d);
    return;
  }
  if (d.kind) {
    HP.life3d.toggle(d);
    if (HP.sync3d && d.it) HP.sync3d.broadcastLamp(d.it.id, d.it.on);
    return;
  }
  /* latch the whole door (both leaves of a double) — a latched door
     stays open until E again; unlatching lets the spring shut it    */
  const open = !(d.latched || d.holdT > 0.2 || d.open > 0.5);
  for (const o of HP.world3d.doorPivots) if (o.a === d.a) { o.latched = open; if (!open) o.holdT = 0; }
  if (HP.sync3d && HP.world3d && HP.world3d.doorPivots) {
    const idx = HP.world3d.doorPivots.indexOf(d);
    if (idx >= 0) HP.sync3d.broadcastDoor(idx, open ? 1.0 : 0.0, 0);
  }
}

/* ---------- main loop ---------- */
let last = 0;
function tick(t) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
  if (paused) { HP.world3d.render(); return; }

  /* move */
  if (started) {
    if (sitting) {
      if (keys.KeyW || keys.ArrowUp || keys.KeyS || keys.ArrowDown ||
          keys.KeyA || keys.ArrowLeft || keys.KeyD || keys.ArrowRight ||
          keys.Space || Math.hypot(moveT.x, moveT.y) > 0.1) {
        standUp();
      }
    }
    let mx = moveT.x, mz = moveT.y;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const len = Math.hypot(mx, mz) || 1;
    if (len > 1) { mx /= len; mz /= len; }
    const sp = (keys.ShiftLeft || keys.ShiftRight) ? RUN : SPEED;
    const run = sp === RUN;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw),  rz = -Math.sin(yaw);
    /* wading: water drags you to about half speed                    */
    const wading0 = !!waterAt(px, pz) && feetY < -8;
    const drag = wading0 ? 0.5 : 1;
    /* eased velocity — the walker accelerates and glides to a stop
       instead of snapping between full speed and frozen             */
    const tvx = (fx * -mz + rx * mx) * sp * drag, tvz = (fz * -mz + rz * mx) * sp * drag;
    const ease = Math.min(1, dt * 9);
    velX += (tvx - velX) * ease; velZ += (tvz - velZ) * ease;
    if (Math.hypot(velX, velZ) < 3) { velX = velZ = 0; }
    const vx = velX * dt, vz = velZ * dt;
    if (vx || vz) {
      const [nx, nz] = collide(px + vx, pz + vz, vx, vz);
      px = nx; pz = nz;
    }
    /* step down into / climb out of the basin — a smooth fall, not a
       teleport, so it reads as stepping into water                  */
    const wa = waterAt(px, pz);
    const tgtY = groundAt(px, pz);
    groundY += (tgtY - groundY) * Math.min(1, dt * 4.5);
    if (Math.abs(tgtY - groundY) < 0.05) groundY = tgtY;
    const wading = !!wa && feetY < -8;
    if (wading !== wasIn) { if (HP.sound3d) HP.sound3d.splash(wading); wasIn = wading; }
    /* jump: gravity pulls you back to whatever you're standing on   */
    if (airborne) {
      airY += airV * dt; airV -= GRAV * dt;
      if (airY <= 0) {
        airY = 0; airborne = false;
        if (HP.sound3d) HP.sound3d.step(floorMat(), true);   // landing thud/splash
      }
    }
    feetY = groundY + airY;
    const speed = Math.hypot(velX, velZ);
    /* head-bob: stride phase advances with distance actually moved  */
    const moved = Math.hypot(vx, vz);
    stride += moved * 0.036;
    const bobAmt = Math.min(1, speed / SPEED) * 1.15 * (wading ? 0.35 : 1) * (airborne ? 0.3 : 1);
    const bobY = Math.sin(stride * 2) * bobAmt;
    /* one footstep per half-stride, voiced by the floor underfoot   */
    const ix = Math.floor(stride * 2 / Math.PI);
    if (ix !== stepIx) {
      stepIx = ix;
      if (HP.sound3d && speed > 32 && !airborne) HP.sound3d.step(floorMat(), run);
    }
    const cam = HP.world3d.camera;
    if (!K.fly) {                                        /* debug: free camera */
      const elev = K.camElevate || 0;
      cam.position.set(px, (sitting ? (HP.world3d.EYE - 12 + groundY) : (HP.world3d.EYE + feetY + bobY)) + elev, pz);
      cam.rotation.y = yaw; cam.rotation.x = pitch;
      cam.rotation.z = Math.sin(stride) * 0.011 * Math.min(1, speed / RUN);  // sprint sway
      cam.rotation.order = 'YXZ';
    }
    if (HP.sync3d && HP.sync3d.tick) HP.sync3d.tick(dt, t / 1000, cam);

    /* interact prompt — doors, gates, windows and gadgets           */
    const d = nearestThing();
    if (d !== prompt) {
      prompt = d;
      el.prompt.style.display = d ? 'block' : 'none';
    }
    if (d) {
      const action = isTouch() ? 'Tap' : 'E';
      if (d.isShowroom) {
        const numPrefix = d.item.itemNum ? ('#' + d.item.itemNum + ' ') : '';
        const cleanLabel = (d.item.label || (d.def && d.def.name) || '').replace(/^#\d+\s*/, '');
        el.prompt.textContent = numPrefix + cleanLabel;
      } else if (d.kind === 'climb') {
        el.prompt.textContent = action + ' — ' + d.label;
      } else if (d.kind === 'seat') {
        el.prompt.textContent = action + ' — ' + (d.isSitting ? 'Stand up' : d.label);
      } else if (d.kind === 'garagedoor') {
        el.prompt.textContent = action + ' — ' + d.label;
      } else if (d.kind) {
        el.prompt.textContent = action + ' — ' + HP.life3d.label(d);
      } else {
        const thing = d.gate ? 'gate' : d.window ? 'window' : 'door';
        el.prompt.textContent = action + ' — ' +
          ((d.latched || d.holdT > 0.2 || d.open > 0.5) ? 'close ' : 'open ') + thing;
      }
    }
  }

  /* garage door roll-up animation */
  if (HP.world3d && HP.world3d.garageDoors) {
    for (const gd of HP.world3d.garageDoors) {
      const tgt = gd.target;
      const err = tgt - gd.open;
      gd.vel = (gd.vel || 0) + (err * 16 - (gd.vel || 0) * 5.5) * dt;
      gd.open += gd.vel * dt;
      if (gd.open < 0) { gd.open = 0; if (gd.vel < 0) gd.vel = 0; }
      if (gd.open > 1) { gd.open = 1; if (gd.vel > 0) gd.vel = 0; }
      if (Math.abs(tgt - gd.open) < 0.001) { gd.open = tgt; gd.vel = 0; }
      gd.updatePanels(gd.open);
    }
  }

  /* door physics — damped spring: bump velocity throws the leaf,
     the spring pulls it home (open while latched/held, shut after),
     with a small overshoot so it feels hinged, not robotic          */
  for (const d of (HP.world3d.doorPivots || [])) {
    if (d.holdT > 0) d.holdT -= dt;
    if (d.maxAng === undefined) {
      if (d.casement) d.maxAng = Math.PI / 2;
      else if (d.slide) d.maxAng = Infinity;            // sashes slide, not swing
      else {
        if (d.a.flip === undefined) chooseFlip(d);        // pick roomier side
        d.flip = d.a.flip;
        d.maxAng = swingLimit(d);                          // swing arc vs world
      }
    }
    const tgt = (d.latched || d.holdT > 0) ? 1 : 0;
    const err = tgt - d.open;
    const previous = d.open;
    d.vel = (d.vel || 0) + (err * 26 - d.vel * (d.window ? 10.2 : 5.5)) * dt;
    d.open += d.vel * dt;
    if (d.open < 0) { d.open = 0; if (d.vel < 0) d.vel = 0; }
    if (d.slide) {
      d.open = slideWindow(d, previous, Math.min(1, d.open));
      if (Math.abs(tgt - d.open) < 0.0001) { d.open = tgt; d.vel = 0; }
    }
    if (d.casement) {
      d.open = swingWindow(d, previous, clamp(d.open, 0, 1));
      if (Math.abs(tgt - d.open) < 0.0001) { d.open = tgt; d.vel = 0; }
    }
    /* creak when it starts swinging, thud when it closes home       */
    if (HP.sound3d && d.prevOpen !== undefined) {
      if (d.prevOpen <= 0.04 && d.open > 0.08 && Math.abs(d.vel) > 0.3)
        d.window ? HP.sound3d.windowOpen() : HP.sound3d.door(true, d.gate);
      else if (d.prevOpen > 0.05 && d.open <= 0.05 && !d.latched)
        d.window ? HP.sound3d.windowOpen() : HP.sound3d.door(false, d.gate);
    }
    d.prevOpen = d.open;
    const lim = d.window ? 1 : d.maxAng / 2.9;
    if (d.open > lim) { d.open = lim; if (d.vel > 0) d.vel = -d.vel * 0.2; }  // bounce off the obstruction
    d.target = tgt;
    if (d.casement) {
      d.pivot.rotation.y = d.open * Math.PI / 2 * d.swingDir;
    } else if (d.slide) {                          // sash glides along the wall plane
      d.pivot.position.set(d.base.x + d.slide.x * d.open,
                           d.base.y + d.slide.y * d.open,
                           d.base.z + d.slide.z * d.open);
    } else {
      const ang = d.open * 2.9;                      // ~166° max — folds flat against the wall
                                                     // (margin so the leaf never clips the face)
      const side = d.li === 1 ? -1 : 1;
      d.pivot.rotation.y = (d.a.d === 'h' ? ang * side : -ang * side) * (d.flip || 1);
    }

    /* a swinging leaf shoves light furniture aside instead of
       phasing through it                                          */
    if (!d.window && Math.abs(d.vel || 0) > 0.02) {
      for (const m of (HP.world3d.movers || [])) {
        if (leafPen(d, d.pivot.rotation.y, m.box) <= 2) continue;
        const dx = m.x + m.w / 2 - d.pivot.position.x, dz = m.z + m.h / 2 - d.pivot.position.z;
        const dl = Math.hypot(dx, dz) || 1;
        const push = Math.min(3, Math.abs(d.vel) * 1.5 + 0.6);
        m.vx = clamp(m.vx + dx / dl * push * 40, -150, 150);
        m.vz = clamp(m.vz + dz / dl * push * 40, -150, 150);
        d.vel *= 0.8;
      }
    }
  }

  /* furniture physics — pushed items slide, friction settles them,
     walls/furniture/each other stop them                            */
  const movers = HP.world3d.movers || [];
  let moved = false;
  for (const m of movers) {
    if (!m.vx && !m.vz) continue;
    const damp = Math.exp(-6 * dt);
    m.vx *= damp; m.vz *= damp;
    if (Math.hypot(m.vx, m.vz) < 6) { m.vx = m.vz = 0; continue; }
    let nx2 = m.x + m.vx * dt, nz2 = m.z + m.vz * dt;
    const box = { x0: nx2, x1: nx2 + m.w, z0: nz2, z1: nz2 + m.h };
    const hit = b => {
      const ox = Math.min(box.x1, b.x1) - Math.max(box.x0, b.x0);
      const oz = Math.min(box.z1, b.z1) - Math.max(box.z0, b.z0);
      if (ox <= 0 || oz <= 0) return;
      if (b.mv !== undefined) {                 // billiard shove
        const om = HP.world3d.movers[b.mv];
        om.vx += m.vx * 0.5; om.vz += m.vz * 0.5;
      }
      if (ox < oz) { nx2 += (nx2 + m.w / 2 < (b.x0 + b.x1) / 2 ? -ox : ox);
                     box.x0 = nx2; box.x1 = nx2 + m.w; m.vx = 0; }
      else         { nz2 += (nz2 + m.h / 2 < (b.z0 + b.z1) / 2 ? -oz : oz);
                     box.z0 = nz2; box.z1 = nz2 + m.h; m.vz = 0; }
    };
    /* two passes: resolving against one box can push into another   */
    for (let pass = 0; pass < 2; pass++) {
      for (const b of HP.world3d.colliders)
        if (b !== m.box && b.y0 < m.sy && b.y1 > 2) hit(b);
      for (const d of (HP.world3d.doorPivots || []))   // doors block furniture too
        if (!d.window || (d.casement && m.sy > d.ly0)) hit(leafBox(d));
      if (HP.world3d && HP.world3d.garageDoors) {
        for (const gd of HP.world3d.garageDoors)
          if (gd.open < 0.65) hit(gd.box);
      }
    }
    /* a pool is a hole in the ground — furniture can't slide onto it */
    for (const a of (HP.world3d.waterAreas || [])) {
      if (box.x1 > a.x0 && box.x0 < a.x1 && box.z1 > a.z0 && box.z0 < a.z1) {
        nx2 = m.x; nz2 = m.z; m.vx = m.vz = 0; break;
      }
    }
    m.x = clamp(nx2, 0, HP.GRID_W * HP.CELL - m.w);
    m.z = clamp(nz2, 0, HP.GRID_H * HP.CELL - m.h);
    m.box.x0 = m.x; m.box.x1 = m.x + m.w; m.box.z0 = m.z; m.box.z1 = m.z + m.h;
    moved = true;
  }
  if (moved) {
    const fit = HP.world3d.fitMesh;
    if (HP.world3d.furnitureVisuals) {
      HP.world3d.furnitureVisuals.move(movers);
    } else if (fit) {
      const M = new THREE.Matrix4();
      for (const m of movers) {
        M.makeScale(m.sx, m.sy, m.sz);
        M.setPosition(m.x + m.w / 2, m.sy / 2, m.z + m.h / 2);
        fit.setMatrixAt(m.inst, M);
      }
      fit.instanceMatrix.needsUpdate = true;
    }
  }

  /* fps meter + adaptive resolution: sustained low fps drops DPR    */
  frames++;
  if (t - fpsT > 500) {
    const fps = Math.round(frames * 1000 / (t - fpsT));
    el.fps.textContent = fps + ' fps';
    el.fps.style.color = fps >= 50 ? '#7fe08a' : fps >= 28 ? '#e8c86a' : '#ff7a6a';
    if (HP.graphics3d) HP.graphics3d.sample(fps, (t - fpsT) / 1000);
    else if (fps < 42 && !K._lo) {                       /* legacy fallback */
      K._lo = true;
      const r = HP.world3d.renderer;
      if (r && r.getPixelRatio() > 1) r.setPixelRatio(1);
    }
    frames = 0; fpsT = t;
  }
  if (fpsT === 0) fpsT = t;

  HP.world3d.render();
}
})();
