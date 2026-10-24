/* tools.js — editing tools. input.js routes pointer events here.
   Each tool gets {wx,wy,cx,cy,sx,sy,e} — world px, cell, screen px, event. */
(function () {

let drag = null;          // per-gesture tool state

/* ---------------- select / move ---------------- */
const selectTool = {
  down(p) {
    const it = HP.itemAt(p.cx, p.cy);
    if (it) {
      HP.selected = it;
      HP.selectedRoom = null;
      const f = HP.footprint(it);
      const members = HP.groupOf(it);
      drag = {
        kind: 'move', item: it, members, snap: HP.snap(),
        ox: p.cx - f.x, oy: p.cy - f.y,          // grab offset in cells
        origs: members.map(m => ({ m, x: m.x, y: m.y })), moved: false, valid: true
      };
    } else {
      HP.selected = null;
      drag = { kind: 'pan', sx: p.sx, sy: p.sy, cam: { ...HP.camera },
               roomCell: HP.regionAt(p.cx, p.cy) ? { cx: p.cx, cy: p.cy } : null };
    }
    HP.refreshContext(); HP.markDirty();
  },
  move(p) {
    if (!drag) return;
    if (drag.kind === 'move') {
      const nx = p.cx - drag.ox, ny = p.cy - drag.oy;
      const dx = nx - drag.item.x, dy = ny - drag.item.y;
      if (dx || dy) {
        for (const m of drag.members) { m.x += dx; m.y += dy; }
        drag.moved = true;
        drag.valid = drag.members.every(m =>
          HP.canPlace(m.type, m.x, m.y, m.rot, drag.members, m.w ? { w: m.w, h: m.h } : null));
        HP.markDirty();
      }
    } else if (drag.kind === 'pan') {
      HP.camera.x = drag.cam.x - (p.sx - drag.sx) / HP.camera.zoom;
      HP.camera.y = drag.cam.y - (p.sy - drag.sy) / HP.camera.zoom;
      HP.markDirty();
    }
  },
  up(p) {
    if (!drag) return;
    if (drag.kind === 'move') {
      if (!drag.valid || !drag.members.every(m =>
        HP.canPlace(m.type, m.x, m.y, m.rot, drag.members, m.w ? { w: m.w, h: m.h } : null))) {
        for (const o of drag.origs) { o.m.x = o.x; o.m.y = o.y; }   // revert all
      } else if (drag.moved) {
        HP.pushUndoSnap(drag.snap);
        HP.saveState();
      }
    } else if (drag.kind === 'pan' &&
               Math.hypot(p.sx - drag.sx, p.sy - drag.sy) < 6) {
      HP.selectedRoom = drag.roomCell;           // plain click → tap a room → edit it
    }
    drag = null; HP.refreshContext(); HP.markDirty();
  },
  cancel() { drag = null; }
};

/* ---------------- wall draw / erase ---------------- */
const wallTool = {
  down(p) { drag = { a: HP.nearestVertex(p.wx, p.wy), b: null }; },
  move(p) {
    if (!drag) return;
    drag.b = HP.nearestVertex(p.wx, p.wy);
    HP.wallPreview = HP.segmentsBetween(drag.a, drag.b);
    const n = HP.wallPreview.length;
    if (n) {
      const fresh = HP.wallPreview.filter(k => !HP.cur().walls[k]).length;
      HP.status('Wall: ' + n + ' segments · ' + (n * 0.5).toFixed(1) + ' m of material' +
                (fresh < n ? ' (' + fresh + ' new)' : ''));
    }
    HP.markDirty();
  },
  up() {
    if (drag && HP.wallPreview && HP.wallPreview.length) {
      HP.pushUndo();
      for (const k of HP.wallPreview)
        if (!HP.cur().walls[k]) HP.cur().walls[k] = { f: null };
      HP.saveState();
      HP.status('Wall added — ' + HP.wallPreview.length + ' segments');
    }
    HP.wallPreview = null; drag = null;
    HP.invalidateRegions();
  },
  cancel() { HP.wallPreview = null; drag = null; }
};

/* ---------------- fence draw (edge-based, like walls — drag for any length) ---------------- */
const fenceTool = {
  down(p) { drag = { a: HP.nearestVertex(p.wx, p.wy), b: null }; },
  move(p) {
    if (!drag) return;
    drag.b = HP.nearestVertex(p.wx, p.wy);
    HP.fencePreview = HP.segmentsBetween(drag.a, drag.b);
    const n = HP.fencePreview.length;
    if (n) {
      const fresh = HP.fencePreview.filter(k => !HP.cur().fences[k]).length;
      HP.status('Fence: ' + n + ' segments · ' + (n * 0.5).toFixed(1) + ' m' +
                (fresh < n ? ' (' + fresh + ' new)' : ''));
    }
    HP.markDirty();
  },
  up() {
    if (drag && HP.fencePreview && HP.fencePreview.length) {
      HP.pushUndo();
      for (const k of HP.fencePreview)
        HP.cur().fences[k] = { t: HP.fenceType };          // re-typing is fine — redraw over old fence
      HP.saveState();
      HP.status('Fence added — ' + HP.fencePreview.length + ' segments');
    }
    HP.fencePreview = null; drag = null;
    HP.invalidateRegions();
  },
  cancel() { HP.fencePreview = null; drag = null; }
};

/* ---------------- door / window ---------------- */
function featureTool(kind) {
  return {
    down(p) {
      const k = HP.nearestWallSeg(p.wx, p.wy, 0.8);
      if (!k) { HP.status('No wall here — draw a wall first'); return; }
      HP.pushUndo();
      const w = HP.cur().walls[k];
      w.f = (w.f === kind) ? null : kind;          // toggle
      HP.saveState(); HP.invalidateRegions();      // walls live in the static layer — rebuild it
      HP.status(w.f ? (kind === 'door' ? 'Door placed' : 'Window placed') : 'Back to plain wall');
    },
    move() {}, up() {}, cancel() {}
  };
}

/* ---------------- floor painter ---------------- */
const floorTool = {
  paintCell(x, y) {
    if (!HP.cellIn(x, y)) return;
    const k = HP.cellKey(x, y);
    if (HP.cur().floors[k] !== HP.floorMat) {
      HP.cur().floors[k] = HP.floorMat;
      drag.n++; HP.invalidateRegions();
    }
    drag.lx = x; drag.ly = y;
  },
  down(p) {
    if (HP.floorBrush) {                             // path mode: paint cells as you drag
      drag = { n: 0, lx: null, ly: null };
      HP.pushUndo();
      floorTool.paintCell(p.cx, p.cy);
      return;
    }
    const r = HP.regionAt(p.cx, p.cy);
    if (!r) { HP.status('That area is outside — switch to Path brush or enclose a room first'); return; }
    HP.pushUndo();
    for (const [x, y] of r.cells) {
      const k = HP.cellKey(x, y);
      HP.cur().floors[k] = HP.floorMat;
      if (HP.floorName) HP.cur().roomNames[k] = HP.floorName;
    }
    HP.saveState(); HP.invalidateRegions();
    HP.status('Room painted: ' + (HP.floorName || 'Room') + ' — ' + r.m2.toFixed(1) + ' m²');
  },
  move(p) {
    if (!drag) return;
    const { lx, ly } = drag;
    if (lx === null) { floorTool.paintCell(p.cx, p.cy); return; }
    const dx = p.cx - lx, dy = p.cy - ly, steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (!steps) return;
    for (let i = 1; i <= steps; i++)                 // fill gaps on fast drags
      floorTool.paintCell(lx + Math.round(dx * i / steps), ly + Math.round(dy * i / steps));
  },
  up() {
    if (drag) {
      HP.saveState();
      HP.status('Path painted — ' + drag.n + ' cells · ' + (drag.n * 0.25).toFixed(1) + ' m²');
    }
    drag = null;
  },
  cancel() { drag = null; }
};

/* ---------------- eraser ---------------- */
const eraseTool = {
  down(p) { drag = { pushed: false }; eraseTool.move(p); },
  move(p) {
    if (!drag) return;
    const it = HP.itemAt(p.cx, p.cy);
    const k = HP.nearestWallSeg(p.wx, p.wy, 0.5);
    const fk = HP.nearestWallSeg(p.wx, p.wy, 0.5, HP.cur().fences);
    // floor paint on a non-room cell = outdoor path — erasable
    const ck = HP.cellKey(p.cx, p.cy);
    const pathK = (HP.cur().floors[ck] && !HP.regionAt(p.cx, p.cy)) ? ck : null;
    if (!it && !k && !fk && !pathK) return;
    if (!drag.pushed) { HP.pushUndo(); drag.pushed = true; }
    if (it) {
      const members = HP.groupOf(it);               // connected pieces erase as one
      HP.cur().furniture = HP.cur().furniture.filter(f => !members.includes(f));
      if (members.includes(HP.selected)) HP.selected = null;
    }
    if (k) delete HP.cur().walls[k];
    if (fk) delete HP.cur().fences[fk];
    if (pathK) delete HP.cur().floors[pathK];
    HP.saveState(); HP.invalidateRegions(); HP.refreshContext();
  },
  up() { drag = null; },
  cancel() { drag = null; }
};

/* ---------------- measure ---------------- */
const measureTool = {
  down(p) { drag = { ax: p.wx, ay: p.wy, bx: p.wx, by: p.wy }; HP.measureLine = drag; HP.markDirty(); },
  move(p) {
    if (!drag) return;
    drag.bx = p.wx; drag.by = p.wy;
    const m = Math.hypot(drag.bx - drag.ax, drag.by - drag.ay) / HP.CELL * 0.5;
    HP.status('Measure: ' + m.toFixed(2) + ' m');
    HP.markDirty();
  },
  up() { drag = null; },
  cancel() { drag = null; HP.measureLine = null; }
};

/* ---------------- room label (tap → rename via inspector) ---------------- */
const labelTool = {
  down(p) {
    const r = HP.regionAt(p.cx, p.cy);
    if (!r) { HP.status('No room here'); return; }
    HP.selected = null;
    HP.selectedRoom = { cx: p.cx, cy: p.cy };
    HP.refreshContext(); HP.markDirty();
    setTimeout(() => {
      const i = document.getElementById('room-name-i');
      if (i) { i.focus(); i.select(); }
    }, 60);
  },
  move() {}, up() {}, cancel() {}
};

HP.tools = { select: selectTool, wall: wallTool, door: featureTool('door'),
             window: featureTool('window'), fence: fenceTool, floor: floorTool,
             erase: eraseTool, furniture: selectTool, label: labelTool, measure: measureTool };

/* rotating selected/pending furniture */
HP.rotateActive = function () {
  if (HP.pending) { HP.pending.rot = (HP.pending.rot + 1) % 4; HP.markDirty(); return; }
  if (!HP.selected) return;
  const members = HP.groupOf(HP.selected);
  if (members.length > 1) {                       // rotate whole group around its centre
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const m of members) {
      const f = HP.footprint(m);
      x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y);
      x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, snap = HP.snap();
    const backup = members.map(m => ({ m, x: m.x, y: m.y, rot: m.rot }));
    for (const m of members) {
      const f = HP.footprint(m);
      const mx = f.x + f.w / 2, my = f.y + f.h / 2;
      m.rot = (m.rot + 1) % 4;
      m.x = Math.round(cx - (my - cy) - f.h / 2);   // rotated centre − new dims/2
      m.y = Math.round(cy + (mx - cx) - f.w / 2);
    }
    let bx = 0, by = 0;                             // nudge back inside grid
    for (const m of members) {
      const f = HP.footprint(m);
      if (f.x < 0) bx = Math.max(bx, -f.x);
      if (f.y < 0) by = Math.max(by, -f.y);
      if (f.x + f.w > HP.GRID_W) bx = Math.min(bx, HP.GRID_W - f.x - f.w);
      if (f.y + f.h > HP.GRID_H) by = Math.min(by, HP.GRID_H - f.y - f.h);
    }
    for (const m of members) { m.x += bx; m.y += by; }
    let clash = false;                              // members may not overlap each other
    for (let i = 0; i < members.length && !clash; i++)
      for (let j = i + 1; j < members.length; j++) {
        const A = HP.footprint(members[i]), B = HP.footprint(members[j]);
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) { clash = true; break; }
      }
    const ok = !clash && members.every(m =>
      HP.canPlace(m.type, m.x, m.y, m.rot, members, m.w ? { w: m.w, h: m.h } : null));
    if (!ok) {
      for (const b of backup) { b.m.x = b.x; b.m.y = b.y; b.m.rot = b.rot; }
      HP.status('No room to rotate the group');
    } else HP.pushUndoSnap(snap);
    HP.saveState(); HP.markDirty(); HP.refreshContext();
    return;
  }
  const it = HP.selected, oldRot = it.rot, snap = HP.snap();
  it.rot = (it.rot + 1) % 4;
  // keep inside grid: nudge position if rotated footprint overflows
  const f = HP.footprint(it);
  if (f.x + f.w > HP.GRID_W) it.x = HP.GRID_W - f.w;
  if (f.y + f.h > HP.GRID_H) it.y = HP.GRID_H - f.h;
  if (!HP.canPlace(it.type, it.x, it.y, it.rot, it)) { it.rot = oldRot; HP.status('No room to rotate here'); }
  else HP.pushUndoSnap(snap);
  HP.saveState(); HP.markDirty(); HP.refreshContext();
};

HP.duplicateSelected = function () {
  const it = HP.selected; if (!it) return;
  const members = HP.groupOf(it);
  const sz = m => (m.w ? { w: m.w, h: m.h } : null);
  const fits = (dx, dy) => members.every(m =>
    HP.canPlace(m.type, m.x + dx, m.y + dy, m.rot, members, sz(m)));
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;   // group bbox for offsets
  for (const m of members) {
    const f = HP.footprint(m);
    bx0 = Math.min(bx0, f.x); by0 = Math.min(by0, f.y);
    bx1 = Math.max(bx1, f.x + f.w); by1 = Math.max(by1, f.y + f.h);
  }
  let dx = bx1 - bx0, dy = 0;                        // try right, then below
  if (!fits(dx, 0)) { dx = 0; dy = by1 - by0; }
  if (!fits(dx, dy)) { HP.status('No space to duplicate'); return; }
  HP.pushUndo();
  const gid = it.g ? HP.maxGroup() + 1 : 0;
  let anchor = null;
  for (const m of members) {
    const copy = { id: HP.nextId++, type: m.type, x: m.x + dx, y: m.y + dy, rot: m.rot, v: m.v };
    if (m.w) { copy.w = m.w; copy.h = m.h; }
    if (gid) copy.g = gid;
    HP.cur().furniture.push(copy);
    if (m === it) anchor = copy;
  }
  HP.selected = anchor; HP.saveState(); HP.markDirty(); HP.refreshContext();
};

/* grow/shrink the selected item by whole cells (visual footprint axes) */
HP.resizeItem = function (it, dw, dh) {
  const def = HP.itemDef(it.type);
  const snap = HP.snap(), ox = it.x, oy = it.y, ow = it.w, oh = it.h;
  const f = HP.footprint(it);
  const nw = Math.max(1, Math.min(10, f.w + dw));
  const nh = Math.max(1, Math.min(10, f.h + dh));
  if (nw === f.w && nh === f.h) return;
  it.w = (it.rot % 2 === 0) ? nw : nh;               // stored unrotated
  it.h = (it.rot % 2 === 0) ? nh : nw;
  const f2 = HP.footprint(it);                       // keep inside grid
  if (f2.x + f2.w > HP.GRID_W) it.x = HP.GRID_W - f2.w;
  if (f2.y + f2.h > HP.GRID_H) it.y = HP.GRID_H - f2.h;
  if (!HP.canPlace(it.type, it.x, it.y, it.rot, it, { w: it.w, h: it.h })) {
    it.w = ow; it.h = oh; it.x = ox; it.y = oy;
    HP.status('No room to resize');
    return;
  }
  if (it.w === def.w && it.h === def.h) { delete it.w; delete it.h; }  // back to default
  HP.pushUndoSnap(snap);
  HP.saveState(); HP.markDirty(); HP.refreshContext();
};

HP.deleteSelected = function () {
  const it = HP.selected; if (!it) return;
  HP.pushUndo();
  const members = HP.groupOf(it);                   // delete the whole connected piece
  HP.cur().furniture = HP.cur().furniture.filter(f => !members.includes(f));
  HP.selected = null; HP.saveState(); HP.markDirty(); HP.refreshContext();
};

HP.cycleVariant = function () {
  const target = HP.pending || HP.selected; if (!target) return;
  if (HP.pending) { HP.pending.v = (HP.pending.v + 1) % HP.pending.def.colors.length; HP.markDirty(); return; }
  for (const m of HP.groupOf(HP.selected)) {       // recolour the whole connected piece
    const def = HP.itemDef(m.type);
    m.v = ((m.v || 0) + 1) % def.colors.length;
  }
  HP.pushUndo(); HP.saveState(); HP.markDirty();
};

HP.cancelPending = function () {
  if (HP.pending) {
    HP.pending = null; HP.ghost = null;
    HP.markDirty(); HP.refreshContext();
    HP.status('Placement cancelled');
  }
};
})();
