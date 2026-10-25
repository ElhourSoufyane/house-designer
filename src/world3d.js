/* world3d.js — builds a Three.js scene from the live house state for Play 3D.
   Units = world px (1 cell = 28 px = 0.5 m). Grid x→x, grid y→z, y=up. */
(function () {
if (typeof THREE === 'undefined') return;

const WALL_H = 140;                       // ~2.5 m — chunky enough to read as walls
const DOOR_H = 104, WIN_SILL = 54, WIN_TOP = 112;
const EYE = 78, EYE_SIT = 48;
const MAX_LAMP_LIGHTS = 6;

let renderer = null, scene = null, camera = null, sun = null;
let levelGroup = null, builtLevel = -1, lastBuild = 0;
let doorLeaves = [];                      // {grp,key,open}
let lampLights = [];                      // {light,it,x,y}
let avatarMap = {};                       // name -> Group
let itemMeshes = new Map();               // it -> Object3D

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
  const walls = HP.cur().walls, batch = new GeoBatch(), t0 = C();
  const wallMat = std('#f2efe8', 0.95);
  const isDoor = (d, x, y) => { const w = walls[d + ',' + x + ',' + y]; return w && w.f === 'door'; };
  for (const k in walls) {
    const s = HP.parseWallKey(k), feat = walls[k].f, t = segThick(s), ht = t / 2;
    const x0 = s.x * C(), y0 = s.y * C(), x1 = x0 + (s.d === 'h' ? C() : 0), y1 = y0 + (s.d === 'v' ? C() : 0);
    if (!feat) {                                            // solid segment
      if (s.d === 'h') batch.box(x0, 0, y0 - ht, x1, WALL_H, y0 + ht);
      else batch.box(x0 - ht, 0, y0, x0 + ht, WALL_H, y1);
      continue;
    }
    const gap = Math.min(0.82 * C(), C() - 6);              // opening width
    const jw = (C() - gap) / 2;                             // jamb width
    if (feat === 'door') {
      // pair check like drawDoors: even offset leads a double door
      let off = 0;
      if (s.d === 'h') { for (let x = s.x - 1; isDoor('h', x, s.y); x--) off++; }
      else { for (let y = s.y - 1; isDoor('v', s.x, y); y--) off++; }
      if (off % 2 === 1) continue;                          // handled by pair leader
      const dbl = s.d === 'h' ? isDoor('h', s.x + 1, s.y) : isDoor('v', s.x, s.y + 1);
      const n = dbl ? 2 : 1, wAll = n * C(), gAll = Math.min(dbl ? 1.7 * C() : gap, wAll - 6);
      const jAll = (wAll - gAll) / 2;
      if (s.d === 'h') {
        batch.box(x0, 0, y0 - ht, x0 + jAll, WALL_H, y0 + ht);                     // left jamb
        batch.box(x0 + wAll - jAll, 0, y0 - ht, x0 + wAll, WALL_H, y0 + ht);       // right jamb
        batch.box(x0 + jAll, DOOR_H, y0 - ht, x0 + wAll - jAll, WALL_H, y0 + ht);  // lintel
      } else {
        batch.box(x0 - ht, 0, y0, x0 + ht, WALL_H, y0 + jAll);
        batch.box(x0 - ht, 0, y0 + wAll - jAll, x0 + ht, WALL_H, y0 + wAll);
        batch.box(x0 - ht, DOOR_H, y0 + jAll, x0 + ht, WALL_H, y0 + wAll - jAll);
      }
      const dir = insideSign(s);                            // leaf per side on doubles
      const leafMat = std('#a08a6a', 0.7);
      const mk = (hx, hz, alongX, extend) => {
        const lg = new THREE.Group();
        lg.position.set(hx, 0, hz);
        const lw = gAll / (dbl ? 2 : 1);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(alongX ? lw : 3, DOOR_H, alongX ? 3 : lw), leafMat);
        leaf.castShadow = true;
        leaf.position.set(alongX ? extend * lw / 2 : 0, DOOR_H / 2, alongX ? 0 : extend * lw / 2);
        lg.add(leaf);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), std('#3a3f47', 0.4, 0.8));
        knob.position.set(alongX ? extend * (lw - 8) : 4, DOOR_H / 2, alongX ? 4 : extend * (lw - 8));
        lg.add(knob);
        group.add(lg);
        // 'h': rot.y=-dir*extend swings tip into room; 'v': +dir*extend (mirrored axis)
        doorLeaves.push({ grp: lg, key: k, open: (alongX ? -dir : dir) * extend * 1.85 });
      };
      if (s.d === 'h') {
        mk(x0 + jAll, y0, true, 1);
        if (dbl) mk(x0 + wAll - jAll, y0, true, -1);
      } else {
        mk(x0, y0 + jAll, false, 1);
        if (dbl) mk(x0, y0 + wAll - jAll, false, -1);
      }
    } else if (feat === 'window') {
      if (s.d === 'h') {
        batch.box(x0, 0, y0 - ht, x0 + jw, WALL_H, y0 + ht);
        batch.box(x0 + C() - jw, 0, y0 - ht, x1, WALL_H, y0 + ht);
        batch.box(x0 + jw, 0, y0 - ht, x1 - jw, WIN_SILL, y0 + ht);           // sill
        batch.box(x0 + jw, WIN_TOP, y0 - ht, x1 - jw, WALL_H, y0 + ht);       // header
      } else {
        batch.box(x0 - ht, 0, y0, x0 + ht, WALL_H, y0 + jw);
        batch.box(x0 - ht, 0, y0 + C() - jw, x0 + ht, WALL_H, y1);
        batch.box(x0 - ht, 0, y0 + jw, x0 + ht, WIN_SILL, y0 + C() - jw);
        batch.box(x0 - ht, WIN_TOP, y0 + jw, x0 + ht, WALL_H, y0 + C() - jw);
      }
      const gl = new THREE.Mesh(
        new THREE.PlaneGeometry(gap, WIN_TOP - WIN_SILL),
        new THREE.MeshStandardMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
      if (s.d === 'h') gl.position.set(x0 + C() / 2, (WIN_SILL + WIN_TOP) / 2, y0);
      else { gl.rotation.y = Math.PI / 2; gl.position.set(x0, (WIN_SILL + WIN_TOP) / 2, y0 + C() / 2); }
      group.add(gl);
    }
  }
  group.add(batch.mesh(wallMat));
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
  group.add(batch.mesh(mat));
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
  updateAvatars();
  renderer.render(scene, camera);
};
})();
