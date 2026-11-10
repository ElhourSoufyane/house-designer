// Run: node test-graphics.js. No GPU, network, or house-save mutations.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const THREE = require('./lib/three.min.js');
const storage = {}, context = {
  THREE, console, devicePixelRatio: 3, innerWidth: 1280, innerHeight: 720,
  navigator: { hardwareConcurrency: 12, deviceMemory: 8 },
  matchMedia: () => ({ matches: false }), addEventListener() {},
  localStorage: { getItem: k => storage[k] || null, setItem: (k, v) => storage[k] = v },
  document: { hidden: false, createElement: () => ({}), getElementById: () => null },
};
context.window = context;
vm.createContext(context);
for (const file of ['grid', 'catalog', 'graphics3d', 'cull3d', 'sky3d', 'furniture3d', 'life3d'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', file + '.js'), 'utf8'), context);
const { HP } = context, G = HP.graphics3d;
let dpr, resizes = 0;
G.init({ setPixelRatio: v => dpr = v, capabilities: {} }, () => resizes++);
// Auto opens desktops on Balanced (never straight into High) and earns High.
assert.equal(G.tier, 'medium'); assert.equal(dpr, 1);
for (let i = 0; i < 40; i++) G.sample(60, 0.5);
assert.equal(G.tier, 'high', 'Sustained 60 fps should promote to High');
assert.equal(dpr, 1.5);
assert.equal(G.deviceTier({ hardwareConcurrency: 8, deviceMemory: 8 }, true), 'low');
assert.equal(G.deviceTier({ hardwareConcurrency: 2 }, false), 'low');
assert.equal(G.deviceTier({ userAgent: 'iPhone', hardwareConcurrency: 8 }, false), 'low');
assert.equal(G.deviceTier({ platform: 'MacIntel', maxTouchPoints: 5 }, false), 'low');
for (let i = 0; i < 40; i++) G.sample(22, 0.5);
assert.equal(G.tier, 'low'); assert.equal(dpr, 0.85);
G.setQuality('high');
for (let i = 0; i < 30; i++) G.sample(20, 0.5);
assert.equal(G.tier, 'high', 'Manual selection must not be overridden');
G.setQuality('auto');
context.document.hidden = true;
for (let i = 0; i < 30; i++) G.sample(1, 1);
assert.equal(G.tier, 'medium', 'Background tabs must not lower quality');
context.document.hidden = false;
assert(resizes > 3);
assert.equal(G.presets.low.shadow, 0, 'Low must not render shadow maps');
assert(G.presets.low.lite && !G.presets.medium.lite, 'Low uses the cheap material path');

// Occlusion: a solid wall hides the room behind it; a closed door does too,
// an open door or a window lets you see through.
{
  const V = HP.cull3d, C = HP.CELL;
  V.reset();
  const near = { visible: false }, behind = { visible: false };
  V.add(near, 15 * C, 10 * C, 16 * C, 11 * C);
  V.add(behind, 40 * C, 10 * C, 41 * C, 11 * C);
  const walls = {};
  for (let y = 0; y < HP.GRID_H; y++) walls['v,24,' + y] = {};
  const door = { a: { k: 'v,24,10', dbl: false }, open: 0 };
  walls['v,24,10'] = { f: 'door' };
  V.setWalls(walls, [door]);
  V.update(10.5 * C, 10.5 * C, true);
  assert(near.visible, 'Same-room object must draw');
  assert(!behind.visible, 'Object behind a wall + closed door must be culled');
  door.open = 1; V.update(10.5 * C, 10.5 * C);
  assert(behind.visible, 'Opening the door must reveal the next room');
  walls['v,24,10'] = { f: 'window' };
  V.setWalls(walls, []);
  V.update(10.5 * C, 10.5 * C, true);
  assert(behind.visible, 'Windows are see-through');
  // Long boxes are split at tile lines so they cull piecewise.
  const pieces = V.splitBoxes([{ x0: 0, x1: 40 * C, z0: 0, z1: 10, y0: 0, y1: 74 }]);
  assert(pieces.length >= 5 && pieces.every(p => p.x1 - p.x0 <= V.TILE * C + 0.01));
}

// Time of day: sun rises east, peaks at noon, sets west; night is dim moonlight.
{
  const S = HP.sky3d;
  const noon = S.sample(12), sunDirNoon = noon.sunDir.y;
  assert(sunDirNoon > 0.85 && noon.day === 1 && noon.night === 0, 'Noon: sun high, full day');
  const morning = S.sample(8.5);
  assert(morning.sunDir.x > 0.3 && morning.sunDir.y > 0.2, 'Morning sun in the east (+x)');
  assert(S.sample(16).sunDir.x < -0.3, 'Afternoon sun in the west');
  const mid = S.sample(0);
  assert(mid.night === 1 && mid.day === 0 && mid.lightI < 0.4, 'Midnight: moonlight only');
  for (let h = 0; h < 24; h += 0.25) {
    const s = S.sample(h);
    assert(s.lightDir.y >= 0.099, `Light never comes from below the ground (h=${h})`);
    assert(s.ambI > 0.12, `Never pitch black (h=${h})`);
  }
  assert.equal(S.clock(18.5), '18:30');
  assert.equal(S.clock(24), '00:00');
}

// Every catalog item/rotation must build finite transforms inside bounded batches.
const group = new THREE.Group(), builder = HP.furniture3d.builder(group);
let index = 0;
for (const def of HP.CATALOG) for (let rot = 0; rot < 4; rot++) {
  const it = { type: def.id, x: 8, y: 8, rot, v: 0 };
  builder.add(it, def, HP.footprint(it), 20, index++);
}
const visuals = builder.finish();
// 1656 items in one tile bake into one mesh per material — not one per part.
assert(group.children.length <= visuals.batchCount && visuals.batchCount < 25,
  `Baked furniture must be ~1 draw per material (${group.children.length} meshes)`);
for (const obj of group.children)
  for (const v of obj.geometry.attributes.position.array) assert(Number.isFinite(v));
const baked = group.children.length;
const sumAbs = () => group.children.slice(0, baked).reduce((s, o) =>
  s + o.geometry.attributes.position.array.reduce((a, v) => a + Math.abs(v), 0), 0);
const beforeSum = sumAbs();
const m = { inst: 0, x: 224, z: 224, box: { x0: 224, z0: 224 } };
visuals.move([m]);
assert.equal(group.children.length, baked, 'Idle furniture must stay baked');
m.x += 14; m.z -= 7; visuals.move([m]);
const g2 = visuals.detached.get(0);
assert(g2 && g2.children.length > 0, 'First push detaches the item into its own mesh');
assert(Math.abs(g2.position.x - 14) < 1e-6 && Math.abs(g2.position.z + 7) < 1e-6,
  'Detached parts follow the physics offset');
assert(sumAbs() < beforeSum, 'Baked copy of the pushed item must be collapsed (no double)');
m.x += 3; visuals.move([m]);
assert.equal(visuals.detached.size, 1); assert(Math.abs(g2.position.x - 17) < 1e-6);
console.log(`PASS: adaptive/manual quality, hidden-tab safety, occlusion culling, ${index} catalog ` +
  `rotations baked into ${visuals.batchCount} materials, detach-on-push mover sync`);
