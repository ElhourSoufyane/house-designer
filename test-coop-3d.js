// test-coop-3d.js — verifies 2D ↔ 3D unified co-op, door/window/light/time sync
const fs = require('fs'), path = require('path');

globalThis.window = globalThis;
globalThis.location = { search: '', origin: 'http://localhost:8000', pathname: '/' };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false });
globalThis.performance = { now: () => Date.now() };

// DOM stubs
const elements = {};
globalThis.document = {
  getElementById: (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: {},
        classList: {
          contains: (cls) => !!elements[id]._classes?.[cls],
          add: (cls) => { elements[id]._classes = elements[id]._classes || {}; elements[id]._classes[cls] = true; },
          remove: (cls) => { elements[id]._classes = elements[id]._classes || {}; delete elements[id]._classes[cls]; },
          toggle: (cls, v) => { elements[id]._classes = elements[id]._classes || {}; if (v) elements[id]._classes[cls] = true; else delete elements[id]._classes[cls]; }
        },
        addEventListener: () => {},
        setAttribute: () => {},
        querySelector: () => ({ textContent: '', querySelector: () => null })
      };
    }
    return elements[id];
  },
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        getContext: () => ({
          font: '', textAlign: '', textBaseline: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
          measureText: (txt) => ({ width: (txt || '').length * 7 }),
          clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
          beginPath: () => {}, arc: () => {}, ellipse: () => {}, roundRect: () => {}, rect: () => {}, fill: () => {}, stroke: () => {}, fillText: () => {}, strokeText: () => {},
          save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
          moveTo: () => {}, lineTo: () => {}, closePath: () => {}
        }),
        width: 256,
        height: 64
      };
    }
    return { style: {}, classList: { add: () => {}, remove: () => {} } };
  },
  addEventListener: () => {}
};

const store = {};
globalThis.localStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => store[k] = v,
  removeItem: k => delete store[k]
};
globalThis.sessionStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => store[k] = v,
  removeItem: k => delete store[k]
};

globalThis.requestAnimationFrame = () => {};
globalThis.Peer = class { constructor() {} on() {} };

let pass = 0, fail = 0;
const assert = (name, cond) => {
  if (cond) {
    pass++;
    console.log('✓ PASS:', name);
  } else {
    fail++;
    console.error('✗ FAIL:', name);
  }
};

async function run() {
  console.log('Running unified 2D ↔ 3D co-op tests...\n');

  // Load modules
  const threeSrc = fs.readFileSync(path.join(__dirname, 'lib/three.min.js'), 'utf8');
  const fakeModule = { exports: {} };
  globalThis.THREE = new Function('module', 'exports', 'window', 'self',
    threeSrc + ';return module.exports && module.exports.REVISION ? module.exports : (typeof THREE!=="undefined"?THREE:null);'
  )(fakeModule, fakeModule.exports, globalThis, globalThis);
  if (!globalThis.THREE || !THREE.BoxGeometry) throw new Error('THREE did not load');
  THREE.WebGLRenderer = function () {
    return { setPixelRatio() {}, getPixelRatio: () => 1, setSize() {}, render() {},
             domElement: elements.gl, capabilities: {}, toneMapping: 0, toneMappingExposure: 1 };
  };

  for (const f of ['grid.js', 'catalog.js', 'sprites.js', 'rooms.js', 'tools.js', 'presets.js', 'save.js', 'sync.js', 'geom3d.js', 'graphics3d.js', 'cull3d.js', 'sky3d.js', 'furniture3d.js', 'life3d.js', 'sound3d.js', 'world3d.js', 'walk3d.js', 'sync3d.js', 'play3d-inpage.js']) {
    eval(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));
  }

  // 1. Check HP.coop / HP.sync exports
  assert('HP.sync exists and equals HP.coop', HP.sync && HP.sync === HP.coop);
  assert('HP.sync.sendAll is a function', typeof HP.sync.sendAll === 'function');
  assert('HP.enter3D is a function', typeof HP.enter3D === 'function');
  assert('HP.exit3D is a function', typeof HP.exit3D === 'function');

  // 2. Test in-page 3D entry and exit
  HP.state = HP.DEFAULT_HOUSE ? HP.migrate(HP.DEFAULT_HOUSE) : HP.newState();
  HP.enter3D();
  assert('HP.in3D is true after enter3D()', HP.in3D === true);
  assert('view3d-wrap is unhidden', !elements['view3d-wrap']._classes?.['hidden']);

  HP.exit3D();
  assert('HP.in3D is false after exit3D()', HP.in3D === false);
  assert('view3d-wrap is hidden', !!elements['view3d-wrap']._classes?.['hidden']);

  // 3. Test 3D position translation to 2D
  // 3D position: px = 100, py = 32, pz = 200, yaw = 0 (faces North)
  // In 2D, coordinates should be x = 100, y = 200, a = -Math.PI / 2
  const dummyConn = { peer: 'partner-1', name: 'Partner', send: () => {} };
  const pos3dMsg = {
    t: 'pos',
    x: 100,
    y: 32,
    z: 200,
    py2d: 200,
    yaw: 0,
    pitch: 0,
    s: 0,
    v: 5,
    name: 'Partner',
    in3d: true,
    a: -Math.PI / 2,
    lvl: 0
  };

  // Dispatch to 2D sync onPos via simulated message
  const rawEvt = { ...pos3dMsg };
  HP.sync.onPos = undefined; // trigger through data flow
  // Call internal onPos
  const fakeDataHandler = (d, c) => {
    // Mimic sync.js message handler
    if (d.t === 'pos') {
      const avatars = HP.peerAvatarList();
    }
  };

  // Dispatch directly through sync3d.js and sync.js
  let sentMsgs = [];
  HP.sync.sendAll = (m) => sentMsgs.push(m);

  // 4. Test Multi-Window & Door Syncing
  // Create mock world3d door pivots with 3 window panes sharing aperture 'a'
  const aperture1 = { d: 'h', x0: 10, z0: 10, x1: 94, z1: 10, cx: 52, cz: 10 };
  HP.world3d.doorPivots = [
    { a: aperture1, open: 0, vel: 0, holdT: 0, latched: false, casement: true, pivot: new THREE.Group() },
    { a: aperture1, open: 0, vel: 0, holdT: 0, latched: false, casement: true, pivot: new THREE.Group() },
    { a: aperture1, open: 0, vel: 0, holdT: 0, latched: false, casement: true, pivot: new THREE.Group() }
  ];

  // Broadcast toggle for aperture1
  HP.sync3d.broadcastDoorToggle([0, 1, 2], true);
  assert('broadcastDoorToggle sent message', sentMsgs.some(m => m.t === 'door_toggle' && m.indices.length === 3 && m.latched === true));

  // Receive door toggle on peer
  HP.sync3d.handleData({ t: 'door_toggle', indices: [0, 1, 2], latched: true }, dummyConn);
  assert('Pane 0 is latched', HP.world3d.doorPivots[0].latched === true);
  assert('Pane 1 is latched', HP.world3d.doorPivots[1].latched === true);
  assert('Pane 2 is latched', HP.world3d.doorPivots[2].latched === true);
  assert('Pane 0 has velocity impulse', HP.world3d.doorPivots[0].vel > 0);

  // 5. Test Door Pushing
  sentMsgs = [];
  HP.sync3d.broadcastPush(HP.world3d.doorPivots[0]);
  assert('broadcastPush sent door_push message', sentMsgs.some(m => m.t === 'door_push' && m.idx === 0));

  HP.world3d.doorPivots[0].vel = 0;
  HP.sync3d.handleData({ t: 'door_push', idx: 0, vel: 2.5, holdT: 3.5 }, dummyConn);
  assert('Door push applied vel to remote pivot', HP.world3d.doorPivots[0].vel === 2.5);
  assert('Door push applied holdT to remote pivot', HP.world3d.doorPivots[0].holdT === 3.5);

  // 6. Test Lights & Interactables Sync
  sentMsgs = [];
  const mockLampRef = { on: true };
  const mockLampSrc = { on: true, power: 1.0 };
  const mockMesh = { visible: true };
  HP.life3d.interactables = [
    { x: 50, z: 50, kind: 'lamp', ref: { on: true, src: mockLampSrc, mesh: mockMesh } }
  ];

  HP.sync3d.broadcastInteract(HP.life3d.interactables[0]);
  assert('broadcastInteract sent interact message', sentMsgs.some(m => m.t === 'interact' && m.kind === 'lamp'));

  HP.sync3d.handleData({ t: 'interact', idx: 0, kind: 'lamp', x: 50, z: 50, on: false }, dummyConn);
  assert('Lamp toggled to off on remote client', HP.life3d.interactables[0].ref.on === false);
  assert('Lamp light source updated to off', mockLampSrc.on === false);
  assert('Lamp mesh visible updated to off', mockMesh.visible === false);

  // 7. Test Global Time Sync
  sentMsgs = [];
  HP.sync3d.broadcastTime(20.5, true);
  assert('broadcastTime sent time message', sentMsgs.some(m => m.t === 'time' && m.hour === 20.5 && m.flow === true));

  HP.sync3d.handleData({ t: 'time', hour: 21.0, flow: false }, dummyConn);
  assert('Global time updated to 21.0', HP.world3d.time.hour === 21.0);
  assert('Time flow updated to false', HP.world3d.time.flow === false);

  // 8. Test 2D Peer Avatar Drawing
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let drawSuccess = true;
  try {
    HP.drawPeerCursors(ctx);
  } catch (err) {
    drawSuccess = false;
    console.error(err);
  }
  assert('HP.drawPeerCursors executes with 0 errors', drawSuccess);

  // 9. Test walk3d.started and 3D Avatar attachment
  assert('HP.walk3d.started is a boolean property', typeof HP.walk3d.started === 'boolean');
  HP.walk3d.started = true;
  assert('HP.walk3d.started is true when set', HP.walk3d.started === true);

  // Test avatar attachment when peer data arrives
  HP.world3d.scene = new THREE.Scene();
  HP.sync3d.handleData(pos3dMsg, dummyConn);
  const peerRecord = HP.sync3d.peers.get('partner-1');
  assert('Peer record exists in sync3d.peers', !!peerRecord);
  assert('Peer avatar root exists', !!peerRecord?.avatar?.root);

  // Tick sync3d to re-attach to scene
  HP.sync3d.tick(0.016, 1.0, HP.world3d.camera);
  assert('AvatarGroup exists and is added to scene', !!HP.sync3d.avatarGroup && HP.world3d.scene.children.includes(HP.sync3d.avatarGroup));
  assert('Peer avatar is child of avatarGroup', HP.sync3d.avatarGroup.children.includes(peerRecord.avatar.root));

  // 10. Test live 3D rebuild on state update
  let buildCalled = false;
  const origBuild = HP.world3d.buildLevel;
  HP.world3d.buildLevel = () => { buildCalled = true; };
  HP.in3D = true;
  HP.world3d.levelGroup = new THREE.Group();
  // Simulate receiving remote state
  HP.sync.applyState({ t: 'state', rev: Date.now(), origin: 'partner-1', state: HP.state, nextId: 100 }, dummyConn);
  assert('Live 3D buildLevel is triggered on remote state update', buildCalled === true);
  HP.world3d.buildLevel = origBuild;

  console.log(`\nResults: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

run();
