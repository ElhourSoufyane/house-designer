/* sync3d.js — Real-Time 3D Multiplayer & Co-op Walk
   Uses PeerJS over WebRTC for zero-backend, browser-to-browser P2P networking.
   Features:
   - 4-letter room codes & 1-click invite links (?room=CODE)
   - Stylized 3D player avatars with walking/running animations & head pitch tracking
   - Sitting pose sync on chairs, sofas, and beds
   - Real-time door, window, and interactive lamp/TV synchronization
   - Smooth positional interpolation (lerp) & 3D floating nameplates with emotes
*/
(function () {
  'use strict';
  const PREFIX = 'houseplan3d-';
  const LS_NAME = 'hd_name';
  const CURSOR_COLORS = ['#38bdf8', '#f43f5e', '#a855f7', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#eab308'];

  function nameColor(n) {
    let h = 0; for (const ch of n || '?') h = (h * 31 + ch.charCodeAt(0)) % 997;
    return CURSOR_COLORS[h % CURSOR_COLORS.length];
  }

  const S3 = {
    peer: null,
    conns: [],
    mode: null,          // 'host' | 'guest' | null
    roomCode: null,
    myName: localStorage.getItem(LS_NAME) || 'Player',
    peers: new Map(),    // peerId -> { data, target, current, avatar, lastSeen }
    avatarGroup: null,
    active: false,
    sendTimer: null,
    lastSentPos: null,
  };
  HP.sync3d = S3;

  /* ---------- 3D Billboard Nameplate Generator ---------- */
  function createNameplate(initialName, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    let curName = initialName || 'Partner';
    let texture = null;

    function redraw(emote, newName) {
      if (newName) curName = newName;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (emote) {
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emote, 128, 28);
      }
      // Rounded pill tag
      const text = curName || 'Partner';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const tw = ctx.measureText(text).width;
      const pw = Math.max(90, tw + 32);
      const px = (canvas.width - pw) / 2;
      const py = emote ? 34 : 18;
      const ph = 26;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 13);
      ctx.fill();

      ctx.strokeStyle = color || '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dot indicator
      ctx.fillStyle = color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(px + 14, py + ph / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Name text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px + pw / 2 + 6, py + ph / 2 + 1);

      if (texture) texture.needsUpdate = true;
    }
    redraw();

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(18, 4.5, 1);
    sprite.renderOrder = 999;
    sprite.redraw = redraw;
    return sprite;
  }

  /* ---------- Stylized 3D Avatar Builder ---------- */
  function buildAvatar(name) {
    const g = new THREE.Group();
    const color = nameColor(name);

    const skinMat = new THREE.MeshStandardMaterial({ color: '#fcd3b6', roughness: 0.6, metalness: 0.05 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7, metalness: 0.1 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#3b2f2f', roughness: 0.9 });

    // 1. Torso / Hoodie
    const torso = new THREE.Mesh(new THREE.BoxGeometry(7.2, 11.5, 4.2), clothesMat);
    torso.position.y = 26.5;
    g.add(torso);

    // Hoodie pocket & zipper detail
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.8, 0.4), new THREE.MeshStandardMaterial({ color: HP.shade ? HP.shade(color, 0.85) : color, roughness: 0.6 }));
    pocket.position.set(0, 24.2, 2.2);
    g.add(pocket);

    // 2. Head Group (Rotates in pitch)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 34.5, 0);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 10), skinMat);
    neck.position.y = 1.0;
    headGroup.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(5.4, 5.6, 5.2), skinMat);
    head.position.y = 4.6;
    headGroup.add(head);

    // Hair cap
    const hair = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 5.6), hairMat);
    hair.position.set(0, 6.8, -0.2);
    headGroup.add(hair);

    // Stylized eyes/sunglasses visor
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 0.6), darkMat);
    glasses.position.set(0, 5.0, 2.65);
    headGroup.add(glasses);

    g.add(headGroup);

    // 3. Limbs (Hierarchical pivots for smooth walk cycles)
    // Left Leg
    const legL = new THREE.Group();
    legL.position.set(-2.0, 21.0, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 18.0, 3.0), darkMat);
    legLMesh.position.y = -9.0;
    legL.add(legLMesh);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.8, 4.4), shoeMat);
    shoeL.position.set(0, -17.0, 0.7);
    legL.add(shoeL);
    g.add(legL);

    // Right Leg
    const legR = new THREE.Group();
    legR.position.set(2.0, 21.0, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 18.0, 3.0), darkMat);
    legRMesh.position.y = -9.0;
    legR.add(legRMesh);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.8, 4.4), shoeMat);
    shoeR.position.set(0, -17.0, 0.7);
    legR.add(shoeR);
    g.add(legR);

    // Left Arm
    const armL = new THREE.Group();
    armL.position.set(-4.6, 31.0, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 11.0, 2.6), clothesMat);
    armLMesh.position.y = -5.5;
    armL.add(armLMesh);
    const handL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 2.0), skinMat);
    handL.position.y = -11.5;
    armL.add(handL);
    g.add(armL);

    // Right Arm
    const armR = new THREE.Group();
    armR.position.set(4.6, 31.0, 0);
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 11.0, 2.6), clothesMat);
    armRMesh.position.y = -5.5;
    armR.add(armRMesh);
    const handR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 2.0), skinMat);
    handR.position.y = -11.5;
    armR.add(handR);
    g.add(armR);

    // 4. Floating Name Tag Billboard
    const nameplate = createNameplate(name, color);
    nameplate.position.y = 44.0;
    g.add(nameplate);

    return {
      root: g,
      headGroup,
      legL,
      legR,
      armL,
      armR,
      torso,
      nameplate,
      phase: Math.random() * Math.PI * 2,
    };
  }

  /* ---------- Scene Setup & Avatar Registration ---------- */
  function initScene(scene) {
    if (!S3.avatarGroup) {
      S3.avatarGroup = new THREE.Group();
      scene.add(S3.avatarGroup);
    }
  }

  function getOrCreatePeer(peerId, name) {
    if (S3.peers.has(peerId)) {
      const p = S3.peers.get(peerId);
      if (name && p.name !== name) {
        p.name = name;
        if (p.avatar && p.avatar.nameplate) p.avatar.nameplate.redraw(p.emote, name);
      }
      return p;
    }
    const avatar = buildAvatar(name || 'Partner');
    if (S3.avatarGroup) S3.avatarGroup.add(avatar.root);

    const record = {
      peerId,
      name: name || 'Partner',
      avatar,
      current: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, s: 0, v: 0 },
      target: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, s: 0, v: 0 },
      lastSeen: Date.now(),
      emote: null,
      emoteTimer: null
    };
    S3.peers.set(peerId, record);
    updateCoopPill();
    return record;
  }

  function removePeer(peerId) {
    if (!S3.peers.has(peerId)) return;
    const p = S3.peers.get(peerId);
    if (p.avatar && p.avatar.root && S3.avatarGroup) {
      S3.avatarGroup.remove(p.avatar.root);
    }
    S3.peers.delete(peerId);
    updateCoopPill();
  }

  /* ---------- Position & Animation Tick ---------- */
  function tick(dt, now, camera) {
    for (const [peerId, p] of S3.peers) {
      const cur = p.current, tgt = p.target, av = p.avatar;
      if (!av) continue;

      // Smooth Lerp Position & Yaw
      const lerpFactor = Math.min(1.0, dt * 14.0);
      cur.x += (tgt.x - cur.x) * lerpFactor;
      cur.y += (tgt.y - cur.y) * lerpFactor;
      cur.z += (tgt.z - cur.z) * lerpFactor;

      // Angular lerp for yaw
      let dyaw = ((tgt.yaw - cur.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      cur.yaw += dyaw * lerpFactor;
      cur.pitch += (tgt.pitch - cur.pitch) * lerpFactor;
      cur.s = tgt.s;
      cur.v += (tgt.v - cur.v) * lerpFactor;

      av.root.position.set(cur.x, cur.y, cur.z);
      av.root.rotation.y = cur.yaw;
      av.headGroup.rotation.x = Math.max(-0.9, Math.min(0.9, cur.pitch * 0.65));

      // Walking & Running Animation Cycle
      if (cur.s) {
        // Sitting Pose
        av.torso.position.y = 17.0;
        av.headGroup.position.y = 25.0;
        av.legL.position.set(-2.0, 14.0, 1.0);
        av.legR.position.set(2.0, 14.0, 1.0);
        av.legL.rotation.x = -Math.PI / 2;
        av.legR.rotation.x = -Math.PI / 2;
        av.armL.rotation.x = -0.4;
        av.armR.rotation.x = -0.4;
      } else {
        // Standing / Walking
        av.torso.position.y = 26.5;
        av.headGroup.position.y = 34.5;
        av.legL.position.set(-2.0, 21.0, 0);
        av.legR.position.set(2.0, 21.0, 0);

        if (cur.v > 3.0) {
          const freq = cur.v > 90 ? 15.0 : 10.0;
          av.phase += dt * freq;
          const swing = Math.sin(av.phase) * (cur.v > 90 ? 0.75 : 0.52);
          av.legL.rotation.x = swing;
          av.legR.rotation.x = -swing;
          av.armL.rotation.x = -swing * 0.85;
          av.armR.rotation.x = swing * 0.85;
        } else {
          av.legL.rotation.x = 0;
          av.legR.rotation.x = 0;
          av.armL.rotation.x = 0;
          av.armR.rotation.x = 0;
        }
      }
    }
  }

  /* ---------- Network Message Transport ---------- */
  function sendAll(msg) {
    for (const c of S3.conns) {
      try { if (c.open) c.send(msg); } catch (e) {}
    }
  }

  function handleData(raw, conn) {
    if (!raw || !raw.t) return;
    const d = raw;
    const peerId = conn.peer;

    if (d.t === 'hello') {
      conn.name = d.name || 'Partner';
      const p = getOrCreatePeer(peerId, d.name);
      notify(`${d.name} joined the 3D walk!`);
      // If host, send current house state and doors/lamps
      if (S3.mode === 'host' && HP.state) {
        conn.send({ t: 'house', state: HP.state, nextId: HP.nextId });
        syncWorldStateTo(conn);
      }
    } else if (d.t === 'pos') {
      const p = getOrCreatePeer(peerId, d.name || conn.name);
      if (!p.hasFirstPos) {
        p.hasFirstPos = true;
        p.current.x = d.x;
        p.current.y = d.y || 0;
        p.current.z = d.z;
        p.current.yaw = d.yaw || 0;
        p.current.pitch = d.pitch || 0;
        p.current.s = d.s ? 1 : 0;
        p.current.v = d.v || 0;
        if (p.avatar && p.avatar.root) {
          p.avatar.root.position.set(d.x, d.y || 0, d.z);
        }
      }
      p.target.x = d.x;
      p.target.y = d.y || 0;
      p.target.z = d.z;
      p.target.yaw = d.yaw || 0;
      p.target.pitch = d.pitch || 0;
      p.target.s = d.s ? 1 : 0;
      p.target.v = d.v || 0;
      p.lastSeen = Date.now();
    } else if (d.t === 'door') {
      applyDoorState(d);
    } else if (d.t === 'lamp') {
      applyLampState(d);
    } else if (d.t === 'mover') {
      applyMoverState(d);
    } else if (d.t === 'emote') {
      applyEmote(peerId, d.emote);
    } else if (d.t === 'house') {
      if (d.state) {
        notify('Loaded shared house from host');
        HP.state = HP.migrate(d.state);
        HP.nextId = d.nextId || HP.nextId;
        if (HP.world3d && HP.world3d.buildLevel) {
          HP.invalidateRegions();
          HP.world3d.buildLevel();
        }
      }
    }
  }

  function setupConn(c) {
    c.on('open', () => {
      S3.conns.push(c);
      c.send({ t: 'hello', name: S3.myName });
      updateCoopPill();
    });
    c.on('data', d => handleData(d, c));
    const onDrop = () => {
      S3.conns = S3.conns.filter(x => x !== c);
      removePeer(c.peer);
      updateCoopPill();
      if (c.name) notify(`${c.name} left`);
    };
    c.on('close', onDrop);
    c.on('error', onDrop);
  }

  /* ---------- World Interaction Syncing ---------- */
  function syncWorldStateTo(conn) {
    // Sync doors
    if (HP.world3d && HP.world3d.doorPivots) {
      HP.world3d.doorPivots.forEach((d, idx) => {
        if (d.open > 0.05) conn.send({ t: 'door', idx, open: d.open, vel: d.vel || 0 });
      });
    }
  }

  function applyDoorState(d) {
    if (!HP.world3d || !HP.world3d.doorPivots) return;
    const dp = HP.world3d.doorPivots[d.idx];
    if (dp) {
      dp.open = d.open;
      dp.vel = d.vel || 0;
      dp.holdT = 3.5;
    }
  }

  function applyLampState(d) {
    if (!HP.world3d || !HP.world3d.lamps) return;
    const lamp = HP.world3d.lamps.find(l => l.it && l.it.id === d.id);
    if (lamp) {
      lamp.on = d.on;
      if (lamp.light) lamp.light.visible = d.on;
    }
  }

  function applyMoverState(d) {
    if (!HP.world3d || !HP.world3d.movers) return;
    const mv = HP.world3d.movers[d.inst];
    if (mv) {
      mv.x = d.x; mv.z = d.z;
      if (mv.box) { mv.box.x0 = d.x; mv.box.z0 = d.z; }
    }
  }

  function applyEmote(peerId, emote) {
    const p = S3.peers.get(peerId);
    if (!p || !p.avatar || !p.avatar.nameplate) return;
    p.emote = emote;
    p.avatar.nameplate.redraw(emote, p.name);
    clearTimeout(p.emoteTimer);
    p.emoteTimer = setTimeout(() => {
      p.emote = null;
      p.avatar.nameplate.redraw('', p.name);
    }, 4000);
  }

  S3.broadcastDoor = function (idx, open, vel) {
    sendAll({ t: 'door', idx, open, vel });
  };

  S3.broadcastLamp = function (id, on) {
    sendAll({ t: 'lamp', id, on });
  };

  S3.broadcastMover = function (inst, x, z) {
    sendAll({ t: 'mover', inst, x, z });
  };

  S3.sendEmote = function (emote) {
    sendAll({ t: 'emote', emote });
    notify(`Emote: ${emote}`);
  };

  /* ---------- Co-op Host & Join Mechanics ---------- */
  function mkCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  S3.host = function (customCode) {
    S3.leave();
    const clean = (typeof customCode === 'string' && customCode.trim()) ? customCode.trim().toUpperCase() : null;
    S3.roomCode = clean || mkCode();
    notify(`Creating room ${S3.roomCode}…`);
    try {
      S3.peer = new Peer(PREFIX + S3.roomCode);
      S3.peer.on('error', e => {
        if (e && e.type === 'unavailable-id') {
          if (clean) notify(`Room ${clean} is already hosted`);
          else S3.host();
        } else {
          notify(`Co-op error: ${e && e.type}`);
        }
      });
      S3.peer.on('open', () => {
        S3.mode = 'host';
        notify(`Room ${S3.roomCode} ready! Share invite link with your partner`);
        updateCoopPill();
        renderModal();
      });
      S3.peer.on('connection', setupConn);
    } catch (err) {
      notify('Multiplayer network init failed');
    }
  };

  S3.join = function (code, autoHostFallback) {
    S3.leave();
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.length < 3) { notify('Please enter a room code'); return; }
    S3.roomCode = cleanCode;
    notify(`Joining room ${cleanCode}…`);
    try {
      S3.peer = new Peer();
      S3.peer.on('error', e => {
        if (e && e.type === 'peer-unavailable') {
          if (autoHostFallback) {
            notify(`Hosting room ${cleanCode}…`);
            S3.host(cleanCode);
          } else {
            notify('Room not found — check code and try again');
          }
        } else {
          notify(`Co-op error: ${e && e.type}`);
        }
      });
      S3.peer.on('open', () => {
        S3.mode = 'guest';
        const c = S3.peer.connect(PREFIX + cleanCode, { reliable: true });
        setupConn(c);
        updateCoopPill();
        renderModal();
      });
      S3.peer.on('connection', setupConn);
    } catch (err) {
      notify('Connection failed');
    }
  };

  S3.leave = function () {
    for (const c of S3.conns) { try { c.close(); } catch (e) {} }
    S3.conns = [];
    if (S3.peer) { try { S3.peer.destroy(); } catch (e) {} S3.peer = null; }
    for (const [id] of S3.peers) removePeer(id);
    S3.mode = null;
    S3.roomCode = null;
    updateCoopPill();
    renderModal();
  };

  /* ---------- Notification helper ---------- */
  function notify(msg) {
    if (HP.status) HP.status(msg);
    const p = document.getElementById('prompt');
    if (p) {
      p.style.display = 'block';
      p.textContent = msg;
      setTimeout(() => { if (p.textContent === msg) p.style.display = 'none'; }, 3500);
    }
  }

  /* ---------- Topbar UI & Modal ---------- */
  function updateCoopPill() {
    const btn = document.getElementById('btn-coop');
    if (!btn) return;
    if (S3.conns.length > 0) {
      btn.innerHTML = `👥 Online (${S3.conns.length + 1})`;
      btn.style.background = '#059669';
      btn.style.borderColor = '#34d399';
    } else if (S3.mode === 'host') {
      btn.innerHTML = `📡 Room ${S3.roomCode}`;
      btn.style.background = '#2563eb';
      btn.style.borderColor = '#60a5fa';
    } else {
      btn.innerHTML = '👥 Online';
      btn.style.background = '';
      btn.style.borderColor = '';
    }
  }

  function copyInvite() {
    const url = location.origin + location.pathname + '?room=' + S3.roomCode;
    const btn = document.getElementById('coop3d-copy');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          notify('Invite link copied — send it to your partner!');
          if (btn) { const orig = btn.innerHTML; btn.innerHTML = '✓ Copied!'; setTimeout(() => { if (btn) btn.innerHTML = orig; }, 2500); }
        })
        .catch(() => prompt('Copy this invite link:', url));
    } else {
      prompt('Copy this invite link:', url);
    }
  }

  function renderModal() {
    const modal = document.getElementById('coop3d-modal');
    if (!modal) return;
    const inviteUrl = S3.roomCode ? (location.origin + location.pathname + '?room=' + S3.roomCode) : '';

    if (S3.conns.length > 0) {
      const names = S3.conns.map(c => c.name || 'Partner').join(', ');
      modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0;font-size:15px;color:#38bdf8">👥 Online 3D Walk</h3>
          <button id="coop3d-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">×</button>
        </div>
        <div style="font-size:13px;color:#e2e8f0;margin-bottom:8px">Room Code: <b style="letter-spacing:1px;color:#facc15">${S3.roomCode}</b></div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Walking with: <b style="color:#f8fafc">${names}</b></div>
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button id="coop3d-copy" class="btn" style="flex:1;background:#2563eb;color:#fff;padding:6px 10px;font-size:12px;border-radius:6px">📋 Copy Link</button>
          <button id="coop3d-leave" class="btn" style="background:#dc2626;color:#fff;padding:6px 10px;font-size:12px;border-radius:6px">Leave</button>
        </div>
        <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px">Quick Emotes:</div>
        <div style="display:flex;gap:6px">
          <button class="btn emote-btn" data-e="👋" style="font-size:16px;padding:4px 8px">👋</button>
          <button class="btn emote-btn" data-e="❤️" style="font-size:16px;padding:4px 8px">❤️</button>
          <button class="btn emote-btn" data-e="✨" style="font-size:16px;padding:4px 8px">✨</button>
          <button class="btn emote-btn" data-e="☕" style="font-size:16px;padding:4px 8px">☕</button>
        </div>
      `;
      modal.querySelector('#coop3d-copy').onclick = copyInvite;
      modal.querySelector('#coop3d-leave').onclick = S3.leave;
      modal.querySelectorAll('.emote-btn').forEach(b => b.onclick = () => S3.sendEmote(b.getAttribute('data-e')));
    } else if (S3.mode === 'host') {
      modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0;font-size:15px;color:#38bdf8">📡 Hosting 3D House</h3>
          <button id="coop3d-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">×</button>
        </div>
        <div style="background:#1e293b;border:1px dashed #38bdf8;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase">Room Code</div>
          <div style="font-size:26px;font-weight:900;letter-spacing:4px;color:#facc15">${S3.roomCode}</div>
        </div>
        <button id="coop3d-copy" class="btn" style="width:100%;background:#059669;color:#fff;padding:9px;font-size:13px;border-radius:6px;font-weight:bold;margin-bottom:6px">📋 Copy Invite Link</button>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">Direct Join Link:</div>
        <input type="text" id="coop3d-link-input" readonly value="${inviteUrl}" onclick="this.select()" style="width:100%;background:#0f172a;border:1px solid rgba(255,255,255,.2);color:#38bdf8;border-radius:6px;padding:6px;font-size:11px;box-sizing:border-box;margin-bottom:10px;cursor:pointer" title="Click to select">
        <div style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:10px">Send this link to your partner to join you!</div>
        <button id="coop3d-cancel" class="btn" style="width:100%;background:#475569;color:#fff;padding:6px;font-size:12px;border-radius:6px">Cancel Hosting</button>
      `;
      modal.querySelector('#coop3d-copy').onclick = copyInvite;
      modal.querySelector('#coop3d-cancel').onclick = S3.leave;
    } else {
      modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0;font-size:15px;color:#38bdf8">👥 Walk in 3D Together</h3>
          <button id="coop3d-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">×</button>
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Your Name</label>
          <input type="text" id="coop3d-name-input" value="${S3.myName}" maxlength="16" style="width:100%;background:#1e293b;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:6px;padding:6px 8px;font-size:13px;box-sizing:border-box">
        </div>
        <button id="coop3d-host-btn" class="btn" style="width:100%;background:#059669;color:#fff;padding:8px;font-size:13px;font-weight:bold;border-radius:6px;margin-bottom:10px">🏠 Host My House (Get Code)</button>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <input type="text" id="coop3d-code-input" placeholder="ABCD" maxlength="8" style="flex:1;text-transform:uppercase;background:#1e293b;border:1px solid rgba(255,255,255,.2);color:#facc15;font-weight:bold;letter-spacing:2px;border-radius:6px;padding:6px 8px;font-size:14px;box-sizing:border-box">
          <button id="coop3d-join-btn" class="btn" style="background:#2563eb;color:#fff;padding:7px 12px;font-size:13px;font-weight:bold;border-radius:6px">Join</button>
        </div>
        <div style="font-size:11px;color:#94a3b8">Host generates a room code or link. Partner joins and explores your house together in real time!</div>
      `;
      modal.querySelector('#coop3d-name-input').oninput = e => {
        S3.myName = e.target.value.trim() || 'Player';
        localStorage.setItem(LS_NAME, S3.myName);
      };
      modal.querySelector('#coop3d-host-btn').onclick = () => {
        const c = modal.querySelector('#coop3d-code-input').value;
        S3.host(c);
      };
      modal.querySelector('#coop3d-join-btn').onclick = () => {
        const c = modal.querySelector('#coop3d-code-input').value;
        S3.join(c);
      };
    }
    const closeBtn = modal.querySelector('#coop3d-close');
    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
  }

  S3.toggleModal = function () {
    const modal = document.getElementById('coop3d-modal');
    if (!modal) return;
    if (modal.style.display === 'none' || !modal.style.display) {
      renderModal();
      modal.style.display = 'block';
    } else {
      modal.style.display = 'none';
    }
  };

  /* ---------- Integration Hook with walk3d Loop ---------- */
  S3.hook = function (world3d, walk3d) {
    if (S3.active) return;
    S3.active = true;

    initScene(world3d.scene);

    // Position Broadcast Loop (20Hz)
    setInterval(() => {
      if (!S3.conns.length || !walk3d || !walk3d.playerPos) return;
      const pos = walk3d.playerPos();
      if (!pos) return;
      const msg = {
        t: 'pos',
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10,
        yaw: Math.round(pos.yaw * 100) / 100,
        pitch: Math.round(pos.pitch * 100) / 100,
        s: pos.sitting ? 1 : 0,
        v: Math.round((pos.speed || 0) * 10) / 10,
        name: S3.myName
      };
      sendAll(msg);
    }, 50);

    // Bind Auto-Join from URL query parameter ?room=CODE (with auto-host fallback if empty)
    const urlCode = new URLSearchParams(location.search).get('room');
    if (urlCode && urlCode.length >= 3) {
      setTimeout(() => S3.join(urlCode, true), 400);
    }
  };

  S3.tick = tick;
})();
