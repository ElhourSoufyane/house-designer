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
  const { regionOf } = HP.computeRegions();
  const out = (x, y) => !HP.cellIn(x, y) || regionOf[y * HP.GRID_W + x] < 0;
  if (s.d === 'h') return (out(s.x, s.y - 1) || out(s.x, s.y)) ? 0.55 * C() : 0.42 * C();
  return (out(s.x - 1, s.y) || out(s.x, s.y)) ? 0.55 * C() : 0.42 * C();
}
function insideSign(s) {                    // which way the door swings (toward room)
  const { regionOf } = HP.computeRegions();
  const inr = (x, y) => HP.cellIn(x, y) && regionOf[y * HP.GRID_W + x] >= 0;
  if (s.d === 'h') return inr(s.x, s.y) ? 1 : -1;
  return inr(s.x, s.y) ? 1 : -1;
}

function buildWalls(group) {
  const walls = HP.cur().walls, batch = new GeoBatch(), trim = new GeoBatch();
  const wallMat = std('#f2efe8', 0.95);
  let hasTrim = false;
  const isDoor = (d, x, y) => { const w = walls[d + ',' + x + ',' + y]; return w && w.f === 'door'; };
  /* emit a wall-material box for segment s spanning along-axis a0..a1 and
     vertically yLo..yHi. If a perpendicular DOOR meets either end vertex,
     that end's stub is clipped on the door side so the junction wall never
     pokes into the doorway — wall loses, door wins. */
  const STUB = 16;
  const segBox = (s, a0, a1, yLo, yHi) => {
    const ht = segThick(s) / 2;
    let cL = 0, cH = 0, loT0 = true, loT1 = true, hiT0 = true, hiT1 = true;
    if (s.d === 'v') {
      if (isDoor('h', s.x - 1, s.y)) { cL = STUB; loT0 = false; }
      if (isDoor('h', s.x, s.y)) { cL = STUB; loT1 = false; }
      if (isDoor('h', s.x - 1, s.y + 1)) { cH = STUB; hiT0 = false; }
      if (isDoor('h', s.x, s.y + 1)) { cH = STUB; hiT1 = false; }
      const ex = s.x * C(), m0 = a0 + cL, m1 = a1 - cH;
      if (m1 > m0) batch.box(ex - ht, yLo, m0, ex + ht, yHi, m1);
      if (cL && (loT0 || loT1)) batch.box(loT0 ? ex - ht : ex, yLo, a0, loT1 ? ex + ht : ex, yHi, a0 + cL);
      if (cH && (hiT0 || hiT1)) batch.box(hiT0 ? ex - ht : ex, yLo, a1 - cH, hiT1 ? ex + ht : ex, yHi, a1);
    } else {
      if (isDoor('v', s.x, s.y - 1)) { cL = STUB; loT0 = false; }
      if (isDoor('v', s.x, s.y)) { cL = STUB; loT1 = false; }
      if (isDoor('v', s.x + 1, s.y - 1)) { cH = STUB; hiT0 = false; }
      if (isDoor('v', s.x + 1, s.y)) { cH = STUB; hiT1 = false; }
      const ey = s.y * C(), m0 = a0 + cL, m1 = a1 - cH;
      if (m1 > m0) batch.box(m0, yLo, ey - ht, m1, yHi, ey + ht);
      if (cL && (loT0 || loT1)) batch.box(a0, yLo, loT0 ? ey - ht : ey, a0 + cL, yHi, loT1 ? ey + ht : ey);
      if (cH && (hiT0 || hiT1)) batch.box(a1 - cH, yLo, hiT0 ? ey - ht : ey, a1, yHi, hiT1 ? ey + ht : ey);
    }
  };
  for (const k in walls) {
    const s = HP.parseWallKey(k), feat = walls[k].f, t = segThick(s), ht = t / 2;
    const x0 = s.x * C(), y0 = s.y * C(), x1 = x0 + (s.d === 'h' ? C() : 0), y1 = y0 + (s.d === 'v' ? C() : 0);
    /* how much of a neighbouring segment a door opening may take.
       every non-door neighbour grants ~0.45 cell (windows shrink too)
       so ALL singles come out the same width; pinched segments grant
       less so a post survives. doors and open edges grant nothing. */
    const eat = (d, x, y) => {
      const w = walls[d + ',' + x + ',' + y];
      if (!w || w.f === 'door') return 0;
      const doors = (isDoor(d, x - (d === 'h'), y - (d === 'v')) ? 1 : 0)
                  + (isDoor(d, x + (d === 'h'), y + (d === 'v')) ? 1 : 0);
      return (doors > 1 ? 0.28 : 0.45) * C();
    };
    if (!feat) {                                            // solid segment
      if (s.d === 'h') {
        let ax0 = x0, ax1 = x1;
        if (isDoor('h', s.x - 1, s.y)) ax0 += eat('h', s.x, s.y);
        if (isDoor('h', s.x + 1, s.y)) ax1 -= eat('h', s.x, s.y);
        if (ax1 > ax0) segBox(s, ax0, ax1, 0, WALL_H);
      } else {
        let ay0 = y0, ay1 = y1;
        if (isDoor('v', s.x, s.y - 1)) ay0 += eat('v', s.x, s.y);
        if (isDoor('v', s.x, s.y + 1)) ay1 -= eat('v', s.x, s.y);
        if (ay1 > ay0) segBox(s, ay0, ay1, 0, WALL_H);
      }
      continue;
    }
    const gap = Math.min(0.82 * C(), C() - 6);              // opening width (windows)
    const jw = (C() - gap) / 2;                             // jamb width
    if (feat === 'door') {
      // pair check like drawDoors: even offset leads a double door
      let off = 0;
      if (s.d === 'h') { for (let x = s.x - 1; isDoor('h', x, s.y); x--) off++; }
      else { for (let y = s.y - 1; isDoor('v', s.x, y); y--) off++; }
      if (off % 2 === 1) continue;                          // handled by pair leader
      const dbl = s.d === 'h' ? isDoor('h', s.x + 1, s.y) : isDoor('v', s.x, s.y + 1);
      const n = dbl ? 2 : 1, span = n * C();
      const p0 = s.d === 'h' ? x0 : y0, pEnd = p0 + span;
      // uniform opening: ~0.9 m single, ~1.6 m double — every non-door
      // neighbour grants ~0.45 cell, BUT the opening may never cross a
      // vertex where a perpendicular wall stands: its stub sits inside
      // the extended part. junction vertex = hard stop (corner post).
      const perpAt = (vx, vy) => s.d === 'h'
        ? !!(walls['v,' + vx + ',' + vy] || walls['v,' + vx + ',' + (vy - 1)])
        : !!(walls['h,' + vx + ',' + vy] || walls['h,' + (vx - 1) + ',' + vy]);
      const extL = perpAt(s.x, s.y) ? 0
        : eat(s.d, s.d === 'h' ? s.x - 1 : s.x, s.d === 'h' ? s.y : s.y - 1);
      const extR = perpAt(s.d === 'h' ? s.x + n : s.x, s.d === 'h' ? s.y : s.y + n) ? 0
        : eat(s.d, s.d === 'h' ? s.x + n : s.x, s.d === 'h' ? s.y : s.y + n);
      const ox0 = p0 - extL + 2, ox1 = pEnd + extR - 2;
      const gw = ox1 - ox0;
      /* structural opening: jambs + header in wall material */
      if (s.d === 'h') {
        batch.box(p0 - extL, 0, y0 - ht, ox0, WALL_H, y0 + ht);                // left jamb
        batch.box(ox1, 0, y0 - ht, p0 + span + extR, WALL_H, y0 + ht);         // right jamb
        batch.box(ox0, DOOR_H, y0 - ht, ox1, WALL_H, y0 + ht);                 // lintel
      } else {
        batch.box(x0 - ht, 0, p0 - extL, x0 + ht, WALL_H, ox0);
        batch.box(x0 - ht, 0, ox1, x0 + ht, WALL_H, p0 + span + extR);
        batch.box(x0 - ht, DOOR_H, ox0, x0 + ht, WALL_H, ox1);
      }
      /* casing frame — flat boxes, 1.5 px proud of each face, nothing
         overlaps so no z-fighting: posts below header, header between */
      const fw = 5, fo = ht + 1.5;
      for (const sgn of [-1, 1]) {
        const f0 = sgn < 0 ? -fo - 1.2 : fo, f1 = sgn < 0 ? -fo : fo + 1.2;
        if (s.d === 'h') {
          trim.box(ox0 - fw, 0, y0 + f0, ox0, DOOR_H, y0 + f1);
          trim.box(ox1, 0, y0 + f0, ox1 + fw, DOOR_H, y0 + f1);
          trim.box(ox0 - fw, DOOR_H, y0 + f0, ox1 + fw, DOOR_H + 4, y0 + f1);
        } else {
          trim.box(x0 + f0, 0, ox0 - fw, x0 + f1, DOOR_H, ox0);
          trim.box(x0 + f0, 0, ox1, x0 + f1, DOOR_H, ox1 + fw);
          trim.box(x0 + f0, DOOR_H, ox0 - fw, x0 + f1, DOOR_H + 4, ox1 + fw);
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
        mk(ox0, y0, true, 1);
        if (dbl) mk(ox1, y0, true, -1);
      } else {
        mk(x0, ox0, false, 1);
        if (dbl) mk(x0, ox1, false, -1);
      }
      // aim hitbox over the whole doorway (leader covers the pair)
      const hb = new THREE.Mesh(new THREE.BoxGeometry(
        s.d === 'h' ? gw + 10 : t + 14, DOOR_H, s.d === 'h' ? t + 14 : gw + 10));
      hb.position.set(s.d === 'h' ? (ox0 + ox1) / 2 : x0, DOOR_H / 2,
        s.d === 'h' ? y0 : (ox0 + ox1) / 2);
      hb.visible = false;
      group.add(hb);
      hitTargets.push({ mesh: hb, use: { kind: 'door', key: k } });
    } else if (feat === 'window') {
      if (s.d === 'h') {
        let ax0 = x0, ax1 = x1;
        if (isDoor('h', s.x - 1, s.y)) ax0 += eat('h', s.x, s.y);
        if (isDoor('h', s.x + 1, s.y)) ax1 -= eat('h', s.x, s.y);
        segBox(s, ax0, ax0 + jw, 0, WALL_H);
        segBox(s, ax1 - jw, ax1, 0, WALL_H);
        segBox(s, ax0 + jw, ax1 - jw, 0, WIN_SILL);                          // sill
        segBox(s, ax0 + jw, ax1 - jw, WIN_TOP, WALL_H);                      // header
      } else {
        let ay0 = y0, ay1 = y1;
        if (isDoor('v', s.x, s.y - 1)) ay0 += eat('v', s.x, s.y);
        if (isDoor('v', s.x, s.y + 1)) ay1 -= eat('v', s.x, s.y);
        segBox(s, ay0, ay0 + jw, 0, WALL_H);
        segBox(s, ay1 - jw, ay1, 0, WALL_H);
        segBox(s, ay0 + jw, ay1 - jw, 0, WIN_SILL);
        segBox(s, ay0 + jw, ay1 - jw, WIN_TOP, WALL_H);
      }
      const gl = new THREE.Mesh(
        new THREE.PlaneGeometry(gap, WIN_TOP - WIN_SILL),
        new THREE.MeshStandardMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
      if (s.d === 'h') gl.position.set(x0 + C() / 2, (WIN_SILL + WIN_TOP) / 2, y0);
      else { gl.rotation.y = Math.PI / 2; gl.position.set(x0, (WIN_SILL + WIN_TOP) / 2, y0 + C() / 2); }
      group.add(gl);
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
