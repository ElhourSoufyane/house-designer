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
  /* surface-model walls — geometry computed by wallgeom.js (shared with the
     audit + tests); here we only render boxes + door/window visuals */
  const walls = HP.cur().walls, batch = new GeoBatch(), trim = new GeoBatch();
  const wallMat = std('#f2efe8', 0.95);
  const { regionOf } = HP.computeRegions();
  const geo = HP3D.wallGeom(walls, { C: C(), GRID_W: HP.GRID_W, GRID_H: HP.GRID_H, cellIn: HP.cellIn, regionOf });
  for (const b of geo.boxes) batch.box(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
  const wm = batch.mesh(wallMat);
  group.add(wm);
  solidMeshes.push(wm);
  HP._geo3d = geo;                                   // audit/debug access

  let hasTrim = false;
  for (const d of geo.doors) {
    const s = HP.parseWallKey(d.key);
    const ox0 = d.lo, ox1 = d.hi, gw = ox1 - ox0;
    const wc = (d.w0 + d.w1) / 2;
    const ec = d.d === 'h' ? d.cy + wc : d.cx + wc;    // wall zone centre
    /* casing frame — flat boxes just off each wall face */
    const fw = 5;
    for (const sgn of [-1, 1]) {
      const fa = sgn < 0 ? d.w0 - 1.2 : d.w1, fb = sgn < 0 ? d.w0 : d.w1 + 1.2;
      if (d.d === 'h') {
        trim.box(ox0 - fw, 0, d.cy + fa, ox0, DOOR_H, d.cy + fb);
        trim.box(ox1, 0, d.cy + fa, ox1 + fw, DOOR_H, d.cy + fb);
        trim.box(ox0 - fw, DOOR_H, d.cy + fa, ox1 + fw, DOOR_H + 4, d.cy + fb);
      } else {
        trim.box(d.cx + fa, 0, ox0 - fw, d.cx + fb, DOOR_H, ox0);
        trim.box(d.cx + fa, 0, ox1, d.cx + fb, DOOR_H, ox1 + fw);
        trim.box(d.cx + fa, DOOR_H, ox0 - fw, d.cx + fb, DOOR_H + 4, ox1 + fw);
      }
    }
    hasTrim = true;
    /* leaf — solid slab filling the opening, raised panels, knobs */
    const dir = insideSign(s);
    const lw = gw / (d.dbl ? 2 : 1) - 1;
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
      doorLeaves.push({ grp: lg, key: d.key, open: (alongX ? -dir : dir) * extend * 1.62 });
    };
    if (d.d === 'h') {
      mk(ox0, ec, true, 1);
      if (d.dbl) mk(ox1, ec, true, -1);
    } else {
      mk(ec, ox0, false, 1);
      if (d.dbl) mk(ec, ox1, false, -1);
    }
    const hb = new THREE.Mesh(new THREE.BoxGeometry(
      d.d === 'h' ? gw + 10 : d.t + 14, DOOR_H, d.d === 'h' ? d.t + 14 : gw + 10));
    hb.position.set(d.d === 'h' ? (ox0 + ox1) / 2 : ec, DOOR_H / 2,
      d.d === 'h' ? ec : (ox0 + ox1) / 2);
    hb.visible = false;
    group.add(hb);
    hitTargets.push({ mesh: hb, use: { kind: 'door', key: d.key } });
  }
  for (const w of geo.wins) {
    if (w.eaten) continue;
    const gc = (w.s.d === 'h' ? w.s.y : w.s.x) * C() + (w.w0 + w.w1) / 2;
    const gl = new THREE.Mesh(
      new THREE.PlaneGeometry(w.a1 - w.a0, WIN_TOP - WIN_SILL),
      new THREE.MeshStandardMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
    if (w.s.d === 'h') gl.position.set((w.a0 + w.a1) / 2, (WIN_SILL + WIN_TOP) / 2, gc);
    else { gl.rotation.y = Math.PI / 2; gl.position.set(gc, (WIN_SILL + WIN_TOP) / 2, (w.a0 + w.a1) / 2); }
    group.add(gl);
  }
  if (hasTrim) {
    const tm = trim.mesh(std('#cbb691', 0.7));
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
  HP._lg3d = levelGroup;                               // audit markers attach here
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
