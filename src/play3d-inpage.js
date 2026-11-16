/* play3d-inpage.js — In-page 3D walkthrough integration
   Keeps the 3D walkthrough inside index.html without navigating away,
   preserving the WebRTC multiplayer co-op session, undo stack, and editor state.
*/
(function () {
  'use strict';
  window.HP = window.HP || {};

  HP.in3D = false;
  HP._3dInitialized = false;

  HP.init3D = function () {
    if (HP._3dInitialized) return;
    HP._3dInitialized = true;

    const glCanvas = document.getElementById('gl');
    if (!glCanvas || !HP.world3d) return;

    const W3 = HP.world3d;
    W3.init(glCanvas);

    const graphics = document.getElementById('graphics');
    const graphicsButton = document.getElementById('btn-graphics');
    const graphicsClose = document.getElementById('graphics-close');
    const quality = document.getElementById('quality');
    if (quality && HP.graphics3d) {
      quality.value = HP.graphics3d.mode;
      if (HP.graphics3d.onChange) HP.graphics3d.onChange();
      quality.onchange = () => HP.graphics3d.setQuality(quality.value);
    }

    const toggleGraphics = (show) => {
      if (!graphics || !graphicsButton) return;
      const next = typeof show === 'boolean' ? show : graphics.hidden;
      graphics.hidden = !next;
      graphicsButton.setAttribute('aria-expanded', String(next));
    };
    if (graphicsButton) graphicsButton.onclick = (e) => { e.stopPropagation(); toggleGraphics(); };
    if (graphicsClose) graphicsClose.onclick = (e) => { e.stopPropagation(); toggleGraphics(false); };
    window.addEventListener('click', (e) => {
      if (graphics && !graphics.hidden && !graphics.contains(e.target) && !graphicsButton.contains(e.target)) {
        toggleGraphics(false);
      }
    });

    const warn = document.getElementById('gpu-warn');
    if (warn && HP.graphics3d) {
      warn.hidden = !HP.graphics3d.software;
      const warnClose = document.getElementById('gpu-warn-close');
      if (warnClose) warnClose.onclick = () => { warn.hidden = true; };
    }

    const tod = document.getElementById('tod');
    const todFlow = document.getElementById('tod-flow');
    const todLabel = document.getElementById('tod-label');
    const syncTod = () => {
      if (tod && W3.time) tod.value = W3.time.hour;
      if (todLabel && W3.time && HP.sky3d) todLabel.textContent = HP.sky3d.clock(W3.time.hour);
    };
    if (todFlow && W3.time) todFlow.checked = W3.time.flow;
    syncTod();
    setInterval(() => {
      if (graphics && !graphics.hidden && document.activeElement !== tod) syncTod();
    }, 1000);

    if (tod) {
      tod.oninput = () => {
        W3.setTime(+tod.value);
        if (todLabel && HP.sky3d) todLabel.textContent = HP.sky3d.clock(+tod.value);
        if (HP.sync3d && HP.sync3d.broadcastTime) {
          HP.sync3d.broadcastTime(+tod.value, todFlow ? todFlow.checked : false);
        }
      };
    }
    if (todFlow) {
      todFlow.onchange = () => {
        W3.setTimeFlow(todFlow.checked);
        if (HP.sync3d && HP.sync3d.broadcastTime) {
          HP.sync3d.broadcastTime(W3.time.hour, todFlow.checked);
        }
      };
    }

    const snd = document.getElementById('sound');
    const sndBtn = document.getElementById('btn-sound');
    const syncSnd = () => {
      const on = HP.sound3d && HP.sound3d.enabled();
      if (snd) snd.checked = !!on;
      if (sndBtn) {
        sndBtn.textContent = on ? '🔊' : '🔇';
        sndBtn.title = on ? 'Sound: On (Click to mute)' : 'Sound: Muted (Click to turn on)';
        sndBtn.style.opacity = on ? '1' : '0.6';
      }
    };
    if (HP.sound3d) {
      syncSnd();
      if (snd) snd.onchange = () => { HP.sound3d.setEnabled(snd.checked); if (snd.checked) HP.sound3d.start(); syncSnd(); };
      if (sndBtn) sndBtn.onclick = () => { const next = !HP.sound3d.enabled(); HP.sound3d.setEnabled(next); if (next) HP.sound3d.start(); syncSnd(); };
    }

    const pushBox = document.getElementById('push-furniture');
    if (pushBox) {
      pushBox.checked = !!HP.pushFurniture;
      pushBox.onchange = () => { HP.pushFurniture = pushBox.checked; };
    }

    if (HP.walk3d) HP.walk3d.boot();
    if (HP.sync3d && HP.sync3d.hook) HP.sync3d.hook(W3, HP.walk3d);

    const overlay = document.getElementById('overlay');
    if (overlay) {
      if (HP.graphics3d && HP.graphics3d.touch) {
        const p = overlay.querySelector('p');
        if (p) p.textContent = 'tap to enter your home';
        const k = overlay.querySelector('.keys');
        if (k) k.textContent = 'Left stick to walk. Drag the right side to look. Tap a door prompt to interact.';
      }
      overlay.addEventListener('click', () => {
        let spawn = { x: HP.GRID_W * HP.CELL / 2, y: HP.GRID_H * HP.CELL / 2, yaw: Math.PI };
        const { regions } = HP.computeRegions();
        if (regions && regions.length) {
          const big = regions.reduce((a, b) => a.cells.length > b.cells.length ? a : b);
          spawn = { x: big.lx, y: big.ly };
        }
        HP.walk3d.resume(spawn);
      });
    }

    const btnEditor = document.getElementById('btn-editor');
    if (btnEditor) btnEditor.onclick = () => HP.exit3D();

    const btnAudit = document.getElementById('btn-audit');
    const panel = document.getElementById('audit');
    if (btnAudit && panel) {
      btnAudit.onclick = () => {
        const checks = W3.runAudit();
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">Physical wall check</h3><button onclick="document.getElementById(\'audit\').style.display=\'none\'" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">×</button></div>' + checks.map(c =>
          `<div class="chk"><span class="${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '✗'}</span>
           <div><div>${c.name}</div><div class="det">${c.detail}</div></div></div>`).join('');
      };
    }

    const btnRebuild = document.getElementById('btn-rebuild');
    if (btnRebuild) {
      btnRebuild.onclick = () => {
        HP.invalidateRegions();
        W3.buildLevel();
      };
    }
  };

  let rebuildTimer = null;
  let pendingStaticChanged = false;
  HP.request3DRebuild = function (delay = 40, opts = {}) {
    if (!HP.in3D || !HP.world3d || !HP.world3d.scene || !HP.world3d.levelGroup) return;
    if (opts.staticChanged) pendingStaticChanged = true;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      const mustRebuildStatic = pendingStaticChanged;
      pendingStaticChanged = false;
      if (HP.in3D && HP.world3d) {
        if (mustRebuildStatic || !HP.world3d.furnitureGroup) {
          HP.invalidateRegions();
          HP.world3d.buildLevel();
        } else {
          if (HP.world3d.updateFurnitureAsync) {
            HP.world3d.updateFurnitureAsync();
          } else if (HP.world3d.updateFurniture) {
            HP.world3d.updateFurniture();
          } else {
            HP.world3d.buildLevel();
          }
        }
      }
    }, delay);
  };

  HP.enter3D = function (targetSpawn) {
    if (HP.editingInterior) HP.exitInterior();
    try {
      localStorage.setItem('homeplanner_save_v1', JSON.stringify({ state: HP.state, nextId: HP.nextId }));
    } catch (e) {}

    HP.in3D = true;
    const wrap = document.getElementById('view3d-wrap');
    if (wrap) {
      wrap.classList.remove('hidden');
      if (HP.graphics3d && HP.graphics3d.touch) wrap.classList.add('touch-controls');
    }

    HP.init3D();
    HP.invalidateRegions();
    if (HP.world3d) HP.world3d.buildLevel();

    let spawn = targetSpawn;
    if (!spawn) {
      spawn = { x: HP.GRID_W * HP.CELL / 2, y: HP.GRID_H * HP.CELL / 2, yaw: Math.PI };
      const { regions } = HP.computeRegions();
      if (regions && regions.length) {
        const big = regions.reduce((a, b) => a.cells.length > b.cells.length ? a : b);
        spawn = { x: big.lx, y: big.ly };
      }
    }

    if (HP.walk3d) HP.walk3d.resume(spawn);
  };

  HP.exit3D = function () {
    HP.in3D = false;
    if (HP.walk3d && HP.walk3d.pause) HP.walk3d.pause();
    if (HP.sound3d && HP.sound3d.suspend) HP.sound3d.suspend();

    const name = (HP.sync && HP.sync.myName) || (HP.sync3d && HP.sync3d.myName) || 'Player';
    if (HP.sync && HP.sync.sendAll) {
      HP.sync.sendAll({ t: 'pos', off: true, name });
    }

    if (document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }

    const wrap = document.getElementById('view3d-wrap');
    if (wrap) wrap.classList.add('hidden');

    HP.markDirty();
  };
})();
