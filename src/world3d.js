/* world3d.js — builds a Three.js scene from the live house state for Play 3D.
   Units = world px (1 cell = 28 px = 0.5 m). Grid x→x, grid y→z, y=up. */
(function () {
if (typeof THREE === 'undefined') return;

const WALL_H = 140;                       // ~2.5 m — chunky enough to read as walls
const DOOR_H = 104, WIN_SILL = 54, WIN_TOP = 112;   // ~1.9 m leaf, ~0.9 m opening
const EYE = 78, EYE_SIT = 48;
const MAX_LAMP_LIGHTS = 6;

let renderer = null, scene = null, camera = null, sun = null;
let levelGroup = null, builtLevel = -1, lastBuild = 0;
let doorLeaves = [];                      // {grp,key,open}
let lampLights = [];                      // {light,it,x,y}
let avatarMap = {};                       // name -> Group
let itemMeshes = new Map();               // it -> Object3D
let hitTargets = [];                      // {mesh,use} aim-at hitboxes
let solidMeshes = [];                     // walls+fences — block the aim ray
const ray3 = new THREE.Raycaster(); ray3.far = 110;
let aimClock = 0;

const C = () => HP.CELL;
const std = (c, r = 0.85, m = 0, ex) =>
  new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, ex));

/* ---------------- renderer / scene ---------------- */
HP.init3D = function () {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: HP.canvas3d, antialias: false });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;               // static sun → bake once per build
  renderer.shadowMap.needsUpdate = true;
  camera = new THREE.PerspectiveCamera(70, 1, 4, 5000);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc4e4);
  scene.fog = new THREE.Fog(0xa8c8e8, 1600, 4200);
  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x7d8f6a, 0.9));
  sun = new THREE.DirectionalLight(0xfff0da, 0.95);
  sun.position.set(700, 1000, 500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const d = 1100;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, far: 3000 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun); scene.add(sun.target);
  HP.resize3D();
  return true;
};

HP.resize3D = function () {
  if (!renderer) return;
  const cv = renderer.domElement;
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};

/* ---------------- merged-geometry box builder ---------------- */
function GeoBatch() {
  const pos = [], nor = [];
  this.box = (x0, y0, z0, x1, y1, z1) => {
    const quads = [
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], 1, 0, 0],
      [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], -1, 0, 0],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1],
    ];
    for (const [a, b, c, d, nx, ny, nz] of quads) {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
               a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      for (let i = 0; i < 6; i++) nor.push(nx, ny, nz);
    }
  };
  this.mesh = mat => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
}

/* ---------------- ground + floor ---------------- */
function groundPlane() {
  const size = Math.max(HP.GRID_W, HP.GRID_H) * C() * 3.5;
  const mat = new THREE.MeshStandardMaterial({ color: '#7fa065', roughness: 1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(HP.GRID_W * C() / 2, -1.5, HP.GRID_H * C() / 2);
  m.receiveShadow = true;
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}

function floorMesh() {
  const P = 8;                                       // texture px per cell
  const cv = document.createElement('canvas');
  cv.width = HP.GRID_W * P; cv.height = HP.GRID_H * P;
  const g = cv.getContext('2d');
  g.fillStyle = '#8aa86b'; g.fillRect(0, 0, cv.width, cv.height);
  const { regionOf } = HP.computeRegions();
  const mats = HP.cur().floors;
  g.scale(P / C(), P / C());
  for (let y = 0; y < HP.GRID_H; y++) for (let x = 0; x < HP.GRID_W; x++) {
    const inside = regionOf[y * HP.GRID_W + x] >= 0, m = mats[x + ',' + y];
    if (inside || m) HP.paintFloorCell(g, m || 'default', x * C(), y * C());
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(HP.GRID_W * C(), HP.GRID_H * C()),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  mesh.rotation.x = -Math.PI / 2;                     // flipY texture aligns cell (x,y)→world (x*C, y*C)
  mesh.position.set(HP.GRID_W * C() / 2, 0, HP.GRID_H * C() / 2);
  mesh.receiveShadow = true;
  mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  return mesh;
}

/* ---------------- walls / doors / windows / fences ---------------- */
function segThick(s) {
  /* must match wallThick() in main.js — the plan draws 0.30/0.44; thicker
     3D walls squeeze every corridor + doorway into a slit */
  const { regionOf } = HP.computeRegions();
  const out = (x, y) => !HP.cellIn(x, y) || regionOf[y * HP.GRID_W + x] < 0;
  if (s.d === 'h') return (out(s.x, s.y - 1) || out(s.x, s.y)) ? 0.44 * C() : 0.30 * C();
  return (out(s.x - 1, s.y) || out(s.x, s.y)) ? 0.44 * C() : 0.30 * C();
}
function insideSign(s) {                    // which way the door swings (toward room)
  const { regionOf } = HP.computeRegions();
  const inr = (x, y) => HP.cellIn(x, y) && regionOf[y * HP.GRID_W + x] >= 0;
  if (s.d === 'h') return inr(s.x, s.y) ? 1 : -1;
  return inr(s.x, s.y) ? 1 : -1;
}

function buildWalls(group) {
  /* One-sided walls + solid-minus-apertures (SH3D style):
     each wall's thickness goes ONE side of its edge — into the larger
     region (or outside) — so corridors and doorway junctions keep their
     full cell width. Every seg adds a solid rect; doors/windows declare
     aperture rects cut by height band; junction caps close L corners;
     jambs/lintels/sills/posts all emerge from the subtraction. */
  const walls = HP.cur().walls, batch = new GeoBatch(), trim = new GeoBatch();
  const wallMat = std('#f2efe8', 0.95);
  let hasTrim = false;
  const isDoor = (d, x, y) => { const w = walls[d + ',' + x + ',' + y]; return w && w.f === 'door'; };
  const eat = (d, x, y) => {
    const w = walls[d + ',' + x + ',' + y];
    if (!w || w.f === 'door') return 0;
    const doors = (isDoor(d, x - (d === 'h'), y - (d === 'v')) ? 1 : 0)
                + (isDoor(d, x + (d === 'h'), y + (d === 'v')) ? 1 : 0);
    return (doors > 1 ? 0.28 : 0.45) * C();
  };
  /* which side of the edge the wall's thickness occupies:
     -1 = -x/-z cell, +1 = +x/+z cell — into the bigger region / outside */
  const { regionOf } = HP.computeRegions();
  const rsz = {};
  for (let i = 0; i < regionOf.length; i++) if (regionOf[i] >= 0) rsz[regionOf[i]] = (rsz[regionOf[i]] || 0) + 1;
  const rAt = (x, y) => HP.cellIn(x, y) ? regionOf[y * HP.GRID_W + x] : -1;
  const segSide = (s) => {
    const a = s.d === 'h' ? rAt(s.x, s.y - 1) : rAt(s.x - 1, s.y);
    const b = s.d === 'h' ? rAt(s.x, s.y) : rAt(s.x, s.y);
    if (a < 0 && b < 0) return 1;
    if (a < 0) return -1;                       // into the outside
    if (b < 0) return 1;
    return (rsz[a] || 1) >= (rsz[b] || 1) ? -1 : 1;   // into the bigger region
  };
  const rects = [], aps = [], wins = [];
  const vt = {};                                 // vertex -> max half-thickness (caps)
  const touch = (vx, vy, t) => { const k = vx + ',' + vy; vt[k] = Math.max(vt[k] || 0, t / 2); };

  for (const k in walls) {
    const s = HP.parseWallKey(k), feat = walls[k].f, t = segThick(s), sd = segSide(s);
    const x0 = s.x * C(), y0 = s.y * C();
    /* thickness axis range: h segs vary in z, v segs vary in x */
    const w0 = sd < 0 ? -t : 0, w1 = sd < 0 ? 0 : t;       // offset from edge line
    const wc = (w0 + w1) / 2;                              // wall centre offset
    rects.push(s.d === 'h'
      ? { x0, x1: x0 + C(), z0: y0 + w0, z1: y0 + w1 }
      : { x0: x0 + w0, x1: x0 + w1, z0: y0, z1: y0 + C() });
    if (s.d === 'h') { touch(s.x, s.y, t); touch(s.x + 1, s.y, t); }
    else { touch(s.x, s.y, t); touch(s.x, s.y + 1, t); }
    if (feat === 'window') { wins.push({ s, x0, y0, w0, w1, wc }); continue; }
    if (feat !== 'door') continue;
    // pair check like drawDoors: even offset leads a double door
    let off = 0;
    if (s.d === 'h') { for (let x = s.x - 1; isDoor('h', x, s.y); x--) off++; }
    else { for (let y = s.y - 1; isDoor('v', s.x, y); y--) off++; }
    if (off % 2 === 1) continue;                            // handled by pair leader
    const dbl = s.d === 'h' ? isDoor('h', s.x + 1, s.y) : isDoor('v', s.x, s.y + 1);
    const n = dbl ? 2 : 1, span = n * C();
    const p0 = s.d === 'h' ? x0 : y0, pEnd = p0 + span;
    const nbL = walls[s.d + ',' + (s.d === 'h' ? s.x - 1 : s.x) + ',' + (s.d === 'h' ? s.y : s.y - 1)];
    const nbR = walls[s.d + ',' + (s.d === 'h' ? s.x + n : s.x) + ',' + (s.d === 'h' ? s.y : s.y + n)];
    /* junction posts: a perpendicular wall at a vertex (a) kills extension
       past it, and (b) bounds the opening at its far face if its thickness
       intrudes into the door's cell. post face = jamb, like real framing. */
    const post = (d2, x2, y2) => walls[d2 + ',' + x2 + ',' + y2] ? { d: d2, x: x2, y: y2 } : null;
    const boundL = () => {
      let b = -Infinity, any = false;
      for (const dy of [0, -1]) {
        const p = post('v', s.x, s.y + dy); if (!p) continue;
        any = true;                                    // post face: vertex, or deeper if it intrudes into the door cell
        b = Math.max(b, s.x * C() + (segSide(p) > 0 ? segThick(p) : 0));
      }
      return { b, any };
    };
    const boundR = () => {
      let b = Infinity, any = false;
      for (const dy of [0, -1]) {
        const p = post('v', s.x + n, s.y + dy); if (!p) continue;
        any = true;
        b = Math.min(b, (s.x + n) * C() - (segSide(p) < 0 ? segThick(p) : 0));
      }
      return { b, any };
    };
    const boundT = () => {                            // 'v' door start vertex
      let b = -Infinity, any = false;
      for (const dx of [0, -1]) {
        const p = post('h', s.x + dx, s.y); if (!p) continue;
        any = true;
        b = Math.max(b, s.y * C() + (segSide(p) > 0 ? segThick(p) : 0));
      }
      return { b, any };
    };
    const boundB = () => {                            // 'v' door end vertex
      let b = Infinity, any = false;
      for (const dx of [0, -1]) {
        const p = post('h', s.x + dx, s.y + n); if (!p) continue;
        any = true;
        b = Math.min(b, (s.y + n) * C() - (segSide(p) < 0 ? segThick(p) : 0));
      }
      return { b, any };
    };
    const L = s.d === 'h' ? boundL() : boundT(), R = s.d === 'h' ? boundR() : boundB();
    const extL = L.any ? 0 : eat(s.d, s.d === 'h' ? s.x - 1 : s.x, s.d === 'h' ? s.y : s.y - 1);
    const extR = R.any ? 0 : eat(s.d, s.d === 'h' ? s.x + n : s.x, s.d === 'h' ? s.y : s.y + n);
    const ox0 = Math.max(p0 - extL + 1, L.b);
    const ox1 = Math.min(pEnd + extR - 1, R.b);
    const gw = ox1 - ox0;
    // extend cut to WIN_TOP when it eats into a window so no band sliver remains
    const apTop = (nbL && nbL.f === 'window') || (nbR && nbR.f === 'window') ? WIN_TOP : DOOR_H;
    aps.push(s.d === 'h'
      ? { x0: ox0, x1: ox1, z0: y0 + w0 - 1, z1: y0 + w1 + 1, y0: 0, y1: apTop }
      : { x0: x0 + w0 - 1, x1: x0 + w1 + 1, z0: ox0, z1: ox1, y0: 0, y1: apTop });
    /* casing frame — flat boxes just off each wall face, no coplanar overlaps */
    const fw = 5, ec = s.d === 'h' ? y0 + wc : x0 + wc;      // wall centre coord
    for (const sgn of [-1, 1]) {
      const fa = sgn < 0 ? w0 - 1.2 : w1, fb = sgn < 0 ? w0 : w1 + 1.2;
      if (s.d === 'h') {
        trim.box(ox0 - fw, 0, y0 + fa, ox0, DOOR_H, y0 + fb);
        trim.box(ox1, 0, y0 + fa, ox1 + fw, DOOR_H, y0 + fb);
        trim.box(ox0 - fw, DOOR_H, y0 + fa, ox1 + fw, DOOR_H + 4, y0 + fb);
      } else {
        trim.box(x0 + fa, 0, ox0 - fw, x0 + fb, DOOR_H, ox0);
        trim.box(x0 + fa, 0, ox1, x0 + fb, DOOR_H, ox1 + fw);
        trim.box(x0 + fa, DOOR_H, ox0 - fw, x0 + fb, DOOR_H + 4, ox1 + fw);
      }
    }
    hasTrim = true;
    /* leaf — solid slab filling the opening, raised panels, knobs */
    const dir = insideSign(s);
    const lw = gw / (dbl ? 2 : 1) - 1;
    const leafMat = std('#8f6d45', 0.62), panelMat = std('#7a5c38', 0.7);
    const mk = (hx, hz, alongX, extend) => {
      const lg = new THREE.Group();
      lg.position.set(hx, 0, hz);
      const lx = alongX ? extend * (lw / 2 + 0.5) : 0;
      const lz = alongX ? 0 : extend * (lw / 2 + 0.5);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(alongX ? lw : 6, DOOR_H - 1, alongX ? 6 : lw), leafMat);
      leaf.castShadow = true;
      leaf.position.set(lx, DOOR_H / 2, lz);
      lg.add(leaf);
      for (const [py, ph] of [[DOOR_H * 0.7, DOOR_H * 0.34], [DOOR_H * 0.26, DOOR_H * 0.34]]) {
        const pn = new THREE.Mesh(new THREE.BoxGeometry(alongX ? lw * 0.55 : 6.8, ph, alongX ? 6.8 : lw * 0.55), panelMat);
        pn.position.set(lx, py, lz);
        lg.add(pn);
      }
      const km = std('#2f333a', 0.3, 0.85);
      for (const zz of [-4, 4]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), km);
        knob.position.set(alongX ? extend * (lw - 7) : zz, DOOR_H * 0.5, alongX ? zz : extend * (lw - 7));
        lg.add(knob);
      }
      group.add(lg);
      // 'h': rot.y=-dir*extend swings tip into room; 'v': +dir*extend (mirrored axis)
      doorLeaves.push({ grp: lg, key: k, open: (alongX ? -dir : dir) * extend * 1.62 });
    };
    if (s.d === 'h') {
      mk(ox0, ec, true, 1);
      if (dbl) mk(ox1, ec, true, -1);
    } else {
      mk(ec, ox0, false, 1);
      if (dbl) mk(ec, ox1, false, -1);
    }
    // aim hitbox over the whole doorway (leader covers the pair)
    const hb = new THREE.Mesh(new THREE.BoxGeometry(
      s.d === 'h' ? gw + 10 : t + 14, DOOR_H, s.d === 'h' ? t + 14 : gw + 10));
    hb.position.set(s.d === 'h' ? (ox0 + ox1) / 2 : ec, DOOR_H / 2,
      s.d === 'h' ? ec : (ox0 + ox1) / 2);
    hb.visible = false;
    group.add(hb);
    hitTargets.push({ mesh: hb, use: { kind: 'door', key: k } });
  }

  /* junction caps — square posts where ≥2 wall ends meet (or one ends);
     closes L/T corner notches left by one-sided thickness */
  for (const vk in vt) {
    const [vx, vy] = vk.split(',').map(Number), tm = vt[vk];
    rects.push({ x0: vx * C() - tm, x1: vx * C() + tm, z0: vy * C() - tm, z1: vy * C() + tm });
  }

  /* windows — glass span clipped against door apertures, then their own
     sill..top aperture is emitted; sill + header emerge from subtraction */
  const gap = Math.min(0.82 * C(), C() - 6), jw = (C() - gap) / 2;
  for (const w of wins) {
    let a0 = (w.s.d === 'h' ? w.x0 : w.y0) + jw;
    let a1 = (w.s.d === 'h' ? w.x0 : w.y0) + C() - jw;
    const bz0 = (w.s.d === 'h' ? w.y0 : w.x0) + w.w0 - 1;
    const bz1 = (w.s.d === 'h' ? w.y0 : w.x0) + w.w1 + 1;
    for (const a of aps) {
      const inBand = w.s.d === 'h' ? (a.z0 < bz1 && a.z1 > bz0) : (a.x0 < bz1 && a.x1 > bz0);
      if (!inBand) continue;
      const lo = w.s.d === 'h' ? a.x0 : a.z0, hi = w.s.d === 'h' ? a.x1 : a.z1;
      if (hi <= a0 || lo >= a1) continue;
      if (lo <= a0) a0 = hi;
      else if (hi >= a1) a1 = lo;
      else if (lo - a0 >= a1 - hi) a1 = lo; else a0 = hi;     // keep bigger side
    }
    if (a1 - a0 < 8) continue;                                // fully eaten — solid
    aps.push(w.s.d === 'h'
      ? { x0: a0, x1: a1, z0: bz0, z1: bz1, y0: WIN_SILL, y1: WIN_TOP }
      : { x0: bz0, x1: bz1, z0: a0, z1: a1, y0: WIN_SILL, y1: WIN_TOP });
    const gc = (w.s.d === 'h' ? w.y0 : w.x0) + w.wc;          // glass at wall centre
    const gl = new THREE.Mesh(
      new THREE.PlaneGeometry(a1 - a0, WIN_TOP - WIN_SILL),
      new THREE.MeshStandardMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
    if (w.s.d === 'h') gl.position.set((a0 + a1) / 2, (WIN_SILL + WIN_TOP) / 2, gc);
    else { gl.rotation.y = Math.PI / 2; gl.position.set(gc, (WIN_SILL + WIN_TOP) / 2, (a0 + a1) / 2); }
    group.add(gl);
  }

  /* subtract apertures: split each wall rect at aperture edges, drop the
     covered height bands */
  for (const r of rects) {
    const hits = [];
    for (const a of aps) if (a.x0 < r.x1 && a.x1 > r.x0 && a.z0 < r.z1 && a.z1 > r.z0) hits.push(a);
    if (!hits.length) { batch.box(r.x0, 0, r.z0, r.x1, WALL_H, r.z1); continue; }
    const xs = [r.x0, r.x1], zs = [r.z0, r.z1];
    for (const a of hits) {
      if (a.x0 > r.x0 && a.x0 < r.x1) xs.push(a.x0);
      if (a.x1 > r.x0 && a.x1 < r.x1) xs.push(a.x1);
      if (a.z0 > r.z0 && a.z0 < r.z1) zs.push(a.z0);
      if (a.z1 > r.z0 && a.z1 < r.z1) zs.push(a.z1);
    }
    xs.sort((p, q) => p - q); zs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) {
      const cx0 = xs[i], cx1 = xs[i + 1], cz0 = zs[j], cz1 = zs[j + 1];
      let bands = [[0, WALL_H]];
      for (const a of hits)
        if (a.x0 <= cx0 + 0.01 && a.x1 >= cx1 - 0.01 && a.z0 <= cz0 + 0.01 && a.z1 >= cz1 - 0.01) {
          const nb = [];
          for (const bnd of bands) {
            if (a.y1 <= bnd[0] + 0.01 || a.y0 >= bnd[1] - 0.01) { nb.push(bnd); continue; }
            if (bnd[0] < a.y0 - 0.01) nb.push([bnd[0], a.y0]);
            if (bnd[1] > a.y1 + 0.01) nb.push([a.y1, bnd[1]]);
          }
          bands = nb;
        }
      for (const bnd of bands) if (bnd[1] - bnd[0] > 0.01)
        batch.box(cx0, bnd[0], cz0, cx1, bnd[1], cz1);
    }
  }
  const wm = batch.mesh(wallMat);
  group.add(wm);
  solidMeshes.push(wm);
  if (hasTrim) {
    const tm = trim.mesh(std('#cbb691', 0.7));        // door casings, warmer wood tone
    group.add(tm);
  }
}

function buildFences(group) {
  const ks = Object.keys(HP.cur().fences);
  if (!ks.length) return;
  const batch = new GeoBatch();
  const mat = std('#8a6844', 0.9);
  for (const k of ks) {
    const s = HP.parseWallKey(k), t = 5;
    const x0 = s.x * C(), y0 = s.y * C();
    if (s.d === 'h') batch.box(x0, 0, y0 - t / 2, x0 + C(), 42, y0 + t / 2);
    else batch.box(x0 - t / 2, 0, y0, x0 + t / 2, 42, y0 + C());
  }
  const fm = batch.mesh(mat);
  group.add(fm);
  solidMeshes.push(fm);
}

/* ---------------- lamps / avatars ---------------- */
function addLampLight(it, f) {
  const l = new THREE.PointLight(0xffd9a0, 0, 320, 1.6);
  l.position.set((f.x + f.w / 2) * C(), 66, (f.y + f.h / 2) * C());
  levelGroup.add(l);
  lampLights.push({ light: l, it, x: l.position.x, y: l.position.z });
}

function avatarMesh(name, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 34, 12), std(color || '#4fc3f7', 0.8));
  body.position.y = 20; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), std('#f0d0b0', 0.7));
  head.position.y = 44; head.castShadow = true; g.add(head);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const cg = cv.getContext('2d');
  cg.fillStyle = 'rgba(20,23,28,.75)'; cg.fillRect(0, 0, 128, 32);
  cg.fillStyle = '#fff'; cg.font = 'bold 17px sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
  cg.fillText(name || '?', 64, 16);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  sp.scale.set(64, 16, 1); sp.position.y = 62;
  g.add(sp);
  return g;
}
function updateAvatars() {
  const seen = {};
  for (const a of (HP.peerAvatarList ? HP.peerAvatarList() : [])) {
    if (a.lvl !== HP.state.level) continue;
    seen[a.name] = 1;
    if (!avatarMap[a.name]) { avatarMap[a.name] = avatarMesh(a.name, a.color); levelGroup.add(avatarMap[a.name]); }
    const m = avatarMap[a.name];
    m.position.set(a.x, 0, a.y);
    m.rotation.y = -(a.a || 0) + Math.PI / 2;
    m.children[0].scale.y = a.s ? 0.6 : 1;          // sitting squashes body
    m.children[1].position.y = a.s ? 34 : 44;
  }
  for (const n in avatarMap) if (!seen[n]) { levelGroup.remove(avatarMap[n]); delete avatarMap[n]; }
}

/* ---------------- build / dispose ---------------- */
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      for (const m of [].concat(o.material)) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

HP.buildScene = function () {
  if (!renderer || !HP.state) return;
  if (levelGroup) { scene.remove(levelGroup); disposeGroup(levelGroup); }
  doorLeaves = []; lampLights = []; itemMeshes = new Map(); avatarMap = {};
  hitTargets = []; solidMeshes = [];
  levelGroup = new THREE.Group();
  levelGroup.add(groundPlane());
  levelGroup.add(floorMesh());
  buildWalls(levelGroup);
  buildFences(levelGroup);
  for (const it of HP.cur().furniture) {
    const m = HP.model3D(it);
    if (!m) continue;
    const f = HP.footprint(it);
    m.position.set((f.x + f.w / 2) * C(), 0, (f.y + f.h / 2) * C());
    m.rotation.y = -it.rot * Math.PI / 2;
    m.userData.item = it;
    m.updateMatrix(); m.matrixAutoUpdate = false;     // static until edited
    levelGroup.add(m);
    itemMeshes.set(it, m);
    if (HP.isLamp && HP.isLamp(it.type)) addLampLight(it, f);
    const seat = HP.seatKind && HP.seatKind(it.type), lamp = HP.isLamp && HP.isLamp(it.type);
    if (seat || lamp) {
      const bb = new THREE.Box3().setFromObject(m);
      const hb = new THREE.Mesh(new THREE.BoxGeometry(
        Math.max(10, bb.max.x - bb.min.x), Math.max(10, bb.max.y - bb.min.y), Math.max(10, bb.max.z - bb.min.z)));
      hb.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
      hb.visible = false;
      levelGroup.add(hb);
      hitTargets.push({ mesh: hb, use: { kind: seat ? 'sit' : 'lamp', it } });
    }
  }
  scene.add(levelGroup);
  builtLevel = HP.state.level;
  lastBuild = performance.now();
  renderer.shadowMap.needsUpdate = true;               // rebake static shadows
  // sun target follows the lot centre so shadows stay tight
  if (sun) sun.target.position.set(HP.GRID_W * C() / 2, 0, HP.GRID_H * C() / 2);
};

/* ---------------- per-frame ---------------- */
HP.render3D = function (dt) {
  if (!renderer) return;
  if (builtLevel !== HP.state.level) HP.buildScene();
  if (HP.scene3Dirty && performance.now() - lastBuild > 450) {
    HP.scene3Dirty = false; HP.buildScene();
  }
  const p = HP.player;
  if (p) {
    camera.position.set(p.x, (HP.playerSitting ? EYE_SIT : EYE), p.y);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = HP.yaw3 || 0;
    camera.rotation.x = HP.pitch3 || 0;
    camera.rotation.z = 0;
  }
  for (const d of doorLeaves) {
    const s = HP.cur().walls[d.key];
    const target = (s && !s.c) ? d.open : 0;
    const diff = target - d.grp.rotation.y;
    if (Math.abs(diff) > 0.002) {
      d.grp.rotation.y += diff * Math.min(1, dt * 9);
      renderer.shadowMap.needsUpdate = true;           // moving leaf → moving shadow
    }
  }
  lampLights.forEach(l => { l.light.visible = false; });
  if (p) {
    lampLights.filter(l => l.it.on)
      .sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2))
      .slice(0, MAX_LAMP_LIGHTS).forEach(l => { l.light.visible = true; });
  }
  aimClock += dt;
  if (aimClock > 0.08) { aimClock = 0; updateAim(); }
  updateAvatars();
  renderer.render(scene, camera);
};

/* ---------------- crosshair aim ---------------- */
const _aimDir = new THREE.Vector3();
function updateAim() {
  HP.aimUse = null;
  if (!camera) return;
  camera.getWorldDirection(_aimDir);
  ray3.set(camera.position, _aimDir);
  const objs = solidMeshes.concat(hitTargets.map(t => t.mesh));
  const hits = ray3.intersectObjects(objs, false);
  if (!hits.length) return;
  const h = hits[0];
  const t = hitTargets.find(tt => tt.mesh === h.object);
  if (!t) return;                                       // wall/fence blocks
  const u = t.use;
  if (u.kind === 'door') {
    const s = HP.cur().walls[u.key];
    u.label = (s && s.c ? 'Open' : 'Close') + ' door';
  } else if (u.kind === 'lamp') {
    u.label = (u.it.on ? 'Turn off ' : 'Turn on ') + HP.itemDef(u.it.type).name;
  } else if (u.kind === 'sit') {
    u.label = (HP.seatKind(u.it.type) === 'lie' ? 'Lie on ' : 'Sit on ') + HP.itemDef(u.it.type).name;
  }
  HP.aimUse = u;
}
})();
