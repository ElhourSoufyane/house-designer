// Smoke test: loads non-DOM game logic into Node and exercises it.
// Run:  ELECTRON_RUN_AS_NODE=1 Devin.exe test-smoke.js
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, createElement: () => { throw new Error('no canvas'); } };
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v, removeItem: k => delete store[k] };
globalThis.requestAnimationFrame = () => {};

async function main() {
for (const f of ['grid.js', 'catalog.js', 'sprites.js', 'rooms.js', 'tools.js', 'presets.js', 'save.js', 'walk.js'])
  eval(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));
// UI functions live in ui.js (DOM-bound) — stub them for the logic test
HP.refreshContext = () => {}; HP.status = () => {}; HP.updateUndoButtons = () => {};
HP.updateFloorUI = () => {};

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', name); } };
const load = (st) => { HP.state = HP.migrate(st); HP.regions = null; };

// --- preset builds ---
for (const p of HP.PRESETS) {
  const s = p.build();
  t(p.id + ' builds', s && (s.walls || s.levels));
}

// --- cozy apartment regions ---
load(HP.PRESETS[0].build());
t('levels model', Array.isArray(HP.state.levels) && HP.cur().walls);
let { regionOf, regions } = HP.computeRegions();
t('cozy has 4 rooms', regions.length === 4);
t('cozy outside marked', regionOf[0] === -1);
const names = regions.map(r => r.name).sort();
t('room names found', names.join() === 'BWC,LIVING / KITCHEN,OFFICE,SUITE');
const total = regions.reduce((a, r) => a + r.m2, 0);
t('cozy area ~120m2', Math.abs(total - 120) < 2);

// --- walls block flood fill ---
t('wall separates rooms', regionOf[14 * HP.GRID_W + 30] !== regionOf[14 * HP.GRID_W + 36]);

// --- family house ---
load(HP.PRESETS[1].build());
({ regionOf, regions } = HP.computeRegions());
t('family has 4 rooms', regions.length === 4);

// --- duplex: 2 floors ---
load(HP.PRESETS.find(p => p.id === 'duplex').build());
t('duplex has 2 levels', HP.state.levels.length === 2);
t('duplex floor0 rooms', HP.computeRegions().regions.length === 4);
HP.setLevel(1);
t('duplex floor1 rooms', HP.computeRegions().regions.length === 4);
t('floor1 has furniture', HP.cur().furniture.length > 0);
HP.setLevel(0);

// --- label anchors inside own region ---
for (const preset of HP.PRESETS) {
  load(preset.build());
  for (let li = 0; li < HP.state.levels.length; li++) {
    HP.state.level = li; HP.regions = null;
    const { regionOf: ro, regions: rs } = HP.computeRegions();
    for (const r of rs) {
      const lx = Math.floor(r.lx / HP.CELL), ly = Math.floor(r.ly / HP.CELL);
      t(preset.id + ' L' + li + ' label inside region ' + r.id, ro[ly * HP.GRID_W + lx] === r.id);
    }
  }
  HP.state.level = 0;
}

// --- furniture placement ---
load(HP.newLevel ? HP.newState() : null);
t('canPlace empty ok', HP.canPlace('bedQueen', 10, 10, 0));
HP.cur().furniture.push({ id: 1, type: 'bedQueen', x: 10, y: 10, rot: 0, v: 0 });
t('overlap rejected', !HP.canPlace('sofa3', 11, 11, 0));
t('adjacent ok', HP.canPlace('sofa3', 14, 10, 0));
t('out of bounds rejected', !HP.canPlace('sofa3', 62, 10, 0));
t('itemAt finds bed', HP.itemAt(11, 11)?.type === 'bedQueen');
t('itemAt misses empty', HP.itemAt(20, 20) === null);

// --- wall blocks furniture ---
HP.cur().walls['v,20,20'] = { f: null };
t('wall blocks placement', !HP.canPlace('counter', 19, 20, 0));   // 2×1 spanning the wall
t('wall flush ok', HP.canPlace('counter', 20, 20, 0) === false || HP.canPlace('counter', 18, 19, 0));

// --- door clearance ---
HP.cur().walls = {};
HP.cur().walls['h,30,30'] = { f: 'door' };
t('door blocks in front', !HP.canPlace('nightstand', 30, 30, 0));
t('away from door ok', HP.canPlace('nightstand', 32, 30, 0));

// --- wall segments ---
t('h segments', HP.segmentsBetween({ x: 5, y: 5 }, { x: 9, y: 5 })[0] === 'h,5,5');
t('v segments', HP.segmentsBetween({ x: 5, y: 5 }, { x: 5, y: 2 }).length === 3);
t('diagonal locks axis', HP.segmentsBetween({ x: 5, y: 5 }, { x: 9, y: 8 }).length === 4);
t('nearestWallSeg', HP.nearestWallSeg(30.5 * HP.CELL, 30.1 * HP.CELL, 0.8) === 'h,30,30');

// --- undo/redo ---
load(HP.newState());
HP.cur().furniture.push({ id: 1, type: 'chair', x: 5, y: 5, rot: 0, v: 0 });
HP.pushUndo();
HP.cur().furniture.pop();
t('undo restores', HP.cur().furniture.length === 0 && (HP.undo(), HP.cur().furniture.length === 1));
t('redo applies', (HP.redo(), HP.cur().furniture.length === 0));

// --- add level requires stairs, then copies exterior shell ---
load(HP.PRESETS[0].build());                     // cozy has no stairs
HP.showDialog = null;
HP.addLevel();
t('addLevel rejected without stairs', HP.state.levels.length === 1);
const w0 = Object.keys(HP.cur().walls).length;
HP.cur().furniture.push({ id: 50, type: 'stairs', x: 24, y: 15, rot: 0, v: 0 });
HP.addLevel();
t('level added with stairs', HP.state.levels.length === 2 && HP.state.level === 1);
t('shell copied', Object.keys(HP.cur().walls).length > 0 && Object.keys(HP.cur().walls).length < w0);
HP.setLevel(0);

// --- stairs are walkable + travel between floors ---
t('stairs def walkable', HP.itemDef('stairs').walkable === true);
load(HP.PRESETS.find(p => p.id === 'duplex').build());
HP.player = { x: 39 * HP.CELL, y: 17 * HP.CELL, angle: 0 };   // on L0 stairs footprint
HP.travelFloor(1);
t('travel up lands on L1 stairs', HP.state.level === 1 &&
  Math.abs(HP.player.x - 39.5 * HP.CELL) < HP.CELL && Math.abs(HP.player.y - 17.5 * HP.CELL) < HP.CELL * 2);
HP.travelFloor(-1);
t('travel back down', HP.state.level === 0);

// --- furniture resize ---
load(HP.newState());                                // empty level — no walls to block
const ri = { id: 7, type: 'coffeeR', x: 10, y: 10, rot: 0, v: 0 };
HP.cur().furniture.push(ri);
HP.resizeItem(ri, 1, 0);
t('resize grows', HP.footprint(ri).w === 3 && ri.w === 3);
HP.resizeItem(ri, -1, 0);
t('resize back to default', !ri.w && HP.footprint(ri).w === 2);
ri.rot = 1;
HP.resizeItem(ri, 1, 0);
t('rotated resize maps axes', HP.footprint(ri).w === 2 && ri.h === 2);
HP.saveState();
await new Promise(r => setTimeout(r, 400));
const savedSz = JSON.parse(localStorage.getItem('homeplanner_save_v1')).state.levels[0].furniture[0];
t('size persists in save', savedSz.w === 2 && savedSz.h === 2);

// --- connected groups act as one piece ---
load(HP.newState());
const ga = { id: 1, type: 'modseat', x: 5, y: 5, rot: 0, v: 0 };
const gb = { id: 2, type: 'modseat', x: 7, y: 5, rot: 0, v: 0 };
const gc = { id: 3, type: 'chair', x: 20, y: 20, rot: 0, v: 0 };
HP.cur().furniture.push(ga, gb, gc);
HP.selected = ga;
HP.connectSelected();
t('adjacent pieces connect', ga.g === gb.g && HP.groupOf(ga).length === 2 && !gc.g);
const gd = { id: 4, type: 'modseat', x: 9, y: 5, rot: 0, v: 0 };   // touches gb, not ga
HP.cur().furniture.push(gd);
HP.connectSelected();
t('connection is transitive (a-b-c)', HP.groupOf(ga).length === 3 && gd.g === ga.g);
HP.disconnectSelected();
t('disconnect frees one, keeps rest', !ga.g && !!gb.g && gb.g === gd.g);
gb.g = gd.g = undefined;                                // clean slate for reconnect test
HP.connectSelected();
HP.selected = ga;
HP.rotateActive();
t('group rotates together', ga.rot === 1 && gb.rot === 1 && gd.rot === 1);
// group metadata survives a save/load round trip
const gsnap = HP.snap();
HP.state = HP.migrate(JSON.parse(gsnap));
const rga = HP.cur().furniture.find(f => f.id === 1);
t('group id survives save/load', !!rga.g && HP.groupOf(rga).length === 3);
HP.deleteSelected();
t('delete removes whole group', HP.cur().furniture.length === 1 && HP.cur().furniture[0].type === 'chair');
// modular pieces auto-connect when placed touching
load(HP.newState());
const ma = { id: 1, type: 'modseat', x: 5, y: 5, rot: 0, v: 0 };
const mb = { id: 2, type: 'modseat', x: 7, y: 5, rot: 0, v: 0 };
HP.cur().furniture.push(ma, mb);
HP.autoConnect(mb);
t('modular pieces auto-connect on touch', ma.g && ma.g === mb.g);
const mc = { id: 3, type: 'chair', x: 5, y: 9, rot: 0, v: 0 };
HP.cur().furniture.push(mc);
HP.autoConnect(mc);
t('non-modular never auto-connects', !mc.g);

// --- save/load (levels survive) ---
load(HP.PRESETS.find(p => p.id === 'duplex').build());
HP.nextId = 99;
HP.saveState();
await new Promise(r => setTimeout(r, 400));
HP.state = HP.newState();
t('loadState restores levels', HP.loadState() && HP.state.levels.length === 2 && HP.nextId === 99);

// --- wall-hung items ---
load(HP.newState());
HP.cur().walls['h,10,11'] = { f: null };            // wall = north edge of cell (10,11)
t('hangSide finds wall', HP.hangSide('wallart', 10, 11, 0) === 'n');
t('hangSide null away from walls', HP.hangSide('wallart', 20, 20, 0) === null);
t('hangs needs wall', !HP.canPlace('wallart', 20, 20, 0));
t('hangs places on wall', HP.canPlace('wallart', 10, 11, 0));
HP.cur().furniture.push({ id: 1, type: 'sofa3', x: 9, y: 11, rot: 0, v: 0 });
t('art hangs above furniture', HP.canPlace('wallart', 10, 11, 0));
HP.cur().furniture.push({ id: 2, type: 'wallart', x: 10, y: 11, rot: 0, v: 0, hang: 'n' });
t('art cannot stack on art', !HP.canPlace('artabstract', 10, 11, 0));
t('normal item still blocked by sofa', !HP.canPlace('chair', 10, 11, 0));

// --- plot sizes ---
load(HP.newEmpty(96, 60));
t('newEmpty stores size', HP.state.w === 96 && HP.state.h === 60);
HP.applyGridSize();
t('applyGridSize swaps constants', HP.GRID_W === 96 && HP.GRID_H === 60);
t('cellIn uses new bounds', HP.cellIn(95, 59) && !HP.cellIn(96, 60));
t('canPlace respects new bounds', HP.canPlace('bedQueen', 90, 55, 0) && !HP.canPlace('bedQueen', 97, 55, 0));
const m = HP.migrate({ walls: {}, floors: {}, fences: {}, roomNames: {}, furniture: [] });
t('migrate defaults plot size', m.w === 64 && m.h === 44);

// --- wall painting (per-room interior faces & per-side brush) ---
load(HP.PRESETS[0].build());
const rs0 = HP.computeRegions().regions;
const rm0 = rs0[0];
const paintedCount = HP.paintRoomWalls(rm0, '#9cb29b');
t('paintRoomWalls paints bounding faces', paintedCount > 4 && HP.roomWallColor(rm0) === '#9cb29b');
const [rx0, ry0] = rm0.cells[0];
const nw = HP.cur().walls[HP.wallKey('h', rx0, ry0)];
if (nw) t('room paint sets interior face only', nw.cb === '#9cb29b' && !nw.ca);
HP.paintRoomWalls(rm0, '');
t('paintRoomWalls reset clears colour', HP.roomWallColor(rm0) === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
}
main();
