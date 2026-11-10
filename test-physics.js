// Headless physics test — real THREE + real house, manually driven tick.
// Run: node test-physics.js
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;

/* ---------- DOM stubs ---------- */
const docListeners = {};
const mkEl = () => ({ style: {}, textContent: '', listeners: {},
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  requestPointerLock() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 44, height: 44 }),
  querySelector: () => ({ textContent: '' }) });
const els = {};
globalThis.document = {
  getElementById: id => els[id] || (els[id] = mkEl()),
  addEventListener: (t, f) => (docListeners[t] = docListeners[t] || []).push(f),
  pointerLockElement: null, exitPointerLock() {},
  createElement: () => mkEl(),
};
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v, removeItem: k => delete store[k] };
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; };

/* ---------- real THREE ---------- */
const threeSrc = fs.readFileSync(path.join(__dirname, 'lib/three.min.js'), 'utf8');
const fakeModule = { exports: {} };
globalThis.THREE = new Function('module', 'exports', 'window', 'self',
  threeSrc + ';return module.exports && module.exports.REVISION ? module.exports : (typeof THREE!=="undefined"?THREE:null);'
)(fakeModule, fakeModule.exports, globalThis, globalThis);
if (!globalThis.THREE || !THREE.BoxGeometry) throw new Error('THREE did not load');
THREE.WebGLRenderer = function () {
  return { setPixelRatio() {}, getPixelRatio: () => 1, setSize() {}, render() {},
           domElement: els.gl, capabilities: {}, toneMapping: 0, toneMappingExposure: 1 };
};

/* ---------- game code ---------- */
for (const f of ['grid.js', 'catalog.js', 'rooms.js', 'geom3d.js', 'graphics3d.js', 'cull3d.js', 'sky3d.js', 'furniture3d.js', 'life3d.js', 'sound3d.js', 'world3d.js', 'walk3d.js'])
  eval(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));

/* ---------- real house ---------- */
const house = require('C:/Users/bo1y/Desktop/myhouse/my-house.house.json');
HP.state = house.state; HP.state.level = house.state.level || 0;

const W3 = HP.world3d;
W3.init(document.getElementById('gl'));
W3.buildLevel();
HP.walk3d.boot();

/* ---------- frame driver ---------- */
let T = 0;
const step = (ms = 16) => { T += ms; const cb = rafCb; rafCb = null; if (cb) cb(T); };
const run = (secs, ms = 16) => { for (let i = 0; i < secs * 1000 / ms; i++) step(ms); };
const key = (code, down = true) =>
  (docListeners[down ? 'keydown' : 'keyup'] || []).forEach(f => f({ code }));
const tap = code => { key(code, true); step(); key(code, false); };
const place = (x, z, yaw) => HP.walk3d.enter({ x, y: z, yaw });
const pos = () => ({ x: W3.camera.position.x, z: W3.camera.position.z });
const deg = r => Math.round(r * 180 / Math.PI);

let pass = 0, fail = 0;
const t = (name, cond, info = '') =>
  cond ? pass++ : (fail++, console.log('FAIL:', name, info));

/* ---------- build sanity ---------- */
t('colliders built', W3.colliders.length > 100, W3.colliders.length);
t('door leaves exist', W3.doorPivots.filter(d => !d.gate && !d.window).length > 5);
t('movers registered', W3.movers.length > 0, W3.movers.length);
t('windows are pivots', W3.doorPivots.filter(d => d.window).length > 3,
  W3.doorPivots.filter(d => d.window).length);
console.log('  pivots:', W3.doorPivots.length,
  '(doors', W3.doorPivots.filter(d => !d.gate && !d.window).length +
  ', windows', W3.doorPivots.filter(d => d.window).length +
  ', gates', W3.doorPivots.filter(d => d.gate).length + ')',
  '| movers:', W3.movers.length);

/* ---------- 1. swing limits ---------- */
place(500, 500, 0); run(0.1);
const doors = W3.doorPivots.filter(d => !d.gate && !d.window);
const lims = doors.map(d => deg(d.maxAng));
const capped = lims.filter(l => l < 166).length;
console.log('  door swing limits (deg):', lims.join(','));
t('every door can still open', lims.every(l => l >= 8));
t('some doors obstructed by furniture/walls', capped > 0, `${capped}/${lims.length} capped`);

/* ---------- 2. door still pushes open & auto-closes ---------- */
{
  /* pick a door whose swing side is reachable flat ground          */
  let d = null, sx = 0, sz = 0;
  for (const o of doors) {
    const cx = (o.a.x0 + o.a.x1) / 2, cz = (o.a.z0 + o.a.z1) / 2;
    const f = o.flip || 1;                             // push from opposite the fold
    const cands = o.a.d === 'h'
      ? [[cx, f > 0 ? o.a.z1 + 14 : o.a.z0 - 14]]
      : [[f > 0 ? o.a.x1 + 14 : o.a.x0 - 14, cz]];
    for (const [tx, tz] of cands) {
      let blocked = false;
      for (const b of W3.colliders)
        if (b.y0 < 50 && tx > b.x0 - 8 && tx < b.x1 + 8 && tz > b.z0 - 8 && tz < b.z1 + 8) { blocked = true; break; }
      if (!blocked) { d = o; sx = tx; sz = tz; break; }
    }
    if (d) break;
  }
  if (!d) t('push opens door', false, 'no reachable swing side found');
  else {
    const dx = (d.a.x0 + d.a.x1) / 2 - sx, dz = (d.a.z0 + d.a.z1) / 2 - sz;
    place(sx, sz, Math.atan2(-dx, -dz));
    key('KeyW', true); run(1.5); key('KeyW', false);
    const opened = d.open, at = pos();
    console.log('  pushed door at', d.a.d + ',' + d.a.x0 / HP.CELL + ',' + d.a.z0 / HP.CELL,
      'player ended', Math.round(at.x), Math.round(at.z));
    run(5);
    t('push opens door', opened > 0.3, 'open=' + opened.toFixed(2));
    t('door auto-closes', d.open < 0.15, 'open=' + d.open.toFixed(2));
  }
}

/* ---------- 3. swing cap actually clamps the leaf ---------- */
{
  const d = doors.find(o => o.maxAng < 2.8);
  if (d) {
    d.latched = true; run(6);                          // force full open attempt
    t('leaf stops at obstruction', Math.abs(d.open * 2.9 - d.maxAng) < 0.02,
      `open=${deg(d.open * 2.9)}° max=${deg(d.maxAng)}°`);
    d.latched = false; run(6);
    t('freed door closes again', d.open < 0.15, 'open=' + d.open.toFixed(2));
  } else console.log('  (no capped door to clamp-test)');
}

/* ---------- 4. player shoves light furniture ---------- */
{
  /* find a mover with clear floor on its south side                */
  let m = null;
  for (const cand of W3.movers) {
    const sx = cand.x + cand.w / 2, sz = cand.z + cand.h + 9;
    let blocked = false;
    for (const b of W3.colliders)
      if (b !== cand.box && b.y0 < 50 && sx > b.x0 - 8 && sx < b.x1 + 8 && sz > b.z0 - 8 && sz < b.z1 + 8)
        { blocked = true; break; }
    if (!blocked) { m = cand; break; }
  }
  if (!m) t('walking pushes light furniture', false, 'no reachable mover');
  else {
    const mx = m.x + m.w / 2, mz = m.z + m.h / 2;
    // 4a. Default: pushing disabled -> walking into furniture must NOT move it
    HP.pushFurniture = false;
    place(mx, m.z + m.h + 9, 0);
    const initX = m.box.x0, initZ = m.box.z0;
    key('KeyW', true); run(0.8); key('KeyW', false); run(0.4);
    const lockedDist = Math.hypot(m.box.x0 - initX, m.box.z0 - initZ);
    t('default: walking does NOT move furniture', lockedDist < 0.01, 'moved ' + lockedDist.toFixed(2) + 'px');

    // 4b. When enabled: player shoves light furniture
    HP.pushFurniture = true;
    place(mx, m.z + m.h + 9, 0);                       // south of it, face -z (yaw 0)
    const bx = m.box.x0, bz = m.box.z0;
    key('KeyW', true); run(1.2); key('KeyW', false); run(1);
    const moved = Math.hypot(m.box.x0 - bx, m.box.z0 - bz);
    t('walking pushes light furniture', moved > 4, 'moved ' + moved.toFixed(1) + 'px');
    HP.pushFurniture = false;
  }
}

/* ---------- 5. mover stops at walls ---------- */
{
  /* slam a mover at max speed toward its nearest wall — it must stop.
     Items that START overlapping a wall (plan artifact) are skipped. */
  const overlaps = b => {
    let n = 0;
    for (const c of W3.colliders) {
      if (c === b || c.mv !== undefined || c.y0 >= (b._sy || 30) || c.y1 < 2) continue;
      if (b.x1 > c.x0 + 1 && b.x0 < c.x1 - 1 && b.z1 > c.z0 + 1 && b.z0 < c.z1 - 1) n++;
    }
    return n;
  };
  let m = null;
  for (const cand of W3.movers) { cand.box._sy = cand.sy; if (overlaps(cand.box) === 0) { m = cand; break; } }
  if (!m) t('mover never overlaps statics', false, 'all movers start overlapping?!');
  else {
    m.vx = 140; m.vz = 0; run(3);
    const n = overlaps(m.box);
    t('mover never overlaps statics', n === 0, n + ' overlaps | mover@' +
      Math.round(m.box.x0) + ',' + Math.round(m.box.z0));
  }
}

/* ---------- 6. door shoves a mover ---------- */
{
  /* relocate a mover into a door's swing path, then open the door   */
  const d = doors.find(o => deg(o.maxAng) > 100 && !o.a.dbl);
  const m = W3.movers[0];
  if (d) {
    const px0 = d.pivot.position.x, pz0 = d.pivot.position.z;
    /* drop the mover right in the leaf's mid-sweep path             */
    const dir = (d.a.d === 'h' ? 1 : -1) * (d.li === 1 ? -1 : 1);
    const th = d.maxAng * 0.5 * dir;                   // mid-sweep angle
    /* leaf local: u along door (16px out), v across (offset 0)      */
    const lu = 16, lv = 0;
    const wx = d.a.d === 'h' ? lu : lv, wz = d.a.d === 'h' ? lv : lu;
    m.x = px0 + wx * Math.cos(th) + wz * Math.sin(th) - m.w / 2;
    m.z = pz0 - wx * Math.sin(th) + wz * Math.cos(th) - m.h / 2;
    m.box.x0 = m.x; m.box.x1 = m.x + m.w; m.box.z0 = m.z; m.box.z1 = m.z + m.h;
    m.vx = m.vz = 0;
    const bx = m.x, bz = m.z;
    d.latched = true; run(4); d.latched = false; run(4);
    const moved = Math.hypot(m.x - bx, m.z - bz);
    t('swinging door shoves furniture', moved > 3,
      `moved ${moved.toFixed(1)}px (leaf at ${deg(d.pivot.rotation.y)}°)`);
  }
}

/* ---------- helper: stand facing a pivot with nothing nearer ----- */
function standAt(d, dist) {
  /* candidate spots on either side of the aperture centre            */
  const spots = d.a.d === 'h'
    ? [[d.a.cx, d.a.z0 - dist], [d.a.cx, d.a.z1 + dist]]
    : [[d.a.x0 - dist, d.a.cz], [d.a.x1 + dist, d.a.cz]];
  for (const [sx, sz] of spots) {
    let blocked = false;
    for (const b of W3.colliders)
      if (b.y0 < 50 && sx > b.x0 - 8 && sx < b.x1 + 8 && sz > b.z0 - 8 && sz < b.z1 + 8)
        { blocked = true; break; }
    if (blocked) continue;
    const dx = d.a.cx - sx, dz = d.a.cz - sz;
    place(sx, sz, Math.atan2(-dx, -dz));
    step();
    const near = W3.doorPivots.find(o => {
      const ddx = o.a.cx - sx, ddz = o.a.cz - sz;
      return Math.hypot(ddx, ddz) < Math.hypot(dx, dz) - 1;
    });
    if (!near) return true;
  }
  return false;
}

/* ---------- 7. windows open via E ---------- */
{
  const w = W3.doorPivots.find(d => d.window && standAt(d, 22));
  if (w) {
    tap('KeyE'); run(4);
    t('E opens window sash', w.open > 0.5, 'open=' + w.open.toFixed(2));
    t('prompt says window', /window/.test(els.prompt.textContent), els.prompt.textContent);
  } else t('E opens window sash', false, 'no reachable window');
}

/* Windows stay assembled throughout travel, not just at endpoints.
   Use mesh bounds to catch frames/handles clipping too, in both wall axes. */
function checkWindows(label) {
  const wins = W3.windows, moving = wins.flatMap(w => w.panels.filter(p => !p.fixed));
  for (const d of moving) { d.latched = false; d.holdT = 0; }
  run(4);
  place(100, 100, 0); // keep the test player outside every sash's sweep
  // Trace actual rendered boxes, including every instance in the frame.
  // Collision-only tests miss air slits between a closed sash and jamb.
  const renderedBoxes = w => {
    w.root.updateMatrixWorld(true);
    const boxes = [], matrix = new THREE.Matrix4();
    w.root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.parameters;
      if (!p || p.width === undefined) return;
      const local = new THREE.Box3(new THREE.Vector3(-p.width / 2, -p.height / 2, -p.depth / 2),
        new THREE.Vector3(p.width / 2, p.height / 2, p.depth / 2));
      if (mesh.isInstancedMesh) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
          boxes.push(local.clone().applyMatrix4(matrix));
        }
      } else boxes.push(local.applyMatrix4(mesh.matrixWorld));
    });
    return boxes;
  };
  let sealed = true;
  for (const w of wins.filter(w => w.style === 'casement')) {
    const h = w.a.d === 'h', boxes = renderedBoxes(w);
    // Include the wall reveal: an oblique ray can leave the assembly
    // footprint and meet the wall beside/above/below it.
    for (const b of W3.geom.boxes) boxes.push(new THREE.Box3(
      new THREE.Vector3(b.x0, b.y0, b.z0), new THREE.Vector3(b.x1, b.y1, b.z1)));
    const face = h ? (w.inward > 0 ? w.a.z1 : w.a.z0) : (w.inward > 0 ? w.a.x1 : w.a.x0);
    for (const p of w.panels) {
      const centre = (h ? p.pivot.position.x + p.sash.position.x : p.pivot.position.z + p.sash.position.z) +
        (h ? w.root.position.x : w.root.position.z);
      const samples = [];
      for (const side of [-1, 1]) for (const gap of [-0.05, 0.15, 0.7]) {
        for (const y of [p.ly0 + 0.1, (p.ly0 + p.ly1) / 2, p.ly1 - 0.1])
          samples.push([centre + side * (p.lw / 2 + gap), y]);
        samples.push([centre, (side < 0 ? p.ly0 - gap : p.ly1 + gap)]);
      }
      for (const [u, y] of samples) for (const [su, sy] of [[0, 0], [-2.5, 0], [2.5, 0], [0, -2], [0, 2]]) {
        const origin = new THREE.Vector3(h ? u : face + w.inward * 2, y, h ? face + w.inward * 2 : u);
        const dir = new THREE.Vector3(h ? su : -w.inward, sy, h ? -w.inward : su).normalize();
        const ray = new THREE.Ray(origin, dir);
        const depth = h ? w.a.z1 - w.a.z0 : w.a.x1 - w.a.x0;
        const distance = (depth + 2.01) / Math.abs(h ? dir.z : dir.x);
        const hit = new THREE.Vector3();
        // Stop at the far wall face. A distant wall seen through an
        // air slit must not count as a sealed window.
        sealed &&= boxes.some(b => ray.intersectBox(b, hit) && hit.distanceTo(origin) <= distance);
      }
    }
  }
  t(label + ': closed window edges sealed from straight and oblique views', sealed);
  const fixed = wins.flatMap(w => w.panels.filter(p => p.fixed)
    .map(p => ({ p, at: p.pivot.position.clone() })));
  let contained = true, clear = true, separated = true;
  const intersects = (a, b) => Math.min(a.max.x, b.x1) - Math.max(a.min.x, b.x0) > 0.01 &&
    Math.min(a.max.y, b.y1) - Math.max(a.min.y, b.y0) > 0.01 &&
    Math.min(a.max.z, b.z1) - Math.max(a.min.z, b.z0) > 0.01;
  const sample = () => {
    for (const w of wins) {
      w.root.updateMatrixWorld(true);
      const boxes = w.panels.map(p => new THREE.Box3().setFromObject(p.pivot));
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i], p = w.panels[i];
        if (!p.casement) contained &&= b.min.x >= w.a.x0 - 0.01 && b.max.x <= w.a.x1 + 0.01 &&
          b.min.y >= w.a.y0 - 0.01 && b.max.y <= w.a.y1 + 0.01 &&
          b.min.z >= w.a.z0 - 0.01 && b.max.z <= w.a.z1 + 0.01;
        else {
          const face = w.a.d === 'h' ? (w.inward > 0 ? w.a.z1 : w.a.z0)
            : (w.inward > 0 ? w.a.x1 : w.a.x0);
          const near = w.a.d === 'h' ? (w.inward > 0 ? b.min.z : b.max.z)
            : (w.inward > 0 ? b.min.x : b.max.x);
          contained &&= (near - face) * w.inward >= -0.01 &&
            b.min.y >= w.a.y0 && b.max.y <= w.a.y1 &&
            Math.abs(p.pivot.rotation.y) <= Math.PI / 2 + 0.001;
        }
        const hit = W3.geom.boxes.find(s => intersects(b, s));
        if (hit && clear) console.log('  window wall overlap:', w.a.k, JSON.stringify(hit));
        clear &&= !hit;
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        separated &&= !intersects(boxes[i], { x0: b.min.x, x1: b.max.x,
          y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z });
      }
    }
  };
  for (const d of moving) d.latched = true;
  for (let i = 0; i < 80; i++) { step(50); sample(); }
  t(label + ': operating sashes open (or stop at room obstructions)',
    moving.every(d => d.open > (label === 'real house' && d.casement ? 0.05 : 0.99)),
    moving.filter(d => d.open <= 0.99).map(d => `${d.a.k}=${d.open.toFixed(2)}`).join(','));
  let openClear = true;
  for (const w of wins.filter(w => w.style === 'casement')) {
    const h = w.a.d === 'h', boxes = renderedBoxes(w);
    for (const p of w.panels.filter(p => p.open > 0.99)) {
      const u = (h ? p.base.x : p.base.z) + p.hinge * p.lw / 2;
      const depth = (h ? p.base.z : p.base.x) + w.inward * (p.lw + 2);
      const origin = w.root.position.clone().add(new THREE.Vector3(h ? u : depth, 0, h ? depth : u));
      const ray = new THREE.Ray(origin, new THREE.Vector3(h ? 0 : -w.inward, 0, h ? -w.inward : 0));
      openClear &&= !boxes.some(b => ray.intersectsBox(b));
    }
  }
  t(label + ': open windows retain clear apertures', openClear);
  for (const d of moving) d.latched = false;
  for (let i = 0; i < 80; i++) { step(50); sample(); }
  t(label + ': every operating sash closes', moving.every(d => d.open < 0.001));
  t(label + ': fixed panes never move', fixed.every(({ p, at }) => p.pivot.position.equals(at)));
  t(label + ': lift sashes contained / casements swing inward at sill height', contained);
  t(label + ': no sash enters solid wall', clear);
  t(label + ': sashes never intersect each other', separated);
}
checkWindows('real house');

/* ---------- 8. gates exist & act like doors ---------- */
{
  const gates = W3.doorPivots.filter(d => d.gate);
  console.log('  gates:', gates.length);
  const g = gates.find(d => standAt(d, 20));
  if (g) {
    tap('KeyE'); run(4);
    t('E opens gate', g.open > 0.5, 'open=' + g.open.toFixed(2));
    t('prompt says gate', /gate/.test(els.prompt.textContent), els.prompt.textContent);
  } else t('gates exist & act like doors', gates.length > 0, gates.length + ' gates, none reachable');
}

/* ---------- 9. pool: recessed basin + wading ---------- */
{
  const areas = W3.waterAreas || [];
  const pool = HP.cur().furniture.find(i => /pool$|pond/i.test(i.type));
  t('pool basin registered', areas.length === 1 && !!pool, areas.length + ' areas');
  if (areas.length && pool) {
    const f = HP.footprint(pool), a = areas[0];
    t('water area covers pool footprint',
      a.x0 >= f.x * HP.CELL && a.x1 <= (f.x + f.w) * HP.CELL &&
      a.z0 >= f.y * HP.CELL && a.z1 <= (f.y + f.h) * HP.CELL);
    t('basin is one metre deep', a.floorY === -HP.CELL);
    t('water surface is animated', (W3.water || []).length === 1 && !!W3.water[0].pos);
    place((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2, 0); run(1.5);
    t('wading sinks the camera one metre',
      Math.abs(W3.camera.position.y - (W3.EYE + a.floorY)) < 1,
      'y=' + W3.camera.position.y.toFixed(1));
    /* climb out through whichever edge is clear of furniture        */
    let climbed = false;
    for (const [ex, ez, ey] of [
      [(a.x0 + a.x1) / 2, a.z0 + 8, 0], [(a.x0 + a.x1) / 2, a.z1 - 8, Math.PI],
      [a.x0 + 8, (a.z0 + a.z1) / 2, Math.PI / 2], [a.x1 - 8, (a.z0 + a.z1) / 2, -Math.PI / 2]]) {
      place(ex, ez, ey); run(0.3);
      key('KeyW', true); run(3); key('KeyW', false); run(0.8);
      if (W3.camera.position.y > W3.EYE - 5) { climbed = true; break; }
    }
    t('player can climb out of the pool', climbed,
      'y=' + W3.camera.position.y.toFixed(1));
    if (a.stairs) {
      const s = a.stairs;
      place((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0); run(1.5);
      t('pool stairs give stepped heights',
        W3.camera.position.y > W3.EYE + a.floorY + 2 && W3.camera.position.y < W3.EYE,
        'y=' + W3.camera.position.y.toFixed(1));
    } else t('pool has entry stairs', false);
  }
}

/* ---------- 10. jump ---------- */
{
  place(1134, 830, 0); run(0.5);                 // open lawn south of the pool
  const y0 = W3.camera.position.y;
  key('Space', true); run(0.05); key('Space', false);
  let apex = y0;
  for (let i = 0; i < 10; i++) { run(0.1); apex = Math.max(apex, W3.camera.position.y); }
  run(1.2);
  t('space makes you jump', apex > y0 + 8, 'apex=' + (apex - y0).toFixed(1));
  t('lands back on the ground', Math.abs(W3.camera.position.y - y0) < 1.5,
    'y=' + W3.camera.position.y.toFixed(1));
}

/* ---------- 10. audit still green ---------- */
{
  const { regionOf, regions } = HP.computeRegions();
  const env = { C: HP.CELL, fences: HP.cur().fences,
    rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : regionOf[y * HP.GRID_W + x],
    rsz: id => id >= 0 ? regions[id].cells.length : 1e9 };
  const { checks } = HP.geom3d.audit(HP.cur().walls, env);
  for (const c of checks) t('audit: ' + c.name, c.ok, (c.marks || []).length + ' marks');
}

/* Isolated one-, two-, and three-cell windows, each orientation.
   The real save has no two-cell window, so it cannot cover that mechanism. */
HP.state = JSON.parse(JSON.stringify(house.state));
const fixture = HP.cur();
fixture.walls = {}; fixture.furniture = []; fixture.fences = {}; fixture.floors = {};
for (let n = 1; n <= 3; n++) {
  const start = 10 + n * 8, end = start + n + 2;
  for (let i = start; i < end; i++) {
    for (const edge of [start, end]) {
      fixture.walls[`h,${i},${edge}`] = { f: i > start && i < end - 1 ? 'window' : 'wall' };
      fixture.walls[`v,${edge},${i}`] = { f: i > start && i < end - 1 ? 'window' : 'wall' };
    }
  }
}
HP.invalidateRegions(); W3.buildLevel();
t('fixtures cover one/two/three panels on all four room sides', W3.windows.length === 12 &&
  W3.windows.filter(w => w.style === 'casement').length === 8);
t('every multi-panel sash has a hinge (including the centre)', W3.windows
  .filter(w => w.style === 'casement').every(w => w.panels.every(p => p.casement && !p.fixed && !p.slide)));
for (const w of W3.windows.filter(w => w.style === 'casement')) {
  const s = HP.parseWallKey(w.a.k);
  const plus = HP.regionAt(s.x, s.y);
  t('hinges choose enclosed side ' + w.a.k, w.inward === (plus ? 1 : -1));
}
checkWindows('both orientations / all layouts');

/* Furniture inserted after build blocks opening and closing, even at 20fps. */
{
  const d = W3.windows.find(w => w.style === 'casement').panels[0];
  const root = d.pivot.parent.position, h = d.a.d === 'h';
  const angle = Math.PI / 4 * d.swingDir, u = d.hinge * d.lw * 0.85;
  const lx = h ? u : 0, lz = h ? 0 : u;
  const x = root.x + d.pivot.position.x + lx * Math.cos(angle) + lz * Math.sin(angle);
  const z = root.z + d.pivot.position.z - lx * Math.sin(angle) + lz * Math.cos(angle);
  const block = { x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5,
    y0: d.ly0 + 1, y1: d.ly1 - 1 };
  W3.colliders.push(block); d.latched = true; run(4, 50);
  t('swinging sash stops at furniture', d.open > 0.1 && d.open < 0.6, d.open);
  W3.colliders.splice(W3.colliders.indexOf(block), 1); run(4, 50);
  t('sash reaches 90 degrees after obstruction removed', d.open > 0.99);
  W3.colliders.push(block); d.latched = false; run(4, 50);
  t('closing sash stops at furniture', d.open > 0.4 && d.open < 0.9, d.open);
  W3.colliders.splice(W3.colliders.indexOf(block), 1); run(4, 50);
  t('sash closes after obstruction removed', d.open < 0.001);
  place(x, z, 0); d.latched = true; run(4, 50);
  t('window stops before hitting the player', d.open < 0.5, d.open);
  place(100, 100, 0); run(4, 50);
  t('window opens after the player steps away', d.open > 0.99);
  d.latched = false; run(4, 50);
}

/* Pause freezes walking and ignores input; Resume must not use spawn
   or reset mouse look. Exercise both P and pointer-lock loss (Escape). */
place(100, 100, 0.3);
document.pointerLockElement = els.gl;
docListeners.pointerlockchange.forEach(f => f());
docListeners.mousemove.forEach(f => f({ movementX: 20, movementY: -35 }));
key('KeyW'); run(0.2); tap('KeyP');
const beforePause = W3.camera.position.clone(), beforeLook = W3.camera.rotation.clone();
run(1);
key('KeyW'); docListeners.mousemove.forEach(f => f({ movementX: 50, movementY: 50 })); run(0.5);
t('pause freezes position and ignores movement/look input', W3.camera.position.equals(beforePause) &&
  W3.camera.rotation.equals(beforeLook));
HP.walk3d.resume({ x: 900, y: 900, yaw: 2 }); run(0.1);
t('resume preserves position and view, not spawn', pos().x === beforePause.x && pos().z === beforePause.z &&
  W3.camera.rotation.x === beforeLook.x && W3.camera.rotation.y === beforeLook.y);
document.pointerLockElement = null; docListeners.pointerlockchange.forEach(f => f());
t('Escape / lost pointer lock pauses', HP.walk3d.isPaused());
HP.walk3d.resume({ x: 900, y: 900 }); run(0.1);
t('Escape resume also preserves position', pos().x === beforePause.x && pos().z === beforePause.z);

/* ---------- 360° mouse look + warp spike rejection ---------- */
{
  place(500, 500, 0);
  document.pointerLockElement = els.gl;
  docListeners.pointerlockchange.forEach(f => f());
  run(0.1);
  let prevY = W3.camera.rotation.y, snapped = false;
  for (let i = 0; i < 140; i++) {
    docListeners.mousemove.forEach(f => f({ movementX: 20, movementY: 0 }));
    if (i === 50) docListeners.mousemove.forEach(f => f({ movementX: -720, movementY: 0 })); // bogus recenter spike
    if (i === 95) docListeners.mousemove.forEach(f => f({ movementX: 640, movementY: 0 }));  // oversized jump
    step(16);
    const curY = W3.camera.rotation.y;
    const dAng = Math.atan2(Math.sin(curY - prevY), Math.cos(curY - prevY));
    if (dAng > 0.001 || Math.abs(dAng + 20 * 0.0023) > 0.01) snapped = true;
    prevY = curY;
  }
  t('360° mouse turn is continuous and rejects warp spikes', !snapped);
}

console.log(`\n${fail ? 'FAILURES: ' + fail : 'ALL PASS'} (${pass} checks)`);
process.exit(fail ? 1 : 0);
