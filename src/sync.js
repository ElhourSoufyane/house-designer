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
function broadcastState() {
  if (applying || !conns.length) return;
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    rev = Date.now();
    sendAll({ t: 'state', rev, state: HP.state, nextId: HP.nextId });
  }, 300);
}
const _saveState = HP.saveState;
HP.saveState = function () { _saveState(); broadcastState(); };

function applyState(msg, fromConn) {
  if (msg.rev <= rev) return;                    // last-write-wins
  applying = true;
  rev = msg.rev;
  HP.state = HP.migrate(msg.state);
  HP.state.level = Math.min(HP.state.level, HP.state.levels.length - 1);
  HP.nextId = Math.max(HP.nextId || 0, msg.nextId || 0);
  HP.selected = HP.pending = HP.ghost = HP.selectedRoom = null;
  HP.invalidateRegions(); HP.refreshContext();
  if (HP.updateFloorUI) HP.updateFloorUI();
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state: HP.state, nextId: HP.nextId })); } catch (e) {}
  applying = false;
  if (mode === 'host')                           // star: relay to the other guests
    for (const c of conns) if (c !== fromConn) { try { c.send(msg); } catch (e) {} }
}

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
function onCursor(d) {
  cursors[d.name] = { x: d.x, y: d.y, name: d.name, color: nameColor(d.name), at: Date.now() };
  HP.markDirty();
}

/* ---------- remote walk avatars ---------- */
const avatars = {};                        // name -> {x, y, a, lvl, at, color}
function onPos(d) {
  if (d.off) { delete avatars[d.name]; HP.markDirty(); return; }
  avatars[d.name] = { x: d.x, y: d.y, a: d.a, lvl: d.lvl, color: nameColor(d.name), at: Date.now() };
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
  const r = 11;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(2, 3, r, r * 0.85, 0, 0, 7); g.fill();
  g.rotate(p.a || 0);
  g.beginPath(); g.arc(0, 0, r, 0, 7);
  g.fillStyle = p.color; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#e8eaf0';
  g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();
  g.restore();
  nameTag(g, n, p.x, p.y, p.color);
}
/* prune stale peers + draw cursors & walk avatars — called from drawOverlays */
HP.drawPeerCursors = function (g) {
  const now = Date.now();
  for (const n in avatars) {
    const p = avatars[n];
    if (now - p.at > 2500) { delete avatars[n]; continue; }
    if (p.lvl === HP.state.level) drawPeerAvatar(g, n, p);
  }
  for (const n in cursors) {
    const c = cursors[n];
    if (now - c.at > 4000) { delete cursors[n]; continue; }
    if (avatars[n] && now - avatars[n].at <= 2500) continue;   // walking → avatar, not cursor
    g.fillStyle = c.color;
    g.beginPath(); g.arc(c.x, c.y, 7, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    nameTag(g, n, c.x, c.y, c.color);
  }
};

/* ---------- connections ---------- */
function setupConn(c) {
  c.on('open', () => {
    conns.push(c);
    sendTo(c, { t: 'hello', name: myName || 'Player' });
    if (mode === 'host')
      sendTo(c, { t: 'state', rev: Date.now(), state: HP.state, nextId: HP.nextId });
    setConnected();
    HP.status('Co-op connected — you are building together now');
  });
  c.on('data', async raw => {
    const d = await unpackMsg(raw);
    if (!d || !d.t) return;
    if (d.t === 'hello') { c.name = d.name; HP.status(d.name + ' joined the house'); setConnected(); }
    else if (d.t === 'state') applyState(d, c);
    else if (d.t === 'cursor') onCursor(d);
    else if (d.t === 'pos') onPos(d);
  });
  const drop = () => {
    conns = conns.filter(x => x !== c);
    if (c.name) { delete cursors[c.name]; delete avatars[c.name]; }
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
    const r = HP.canvas.getBoundingClientRect();
    const w = HP.s2w(e.clientX - r.left, e.clientY - r.top);
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
      sendAll({ t: 'pos', x: HP.player.x, y: HP.player.y, a: HP.player.angle, lvl: HP.state.level, name: myName || 'Player' });
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
