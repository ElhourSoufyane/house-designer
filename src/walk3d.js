/* walk3d.js — first-person controls for Play 3D.
   Rides on the existing play machinery: HP.togglePlay() spawns + runs
   tickPlayer (movement, collision, interactions, stairs, avatar sync).
   This file only adds: canvas/button/styles injection, mouse/touch look,
   and a per-frame render loop. Zero edits to live files — hooks are
   additive monkey-patches applied at first use. */
(function () {
if (typeof THREE === 'undefined') return;

const isTouch = 'ontouchstart' in window;
const look = { yaw: -Math.PI / 2, pitch: -0.06 };
let raf = 0, injected = false, patched = false;
let joyId = null, joyO = null, joyKeys = { w: 0, a: 0, s: 0, d: 0 };
let lookId = null, lookLast = null;
let btn = null;

/* ---------------- injection: canvas, button, styles ---------------- */
function inject() {
  if (injected) return; injected = true;
  const v = HP.canvas;
  if (!v || !v.parentNode) return;
  const st = document.createElement('style');
  st.textContent =
    '#view3d{position:absolute;inset:0;width:100%;height:100%;display:none;' +
    'touch-action:none;z-index:1;cursor:crosshair}\n' +
    'body.playing3d #view{display:none}\n' +
    'body.playing3d #view3d{display:block}\n' +
    '#xh{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
    'width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.9);' +
    'box-shadow:0 0 0 2px rgba(0,0,0,.35);display:none;z-index:21;pointer-events:none}\n' +
    'body.playing3d #xh{display:block}\n' +
    'body.playing3d #xh.on{background:#5dd8a0;transform:translate(-50%,-50%) scale(1.35)}\n' +
    '#xh-lbl{position:absolute;left:50%;top:calc(50% + 18px);transform:translateX(-50%);' +
    'background:rgba(20,23,28,.8);color:#fff;font:600 12px/1.4 system-ui;padding:4px 10px;' +
    'border-radius:8px;display:none;z-index:21;pointer-events:none;white-space:nowrap}\n' +
    'body.playing3d #xh-lbl.on{display:block}\n' +
    'body.playing3d #use-ui{display:none!important}\n';   // crosshair replaces proximity prompts
  document.head.appendChild(st);
  const cv = document.createElement('canvas');
  cv.id = 'view3d';
  v.parentNode.insertBefore(cv, v.nextSibling);
  HP.canvas3d = cv;
  const xh = document.createElement('div'); xh.id = 'xh';
  const xl = document.createElement('div'); xl.id = 'xh-lbl';
  v.parentNode.appendChild(xh); v.parentNode.appendChild(xl);
  if (isTouch) {                                        // no E key — tap the label to use
    xl.style.pointerEvents = 'auto';
    xl.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (HP.aimUse && HP.walkUseAt) HP.walkUseAt(HP.aimUse);
    });
  }
  const pb = document.getElementById('btn-play');
  if (pb) {
    btn = document.createElement('button');
    btn.className = 'tbtn primary';
    btn.id = 'btn-play3d';
    btn.textContent = 'Play 3D';
    btn.title = 'First-person 3D walk';
    pb.parentNode.insertBefore(btn, pb.nextSibling);
    btn.onclick = () => HP.togglePlay3();
  }
  cv.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('resize', () => { if (HP.playing3) HP.resize3D(); });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', e => {
    if (HP.playing3 && e.key === 'Escape') HP.togglePlay3();
  });
  // aim-at use: capture on window so we beat walk.js's proximity E handler
  window.addEventListener('keydown', e => {
    if (!HP.playing3 || (e.key !== 'e' && e.key !== 'E' && e.key !== 'Enter')) return;
    const su = document.getElementById('stairs-ui');
    if (su && !su.classList.contains('hidden')) return;   // stairs keep priority
    if (HP.aimUse && HP.walkUseAt) {
      e.stopPropagation(); e.preventDefault();
      HP.walkUseAt(HP.aimUse);
    }
  }, true);
  document.addEventListener('pointerlockchange', () => {
    // Esc while locked drops the lock without a keydown — treat as exit
    if (HP.playing3 && !isTouch && document.pointerLockElement !== HP.canvas3d
      && HP.canvas3d._hadLock) HP.togglePlay3();
    HP.canvas3d._hadLock = document.pointerLockElement === HP.canvas3d;
  });
}

/* additive patches — applied once, all no-ops while playing3 is false */
function patch() {
  if (patched) return; patched = true;
  const _renderAll = HP.renderAll;
  HP.renderAll = function (g, cam, layer) {
    if (HP.playing3) return;                      // hidden canvas → free
    return _renderAll.call(this, g, cam, layer);
  };
  const _ss = HP.saveState;
  HP.saveState = function () {
    _ss.apply(this, arguments);
    if (HP.playing3) HP.scene3Dirty = true;
  };
  const _ir = HP.invalidateRegions;
  HP.invalidateRegions = function () {
    _ir.apply(this, arguments);
    if (HP.playing3) HP.scene3Dirty = true;
  };
}

/* ---------------- toggle ---------------- */
HP.togglePlay3 = function () {
  inject(); patch();
  if (!HP.playing3) {
    const wasPlaying = HP.playing;
    if (!wasPlaying) HP.togglePlay();
    if (!HP.playing) return;
    if (!HP.init3D()) {
      HP.status('3D needs WebGL — not supported on this device');
      if (!wasPlaying) HP.togglePlay();
      return;
    }
    HP.playing3 = true;
    HP.scene3Dirty = true;
    document.body.classList.add('playing3d');
    look.yaw = -Math.PI / 2; look.pitch = -0.06;
    HP.yaw3 = look.yaw; HP.pitch3 = look.pitch;
    HP._rot3 = look.yaw;
    HP.buildScene();
    if (!isTouch) try { HP.canvas3d.requestPointerLock(); } catch (_) {}
    if (btn) btn.textContent = 'Stop 3D';
    HP.status(isTouch
      ? '3D — left side to move, right side to look'
      : '3D — WASD move · mouse look · E use · Esc exit');
    requestAnimationFrame(loop3);
  } else {
    HP.playing3 = false;
    HP._rot3 = undefined;
    cancelAnimationFrame(raf);
    document.body.classList.remove('playing3d');
    if (document.pointerLockElement === HP.canvas3d) document.exitPointerLock();
    if (btn) btn.textContent = 'Play 3D';
    if (HP.playing) HP.togglePlay();
  }
};

/* ---------------- look input ---------------- */
function onMouseMove(e) {
  if (!HP.playing3 || isTouch) return;
  if (document.pointerLockElement !== HP.canvas3d) return;
  look.yaw -= e.movementX * 0.0024;
  look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch - e.movementY * 0.0024));
  HP.yaw3 = look.yaw; HP.pitch3 = look.pitch; HP._rot3 = look.yaw;
}

/* touch: left half = move joystick, right half = look drag */
function onDown(e) {
  if (!HP.playing3) return;
  const r = HP.canvas3d.getBoundingClientRect();
  const x = e.clientX - r.left;
  if (x < r.width * 0.5 && joyId === null) {
    joyId = e.pointerId;
    joyO = { x: e.clientX, y: e.clientY };
    const joy = document.getElementById('joy');
    if (joy) { joy.style.display = 'block'; joy.style.left = (x - 55) + 'px'; joy.style.top = (e.clientY - r.top - 55) + 'px'; }
  } else if (lookId === null) {
    lookId = e.pointerId;
    lookLast = { x: e.clientX, y: e.clientY };
  }
  if (!isTouch && document.pointerLockElement !== HP.canvas3d) {
    try { HP.canvas3d.requestPointerLock(); } catch (_) {}
  }
}
function onMove(e) {
  if (!HP.playing3) return;
  if (e.pointerId === joyId) {
    const dx = (e.clientX - joyO.x) / 55, dy = (e.clientY - joyO.y) / 55;
    const m = Math.hypot(dx, dy), nx = m > 1 ? dx / m : dx, ny = m > 1 ? dy / m : dy;
    const knob = document.querySelector('#joy .knob');
    if (knob) knob.style.transform = `translate(${nx * 34}px,${ny * 34}px)`;
    setKeys(nx, ny);
  } else if (e.pointerId === lookId) {
    look.yaw -= (e.clientX - lookLast.x) * 0.007;
    look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch - (e.clientY - lookLast.y) * 0.007));
    lookLast = { x: e.clientX, y: e.clientY };
    HP.yaw3 = look.yaw; HP.pitch3 = look.pitch; HP._rot3 = look.yaw;
  }
}
function onUp(e) {
  if (e.pointerId === joyId) {
    joyId = null; joyO = null;
    const joy = document.getElementById('joy');
    if (joy) joy.style.display = 'none';
    const knob = document.querySelector('#joy .knob');
    if (knob) knob.style.transform = '';
    setKeys(0, 0);
  } else if (e.pointerId === lookId) { lookId = null; lookLast = null; }
}

/* drive the shared key handlers so WASD-style movement stays single-sourced */
function simKey(k, down) {
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
}
function setKeys(dx, dy) {
  const want = { w: dy < -0.3, s: dy > 0.3, a: dx < -0.3, d: dx > 0.3 };
  for (const k in want)
    if (!!joyKeys[k] !== want[k]) { simKey(k, want[k]); joyKeys[k] = want[k] ? 1 : 0; }
}

/* ---------------- render loop ---------------- */
let last = 0;
function loop3(t) {
  if (!HP.playing3) return;
  if (!HP.playing) { HP.togglePlay3(); return; }    // 2D Stop pressed → clean exit
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
  last = t;
  HP.render3D(dt);
  const xh = document.getElementById('xh'), xl = document.getElementById('xh-lbl');
  if (xh) xh.classList.toggle('on', !!HP.aimUse);
  if (xl) {
    const lbl = HP.aimUse ? HP.aimUse.label : '';
    if (lbl !== xl._lbl) { xl._lbl = lbl; xl.textContent = lbl ? (isTouch ? 'Tap · ' : 'E · ') + lbl : ''; }
    xl.classList.toggle('on', !!lbl);
  }
  raf = requestAnimationFrame(loop3);
}

/* ---------------- boot ---------------- */
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', inject);
else inject();
})();
