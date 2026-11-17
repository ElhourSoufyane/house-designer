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
HP.defaultDoorSwing = HP.defaultDoorSwing || 'in';
HP.defaultWindowSwing = HP.defaultWindowSwing || 'in';
const TOOL_HINTS = {
  select: 'Select furniture or tap any door/window to change opening inside / outside. Tap a room to edit properties.',
  wall: 'Draw walls between grid lines, or switch to Paint Room / Paint Wall to colour them.',
  door: 'Tap a wall to place a door (Inside / Outside). Tap an existing door to flip its swing.',
  window: 'Tap a wall to place a window (Inside / Outside). Tap an existing window to flip its swing.',
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
  s.appendChild(row2);
  if ((it.type === 'greenhouse' || it.type === 'treehouse') && !HP.editingInterior) {
    const editRow = document.createElement('div');
    editRow.style.marginTop = '8px';
    const isGH = it.type === 'greenhouse';
    const b = btn(isGH ? '🌿 Edit Greenhouse Interior' : '🏡 Edit Cabin Interior', 'primary', () => HP.enterInterior(it));
    b.style.width = '100%';
    b.style.fontWeight = '700';
    b.style.padding = '8px 10px';
    b.style.justifyContent = 'center';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.gap = '6px';
    editRow.appendChild(b);
    s.appendChild(editRow);
  }
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
  let curWallStyle = 'plaster';
  for (const [x, y] of r.cells) {
    const k1 = HP.wallKey('h', x, y), k2 = HP.wallKey('h', x, y + 1);
    const k3 = HP.wallKey('v', x, y), k4 = HP.wallKey('v', x + 1, y);
    const w = HP.cur().walls[k1] || HP.cur().walls[k2] || HP.cur().walls[k3] || HP.cur().walls[k4];
    if (w && w.style) { curWallStyle = w.style; break; }
  }
  s.innerHTML = `<div class="field"><label>Room Name</label>
      <input type="text" id="room-name-i" value="${(r.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Bedroom">
      <button class="ibtn primary" id="room-name-apply" style="display:none;margin-top:8px">Apply Name</button></div>
    <div class="field"><label>Flooring — click to apply</label><div class="fam-list" id="room-sw"></div></div>
    <div class="field"><label>Wall Style / Material</label>
      <div class="seg wrap" id="room-wall-style-seg">
        <button class="seg-btn ${curWallStyle === 'plaster' ? 'on' : ''}" data-style="plaster">Plaster</button>
        <button class="seg-btn ${curWallStyle === 'brick' ? 'on' : ''}" data-style="brick">Brick</button>
        <button class="seg-btn ${curWallStyle === 'stone' ? 'on' : ''}" data-style="stone">Stone</button>
        <button class="seg-btn ${curWallStyle === 'wood' ? 'on' : ''}" data-style="wood">Wood</button>
        <button class="seg-btn ${curWallStyle === 'tile' ? 'on' : ''}" data-style="tile">Tile</button>
        <button class="seg-btn ${curWallStyle === 'glass' ? 'on' : ''}" data-style="glass">Glass</button>
      </div>
    </div>
    <div class="field"><label>Wall Paint — click to apply</label><div class="swatches" id="room-wall-sw"></div></div>
    <div class="stat-row"><span class="k">Area</span><span class="v accent">${r.m2.toFixed(1)} m²</span></div>
    <div class="stat-row"><span class="k">Wall segments</span><span class="v">${cnt.walls}</span></div>
    <div class="stat-row"><span class="k">Doors</span><span class="v">${cnt.doors}</span></div>
    <div class="stat-row"><span class="k">Windows</span><span class="v">${cnt.wins}</span></div>`;
  top.appendChild(s);

  const roomStyleSeg = $('#room-wall-style-seg');
  if (roomStyleSeg) {
    roomStyleSeg.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => {
        HP.pushUndo();
        const st = b.dataset.style;
        HP.setRoomWallStyle(r, st);
        HP.invalidateRegions(); HP.saveState(); HP.markDirty();
        roomUI();
        HP.status('Room walls set to ' + st);
      };
    });
  }

  const sw = $('#room-sw');
  const curFloor = HP.cur().floors[HP.cellKey(r.cells[0][0], r.cells[0][1])];
  floorSwatches(sw, curFloor, id => {         // floor applies instantly
    HP.pushUndo();
    for (const [x, y] of r.cells) HP.cur().floors[HP.cellKey(x, y)] = id;
    if (HP.invalidateFloors) HP.invalidateFloors(); else HP.invalidateRegions();
    HP.saveState();
    if (HP.in3D && HP.world3d && HP.world3d.updateFloors) {
      HP.world3d.updateFloors();
    }
  });
  wallSwatches($('#room-wall-sw'), HP.roomWallColor(r), col => {
    HP.pushUndo();
    HP.paintRoomWalls(r, col);
    HP.invalidateRegions(); HP.saveState();
    HP.status(col ? 'Room walls painted' : 'Room walls reset to default');
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
  if (mode === 'clear' && HP.invalidateFloors) HP.invalidateFloors();
  else HP.invalidateRegions();
  HP.saveState(); refreshInspector();
  if (HP.in3D && HP.world3d && HP.world3d.updateFloors) {
    HP.world3d.updateFloors();
  }
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

/* wall paint swatches + custom colour picker */
function wallSwatches(wrap, activeCol, onPick) {
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const p of (HP.WALL_PAINTS || [])) {
    const b = document.createElement('button');
    b.className = 'sw' + ((activeCol || '') === p.id ? ' active' : '');
    b.style.background = p.col;
    b.title = p.name;
    const nm = document.createElement('i'); nm.textContent = p.name; b.appendChild(nm);
    b.onclick = () => {
      onPick(p.id);
      wrap.querySelectorAll('.sw').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
    wrap.appendChild(b);
  }
  const ci = document.createElement('input');
  ci.type = 'color';
  ci.title = 'Custom wall colour';
  ci.value = /^#[0-9a-f]{6}$/i.test(activeCol || '') ? activeCol : '#d6dfd4';
  ci.style.cssText = 'width:34px;height:34px;border:2px solid var(--border);border-radius:7px;background:none;padding:0;cursor:pointer';
  ci.oninput = () => {
    wrap.querySelectorAll('.sw').forEach(x => x.classList.remove('active'));
    onPick(ci.value);
  };
  wrap.appendChild(ci);
}

/* Wall and Door style definitions with rich visual preview cards */
const WALL_MATERIAL_DEFS = {
  plaster: {
    name: 'Plaster',
    desc: 'Smooth painted architectural plaster',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#f5f0e6"/><circle cx="20" cy="15" r="1.2" fill="#e2dcd2"/><circle cx="55" cy="28" r="1.5" fill="#e2dcd2"/><circle cx="68" cy="10" r="1.2" fill="#e2dcd2"/><circle cx="35" cy="30" r="1.2" fill="#e2dcd2"/></svg>`
  },
  brick: {
    name: 'Brick',
    desc: 'Kiln-fired running bond clay brick',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#c5beaf"/><rect x="2" y="2" width="22" height="7" rx="1.5" fill="#833223"/><rect x="28" y="2" width="22" height="7" rx="1.5" fill="#973e2d"/><rect x="54" y="2" width="24" height="7" rx="1.5" fill="#782a1d"/><rect x="0" y="11" width="13" height="7" rx="1.5" fill="#883424"/><rect x="17" y="11" width="22" height="7" rx="1.5" fill="#51190f"/><rect x="43" y="11" width="22" height="7" rx="1.5" fill="#a04533"/><rect x="69" y="11" width="11" height="7" rx="1.5" fill="#833223"/><rect x="2" y="20" width="22" height="7" rx="1.5" fill="#933b2b"/><rect x="28" y="20" width="22" height="7" rx="1.5" fill="#592116"/><rect x="54" y="20" width="24" height="7" rx="1.5" fill="#8d3727"/><rect x="0" y="29" width="13" height="7" rx="1.5" fill="#a8523e"/><rect x="17" y="29" width="22" height="7" rx="1.5" fill="#833223"/><rect x="43" y="29" width="22" height="7" rx="1.5" fill="#702519"/><rect x="69" y="29" width="11" height="7" rx="1.5" fill="#883424"/></svg>`
  },
  stone: {
    name: 'Stone',
    desc: 'Stacked ashlar limestone & slate',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#2d2822"/><rect x="2" y="2" width="34" height="9" rx="1.5" fill="#8d867a"/><rect x="40" y="2" width="38" height="9" rx="1.5" fill="#77736b"/><rect x="2" y="14" width="22" height="10" rx="1.5" fill="#a3998a"/><rect x="27" y="14" width="30" height="10" rx="1.5" fill="#68655e"/><rect x="60" y="14" width="18" height="10" rx="1.5" fill="#9b9284"/><rect x="2" y="27" width="45" height="11" rx="1.5" fill="#77736b"/><rect x="50" y="27" width="28" height="11" rx="1.5" fill="#8d867a"/></svg>`
  },
  wood: {
    name: 'Wood',
    desc: 'Vertical timber slat cladding',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#2a1a0c"/><rect x="0" y="0" width="18" height="40" fill="#b7956f"/><line x1="9" y1="0" x2="9" y2="40" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="20" y="0" width="18" height="40" fill="#c19f79"/><line x1="29" y1="0" x2="29" y2="40" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="40" y="0" width="18" height="40" fill="#ab8a64"/><line x1="49" y1="0" x2="49" y2="40" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="60" y="0" width="20" height="40" fill="#bd9c75"/><line x1="70" y1="0" x2="70" y2="40" stroke="rgba(0,0,0,0.15)" stroke-width="1"/></svg>`
  },
  tile: {
    name: 'Tile',
    desc: 'Glossy ceramic subway tiles',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#b6b0a4"/><rect x="2" y="2" width="23" height="16" fill="#f4efe6"/><rect x="28" y="2" width="23" height="16" fill="#f4efe6"/><rect x="54" y="2" width="24" height="16" fill="#f4efe6"/><rect x="2" y="21" width="23" height="17" fill="#f4efe6"/><rect x="28" y="21" width="23" height="17" fill="#f4efe6"/><rect x="54" y="21" width="24" height="17" fill="#f4efe6"/></svg>`
  },
  glass: {
    name: 'Glass',
    desc: 'Architectural curtain partition',
    svg: `<svg width="100%" height="100%" viewBox="0 0 80 40"><rect width="80" height="40" fill="#1e2023"/><rect x="2" y="3" width="76" height="34" fill="#cde5eb" fill-opacity="0.55"/><polygon points="20,3 32,3 12,37 0,37" fill="#ffffff" fill-opacity="0.35"/><line x1="40" y1="0" x2="40" y2="40" stroke="#1e2023" stroke-width="2"/></svg>`
  }
};

const DOOR_STYLE_DEFS = {
  panel: {
    name: 'Classic',
    desc: '4-panel stile & rail with brass lever',
    svg: `<svg width="100%" height="100%" viewBox="0 0 60 40"><rect x="18" y="2" width="24" height="36" rx="1.5" fill="#f2ece2" stroke="#4a3e35" stroke-width="1.2"/><rect x="21" y="5" width="8" height="12" rx="1" fill="#ded7ca" stroke="#b0a89a" stroke-width="0.8"/><rect x="31" y="5" width="8" height="12" rx="1" fill="#ded7ca" stroke="#b0a89a" stroke-width="0.8"/><rect x="21" y="20" width="8" height="15" rx="1" fill="#ded7ca" stroke="#b0a89a" stroke-width="0.8"/><rect x="31" y="20" width="8" height="15" rx="1" fill="#ded7ca" stroke="#b0a89a" stroke-width="0.8"/><circle cx="39" cy="20" r="1.4" fill="#c89d46"/><line x1="39" y1="20" x2="35" y2="20" stroke="#c89d46" stroke-width="1.2"/></svg>`
  },
  slide: {
    name: 'Sliding Barn',
    desc: 'Timber slab with Z-brace & track rollers',
    svg: `<svg width="100%" height="100%" viewBox="0 0 60 40"><line x1="4" y1="4" x2="56" y2="4" stroke="#1a1b1d" stroke-width="2.5"/><circle cx="24" cy="4" r="2.2" fill="#1a1b1d"/><circle cx="44" cy="4" r="2.2" fill="#1a1b1d"/><rect x="16" y="7" width="34" height="31" rx="1" fill="#6a4c33" stroke="#422e1e" stroke-width="1"/><line x1="16" y1="22" x2="50" y2="22" stroke="#583e29" stroke-width="2"/><line x1="16" y1="7" x2="50" y2="22" stroke="#583e29" stroke-width="1.8"/><line x1="50" y1="22" x2="16" y2="38" stroke="#583e29" stroke-width="1.8"/><rect x="44" y="20" width="2" height="6" rx="0.5" fill="#1a1b1d"/></svg>`
  },
  glass: {
    name: 'Glass French',
    desc: 'Dark bronze frame & 8 divided lites',
    svg: `<svg width="100%" height="100%" viewBox="0 0 60 40"><rect x="18" y="2" width="24" height="36" rx="1.5" fill="#1f2124"/><rect x="21" y="5" width="18" height="30" fill="#bfe3ea" fill-opacity="0.6"/><line x1="30" y1="5" x2="30" y2="35" stroke="#1f2124" stroke-width="1.2"/><line x1="21" y1="13" x2="39" y2="13" stroke="#1f2124" stroke-width="1"/><line x1="21" y1="21" x2="39" y2="21" stroke="#1f2124" stroke-width="1"/><line x1="21" y1="29" x2="39" y2="29" stroke="#1f2124" stroke-width="1"/><circle cx="38" cy="21" r="1.2" fill="#1a1c1e"/></svg>`
  },
  modern: {
    name: 'Modern',
    desc: 'Flush walnut slab with metallic inlays',
    svg: `<svg width="100%" height="100%" viewBox="0 0 60 40"><rect x="18" y="2" width="24" height="36" rx="1.5" fill="#2d2e32" stroke="#1c1d1f" stroke-width="1.2"/><line x1="20" y1="10" x2="40" y2="10" stroke="#dce0e5" stroke-width="1"/><line x1="20" y1="17" x2="40" y2="17" stroke="#dce0e5" stroke-width="1"/><line x1="20" y1="24" x2="40" y2="24" stroke="#dce0e5" stroke-width="1"/><line x1="20" y1="31" x2="40" y2="31" stroke="#dce0e5" stroke-width="1"/><line x1="38" y1="14" x2="38" y2="28" stroke="#dce0e5" stroke-width="1.8"/></svg>`
  },
  slideglass: {
    name: 'Slide Glass',
    desc: 'Aluminum patio slider with clear glass',
    svg: `<svg width="100%" height="100%" viewBox="0 0 60 40"><rect x="10" y="3" width="40" height="34" fill="#282b30" stroke="#1c1d1f" stroke-width="1"/><rect x="13" y="6" width="16" height="28" fill="#bfe3ea" fill-opacity="0.6"/><rect x="31" y="6" width="16" height="28" fill="#bfe3ea" fill-opacity="0.6"/><line x1="29" y1="3" x2="29" y2="37" stroke="#282b30" stroke-width="2"/><line x1="27" y1="15" x2="27" y2="25" stroke="#d0d3d8" stroke-width="1.4"/></svg>`
  }
};

function renderWallStylePicker(container, curStyle, onSelect) {
  let html = '<div class="style-grid">';
  for (const k in WALL_MATERIAL_DEFS) {
    const def = WALL_MATERIAL_DEFS[k];
    const on = k === curStyle ? 'on' : '';
    html += `
      <div class="style-card ${on}" data-style="${k}">
        <div class="style-thumb">${def.svg}</div>
        <div class="style-name">${def.name}</div>
        <div class="style-desc">${def.desc}</div>
      </div>
    `;
  }
  html += '</div>';
  const curDef = WALL_MATERIAL_DEFS[curStyle] || WALL_MATERIAL_DEFS.plaster;
  html += `
    <div class="style-live-preview">
      <div class="style-live-thumb">${curDef.svg}</div>
      <div class="style-live-info">
        <b>${curDef.name} Material</b>
        <span>${curDef.desc}</span>
      </div>
    </div>
  `;
  container.innerHTML = html;
  container.querySelectorAll('.style-card').forEach(c => {
    c.onclick = () => onSelect(c.dataset.style);
  });
}

function renderDoorStylePicker(container, curStyle, onSelect) {
  let html = '<div class="style-grid">';
  for (const k in DOOR_STYLE_DEFS) {
    const def = DOOR_STYLE_DEFS[k];
    const on = k === curStyle ? 'on' : '';
    html += `
      <div class="style-card ${on}" data-style="${k}">
        <div class="style-thumb">${def.svg}</div>
        <div class="style-name">${def.name}</div>
        <div class="style-desc">${def.desc}</div>
      </div>
    `;
  }
  html += '</div>';
  const curDef = DOOR_STYLE_DEFS[curStyle] || DOOR_STYLE_DEFS.panel;
  html += `
    <div class="style-live-preview">
      <div class="style-live-thumb">${curDef.svg}</div>
      <div class="style-live-info">
        <b>${curDef.name} Door</b>
        <span>${curDef.desc}</span>
      </div>
    </div>
  `;
  container.innerHTML = html;
  container.querySelectorAll('.style-card').forEach(c => {
    c.onclick = () => onSelect(c.dataset.style);
  });
}

/* wall-tool mode & paint picker */
function wallUI() {
  const top = $('#wall-panel'); if (!top) return;
  top.innerHTML = '';
  const s = document.createElement('div');
  s.innerHTML = `<div class="seg" id="wall-mode">
      <button class="seg-btn" data-m="draw">Draw</button>
      <button class="seg-btn" data-m="room">Paint Room</button>
      <button class="seg-btn" data-m="wall">Paint Wall</button>
    </div>
    <div class="field"><label>Default Wall Material / Style</label>
      <div id="wall-style-picker-wrap"></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Wall Paint Colour</label><div class="swatches" id="wall-sw"></div></div>
    <div class="hint" id="wall-mode-hint"></div>`;
  top.appendChild(s);
  const pWrap = $('#wall-style-picker-wrap');
  if (pWrap) {
    const onPickWallStyle = st => {
      HP.wallStyle = st;
      renderWallStylePicker(pWrap, st, onPickWallStyle);
      HP.status('Default wall style set to: ' + st);
    };
    renderWallStylePicker(pWrap, HP.wallStyle || 'plaster', onPickWallStyle);
  }
  const mseg = $('#wall-mode'), mhint = $('#wall-mode-hint');
  const HINTS = {
    draw: 'Drag between grid intersections to build walls. Pick a colour below to pre-paint new walls.',
    room: 'Tap inside any enclosed room to paint all of its interior walls at once.',
    wall: 'Click or drag along one side of a wall to paint just that face (great for accent walls or exterior facades).',
  };
  const mmark = () => {
    mseg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b.dataset.m === (HP.wallMode || 'draw')));
    if (mhint) mhint.textContent = HINTS[HP.wallMode || 'draw'] || '';
  };
  mseg.querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
    HP.wallMode = b.dataset.m;
    if (HP.wallMode !== 'draw' && !HP.wallColor) HP.wallColor = '#9cb29b';
    mmark();
    wallSwatches($('#wall-sw'), HP.wallColor, col => { HP.wallColor = col; });
    HP.status(HINTS[HP.wallMode]);
  });
  mmark();
  wallSwatches($('#wall-sw'), HP.wallColor, col => {
    HP.wallColor = col;
    if ((HP.wallMode || 'draw') === 'draw' && col) {
      HP.wallMode = 'room';
      mmark();
      HP.status('Paint Room: tap a room to paint its walls, or switch to Draw / Paint Wall');
    }
  });
}

function wallSelectedUI(selWall) {
  const top = $('#insp-top'); if (!top) return;
  top.innerHTML = '';
  const lvl = HP.cur();
  const w = lvl && lvl.walls && lvl.walls[selWall.k];
  if (!w) { HP.selectedWall = null; return; }
  $('#edit-title').textContent = 'Wall Properties';

  const curStyle = w.style || 'plaster';
  const curColor = w.ca || w.cb || w.c || '';
  const s = document.createElement('div');
  s.className = 'insp-section';
  s.innerHTML = `
    <div class="field">
      <label>Wall Material / Style</label>
      <div id="selwall-style-picker-wrap"></div>
    </div>
    <div class="field" style="margin-top:10px">
      <label>Wall Paint Colour</label>
      <div class="swatches" id="selwall-sw"></div>
    </div>
    <div class="field" style="margin-top:10px">
      <button class="ibtn" id="selwall-room-btn" style="width:100%;margin-bottom:8px">
        🏠 Apply Style to Entire Room
      </button>
      <button class="btn-danger" id="selwall-del-btn" style="width:100%">
        Delete Wall
      </button>
    </div>
  `;
  top.appendChild(s);

  const pWrap = $('#selwall-style-picker-wrap');
  if (pWrap) {
    renderWallStylePicker(pWrap, curStyle, st => {
      HP.pushUndo();
      w.style = st;
      HP.wallStyle = st;
      HP.saveState();
      HP.markDirty();
      if (HP.in3D && HP.world3d && HP.world3d.buildLevel) HP.world3d.buildLevel();
      wallSelectedUI(selWall);
      HP.status('Wall style set to: ' + st);
    });
  }

  wallSwatches($('#selwall-sw'), curColor, col => {
    HP.pushUndo();
    w.c = col;
    w.ca = col;
    w.cb = col;
    HP.saveState();
    HP.markDirty();
    if (HP.in3D && HP.world3d && HP.world3d.buildLevel) HP.world3d.buildLevel();
    wallSelectedUI(selWall);
    HP.status('Wall painted: ' + col);
  });

  const roomBtn = $('#selwall-room-btn');
  if (roomBtn) {
    roomBtn.onclick = () => {
      const seg = HP.parseWallKey(selWall.k);
      const isH = seg.d === 'h';
      const rA = isH ? HP.regionAt(seg.x, seg.y - 1) : HP.regionAt(seg.x - 1, seg.y);
      const rB = HP.regionAt(seg.x, seg.y);
      const targetRoom = rA || rB;
      if (targetRoom) {
        HP.pushUndo();
        HP.setRoomWallStyle(targetRoom, w.style || 'plaster');
        HP.saveState();
        HP.markDirty();
        if (HP.in3D && HP.world3d && HP.world3d.buildLevel) HP.world3d.buildLevel();
        HP.status('Applied ' + (w.style || 'plaster') + ' to all walls in ' + (targetRoom.name || 'room'));
      } else {
        HP.status('No adjacent room found to style.');
      }
    };
  }

  const delBtn = $('#selwall-del-btn');
  if (delBtn) {
    delBtn.onclick = () => {
      HP.pushUndo();
      delete lvl.walls[selWall.k];
      HP.selectedWall = null;
      HP.invalidateRegions();
      HP.saveState();
      HP.markDirty();
      if (HP.in3D && HP.world3d && HP.world3d.buildLevel) HP.world3d.buildLevel();
      HP.refreshContext();
      HP.status('Wall deleted.');
    };
  }
}
HP.wallSelectedUI = wallSelectedUI;

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

function setFeatureSwing(k, swing) {
  const lvl = HP.cur();
  if (!lvl || !lvl.walls) return;
  const w = lvl.walls[k];
  if (!w || !w.f) return;
  const s = HP.parseWallKey(k);
  w.swing = swing;
  if (w.f === 'door') {
    const adjKeys = [
      s.d === 'h' ? 'h,' + (s.x + 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y + 1),
      s.d === 'h' ? 'h,' + (s.x - 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y - 1)
    ];
    for (const ak of adjKeys) {
      if (lvl.walls[ak] && lvl.walls[ak].f === 'door') {
        lvl.walls[ak].swing = swing;
      }
    }
  } else if (w.f === 'window') {
    let pos = s.d === 'h' ? s.x + 1 : s.y + 1;
    while (true) {
      const ak = s.d === 'h' ? 'h,' + pos + ',' + s.y : 'v,' + s.x + ',' + pos;
      if (lvl.walls[ak] && lvl.walls[ak].f === 'window') {
        lvl.walls[ak].swing = swing;
        pos++;
      } else break;
    }
    pos = s.d === 'h' ? s.x - 1 : s.y - 1;
    while (true) {
      const ak = s.d === 'h' ? 'h,' + pos + ',' + s.y : 'v,' + s.x + ',' + pos;
      if (lvl.walls[ak] && lvl.walls[ak].f === 'window') {
        lvl.walls[ak].swing = swing;
        pos--;
      } else break;
    }
  }
  if (HP.in3D && HP.world3d && HP.world3d.updateApertures) {
    HP.world3d.updateApertures();
  }
}
HP.setFeatureSwing = setFeatureSwing;

HP.defaultDoorStyle = HP.defaultDoorStyle || 'panel';
HP.wallStyle = HP.wallStyle || 'plaster';

function setDoorStyle(k, style) {
  const lvl = HP.cur();
  if (!lvl || !lvl.walls) return;
  const w = lvl.walls[k];
  if (!w || w.f !== 'door') return;
  const s = HP.parseWallKey(k);
  w.doorStyle = style;
  const adjKeys = [
    s.d === 'h' ? 'h,' + (s.x + 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y + 1),
    s.d === 'h' ? 'h,' + (s.x - 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y - 1)
  ];
  for (const ak of adjKeys) {
    if (lvl.walls[ak] && lvl.walls[ak].f === 'door') {
      lvl.walls[ak].doorStyle = style;
    }
  }
  if (HP.in3D && HP.world3d && HP.world3d.updateApertures) {
    HP.world3d.updateApertures();
  }
}
HP.setDoorStyle = setDoorStyle;

HP.setRoomWallStyle = function (r, style) {
  if (!r || !r.cells) return 0;
  const walls = HP.cur().walls;
  let n = 0;
  const setStyle = k => {
    const w = walls[k]; if (!w) return;
    w.style = style;
    n++;
  };
  for (const [x, y] of r.cells) {
    setStyle(HP.wallKey('h', x, y));
    setStyle(HP.wallKey('h', x, y + 1));
    setStyle(HP.wallKey('v', x, y));
    setStyle(HP.wallKey('v', x + 1, y));
  }
  if (HP.in3D && HP.world3d && HP.world3d.buildLevel) {
    HP.world3d.buildLevel();
  }
  return n;
};

function doorUI() {
  const top = $('#door-panel'); if (!top) return;
  top.innerHTML = '';
  const s = document.createElement('div');
  const curDef = HP.defaultDoorSwing || 'in';
  const curStyle = HP.defaultDoorStyle || 'panel';
  s.innerHTML = `
    <div class="field">
      <label>Default Door Opening</label>
      <div class="seg" id="door-tool-seg">
        <button class="seg-btn ${curDef === 'in' ? 'on' : ''}" data-s="in">🚪 Inside</button>
        <button class="seg-btn ${curDef === 'out' ? 'on' : ''}" data-s="out">🚪 Outside</button>
      </div>
    </div>
    <div class="field" style="margin-top:10px">
      <label>Default Door Style</label>
      <div id="door-tool-style-picker-wrap"></div>
    </div>
    <div class="hint" style="margin-top:10px;line-height:1.45">
      <b>Tips:</b><br>
      • Tap any wall to place a door.<br>
      • Tap an existing door on the plan to flip its swing inside ⇄ outside.<br>
      • Two adjacent doors merge into a double door.
    </div>
  `;
  top.appendChild(s);
  const seg = $('#door-tool-seg');
  if (seg) {
    seg.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => {
        HP.defaultDoorSwing = b.dataset.s;
        HP.status('New doors will open: ' + (HP.defaultDoorSwing === 'out' ? 'Outside (Outward)' : 'Inside (Inward)'));
        doorUI();
      };
    });
  }
  const dWrap = $('#door-tool-style-picker-wrap');
  if (dWrap) {
    renderDoorStylePicker(dWrap, curStyle, st => {
      HP.defaultDoorStyle = st;
      HP.status('New doors style: ' + st);
      doorUI();
    });
  }
}

function windowUI() {
  const top = $('#window-panel'); if (!top) return;
  top.innerHTML = '';
  const s = document.createElement('div');
  const curDef = HP.defaultWindowSwing || 'in';
  s.innerHTML = `
    <div class="field">
      <label>Default Window Opening</label>
      <div class="seg" id="window-tool-seg">
        <button class="seg-btn ${curDef === 'in' ? 'on' : ''}" data-s="in">🪟 Inside</button>
        <button class="seg-btn ${curDef === 'out' ? 'on' : ''}" data-s="out">🪟 Outside</button>
      </div>
    </div>
    <div class="hint" style="margin-top:10px;line-height:1.45">
      <b>Tips:</b><br>
      • Tap any wall to place a window.<br>
      • Tap an existing window on the plan to flip its casement swing inside ⇄ outside.<br>
      • Multi-cell window runs hinge and swing together in 3D.
    </div>
  `;
  top.appendChild(s);
  const seg = $('#window-tool-seg');
  if (seg) {
    seg.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => {
        HP.defaultWindowSwing = b.dataset.s;
        HP.status('New windows will open: ' + (HP.defaultWindowSwing === 'out' ? 'Outside (Outward)' : 'Inside (Inward)'));
        windowUI();
      };
    });
  }
}

function featureSelectedUI(feat) {
  const top = $('#insp-top');
  top.innerHTML = '';
  const w = HP.cur() && HP.cur().walls && HP.cur().walls[feat.k];
  if (!w || !w.f) { HP.selectedFeature = null; return; }
  const isDoor = w.f === 'door';
  const kindName = isDoor ? 'Door' : 'Window';
  $('#edit-title').textContent = kindName + ' Properties';
  
  const curSwing = w.swing || 'in';
  const s = document.createElement('div');
  s.className = 'insp-section';
  s.innerHTML = `
    <div class="field">
      <label>Opening Direction</label>
      <div class="seg" id="feat-swing-seg">
        <button class="seg-btn ${curSwing === 'in' ? 'on' : ''}" data-s="in">
          ${isDoor ? '🚪' : '🪟'} Inside
        </button>
        <button class="seg-btn ${curSwing === 'out' ? 'on' : ''}" data-s="out">
          ${isDoor ? '🚪' : '🪟'} Outside
        </button>
      </div>
    </div>
    ${isDoor ? `
    <div class="field" style="margin-top:10px">
      <label>Door Style</label>
      <div id="feat-doorstyle-picker-wrap"></div>
    </div>
    ` : ''}
    <div class="field" style="margin-top:10px">
      <button class="ibtn" id="feat-flip-btn" style="width:100%;margin-bottom:8px">
        ⇄ Flip Inside / Outside
      </button>
      ${isDoor ? `
      <button class="ibtn" id="feat-toggle-closed" style="width:100%;margin-bottom:8px">
        ${w.c ? '👁 Show Open Leaf in 2D' : '🔒 Show Closed Leaf in 2D'}
      </button>
      ` : ''}
      <button class="btn-danger" id="feat-del-btn" style="width:100%">
        Remove ${kindName}
      </button>
    </div>
    <div class="hint" style="margin-top:10px;line-height:1.4">
      ${isDoor 
        ? (curSwing === 'out' ? '🚪 Opens <b>Outside</b> (outward swing).' : '🚪 Opens <b>Inside</b> (inward swing).')
        : (curSwing === 'out' ? '🪟 Casement hinges <b>Outside</b> (exterior opening).' : '🪟 Casement hinges <b>Inside</b> (room opening).')}
    </div>
  `;
  top.appendChild(s);
  
  const seg = $('#feat-swing-seg');
  if (seg) {
    seg.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => {
        HP.pushUndo();
        const sw = b.dataset.s;
        setFeatureSwing(feat.k, sw);
        HP.saveState();
        HP.markDirty();
        featureSelectedUI(feat);
        HP.status(kindName + ' set to open: ' + (sw === 'out' ? 'Outside' : 'Inside'));
      };
    });
  }
  
  const dWrap = $('#feat-doorstyle-picker-wrap');
  if (dWrap) {
    renderDoorStylePicker(dWrap, w.doorStyle || 'panel', st => {
      HP.pushUndo();
      setDoorStyle(feat.k, st);
      HP.defaultDoorStyle = st;
      HP.saveState();
      HP.markDirty();
      featureSelectedUI(feat);
      HP.status('Door style set to: ' + st);
    });
  }

  const flipBtn = $('#feat-flip-btn');
  if (flipBtn) {
    flipBtn.onclick = () => {
      HP.pushUndo();
      const newSwing = curSwing === 'out' ? 'in' : 'out';
      setFeatureSwing(feat.k, newSwing);
      HP.saveState();
      HP.markDirty();
      featureSelectedUI(feat);
      HP.status(kindName + ' flipped to open ' + (newSwing === 'out' ? 'Outside' : 'Inside'));
    };
  }
  
  const closedBtn = $('#feat-toggle-closed');
  if (closedBtn) {
    closedBtn.onclick = () => {
      HP.pushUndo();
      const nextC = !w.c;
      w.c = nextC;
      const s = HP.parseWallKey(feat.k);
      const adjKeys = [
        s.d === 'h' ? 'h,' + (s.x + 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y + 1),
        s.d === 'h' ? 'h,' + (s.x - 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y - 1)
      ];
      const lvl = HP.cur();
      for (const ak of adjKeys) {
        if (lvl.walls[ak] && lvl.walls[ak].f === 'door') {
          lvl.walls[ak].c = nextC;
        }
      }
      HP.saveState();
      HP.markDirty();
      featureSelectedUI(feat);
      HP.status('Door leaf in 2D: ' + (nextC ? 'Closed' : 'Open'));
    };
  }
  
  const delBtn = $('#feat-del-btn');
  if (delBtn) {
    delBtn.onclick = () => {
      HP.pushUndo();
      w.f = null;
      delete w.swing;
      delete w.c;
      HP.selectedFeature = null;
      HP.invalidateRegions();
      HP.saveState();
      HP.status(kindName + ' removed');
      refreshInspector();
      HP.markDirty();
    };
  }
}

function projectStats() {
  const el = $('#insp-project'); if (!el) return;
  const m2 = HP.M2_PER_CELL;
  const gw = HP.state.w || HP.GRID_W, gh = HP.state.h || HP.GRID_H;
  let rooms = 0, pieces = 0;
  const interiors = [];
  const curReg = HP.regions || (HP.computeRegions && HP.computeRegions());
  let curCount = 0;
  if (curReg && curReg.regionOf) {
    for (let j = 0; j < curReg.regionOf.length; j++) if (curReg.regionOf[j] >= 0) curCount++;
  }
  for (let i = 0; i < HP.state.levels.length; i++) {
    const lvl = HP.state.levels[i];
    let floorArea = 0;
    if (i === HP.state.level) {
      floorArea = curCount * m2;
    } else {
      if (lvl._cachedArea === undefined) lvl._cachedArea = HP.interiorCells(i) * m2;
      floorArea = lvl._cachedArea;
    }
    interiors.push(floorArea);
    rooms += new Set(Object.values(lvl.roomNames)).size;
    pieces += lvl.furniture.length;
  }
  const areaRows = interiors.length > 1
    ? interiors.map((a, i) =>
        `<div class="stat-row"><span class="k">Interior · Floor ${i + 1}</span><span class="v${i === HP.state.level ? ' accent' : ''}">${a.toFixed(1)} m²</span></div>`).join('')
    : `<div class="stat-row"><span class="k">Interior area</span><span class="v accent">${interiors[0].toFixed(1)} m²</span></div>`;
  el.innerHTML = `
    <div class="stat-row"><span class="k">Floors</span><span class="v">${HP.state.levels.length}</span></div>
    <div class="stat-row"><span class="k">Plot</span><span class="v">${(gw * 0.5).toFixed(0)}×${(gh * 0.5).toFixed(0)} m (${(gw * gh * m2).toFixed(0)} m²)</span></div>
    ${areaRows}
    <div class="stat-row"><span class="k">Named rooms</span><span class="v">${rooms}</span></div>
    <div class="stat-row"><span class="k">Furniture pieces</span><span class="v">${pieces}</span></div>`;
}
HP.projectStats = projectStats;

/* sidebar shows only the active tool's section; selection edits float on the canvas */
const SEC_FOR = { wall: 'wall', floor: 'floor', furniture: 'furniture', fence: 'fence', door: 'door', window: 'window' };
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
  else if (HP.selectedFeature) featureSelectedUI(HP.selectedFeature);
  else if (HP.selectedWall) wallSelectedUI(HP.selectedWall);
  else if (HP.selectedRoom) roomUI();
  $('#edit-panel').classList.toggle('hidden', !top.firstChild);
  if (insp.dataset.sec === 'wall') wallUI();
  if (insp.dataset.sec === 'floor') floorUI();
  if (insp.dataset.sec === 'fence') fenceUI();
  if (insp.dataset.sec === 'door') doorUI();
  if (insp.dataset.sec === 'window') windowUI();
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
  if (p.sizes) {                                   // Empty Plot → pick lot size
    const row = document.createElement('div');
    row.className = 'pc-sizes';
    p.sizes.forEach(s => {
      const b = document.createElement('button');
      b.className = 'pc-chip';
      b.innerHTML = `<b>${s.label}</b> ${s.w * 0.5}×${s.h * 0.5} m` +
        (s.label === 'XL' ? ' <i>best on PC</i>' : '');
      b.onclick = e => {
        e.stopPropagation();
        HP.newSizedPlot(s.w, s.h);
        $('#preset-overlay').classList.add('hidden');
      };
      row.appendChild(b);
    });
    d.appendChild(row);
  }
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
  $('#preset-open').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { if (inp.files[0]) HP.importFile(inp.files[0]); };
    inp.click();
  };
  $('#preset-overlay').onclick = e => { if (e.target.id === 'preset-overlay') e.target.classList.add('hidden'); };
  $('#dialog-overlay').onclick = e => { if (e.target.id === 'dialog-overlay') e.target.classList.add('hidden'); };

  $('#btn-undo').onclick = () => HP.undo();
  $('#btn-redo').onclick = () => HP.redo();
  $('#btn-snap').onclick = () => HP.toggleSnap();
  $('#btn-save').onclick = () => HP.exportFile();
  $('#btn-export').onclick = () => HP.exportPNG();
  $('#btn-coop').onclick = () => HP.coop && HP.coop.show();
  $('#coop-x').onclick = () => HP.coop && HP.coop.hide();

  $('#btn-zoomin').onclick = () => HP.zoomBtn(1);
  $('#btn-zoomout').onclick = () => HP.zoomBtn(-1);
  const zv = $('#zoom-val');
  if (zv) {
    zv.style.cursor = 'pointer';
    zv.title = 'Click to center & fit house';
    zv.onclick = () => {
      const fit = Math.min(HP.canvas.clientWidth / (HP.GRID_W * HP.CELL + 120),
                           HP.canvas.clientHeight / (HP.GRID_H * HP.CELL + 160));
      HP.camera.zoom = Math.max(HP.MIN_ZOOM, Math.min(1.2, fit));
      HP.camera.x = 0;
      HP.camera.y = 0;
      HP.markDirty();
      HP.updateZoomUI();
      HP.status('Centered house');
    };
  }
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
    else { HP.selected = null; HP.selectedRoom = null; HP.selectedFeature = null; HP.markDirty(); }
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

  const ibDone = $('#ib-done');
  if (ibDone) ibDone.onclick = () => HP.exitInterior();
  const ibReset = $('#ib-reset');
  if (ibReset) ibReset.onclick = () => {
    if (!HP.editingInterior) return;
    HP.pushUndo();
    const it = HP.editingInterior.item;
    it.interior = HP.createDefaultInterior(it);
    HP.editingInterior.interior = it.interior;
    HP.selected = null; HP.selectedSet = [];
    HP.invalidateRegions();
    if (HP.resetLayers) HP.resetLayers();
    HP.markDirty();
    refreshInspector();
    HP.status('Interior layout reset to default');
  };
  const ibClear = $('#ib-clear');
  if (ibClear) ibClear.onclick = () => {
    if (!HP.editingInterior) return;
    HP.pushUndo();
    HP.cur().furniture = [];
    HP.cur().floors = {};
    HP.selected = null; HP.selectedSet = [];
    HP.invalidateRegions();
    if (HP.resetLayers) HP.resetLayers();
    HP.markDirty();
    refreshInspector();
    HP.status('Interior furniture and floors cleared');
  };

  HP.updateFloorUI();
  HP.updateZoomUI();
  HP.updateUndoButtons();
  refreshInspector();
  markAutosaved();
};

HP.showInteriorUI = function (it) {
  const banner = $('#interior-banner');
  const flCtrl = $('#floor-ctrl');
  if (flCtrl) flCtrl.style.display = 'none';
  if (banner) {
    banner.classList.remove('hidden');
    const isGH = it.type === 'greenhouse';
    const titleEl = $('#ib-title');
    const iconEl = $('#ib-icon');
    if (titleEl) titleEl.textContent = isGH ? 'Editing Greenhouse Interior' : 'Editing Cabin Interior';
    if (iconEl) iconEl.textContent = isGH ? '🌿' : '🏡';
  }
};

HP.hideInteriorUI = function () {
  const banner = $('#interior-banner');
  const flCtrl = $('#floor-ctrl');
  if (flCtrl) flCtrl.style.display = '';
  if (banner) banner.classList.add('hidden');
};
})();
