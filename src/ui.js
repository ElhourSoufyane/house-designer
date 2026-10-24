/* ui.js — tool rail, right inspector, top bar, status bar, dialogs.
   Hook names kept from the old context-bar version: HP.refreshContext,
   HP.status, HP.updateUndoButtons (called from tools.js / save.js). */
(function () {
const $ = s => document.querySelector(s);

/* ---------- status bar ---------- */
HP.status = function (m) {
  if (!m || m === HP._status) return;
  HP._status = m;
  const el = $('#st-msg'); if (el) el.textContent = m;
};
HP._status = '';
HP.updateZoomUI = function () {
  const el = $('#zoom-val'); if (el) el.textContent = Math.round(HP.camera.zoom * 100) + '%';
};
HP.updateFloorUI = function () {
  const t = 'Floor ' + (HP.state.level + 1) + '/' + HP.state.levels.length;
  const a = $('#floor-val'), b = $('#st-floor');
  if (a) a.textContent = t; if (b) b.textContent = t;
  const del = $('#floor-del');
  if (del) del.disabled = HP.state.levels.length <= 1;
};
HP.zoomBtn = function (d) {
  const z = Math.max(HP.MIN_ZOOM, Math.min(HP.MAX_ZOOM, HP.camera.zoom * (d > 0 ? 1.25 : 0.8)));
  HP.camera.zoom = z; HP.markDirty(); HP.updateZoomUI();
};
HP.toggleGrid = function () {
  HP.showGrid = !HP.showGrid; HP.invalidateRegions(); HP.saveState();
  const el = $('#st-grid'); if (el) el.textContent = 'Grid: ' + (HP.showGrid ? 'ON' : 'OFF');
};
function markAutosaved() {
  const el = $('#st-save');
  if (el) el.textContent = 'Autosaved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
const _saveState = HP.saveState;
HP.saveState = function () { _saveState(); markAutosaved(); };

/* ---------- mobile inspector drawer ---------- */
function openInspector() { $('#inspector').classList.add('open'); }
function closeInspector() { $('#inspector').classList.remove('open'); }

/* ---------- generic choice dialog ---------- */
function showDialog({ title, desc, buttons }) {
  $('#dialog-title').textContent = title;
  $('#dialog-desc').textContent = desc || '';
  const box = $('#dialog-buttons');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'panel-btn' + (b.cls ? ' ' + b.cls : '');
    el.textContent = b.label;
    el.onclick = () => { $('#dialog-overlay').classList.add('hidden'); if (b.fn) b.fn(); };
    box.appendChild(el);
  }
  $('#dialog-overlay').classList.remove('hidden');
}
HP.showDialog = showDialog;

/* ---------- tool rail ---------- */
const TOOL_HINTS = {
  select: 'Tap a room to edit it, or drag furniture to move it.',
  wall: 'Tap/drag between grid lines to draw walls.',
  door: 'Tap a wall to place a door. Two adjacent doors merge into a double door.',
  window: 'Tap a wall to place a window.',
  fence: 'Pick a fence type, then drag on the plan to draw a fence run of any length.',
  floor: 'Pick a material below, then tap a room to repaint its floor.',
  furniture: 'Pick an item below, then tap the plan to place it.',
  label: 'Tap a room to rename it.',
  measure: 'Drag between two points to measure distance.',
  erase: 'Tap a wall segment or furniture to delete it.',
};
function setTool(t) {
  const insp = $('#inspector');
  if (t === 'settings') {
    if (insp.dataset.sec === 'settings' && insp.classList.contains('open')) { closeInspector(); return; }
    insp.dataset.sec = 'settings'; settingsUI(); openInspector(); return;
  }
  if (t === HP.tool && SEC_FOR[t]) { insp.classList.toggle('open'); return; }   // 2nd tap toggles the panel
  HP.tool = t;
  HP.measureLine = null;
  document.querySelectorAll('#toolrail .tool').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === t));
  HP.status(TOOL_HINTS[t] || 'Ready');
  if (SEC_FOR[t]) openInspector(); else closeInspector();   // drawer only for tools with a panel
  if (t === 'furniture') $('#insp-catalog-sec').scrollIntoView({ block: 'start' });
  HP.markDirty();
  refreshInspector();
}
HP.setTool = setTool;

/* ---------- inspector: top section ---------- */
function btn(label, cls, fn) {
  const b = document.createElement('button');
  b.className = 'ibtn' + (cls ? ' ' + cls : '');
  b.innerHTML = label; b.onclick = fn;
  return b;
}

function placingUI() {
  const top = $('#insp-top'), p = HP.pending;
  top.innerHTML = '';
  $('#edit-title').textContent = 'Placing — ' + (p.def.brand ? p.def.brand + ' ' : '') + p.def.name;
  const s = document.createElement('div');
  s.className = 'insp-section';
  s.innerHTML = `<div class="hint" style="margin-top:0">Tap the floor plan to place it.</div>`;
  const row = document.createElement('div');
  row.appendChild(btn('Rotate', '', () => HP.rotateActive()));
  if (p.def.colors.length > 1) row.appendChild(btn('Style', '', () => HP.cycleVariant()));
  row.appendChild(btn('Cancel', 'danger', () => HP.cancelPending()));
  s.appendChild(row); top.appendChild(s);
}

function itemUI(it) {
  const top = $('#insp-top'), def = HP.itemDef(it.type);
  const members = HP.groupOf(it);
  top.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'insp-section';
  $('#edit-title').textContent = (def.brand ? def.brand + ' ' : '') + def.name + (members.length > 1 ? ' ×' + members.length : '');
  const row = document.createElement('div');
  row.appendChild(btn('Rotate', '', () => HP.rotateActive()));
  if (def.colors.length > 1) row.appendChild(btn('Style', '', () => HP.cycleVariant()));
  row.appendChild(btn('Copy', '', () => HP.duplicateSelected()));
  row.appendChild(btn('Delete', 'danger', () => HP.deleteSelected()));
  s.appendChild(row);
  const row2 = document.createElement('div');
  row2.appendChild(btn('Connect', '', () => HP.connectSelected()));
  if (it.g) row2.appendChild(btn('Disconnect', '', () => HP.disconnectSelected()));
  s.appendChild(row);
  s.appendChild(row2);
  // size steppers (visual footprint, shown in metres)
  const f = HP.footprint(it);
  const sizeF = document.createElement('div');
  sizeF.className = 'field';
  sizeF.innerHTML = `<label>Size — ${(f.w / 2).toFixed(1)}m × ${(f.h / 2).toFixed(1)}m</label>`;
  const sr = document.createElement('div'); sr.className = 'size-row';
  const mkStep = (label, dw, dh) => {
    const sp = document.createElement('span'); sp.className = 'sv'; sp.textContent = label;
    sr.appendChild(sp);
    sr.appendChild(btn('−', '', () => HP.resizeItem(it, dw, dh)));
    sr.appendChild(btn('+', '', () => HP.resizeItem(it, -dw, -dh)));
  };
  mkStep('W', -1, 0);
  mkStep('H', 0, -1);
  const rs = btn('<svg class="ic"><use href="#i-reset"/></svg>', '', () => { const d = HP.itemDef(it.type);
    HP.resizeItem(it, (it.rot % 2 === 0 ? d.w : d.h) - f.w, (it.rot % 2 === 0 ? d.h : d.w) - f.h); });
  rs.title = 'Reset size'; sr.appendChild(rs);
  sizeF.appendChild(sr);
  s.appendChild(sizeF);
  if (def.colors.length > 1) {
    const sw = document.createElement('div'); sw.className = 'swatches';
    def.colors.forEach((c, vi) => {
      const b = document.createElement('button');
      b.className = 'sw' + (vi === (it.v || 0) ? ' active' : '');
      b.style.background = c;
      b.onclick = () => { HP.pushUndo(); for (const m of HP.groupOf(it)) m.v = vi; HP.markDirty(); HP.saveState(); itemUI(it); };
      sw.appendChild(b);
    });
    s.appendChild(sw);
  }
  top.appendChild(s);
}

function roomSegCounts(r) {
  let walls = 0, doors = 0, wins = 0;
  const inR = new Set(r.cells.map(([x, y]) => x + ',' + y));
  const seen = {};
  for (const [x, y] of r.cells) {
    const edges = [['h', x, y], ['h', x, y + 1], ['v', x, y], ['v', x + 1, y]];
    for (const [d, ex, ey] of edges) {
      const k = d + ',' + ex + ',' + ey;
      if (seen[k] || !HP.cur().walls[k]) continue;
      seen[k] = 1; walls++;
      const f = HP.cur().walls[k].f;
      if (f === 'door') doors++; else if (f === 'window') wins++;
    }
  }
  return { walls, doors, wins };
}

function roomUI() {
  const top = $('#insp-top');
  const r = HP.regionAt(HP.selectedRoom.cx, HP.selectedRoom.cy);
  top.innerHTML = '';
  if (!r) { HP.selectedRoom = null; projectUI(); return; }
  const cnt = roomSegCounts(r);
  const s = document.createElement('div');
  s.className = 'insp-section';
  $('#edit-title').textContent = 'Room Properties';
  s.innerHTML = `<div class="field"><label>Room Name</label>
      <input type="text" id="room-name-i" value="${(r.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Bedroom">
      <button class="ibtn primary" id="room-name-apply" style="display:none;margin-top:8px">Apply Name</button></div>
    <div class="field"><label>Flooring — click to apply</label><div class="fam-list" id="room-sw"></div></div>
    <div class="stat-row"><span class="k">Area</span><span class="v accent">${r.m2.toFixed(1)} m²</span></div>
    <div class="stat-row"><span class="k">Wall segments</span><span class="v">${cnt.walls}</span></div>
    <div class="stat-row"><span class="k">Doors</span><span class="v">${cnt.doors}</span></div>
    <div class="stat-row"><span class="k">Windows</span><span class="v">${cnt.wins}</span></div>`;
  top.appendChild(s);

  const sw = $('#room-sw');
  const curFloor = HP.cur().floors[HP.cellKey(r.cells[0][0], r.cells[0][1])];
  floorSwatches(sw, curFloor, id => {         // floor applies instantly
    HP.pushUndo();
    for (const [x, y] of r.cells) HP.cur().floors[HP.cellKey(x, y)] = id;
    HP.invalidateRegions(); HP.saveState();
  });

  const nameI = $('#room-name-i'), applyB = $('#room-name-apply');
  const origName = r.name || '';
  nameI.addEventListener('input', () => {
    applyB.style.display = nameI.value.trim() !== origName ? 'inline-block' : 'none';
  });
  applyB.onclick = () => {
    HP.pushUndo();
    const name = nameI.value.trim();
    for (const [x, y] of r.cells) {
      const k = HP.cellKey(x, y);
      if (name) HP.cur().roomNames[k] = name; else delete HP.cur().roomNames[k];
    }
    HP.invalidateRegions(); HP.saveState(); HP.status('Room renamed');
    applyB.style.display = 'none';
  };

  const del = document.createElement('button');
  del.className = 'btn-danger'; del.textContent = 'Delete Room';
  del.onclick = () => HP.askDeleteRoom(r);
  s.appendChild(del);
}

/* delete-room: user picks the kind of deletion */
HP.askDeleteRoom = function (r) {
  showDialog({
    title: 'Delete Room',
    desc: `"${r.name || 'This room'}" (${r.m2.toFixed(1)} m²) — choose what to delete:`,
    buttons: [
      { label: 'Clear flooring & name only', cls: 'primary', fn: () => HP.deleteRoom(r, 'clear') },
      { label: 'Merge into neighbours (remove partition walls)', fn: () => HP.deleteRoom(r, 'merge') },
      { label: 'Cancel', fn: null },
    ],
  });
};
HP.deleteRoom = function (r, mode) {
  HP.pushUndo();
  if (mode === 'clear') {
    for (const [x, y] of r.cells) {
      const k = HP.cellKey(x, y);
      delete HP.cur().floors[k]; delete HP.cur().roomNames[k];
    }
  } else {
    const inR = new Set(r.cells.map(([x, y]) => x + ',' + y));
    for (const [x, y] of r.cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (inR.has(nx + ',' + ny)) continue;
        if (!HP.regionAt(nx, ny)) continue;          // outside → keep exterior wall
        const k = dx !== 0 ? HP.wallKey('v', Math.max(x, nx), y)
                           : HP.wallKey('h', x, Math.max(y, ny));
        delete HP.cur().walls[k];
      }
    }
  }
  HP.selectedRoom = null;
  HP.invalidateRegions(); HP.saveState(); refreshInspector();
};

/* settings panel (gear tool) */
function settingsUI() {
  const top = $('#settings-panel');
  top.innerHTML = '';
  const s = document.createElement('div');
  s.innerHTML = `<div class="field"><label>Background colour</label><div class="swatches" id="bg-sw"></div></div>`;
  top.appendChild(s);

  const sw = $('#bg-sw');
  ['#aebfa0', '#8fb573', '#6f9e4e', '#4f7f39', '#c9bd8f', '#e8ecf1', '#333a45', '#20242a'].forEach(col => {
    const c = document.createElement('button');
    c.className = 'sw' + (HP.state.bg === col ? ' active' : '');
    c.style.background = col;
    c.onclick = () => { HP.state.bg = col; HP.invalidateRegions(); HP.saveState(); settingsUI(); };
    sw.appendChild(c);
  });
  const bgI = document.createElement('input');
  bgI.type = 'color';
  bgI.value = /^#/.test(HP.state.bg || '') ? HP.state.bg : '#aebfa0';
  bgI.style.cssText = 'width:34px;height:34px;border:2px solid var(--border);border-radius:7px;background:none;padding:0;cursor:pointer';
  bgI.oninput = () => { HP.state.bg = bgI.value; HP.invalidateRegions(); };
  bgI.onchange = () => { HP.saveState(); settingsUI(); };
  sw.appendChild(bgI);

  const mkTog = (label, on, fn) => {
    const f = document.createElement('div'); f.className = 'field';
    f.innerHTML = `<label>${label}</label>`;
    const b = btn(on ? 'ON' : 'OFF', on ? 'primary' : '', () => { fn(); settingsUI(); });
    f.appendChild(b); s.appendChild(f);
  };
  mkTog('Grid lines', HP.showGrid, () => { HP.showGrid = !HP.showGrid; HP.invalidateRegions(); HP.saveState(); });
  mkTog('Photo floor textures', HP.state.photoFloors !== false,
    () => {
      HP.state.photoFloors = !(HP.state.photoFloors !== false);
      HP.invalidateRegions(); HP.saveState(); settingsUI();
    });
  if (HP.state.level > 0)
    mkTog('Ghost of floor below', HP.showUnderlay !== false,
      () => { HP.showUnderlay = HP.showUnderlay === false; HP.invalidateRegions(); HP.saveState(); });

  if (HP.state.levels.length > 1) {
    const d = document.createElement('button');
    d.className = 'btn-danger'; d.textContent = 'Delete Floor ' + (HP.state.level + 1);
    d.onclick = () => showDialog({
      title: 'Delete Floor ' + (HP.state.level + 1) + '?',
      desc: 'All walls, flooring and furniture on this floor will be removed.',
      buttons: [
        { label: 'Delete floor', cls: 'danger', fn: () => { HP.removeLevel(); refreshInspector(); } },
        { label: 'Cancel', fn: null },
      ],
    });
    s.appendChild(d);
  }

  const v = document.createElement('div');
  v.className = 'hint';
  v.style.marginTop = '14px';
  v.textContent = 'Build ' + (HP.VERSION || '?') + ' — house-designer on GitHub Pages';
  s.appendChild(v);
}

/* grouped floor swatches — one block per family, colourways under it */
function floorSwatches(wrap, activeId, onPick) {
  if (wrap._io) { wrap._io.disconnect(); wrap._io = null; }
  wrap.innerHTML = '';
  for (const base of HP.FLOOR_MATS) {
    if (base.fam || base.grp) continue;                       // variants render under their family
    const fam = [base, ...HP.FLOOR_MATS.filter(m => (m.grp || m.fam) === base.id)];
    const h = document.createElement('div');
    h.className = 'fam-h'; h.textContent = base.name;
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.className = 'swatches fam-row';
    wrap.appendChild(row);
    for (const m of fam) {
      const c = document.createElement('button');
      c.className = 'sw' + (m.id === activeId ? ' active' : '');
      const i = document.createElement('i'); i.textContent = m.name; c.appendChild(i);
      c.onclick = () => {
        onPick(m.id);
        wrap.querySelectorAll('.sw').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
      };
      row.appendChild(c);
      lazyThumb(wrap, c, m.id, id => HP.floorPreview(id, 52, 52));
    }
  }
}

/* floor-tool material picker */
function floorUI() {
  const top = $('#floor-panel');
  top.innerHTML = '';
  const s = document.createElement('div');
  s.innerHTML = `<div class="seg" id="floor-style">
      <button class="seg-btn" data-v="1">Photo</button>
      <button class="seg-btn" data-v="0">Drawn</button>
    </div>
    <div class="seg" id="floor-mode">
      <button class="seg-btn" data-v="0">Room</button>
      <button class="seg-btn" data-v="1">Path</button>
    </div>
    <div class="field"><label>Material</label><div class="fam-list" id="mat-sw"></div></div>
    <div class="field"><label>Also name the room (optional)</label>
      <input type="text" id="mat-name" value="" placeholder="leave empty to keep name"></div>
    <div class="hint">Then tap a room on the plan.</div>`;
  top.appendChild(s);
  const seg = $('#floor-style');
  const mark = () => seg.querySelectorAll('.seg-btn').forEach(b =>
    b.classList.toggle('on', (b.dataset.v === '1') === (HP.state.photoFloors !== false)));
  seg.querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
    HP.state.photoFloors = b.dataset.v === '1';
    HP.invalidateRegions(); HP.saveState();
    mark(); floorSwatches($('#mat-sw'), HP.floorMat, id => { HP.floorMat = id; });  // repaint swatches
  });
  mark();
  const mseg = $('#floor-mode');
  const mmark = () => mseg.querySelectorAll('.seg-btn').forEach(b =>
    b.classList.toggle('on', (b.dataset.v === '1') === !!HP.floorBrush));
  mseg.querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
    HP.floorBrush = b.dataset.v === '1'; mmark();
    HP.status(HP.floorBrush
      ? 'Path brush: drag anywhere to paint a walkway — inside or outside'
      : 'Room paint: tap a room to repaint its floor');
  });
  mmark();
  const sw = $('#mat-sw');
  floorSwatches(sw, HP.floorMat, id => { HP.floorMat = id; });
  const nameEl = $('#mat-name');
  nameEl.value = HP.floorName || '';
  nameEl.oninput = e => { HP.floorName = e.target.value.trim(); };
}

/* fence-tool type picker — fences are drawn like walls: drag a run of any length */
function fenceUI() {
  const top = $('#fence-panel');
  top.innerHTML = '';
  const s = document.createElement('div');
  s.innerHTML = `<div class="field"><label>Fence type</label><div class="swatches" id="fence-sw"></div></div>
    <div class="hint">Drag on the plan to draw a fence — any length, along grid lines.<br>
    Gates are openings you can walk through. Delete tool removes fence segments.</div>`;
  top.appendChild(s);
  const sw = $('#fence-sw');
  for (const id in HP.FENCE_TYPES) {
    const f = HP.FENCE_TYPES[id];
    const b = document.createElement('button');
    b.className = 'sw fence-sw' + (HP.fenceType === id ? ' active' : '');
    b.title = f.name;
    const nm = document.createElement('i');
    nm.textContent = f.name;
    b.appendChild(nm);
    b.onclick = () => {
      HP.fenceType = id;
      sw.querySelectorAll('.sw').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
    sw.appendChild(b);
    lazyThumb(sw, b, id, fid => {
      const cv = document.createElement('canvas');
      cv.width = 108; cv.height = 66;
      const g = cv.getContext('2d');
      const fd = HP.FENCE_TYPES[fid];
      g.translate(6, 40); g.scale(3.4, 3.4);            // draw a 1-cell sample run
      HP.drawFenceSeg(g, { d: 'h', x: 0, y: 0 }, { t: fid, c: fd.c, post: fd.post });
      return cv;
    });
  }
}

function projectStats() {
  const el = $('#insp-project'); if (!el) return;
  const m2 = HP.M2_PER_CELL;
  let area = 0, rooms = 0, pieces = 0;
  for (const lvl of HP.state.levels) {
    area += Object.keys(lvl.floors).length * m2;
    rooms += new Set(Object.values(lvl.roomNames)).size;
    pieces += lvl.furniture.length;
  }
  el.innerHTML = `
    <div class="stat-row"><span class="k">Floors</span><span class="v">${HP.state.levels.length}</span></div>
    <div class="stat-row"><span class="k">Total area</span><span class="v accent">${area.toFixed(1)} m²</span></div>
    <div class="stat-row"><span class="k">Named rooms</span><span class="v">${rooms}</span></div>
    <div class="stat-row"><span class="k">Furniture pieces</span><span class="v">${pieces}</span></div>`;
}
HP.projectStats = projectStats;

/* sidebar shows only the active tool's section; selection edits float on the canvas */
const SEC_FOR = { floor: 'floor', furniture: 'furniture', fence: 'fence' };
function refreshInspector(force) {
  const insp = $('#inspector');
  if (force === 'settings') { insp.dataset.sec = 'settings'; settingsUI(); }
  else insp.dataset.sec = SEC_FOR[HP.tool] ||            // keep Settings visible
    (insp.dataset.sec === 'settings' ? 'settings' : 'generic');   // while it's open
  const h = $('#tool-hint'); if (h) h.textContent = TOOL_HINTS[HP.tool] || '';
  const top = $('#insp-top');
  top.innerHTML = '';
  if (HP.pending) placingUI();
  else if (HP.selected) itemUI(HP.selected);
  else if (HP.selectedRoom) roomUI();
  $('#edit-panel').classList.toggle('hidden', !top.firstChild);
  if (insp.dataset.sec === 'floor') floorUI();
  if (insp.dataset.sec === 'fence') fenceUI();
  projectStats();
}
HP.refreshContext = refreshInspector;
HP.refreshInspector = refreshInspector;

/* ---------- lazy previews ----------
   Mobile browsers blank canvas elements inside scroll/transformed panels.
   Render previews to <img> only when a tile scrolls into view — fewer live
   canvases (iOS/Android purge canvas memory) and images always composite. */
function lazyThumb(listWrap, el, id, make) {
  const paint = () => {
    try {
      const img = document.createElement('img');
      img.draggable = false; img.alt = '';
      img.src = make(id).toDataURL();
      el.prepend(img);
    } catch (e) { /* leave the tile empty rather than breaking the list */ }
  };
  if (!('IntersectionObserver' in window)) { paint(); return; }
  if (!listWrap._io) listWrap._io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      listWrap._io.unobserve(en.target);
      en.target._paint && en.target._paint();
    }
  }, { rootMargin: '300px' });
  el._paint = paint;
  listWrap._io.observe(el);
}

/* ---------- catalog ---------- */
function buildCatalog(filter) {
  const wrap = $('#catalog-items');
  if (wrap._io) { wrap._io.disconnect(); wrap._io = null; }
  wrap.innerHTML = '';
  const q = (filter || '').trim().toLowerCase();
  const cats = [], byCat = {};
  for (const def of HP.CATALOG) {
    if (q && !def.name.toLowerCase().includes(q) && !def.cat.toLowerCase().includes(q)
        && !(def.brand || '').toLowerCase().includes(q)) continue;
    if (!byCat[def.cat]) { byCat[def.cat] = []; cats.push(def.cat); }
    byCat[def.cat].push(def);
  }
  for (const cat of cats) {
    const h = document.createElement('div');
    h.className = 'cat-title'; h.textContent = cat;
    wrap.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'cat-grid';
    wrap.appendChild(grid);
    for (const def of byCat[cat]) {
      const d = document.createElement('button');
      d.className = 'cat-item';
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = def.name;
      d.appendChild(nm);
      if (def.brand) {
        const br = document.createElement('div'); br.className = 'br'; br.textContent = def.brand;
        d.appendChild(br);
      }
      d.onclick = () => {
        HP.selectedRoom = null; HP.selected = null;
        HP.pending = { def, rot: 0, v: 0 };
        HP.ghost = null;
        HP.setTool('furniture');
        closeInspector();
        HP.status('Placing ' + def.name + ' — tap the plan');
        refreshInspector();
        HP.markDirty();
      };
      grid.appendChild(d);
      lazyThumb(wrap, d, def.id, id => HP.itemPreview(id, 112, 80));
    }
  }
}

/* ---------- preset picker ---------- */
function presetCard(p) {
  const d = document.createElement('button');
  d.className = 'preset-card';
  const cv = document.createElement('canvas');
  cv.width = 240; cv.height = 168;
  HP.presetPreview(cv, p.build());
  d.appendChild(cv);
  const tx = document.createElement('div');
  tx.innerHTML = `<div class="pc-name">${p.name}</div><div class="pc-desc">${p.desc}</div>`;
  d.appendChild(tx);
  d.onclick = () => {
    HP.loadPreset(p.id);
    HP.updateFloorUI();
    $('#preset-overlay').classList.add('hidden');
  };
  return d;
}

/* ---------- wiring ---------- */
HP.initUI = function () {
  buildCatalog();
  $('#cat-search').addEventListener('input', e => buildCatalog(e.target.value));

  document.querySelectorAll('#toolrail .tool').forEach(b => {
    b.onclick = () => setTool(b.dataset.tool);
  });

  $('#btn-new').onclick = () => {
    const l = $('#preset-list');
    l.innerHTML = '';
    HP.PRESETS.forEach(p => l.appendChild(presetCard(p)));
    $('#preset-overlay').classList.remove('hidden');
  };
  $('#preset-cancel').onclick = () => $('#preset-overlay').classList.add('hidden');
  $('#preset-overlay').onclick = e => { if (e.target.id === 'preset-overlay') e.target.classList.add('hidden'); };
  $('#dialog-overlay').onclick = e => { if (e.target.id === 'dialog-overlay') e.target.classList.add('hidden'); };

  $('#btn-undo').onclick = () => HP.undo();
  $('#btn-redo').onclick = () => HP.redo();
  $('#btn-export').onclick = () => HP.exportPNG();
  $('#btn-coop').onclick = () => HP.coop && HP.coop.show();
  $('#coop-x').onclick = () => HP.coop && HP.coop.hide();

  $('#btn-zoomin').onclick = () => HP.zoomBtn(1);
  $('#btn-zoomout').onclick = () => HP.zoomBtn(-1);
  $('#floor-up').onclick = () => HP.setLevel(HP.state.level + 1);
  $('#floor-down').onclick = () => HP.setLevel(HP.state.level - 1);
  $('#floor-add').onclick = () => HP.addLevel();
  $('#floor-del').onclick = () => {
    if (HP.state.levels.length <= 1) return;
    showDialog({
      title: 'Delete Floor ' + (HP.state.level + 1) + '?',
      desc: 'All walls, flooring and furniture on this floor will be removed.',
      buttons: [
        { label: 'Delete floor', cls: 'danger', fn: () => { HP.removeLevel(); refreshInspector(); } },
        { label: 'Cancel', fn: null },
      ],
    });
  };

  $('#btn-play').onclick = () => HP.togglePlay();
  $('#catalog-fab').onclick = () => $('#inspector').classList.toggle('open');
  $('#insp-grabber').onclick = () => closeInspector();

  /* floating edit panel: close button + drag by header */
  $('#edit-close').onclick = () => {
    if (HP.pending) HP.cancelPending();
    else { HP.selected = null; HP.selectedRoom = null; HP.markDirty(); }
    refreshInspector();
  };
  const ep = $('#edit-panel'), eh = $('#edit-head');
  let epd = null;
  eh.addEventListener('pointerdown', e => {
    if (e.target.closest('#edit-close')) return;
    const r = ep.getBoundingClientRect(), w = ep.parentElement.getBoundingClientRect();
    epd = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: w.width, h: w.height };
    eh.setPointerCapture(e.pointerId);
  });
  eh.addEventListener('pointermove', e => {
    if (!epd) return;
    const x = Math.max(0, Math.min(e.clientX - epd.dx, epd.w - ep.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - epd.dy, epd.h - ep.offsetHeight));
    ep.style.left = x + 'px'; ep.style.top = y + 'px'; ep.style.right = 'auto';
  });
  eh.addEventListener('pointerup', () => { epd = null; });

  HP.updateFloorUI();
  HP.updateZoomUI();
  HP.updateUndoButtons();
  refreshInspector();
  markAutosaved();
};
})();
