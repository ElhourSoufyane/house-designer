/* input.js — unified mouse/touch (Pointer Events): tool routing, pan, pinch
   zoom, wheel zoom, furniture placement mode, keyboard shortcuts. */
(function () {
const pointers = new Map();          // id -> {x,y}
let pinch = null;
let placing = false;                 // pointer gesture inside placement mode

function evtPoint(e) {
  const w = HP.s2w(e.clientX, e.clientY);
  const c = HP.w2c(w);
  return { wx: w.x, wy: w.y, cx: c.x, cy: c.y, sx: e.clientX, sy: e.clientY, e };
}

function updateGhost(p) {
  if (!HP.pending) return;
  const def = HP.pending.def;
  const w = (HP.pending.rot % 2 === 0) ? def.w : def.h;
  const h = (HP.pending.rot % 2 === 0) ? def.h : def.w;
  const x = p.cx - Math.floor(w / 2), y = p.cy - Math.floor(h / 2);
  HP.ghost = { x, y, valid: HP.canPlace(def.id, x, y, HP.pending.rot) };
  HP.markDirty();
}

HP.initInput = function () {
  const cv = HP.canvas;

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('pointerleave', () => { HP.ghost = null; HP.markDirty(); });
  document.addEventListener('keydown', onKey);

  function onDown(e) {
    if (HP.playing) return;                       // walk.js owns input in play mode
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {                       // begin pinch
      const [a, b] = [...pointers.values()];
      pinch = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        zoom0: HP.camera.zoom,
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        cam0: { ...HP.camera }
      };
      HP.tools[HP.tool].cancel(); placing = false;
      return;
    }
    if (e.button === 2) {                            // right click: cancel
      if (HP.pending) HP.cancelPending();
      else { HP.selected = null; HP.refreshContext(); HP.markDirty(); }
      return;
    }
    if (HP.pending) { placing = true; updateGhost(evtPoint(e)); return; }
    HP.tools[HP.tool].down(evtPoint(e));
  }

  function onMove(e) {
    if (HP.playing) return;
    const rec = pointers.get(e.pointerId);
    if (rec) { rec.x = e.clientX; rec.y = e.clientY; }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const r = HP.canvas.getBoundingClientRect();
      // zoom around the pinch midpoint
      const z = Math.max(HP.MIN_ZOOM, Math.min(HP.MAX_ZOOM, pinch.zoom0 * d / pinch.d0));
      const wMid0 = HP.s2wWith(pinch.cam0, pinch.mid0.x, pinch.mid0.y);
      HP.camera.zoom = z;
      HP.camera.x = wMid0.x - (mid.x - r.left - r.width / 2) / z;
      HP.camera.y = wMid0.y - (mid.y - r.top - r.height / 2) / z;
      HP.markDirty();
      if (HP.updateZoomUI) HP.updateZoomUI();
      return;
    }
    const p = evtPoint(e);
    if (HP.pending) { updateGhost(p); HP.trackPointer(p); return; }
    HP.tools[HP.tool].move(p);
    HP.trackPointer(p);
  }

  function onUp(e) {
    if (HP.playing) return;
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    const p = evtPoint(e);
    if (HP.pending) {
      if (placing) {
        updateGhost(p);
        if (HP.ghost && HP.ghost.valid) {
          HP.pushUndo();
          const it = {
            id: HP.nextId++, type: HP.pending.def.id,
            x: HP.ghost.x, y: HP.ghost.y,
            rot: HP.pending.rot, v: HP.pending.v || 0, oid: HP.oid
          };
          HP.cur().furniture.push(it);
          HP.autoConnect(it);                        // modular pieces join what they touch
          HP.selected = it;
          HP.saveState(); HP.status('Placed ' + HP.pending.def.name + ' — tap again for more, or Esc/right-click to stop');
          HP.refreshContext();
        } else if (HP.ghost) {
          HP.status('Can\'t place here — blocked or out of bounds');
        }
        placing = false;
      }
      return;
    }
    HP.tools[HP.tool].up(p);
  }

  function onWheel(e) {
    e.preventDefault();
    const p = HP.s2w(e.clientX, e.clientY);
    const z0 = HP.camera.zoom;
    const z = Math.max(HP.MIN_ZOOM, Math.min(HP.MAX_ZOOM, z0 * (e.deltaY < 0 ? 1.12 : 0.89)));
    HP.camera.zoom = z;
    // keep world point under cursor
    const r = HP.canvas.getBoundingClientRect();
    HP.camera.x = p.x - (e.clientX - r.left - r.width / 2) / z;
    HP.camera.y = p.y - (e.clientY - r.top - r.height / 2) / z;
    HP.markDirty();
    if (HP.updateZoomUI) HP.updateZoomUI();
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? HP.redo() : HP.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); HP.redo(); return; }
    if (HP.playing) { if (k === 'escape') HP.togglePlay(); return; }
    switch (k) {
      case 'r': HP.rotateActive(); break;
      case 'delete': case 'backspace': HP.deleteSelected(); break;
      case 'escape':
        if (HP.pending) HP.cancelPending();
        else { HP.selected = null; HP.selectedRoom = null; HP.measureLine = null; HP.refreshContext(); HP.markDirty(); }
        break;
      case 'v': HP.setTool('select'); break;
      case 'w': HP.setTool('wall'); break;
      case 'd': HP.setTool('door'); break;
      case 'n': HP.setTool('window'); break;
      case 'f': HP.setTool('floor'); break;
      case 'b': HP.setTool('fence'); break;
      case 'e': HP.setTool('furniture'); break;
      case 't': HP.setTool('label'); break;
      case 'm': HP.setTool('measure'); break;
      case 'g': HP.toggleGrid(); break;
    }
  }
};

/* s2w with an explicit camera (for pinch anchor math) */
HP.s2wWith = function (cam, sx, sy) {
  const r = HP.canvas.getBoundingClientRect();
  return {
    x: (sx - r.left - r.width / 2) / cam.zoom + cam.x,
    y: (sy - r.top - r.height / 2) / cam.zoom + cam.y
  };
};

/* status-bar pointer readout */
HP.trackPointer = function (p) {
  if (!p) return;
  const el = document.getElementById('st-cursor');
  if (el) el.textContent = 'Cursor: ' + (p.cx * 0.5).toFixed(1) + 'm, ' + (p.cy * 0.5).toFixed(1) + 'm';
};
})();
