/* sync.js — live co-op: two+ people edit the same house in real time.
   PeerJS public broker does the handshake, then everything flows
   peer-to-peer over WebRTC (no game server needed).
   Host gets a room code; guests join with it. Whole-state sync with
   last-write-wins + ~300 ms debounce, plus live name cursors. */
(function () {
const PREFIX = 'houseplan-';
const LS_KEY = 'homeplanner_save_v1';
const LS_BACKUP = 'homeplanner_solo_backup';
let peer = null, conns = [], mode = null, roomCode = null;
let myName = localStorage.getItem('hd_name') || '';
let rev = 0, applying = false, sendTimer = null, lastCursorSent = 0;
const cursors = {};                        // name -> {x, y, color, at}
HP.peerCursors = cursors;
HP.peerAvatarList = () => Object.values(avatars);   // [{x,y,a,lvl,s,name}…] for seat picking

const $ = s => document.querySelector(s);

/* ---------- status + panel ---------- */
function coopStatus(txt, on) {
  const el = $('#st-coop');
  if (el) { el.textContent = txt; el.classList.toggle('on', !!on); }
}
function showPanel() { $('#coop-panel').classList.remove('hidden'); renderPanel(); }
function hidePanel() { $('#coop-panel').classList.add('hidden'); }

function copyInvite() {
  const url = location.origin + location.pathname + '?room=' + roomCode;
  if (navigator.clipboard)
    navigator.clipboard.writeText(url)
      .then(() => HP.status('Invite link copied — send it to your partner'))
      .catch(() => prompt('Copy this link:', url));
  else prompt('Copy this link:', url);
}

function renderPanel() {
  const body = $('#coop-body');
  if (!conns.length) {
    if (peer && peer.open && mode === 'host') {
      /* hosting, waiting for partner — show code + invite link up front */
      body.innerHTML = `
        <div class="field"><label>Send this link to your partner</label>
          <button class="panel-btn primary" id="coop-copy" style="width:100%">Copy invite link</button></div>
        <div class="field"><label>…or give them the code</label>
          <div class="coop-code-big">${roomCode}</div></div>
        <div class="hint">Waiting for someone to join…</div>
        <button class="panel-btn danger" id="coop-cancel" style="width:100%">Cancel hosting</button>`;
      $('#coop-copy').onclick = copyInvite;
      $('#coop-cancel').onclick = leaveGame;
      return;
    }
    if (peer && mode === 'guest') {
      body.innerHTML = `<div class="hint">Connecting…</div>`;
      return;
    }
    const hasBackup = !!localStorage.getItem(LS_BACKUP);
    body.innerHTML = `
      <div class="field"><label>Your name</label>
        <input type="text" id="coop-name" maxlength="16" placeholder="e.g. Soufyane"></div>
      <button class="panel-btn primary" id="coop-host" style="width:100%">Host my house — get a code</button>
      <div class="field"><label>…or join with a code</label>
        <input type="text" id="coop-code" maxlength="6" placeholder="ABCD" style="text-transform:uppercase"></div>
      <button class="panel-btn" id="coop-join" style="width:100%">Join partner's house</button>
      ${hasBackup ? '<button class="panel-btn danger" id="coop-restore" style="width:100%;margin-top:8px">Back to my solo house</button>' : ''}
      <div class="hint" id="coop-hint">Host shares the code — your partner opens Co-op and joins. Joining loads THEIR house (yours is backed up first).</div>`;
    $('#coop-name').value = myName;
    $('#coop-name').oninput = e => { myName = e.target.value.trim(); localStorage.setItem('hd_name', myName); };
    $('#coop-host').onclick = hostGame;
    $('#coop-join').onclick = () => {
      const code = $('#coop-code').value.trim().toUpperCase();
      if (code.length < 4) { $('#coop-hint').textContent = 'Enter the 4-letter code your partner sees.'; return; }
      joinGame(code);
    };
    const rb = $('#coop-restore');
    if (rb) rb.onclick = restoreSolo;
    return;
  }
  const names = conns.map(c => c.name || '…').join(', ');
  body.innerHTML = `
    <div class="field"><label>Room code — share this</label>
      <div class="coop-code-big">${roomCode || '—'}</div></div>
    <button class="panel-btn" id="coop-copy" style="width:100%">Copy invite link</button>
    <div class="hint">Playing with: <b>${names}</b>. Every edit syncs instantly — build together!</div>
    <button class="panel-btn danger" id="coop-leave" style="width:100%">Leave co-op</button>`;
  $('#coop-copy').onclick = copyInvite;
  $('#coop-leave').onclick = leaveGame;
}

function setConnected() {
  if (!conns.length) { coopStatus('Solo', false); renderPanel(); return; }
  coopStatus('Co-op: ' + (conns.length + 1) + ' online', true);
  renderPanel();
}

/* ---------- state broadcast (hooked into saveState) ---------- */
/* house state can exceed WebRTC's per-message limit — gzip it when we can */
async function packMsg(obj) {
  const s = JSON.stringify(obj);
  if (!window.CompressionStream) return obj;
  const buf = await new Response(
    new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  return { t: 'z', d: buf };
}
async function unpackMsg(d) {
  if (d.t !== 'z') return d;
  const s = await new Response(
    new Blob([d.d]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).text();
  return JSON.parse(s);
}
async function sendTo(c, obj) {
  try { c.send(await packMsg(obj)); } catch (e) {}
}
function sendAll(obj) { for (const c of conns) sendTo(c, obj); }
let lastSentSnap = '';
function broadcastState() {
  if (applying || !conns.length) return;
  if (lastSentSnap === HP.snap()) return;         // nothing new — stops apply→broadcast ping-pong
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    rev = Date.now();
    stampOwners();
    stampDelta();                                 // stamp entities we changed since last send
    lastSentSnap = HP.snap();
    sendAll({ t: 'state', rev, origin: peer && peer.id, state: HP.state, stamps, nextId: HP.nextId });
  }, 120);
}
const _saveState = HP.saveState;
HP.saveState = function () { _saveState(); broadcastState(); };

/* claim untagged furniture as mine before sharing — presets & legacy saves
   would otherwise echo back from the partner as anonymous "new" items */
function stampOwners() {
  for (const lvl of HP.state.levels)
    for (const it of lvl.furniture) if (!it.oid) it.oid = HP.oid;
}

/* ---------- per-entity mutation stamps (Figma-style LWW registers) ----------
   Every wall/floor/fence/roomName cell and furniture item gets [seq, oid] —
   a Lamport clock + author id. Incoming remote values only win when their
   stamp beats ours: my unacknowledged edit can never be stomped by an older
   in-flight state (the "wall disappears" bug), and both sides pick the SAME
   winner → deterministic convergence, no divergence. */
let mySeq = 0;
let stamps = {};                                     // {lvl: {dict: {key: [seq, oid]}, items: {id: ...}}}
const peerStamps = {};                               // origin -> their stamps map from last msg
const mergedTags = new Set();                        // entities adopted from remote since last send
let lastSentState = null;                            // deep copy — local-change detector
const tag = (l, d, k) => l + '|' + d + '|' + k;
function stMap(l, d) {
  const s = stamps[l] || (stamps[l] = {});
  return s[d] || (s[d] = {});
}
function cmpStamp(a, b) {                            // >0 → a is newer
  a = a || [0, '']; b = b || [0, ''];
  return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}
function observeStamp(s) { if (s && s[0] > mySeq) mySeq = s[0]; }   // lamport: track max seen

/* at send time: find what WE changed since last send and stamp it ours.
   Remote-adopted entities are skipped via mergedTags (they already carry the
   author's stamp — restamping them ours would start an echo war). */
function stampDelta() {
  const sent = lastSentState || { levels: [] };
  HP.state.levels.forEach((cl, i) => {
    const sl = sent.levels[i] || {};
    for (const d of ['walls', 'floors', 'fences', 'roomNames']) {
      const cd = cl[d] || {}, sd = sl[d] || {}, m = stMap(i, d);
      for (const k in cd)
        if (!mergedTags.has(tag(i, d, k)) && JSON.stringify(cd[k]) !== JSON.stringify(sd[k]))
          m[k] = [++mySeq, HP.oid];
      for (const k in m) if (!(k in cd)) delete m[k];
    }
    const sIds = {}; for (const it of sl.furniture || []) sIds[it.id] = it;
    const im = stMap(i, 'items');
    for (const it of cl.furniture)
      if (!mergedTags.has(tag(i, 'items', it.id)) &&
          JSON.stringify(it) !== JSON.stringify(sIds[it.id] || null))
        im[it.id] = [++mySeq, HP.oid];
    const alive = {}; for (const it of cl.furniture) alive[it.id] = 1;
    for (const k in im) if (!alive[k]) delete im[k];
  });
  mergedTags.clear();
  lastSentState = JSON.parse(JSON.stringify(HP.state));
}

/* ---------- delta merge: apply only what changed on the peer's side ----------
   Two layers, Figma-style:
   1. Diff incoming vs last-seen-state-from-that-origin → what THEY did.
   2. Apply each change only when its Lamport stamp beats ours → deterministic
      last-writer-wins per entity, same winner computed on every device.
      Deletes only land if we haven't touched that entity since their base —
      otherwise our newer edit survives and the rebroadcast re-converges. */
const peerBase = {};                                   // originPeerId -> last received state
function mergeRemote(cur, base, inc, incStamps, baseStamps) {
  while (cur.levels.length < inc.levels.length)
    cur.levels.push({ walls: {}, floors: {}, roomNames: {}, furniture: [], fences: {} });
  for (let i = 0; i < inc.levels.length; i++) {
    const cl = cur.levels[i], bl = base && base.levels[i] || {}, il = inc.levels[i];
    const iS = incStamps && incStamps[i] || {}, bS = baseStamps && baseStamps[i] || {};
    for (const d of ['walls', 'floors', 'fences', 'roomNames']) {
      const cd = cl[d] || (cl[d] = {}), bd = bl[d] || {}, id = il[d] || {};
      const isd = iS[d] || {}, bsd = bS[d] || {}, md = stMap(i, d);
      for (const k in bd)
        if (!(k in id) && k in cd && cmpStamp(md[k], bsd[k]) <= 0) {   // they deleted; we haven't re-edited
          delete cd[k]; delete md[k];
        }
      for (const k in id) {
        if (k in bd && JSON.stringify(id[k]) === JSON.stringify(bd[k])) continue;  // unchanged
        observeStamp(isd[k]);
        if (cmpStamp(isd[k], md[k]) > 0 || !incStamps) {               // their stamp wins (or legacy peer)
          if (JSON.stringify(cd[k]) !== JSON.stringify(id[k])) { cd[k] = id[k]; }
          if (isd[k]) { md[k] = isd[k]; mergedTags.add(tag(i, d, k)); }
        }
      }
    }
    const bIds = {}, iIds = {}, iim = iS.items || {}, bim = bS.items || {}, mim = stMap(i, 'items');
    for (const it of bl.furniture || []) bIds[it.id] = it;
    for (const it of il.furniture) iIds[it.id] = it;
    cl.furniture = cl.furniture.filter(it =>                          // they removed it
      !bIds[it.id] || it.id in iIds || cmpStamp(mim[it.id], bim[it.id]) > 0);
    for (const it of il.furniture) {
      const b = bIds[it.id];
      const idx = cl.furniture.findIndex(x => x.id === it.id);
      if (!b) {                                                              // they added it
        if (it.oid === HP.oid) continue;                                     // my own item echoing back — skip
        const copy = idx >= 0 ? { ...it, id: ++HP.nextId } : it;               // id collision → new id
        cl.furniture.push(copy);
        observeStamp(iim[it.id]);
        if (iim[it.id]) { mim[copy.id] = iim[it.id]; mergedTags.add(tag(i, 'items', copy.id)); }
      } else if (JSON.stringify(b) !== JSON.stringify(it)) {
        observeStamp(iim[it.id]);
        if (cmpStamp(iim[it.id], mim[it.id]) > 0 || !incStamps) {            // they changed it — stamp wins
          if (idx >= 0) cl.furniture[idx] = it; else cl.furniture.push(it);
          if (iim[it.id]) { mim[it.id] = iim[it.id]; mergedTags.add(tag(i, 'items', it.id)); }
        }
      }
    }
  }
  for (const k of ['bg', 'photoFloors', 'w', 'h'])
    if (inc[k] !== undefined && (!base || JSON.stringify(inc[k]) !== JSON.stringify(base[k]))) cur[k] = inc[k];
  /* inc.level is deliberately NOT synced — the viewed floor is a personal
     view choice, not shared house data. Her climbing stairs shouldn't drag
     my screen to floor 2. (Adopted once on join in applyState.) */
  return cur;
}

function applyState(msg, fromConn) {
  /* no rev comparison — clocks differ across devices and a skewed clock
     would silently drop a partner's edits. States can't echo back
     (applying=true blocks rebroadcast), so latest-arrival wins safely. */
  /* snapshot local UI refs BEFORE swapping state — remote edits must not
     wipe the local user's in-progress work (placement ghost, open panels) */
  const selId = HP.selected && HP.selected.id;   // ref into the OLD state — re-find below
  const keepRoom = HP.selectedRoom;              // {cx,cy} — roomUI re-resolves or drops it
  HP.pushUndoSnap(HP.snap());                    // remote edits join the shared undo timeline
  applying = true;
  rev = msg.rev;
  const origin = msg.origin || fromConn.peer;
  const inc = HP.migrate(JSON.parse(JSON.stringify(msg.state)));      // owned copy
  /* floor-change notification — she moved floors, tell me where she went */
  const prevLvl = peerBase[origin] && peerBase[origin].level;
  if (prevLvl !== undefined && inc.level !== prevLvl && fromConn.name && HP.status)
    HP.status(fromConn.name + ' went to floor ' + (inc.level + 1));
  const baseStamps = peerStamps[origin];
  if (!peerBase[origin]) {
    HP.state = inc;                                // first state from them → adopt wholesale
    HP.state.level = Math.min(HP.state.level, HP.state.levels.length - 1);
    if (msg.stamps) {                              // adopt their entity stamps
      for (const l in msg.stamps) {
        const ms = msg.stamps[l];
        for (const d in ms) {
          const sd = stMap(+l, d);
          for (const k in ms[d]) { sd[k] = ms[d][k]; observeStamp(ms[d][k]); }
        }
      }
    }
    lastSentState = JSON.parse(JSON.stringify(inc));  // adopted = my baseline, not "my edits"
  } else {
    mergeRemote(HP.state, peerBase[origin], inc, msg.stamps, baseStamps);  // apply only THEIR delta
  }
  peerBase[origin] = msg.state;
  peerStamps[origin] = msg.stamps || {};
  HP.nextId = Math.max(HP.nextId || 0, msg.nextId || 0);
  /* pending + ghost stay untouched — a local placement in flight continues.
     selected is re-resolved by id (its panel stays open, content refreshes).
     If the partner deleted that item, selection simply clears. */
  HP.selected = null;
  if (selId != null) outer:
  for (const lvl of HP.state.levels)
    for (const it of lvl.furniture)
      if (it.id === selId) { HP.selected = it; break outer; }
  HP.selectedRoom = keepRoom;
  if (HP.state.w !== HP.GRID_W || HP.state.h !== HP.GRID_H) HP.applyGridSize();
  HP.invalidateRegions(); HP.refreshContext(); HP.markDirty();
  if (HP.updateFloorUI) HP.updateFloorUI();
  if (HP.invalidateBlocked) HP.invalidateBlocked();
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state: HP.state, nextId: HP.nextId })); } catch (e) {}
  applying = false;
  /* converged rebroadcast: if the merge produced a state different from what we
     last sent (e.g. simultaneous same-item edits), send it so both sides settle */
  broadcastState();
  if (mode === 'host')                           // star: relay to the other guests
    for (const c of conns) if (c !== fromConn) { try { c.send(msg); } catch (e) {} }
}

/* ---------- live cursors ---------- */

/* ---------- live cursors ---------- */
function sendCursor(x, y) {
  if (!conns.length) return;
  const now = performance.now();
  if (now - lastCursorSent < 120) return;
  lastCursorSent = now;
  sendAll({ t: 'cursor', x, y, name: myName || 'Player' });
}
const CURSOR_COLORS = ['#e05c5c', '#4f9cf9', '#e8963c', '#9c59d0', '#46a35e', '#d05c9c'];
function nameColor(n) {
  let h = 0; for (const ch of n || '?') h = (h * 31 + ch.charCodeAt(0)) % 997;
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
}
function onCursor(d, key) {
  cursors[key] = { x: d.x, y: d.y, name: d.name, color: nameColor(d.name), at: Date.now() };
  HP.markDirty();
}

/* ---------- remote walk avatars ---------- */
const avatars = {};                        // name -> {x, y, a, lvl, at, color}
function onPos(d, key) {
  if (d.off) { delete avatars[key]; HP.markDirty(); return; }
  avatars[key] = { x: d.x, y: d.y, a: d.a, lvl: d.lvl, s: d.s, name: d.name, color: nameColor(d.name), at: Date.now() };
  HP.markDirty();
}
function nameTag(g, n, x, y, color) {
  g.font = '600 11px "Segoe UI", sans-serif'; g.textAlign = 'center';
  const w = g.measureText(n).width + 12;
  g.fillStyle = 'rgba(20,23,28,.85)';
  g.fillRect(x - w / 2, y - 30, w, 18);
  g.fillStyle = '#fff'; g.fillText(n, x, y - 17);
}
/* top-down person — same shape as drawPlayer, colored per peer */
function drawPeerAvatar(g, n, p) {
  const r = p.s ? 9 : 11;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(2, 3, r, r * 0.85, 0, 0, 7); g.fill();
  g.rotate(p.a || 0);
  g.beginPath(); g.arc(0, 0, r, 0, 7);
  g.fillStyle = p.color; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke();
  if (!p.s) {
    g.fillStyle = '#e8eaf0';
    g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();
  }
  g.restore();
  nameTag(g, n, p.x, p.y, p.color);
}
/* prune stale peers + draw cursors & walk avatars — called from drawOverlays */
HP.drawPeerCursors = function (g) {
  const now = Date.now();
  for (const n in avatars) {
    const p = avatars[n];
    if (now - p.at > 2500) { delete avatars[n]; continue; }
    if (p.lvl === HP.state.level) drawPeerAvatar(g, p.name || '?', p);
  }
  for (const n in cursors) {
    const c = cursors[n];
    if (now - c.at > 4000) { delete cursors[n]; continue; }
    if (avatars[n] && now - avatars[n].at <= 2500) continue;   // walking → avatar, not cursor
    g.fillStyle = c.color;
    g.beginPath(); g.arc(c.x, c.y, 7, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    nameTag(g, c.name || '?', c.x, c.y, c.color);
  }
};

/* ---------- connections ---------- */
function setupConn(c) {
  c.on('open', () => {
    conns.push(c);
    sendTo(c, { t: 'hello', name: myName || 'Player' });
    if (mode === 'host') {
      stampOwners();
      sendTo(c, { t: 'state', rev: Date.now(), origin: peer.id, state: HP.state, nextId: HP.nextId });
    }
    setConnected();
    HP.status('Co-op connected — you are building together now');
  });
  c.on('data', async raw => {
    const d = await unpackMsg(raw);
    if (!d || !d.t) return;
    if (d.t === 'hello') { c.name = d.name; HP.status(d.name + ' joined the house'); setConnected(); }
    else if (d.t === 'state') applyState(d, c);
    else if (d.t === 'cursor') onCursor(d, c.peer);
    else if (d.t === 'pos') onPos(d, c.peer);
  });
  const drop = () => {
    conns = conns.filter(x => x !== c);
    delete cursors[c.peer]; delete avatars[c.peer];   // keyed by peer id — same-name peers are safe
    if (c.name) HP.status(c.name + ' left');
    setConnected();
  };
  c.on('close', drop);
  c.on('error', drop);
}
function mkCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';      // no confusable chars
  let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function hostGame() {
  leavePeer();
  roomCode = mkCode();
  HP.status('Creating room ' + roomCode + '…');
  peer = new Peer(PREFIX + roomCode);             // claim the room code as our id
  peer.on('error', e => {
    if (e && e.type === 'unavailable-id') hostGame();   // code collision → retry
    else HP.status('Co-op error: ' + (e && e.type));
  });
  peer.on('open', () => {
    mode = 'host';
    rev = Date.now();
    coopStatus('Hosting ' + roomCode, true);
    renderPanel();
    HP.status('Room ' + roomCode + ' ready — share the code or invite link');
  });
  peer.on('connection', setupConn);
}
function joinGame(code) {
  leavePeer();
  const cur = localStorage.getItem(LS_KEY);       // back up solo house first
  if (cur) localStorage.setItem(LS_BACKUP, cur);
  roomCode = code;
  HP.status('Joining room ' + code + '…');
  peer = new Peer();
  peer.on('error', e => {
    const t = e && e.type;
    if (t === 'peer-unavailable') {
      HP.status('No room with that code — check it and try again');
      mode = null; renderPanel();
    } else HP.status('Co-op error: ' + t);
  });
  peer.on('open', () => {
    mode = 'guest';
    const c = peer.connect(PREFIX + code, { reliable: true });
    setupConn(c);
  });
  peer.on('connection', setupConn);               // peers may dial in too
}
function leavePeer() {
  for (const c of conns) { try { c.close(); } catch (e) {} }
  conns = [];
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  for (const n in cursors) delete cursors[n];
  for (const n in avatars) delete avatars[n];
  mode = null;
}
function leaveGame() {
  leavePeer();
  roomCode = null;
  coopStatus('Solo', false);
  renderPanel();
  HP.status('Left co-op — house is saved on this device');
}
function restoreSolo() {
  const b = localStorage.getItem(LS_BACKUP);
  if (!b) return;
  try {
    const d = JSON.parse(b);
    applying = true;
    HP.state = HP.migrate(d.state); HP.nextId = d.nextId || HP.nextId;
    applying = false;
    HP.invalidateRegions(); HP.refreshContext(); HP.saveState();
    localStorage.removeItem(LS_BACKUP);
    renderPanel();
    HP.status('Back to your solo house');
  } catch (e) { HP.status('Backup restore failed'); }
}

/* ---------- cursor send hook (canvas pointer) ---------- */
function hookCursor() {
  if (!HP.canvas) { setTimeout(hookCursor, 300); return; }
  HP.canvas.addEventListener('pointermove', e => {
    if (HP.playing) return;                        // walking → send avatar pos instead
    const w = HP.s2w(e.clientX, e.clientY);        // s2w handles the canvas offset
    sendCursor(w.x, w.y);
  });
}
hookCursor();

/* ---------- walk-mode position broadcast ---------- */
let lastPosSent = 0;
function hookWalk() {
  if (!HP.tickPlayer || !HP.togglePlay) { setTimeout(hookWalk, 300); return; }
  const tick0 = HP.tickPlayer;
  HP.tickPlayer = function (dt) {
    tick0(dt);
    const now = performance.now();
    if (conns.length && HP.player && now - lastPosSent > 90) {
      lastPosSent = now;
      sendAll({ t: 'pos', x: HP.player.x, y: HP.player.y, a: HP.player.angle, lvl: HP.state.level, s: HP.playerSitting ? 1 : 0, name: myName || 'Player' });
    }
  };
  const play0 = HP.togglePlay;
  HP.togglePlay = function () {
    play0();
    if (!HP.playing) sendAll({ t: 'pos', off: true, name: myName || 'Player' });
  };
}
hookWalk();
window.addEventListener('beforeunload', leavePeer);

/* ---------- invite link: ?room=CODE auto-joins ---------- */
(function inviteLink() {
  const code = new URLSearchParams(location.search).get('room');
  if (!code) return;
  setTimeout(() => {
    showPanel();
    const inp = $('#coop-code');
    if (inp) inp.value = code.toUpperCase();
    if (myName) joinGame(code.toUpperCase());        // name saved → straight in
    else HP.status('Enter your name and tap Join — you were invited to a shared house');
  }, 600);                                            // let the app boot first
})();

/* ---------- public ---------- */
HP.coop = { show: showPanel, hide: hidePanel, leave: leaveGame, online: () => conns.length };
})();
