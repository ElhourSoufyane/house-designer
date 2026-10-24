/* save.js — undo/redo (state snapshots), autosave to localStorage, PNG export. */
(function () {
const LS_KEY = 'homeplanner_save_v1';
let undoStack = [], redoStack = [], saveTimer = null;

HP.snap = () => JSON.stringify(HP.state);

HP.pushUndoSnap = function (snap) {
  undoStack.push(snap);
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  HP.updateUndoButtons();
};
HP.pushUndo = function () { HP.pushUndoSnap(HP.snap()); };

function restore(snap) {
  HP.state = HP.migrate(JSON.parse(snap));
  HP.state.level = Math.min(HP.state.level, HP.state.levels.length - 1);
  HP.selected = null; HP.pending = null; HP.ghost = null; HP.selectedRoom = null;
  HP.invalidateRegions(); HP.refreshContext();
  if (HP.updateFloorUI) HP.updateFloorUI();
}

HP.undo = function () {
  if (!undoStack.length) return;
  redoStack.push(HP.snap());
  restore(undoStack.pop());
  HP.saveState(); HP.updateUndoButtons(); HP.status('Undo');
};
HP.redo = function () {
  if (!redoStack.length) return;
  undoStack.push(HP.snap());
  restore(redoStack.pop());
  HP.saveState(); HP.updateUndoButtons(); HP.status('Redo');
};
HP.updateUndoButtons = function () {
  const u = document.getElementById('btn-undo'), r = document.getElementById('btn-redo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
};

/* ---------- persistence ---------- */
HP.saveState = function () {
  HP.markDirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ state: HP.state, nextId: HP.nextId }));
    } catch (e) { /* storage full/blocked — non-fatal */ }
  }, 250);
};

/* migrate old single-floor saves: {walls,floors,roomNames,furniture} → levels model */
HP.migrate = function (state) {
  if (!state.levels) {
    state = { bg: state.bg || null, level: 0, levels: [state] };
  }
  state.level = state.level || 0;
  for (const l of state.levels) {
    l.walls = l.walls || {}; l.floors = l.floors || {}; l.fences = l.fences || {};
    l.roomNames = l.roomNames || {}; l.furniture = l.furniture || [];
  }
  return state;
};

HP.loadState = function () {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      HP.state = HP.migrate(data.state);
      HP.nextId = Math.max(data.nextId || 0, HP.maxFurnitureId() + 1);
      return true;
    }
  } catch (e) { }
  return false;
};

HP.loadPreset = function (id) {
  const p = HP.PRESETS.find(p => p.id === id);
  if (!p) return;
  HP.pushUndo();
  HP.state = HP.migrate(p.build());
  HP.nextId = HP.maxFurnitureId() + 1;
  HP.selected = null; HP.pending = null; HP.ghost = null; HP.selectedRoom = null;
  HP.invalidateRegions(); HP.saveState(); HP.refreshContext();
  HP.status('Loaded: ' + p.name);
};

/* ---------- floor management ---------- */
HP.setLevel = function (i) {
  if (i < 0 || i >= HP.state.levels.length) return;
  HP.state.level = i;
  HP.selected = null; HP.selectedRoom = null; HP.pending = null; HP.ghost = null;
  HP.invalidateRegions(); HP.refreshContext(); HP.updateFloorUI();
  HP.saveState();
};

HP.addLevel = function () {
  // a floor needs stairs before you can build above it
  if (!HP.cur().furniture.some(it => it.type === 'stairs')) {
    if (HP.showDialog) HP.showDialog({
      title: 'Stairs required',
      desc: 'Place a Stairs item on this floor first — you\'ll find it in the catalog under "Build".',
      buttons: [{ label: 'OK', cls: 'primary', fn: null }],
    });
    else HP.status('Place a Stairs item first (catalog → Build)');
    return;
  }
  HP.pushUndo();
  const below = HP.cur();
  const nl = HP.newLevel();
  /* copy the exterior shell up — for the whole CONNECTED building the stairs
     are in, not just the stair's own room. Regions that share a wall with the
     stairs' region are part of the same structure: flood the building by
     walking region→region across shared wall segments. Detached buildings
     (garage, pool house…) never touch a shared wall so they stay out. */
  const { regionOf } = HP.computeRegions();
  const stair = below.furniture.find(it => it.type === 'stairs');
  const st = stair ? HP.footprint(stair) : null;
  const home = st ? regionOf[(st.y + Math.floor(st.h / 2)) * HP.GRID_W + st.x + Math.floor(st.w / 2)] : -1;
  const W = HP.GRID_W;
  const outside = (x, y) => !HP.cellIn(x, y) || regionOf[y * W + x] < 0;
  const reg = (x, y) => HP.cellIn(x, y) ? regionOf[y * W + x] : -2;
  const inB = new Set();
  if (home >= 0) {
    inB.add(home);
    let grew = true;
    while (grew) {                                   // regions sharing a wall = same building
      grew = false;
      for (const k in below.walls) {
        const s = HP.parseWallKey(k);
        const a = s.d === 'h' ? reg(s.x, s.y - 1) : reg(s.x - 1, s.y);
        const b = s.d === 'h' ? reg(s.x, s.y)     : reg(s.x, s.y);
        if (a >= 0 && b >= 0 && a !== b && inB.has(a) !== inB.has(b)) {
          inB.add(a); inB.add(b); grew = true;
        }
      }
    }
  }
  for (const k in below.walls) {
    const s = HP.parseWallKey(k);
    /* shell = wall with the building's interior on one side, outdoors on the other */
    const c1 = s.d === 'h' ? inB.has(reg(s.x, s.y - 1)) : inB.has(reg(s.x - 1, s.y));
    const c2 = s.d === 'h' ? inB.has(reg(s.x, s.y))     : inB.has(reg(s.x, s.y));
    const o1 = s.d === 'h' ? outside(s.x, s.y - 1) : outside(s.x - 1, s.y);
    const o2 = s.d === 'h' ? outside(s.x, s.y)     : outside(s.x, s.y);
    const shell = home < 0 ? (o1 || o2)            // stairs outdoors → old behaviour
                          : ((c1 && o2) || (c2 && o1));
    if (shell) nl.walls[k] = { f: null };          // shell only — openings are per-floor
  }
  HP.state.levels.push(nl);
  HP.setLevel(HP.state.levels.length - 1);
  HP.status('Floor ' + HP.state.levels.length + ' added — exterior walls copied up');
};

HP.removeLevel = function () {
  if (HP.state.levels.length <= 1) { HP.status('Can\'t remove the only floor'); return; }
  HP.pushUndo();
  HP.state.levels.splice(HP.state.level, 1);
  HP.state.level = Math.min(HP.state.level, HP.state.levels.length - 1);
  HP.setLevel(HP.state.level);
};

/* ---------- PNG export ---------- */
HP.exportPNG = function () {
  const scale = 2;                                   // 2× resolution
  const c = document.createElement('canvas');
  c.width = HP.GRID_W * HP.CELL * scale;
  c.height = HP.GRID_H * HP.CELL * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  HP.renderAll(g, {
    x: HP.GRID_W * HP.CELL / 2, y: HP.GRID_H * HP.CELL / 2,
    zoom: 1, w: c.width / scale, h: c.height / scale, export: true
  });
  const a = document.createElement('a');
  a.download = 'my-house-plan.png';
  a.href = c.toDataURL('image/png');
  a.click();
  HP.status('Exported PNG');
};
})();
