/* life3d.js — the living layer: birds, butterflies, fireflies, and
   furniture that actually works (fan spins, clock tells game time,
   fish swim, fire flickers, TV/lamps toggle with E).
   All procedural — no assets, per-frame cost is a handful of small
   meshes; creatures are skipped entirely on the Low tier.          */
window.HP = window.HP || {};
(function () {
const L = HP.life3d = {};
const C = () => HP.CELL;
let group = null;            // one group per level, dies with levelGroup
const spinners = [];         // {obj, speed}
const clockHands = [];       // {hour, min} hand meshes
const fish = [];             // {mesh, cx, cz, rx, rz, ph, sp, y}
const fires = [];            // {cones[], light, on, base}
const screens = [];          // {mat, on, mesh}
const lampBulbs = [];        // {mesh, src, on}
const birds = [];
const flies = [];            // butterflies
let fireflies = null, fireflySeed = null;
let dog = null;              // the pet

L.interactables = [];
L.dogState = () => dog && { x: dog.x, z: dog.z, state: dog.state };

/* ---------- helpers ---------- */
function std(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, opts || {}));
}
function glowMat(color) {
  return new THREE.MeshBasicMaterial({ color });   // unlit = self-glowing
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/* ---------- per-item working parts ---------- */
function addFan(cx, cz) {
  const g = new THREE.Group();
  const m = std('#6d5b45');
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 6), m);
  rod.position.y = -4;
  g.add(rod);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = box(26, 0.7, 5, m);
    b.position.set(13, 0, 0);
    const holder = new THREE.Group();
    holder.add(b); holder.rotation.y = i * Math.PI / 2;
    blades.add(holder);
  }
  blades.position.y = -8;
  g.add(blades);
  g.position.set(cx, HP.geom3d.WALL_H - 2, cz);
  group.add(g);
  spinners.push({ obj: blades, speed: 7 });
}
function addClock(cx, cz, rot, w, off) {
  const g = new THREE.Group();
  const r = Math.min(w, 26) * 0.42;
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 20), std('#f4efe4'));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.09, 6, 20), std('#4a3b2c'));
  const hour = box(r * 0.55, r * 0.09, 0.4, std('#33291f'));
  const minute = box(r * 0.85, r * 0.07, 0.4, std('#33291f'));
  hour.geometry.translate(r * 0.27, 0, 0); hour.position.z = 0.6;
  minute.geometry.translate(r * 0.42, 0, 0); minute.position.z = 0.9;
  g.add(face, rim, hour, minute);
  g.position.set(cx, 44, cz);
  g.rotation.y = -rot * Math.PI / 2;
  /* wall clocks sit proud of the wall face; floor clocks on their case */
  const fwd = new THREE.Vector3(0, 0, off === undefined ? 2.6 : off).applyEuler(g.rotation);
  g.position.add(fwd);
  group.add(g);
  clockHands.push({ hour, minute });
}
function addFish(cx, cz, w, dep, tankY) {
  const species = [
    { name: 'clownfish', body: '#ff6914', fin: '#ff8533', tail: '#ff6914', stripes: true, sp: 0.65, rx: w * 0.28, rz: dep * 0.22, yOff: 0, sc: 1.1 },
    { name: 'bluetang', body: '#1963d2', fin: '#ffce1f', tail: '#ffce1f', stripes: false, sp: 0.82, rx: w * 0.25, rz: dep * 0.20, yOff: 2.2, sc: 1.0 },
    { name: 'guppy', body: '#ffa812', fin: '#ff771a', tail: '#ff4422', stripes: false, sp: 0.92, rx: w * 0.29, rz: dep * 0.24, yOff: -2.0, sc: 0.95 }
  ];
  for (let i = 0; i < species.length; i++) {
    const s = species[i];
    const holder = new THREE.Group();
    // 1. Sleek hydrodynamic fish body
    const bodyGeo = new THREE.SphereGeometry(1.0, 10, 8);
    bodyGeo.scale(1.5 * s.sc, 0.72 * s.sc, 0.36 * s.sc);
    const bodyMesh = new THREE.Mesh(bodyGeo, std(s.body, { roughness: 0.35, metalness: 0.05 }));
    holder.add(bodyMesh);

    // 2. White clownfish stripes
    if (s.stripes) {
      for (const sx of [-0.25 * s.sc, 0.35 * s.sc]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.72 * s.sc, 0.72 * s.sc, 0.28 * s.sc, 10), std('#ffffff', { roughness: 0.4 }));
        ring.rotation.z = Math.PI / 2;
        ring.scale.set(1.0, 0.96, 0.46);
        ring.position.x = sx;
        holder.add(ring);
      }
    } else if (s.name === 'bluetang') {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s.sc, 0.12 * s.sc, 0.38 * s.sc), std('#0d1117'));
      mark.position.set(-0.25 * s.sc, 0.18 * s.sc, 0);
      holder.add(mark);
    }

    // 3. Realistic fish eyes on left and right sides of head
    for (const side of [-1, 1]) {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s.sc, 6, 6), std('#ffffff', { roughness: 0.2 }));
      eyeW.position.set(1.05 * s.sc, 0.14 * s.sc, side * 0.33 * s.sc);
      eyeW.scale.set(0.8, 0.8, 0.4);
      const eyeP = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s.sc, 6, 6), std('#101214', { roughness: 0.1 }));
      eyeP.position.set(1.12 * s.sc, 0.14 * s.sc, side * 0.36 * s.sc);
      eyeP.scale.set(0.6, 0.6, 0.4);
      holder.add(eyeW, eyeP);
    }

    // 4. Dorsal fin on top
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s.sc, 1.2 * s.sc, 4), std(s.fin, { roughness: 0.5 }));
    dorsal.rotation.z = -Math.PI / 3;
    dorsal.scale.set(1.0, 1.0, 0.12);
    dorsal.position.set(-0.15 * s.sc, 0.82 * s.sc, 0);
    holder.add(dorsal);

    // 5. Left & right pectoral fins
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s.sc, 0.08 * s.sc, 0.35 * s.sc), std(s.fin, { roughness: 0.5, transparent: true, opacity: 0.85 }));
      pec.position.set(0.35 * s.sc, -0.12 * s.sc, side * 0.38 * s.sc);
      pec.rotation.y = side * 0.35;
      pec.rotation.z = -0.2;
      holder.add(pec);
    }

    // 6. Waggling Tail & Caudal fin on animated pivot
    const tailPivot = new THREE.Group();
    tailPivot.position.set(-1.3 * s.sc, 0, 0);
    const caudal = new THREE.Mesh(new THREE.ConeGeometry(0.72 * s.sc, 1.4 * s.sc, 3), std(s.tail, { roughness: 0.4 }));
    caudal.rotation.z = Math.PI / 2;
    caudal.scale.set(1.0, 1.0, 0.12);
    caudal.position.set(-0.70 * s.sc, 0, 0);
    tailPivot.add(caudal);
    holder.add(tailPivot);

    group.add(holder);
    fish.push({
      mesh: holder,
      tail: tailPivot,
      cx,
      cz,
      rx: Math.min(s.rx, w * 0.32),
      rz: Math.min(s.rz, dep * 0.24),
      ph: i * 2.09,
      sp: s.sp,
      y: tankY + s.yOff
    });
  }
}
/* flames sit at the firebox mouth — offset toward the facing side  */
function addFire(cx, cz, rot, dep, h) {
  const a = -rot * Math.PI / 2;
  // Place flames right over the grate logs at center of open firebox (z = +0.06 * dep)
  const ox = Math.sin(a) * dep * 0.06, oz = Math.cos(a) * dep * 0.06;
  const fy = Math.max(4, h * 0.24);
  const cones = [];
  const cols = ['#ff5a1f', '#ffa03d', '#ffe08a'];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.5, 7.5 - i * 1.5, 6), glowMat(cols[i]));
    c.position.set(cx + ox + (i - 1) * 1.6 * Math.cos(a), fy,
                   cz + oz - (i - 1) * 1.6 * Math.sin(a));
    group.add(c); cones.push(c);
  }
  const light = new THREE.PointLight(0xff8a3d, 1.2, 190, 2);
  light.position.set(cx + ox, fy + 6, cz + oz);
  group.add(light);
  const f = { cones, light, on: true, x: cx, z: cz };
  fires.push(f);
  // Interaction prompt placed cleanly in front of the hearth opening
  L.interactables.push({ x: cx + Math.sin(a) * dep * 0.45, z: cz + Math.cos(a) * dep * 0.45, kind: 'fire', ref: f });
}
function addScreen(cx, cz, rot, screenW, screenH, offZ, iy) {
  const m = glowMat('#08090b');
  const s = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), m);
  s.position.set(cx, iy !== undefined ? iy : 25, cz);
  s.rotation.y = -rot * Math.PI / 2;
  const fwd = new THREE.Vector3(0, 0, offZ !== undefined ? offZ : 0.8).applyEuler(s.rotation);
  s.position.add(fwd);
  group.add(s);
  const sc = { mat: m, on: false, mesh: s, x: cx, z: cz };
  screens.push(sc);
  L.interactables.push({ x: cx, z: cz, kind: 'tv', ref: sc });
}
function addLampBulb(cx, cy, cz) {
  /* nearest world light source → this lamp's switch controls it */
  let src = null, bd = 15 * 15;
  for (const s of (HP.world3d.lamps || [])) {
    const d = (s.x - cx) ** 2 + (s.z - cz) ** 2;
    if (d < bd) { bd = d; src = s; }
  }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), glowMat('#ffe3a8'));
  mesh.position.set(cx, cy, cz); mesh.visible = false;
  group.add(mesh);
  const lp = { mesh, src, on: true, x: cx, z: cz };
  if (src) src.lampRef = lp;
  lampBulbs.push(lp);
  L.interactables.push({ x: cx, z: cz, kind: 'lamp', ref: lp });
}

/* ---------- creatures ---------- */
function addBirds() {
  const m = std('#4a4f57', { roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), m);
    body.rotation.z = -Math.PI / 2;
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7), new THREE.MeshStandardMaterial({ color: '#5a5f68', side: THREE.DoubleSide }));
    wl.rotation.x = -Math.PI / 2; wl.position.x = -3.6;
    const wr = wl.clone(); wr.position.x = 3.6;
    b.add(body, wl, wr);
    group.add(b);
    birds.push({ g: b, wl, wr, r: 160 + i * 30, h: 95 + (i % 3) * 14,
      ph: i * 1.05, sp: (0.05 + (i % 3) * 0.012) * (i % 2 ? 1 : -1) });
  }
}
function addButterflies(spots) {
  const cols = ['#ff9f43', '#a06bff', '#ffd166', '#7bdff2', '#f78fb3', '#b8e986'];
  for (let i = 0; i < spots.length; i++) {
    const b = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), wm); wl.position.x = -0.8;
    const wr = wl.clone(); wr.position.x = 0.8;
    b.add(wl, wr);
    group.add(b);
    flies.push({ g: b, wl, wr, ax: spots[i].x, az: spots[i].z, ph: i * 1.7, wph: i * 2.3 });
  }
}
/* ---------- the dog ---------- */
function addDog(home) {
  const fur = std('#a8763e'), dark = std('#7d5527'), pink = std('#d98a8a');
  const g = new THREE.Group();
  const body = box(9, 7, 16, fur); body.position.y = 8.5;
  const chest = box(8.5, 6, 5, fur); chest.position.set(0, 8, 7);
  const head = new THREE.Group();
  const skull = box(6, 5.5, 6, fur);
  const snout = box(3.5, 3, 4, dark); snout.position.set(0, -1, 4.5);
  const nose = box(1.6, 1.4, 1, new THREE.MeshBasicMaterial({ color: 0x1a1512 }));
  nose.position.set(0, -0.8, 6.6);
  const eL = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4), dark);
  eL.position.set(-2, 3.4, -0.5); eL.rotation.z = 0.25;
  const eR = eL.clone(); eR.position.x = 2; eR.rotation.z = -0.25;
  const tongue = box(1.4, 0.5, 2.5, pink); tongue.position.set(0, -2.2, 5); tongue.visible = false;
  head.add(skull, snout, nose, eL, eR, tongue);
  head.position.set(0, 12, 9.5);
  const legs = [];
  for (const [lx, lz] of [[-3, 5.5], [3, 5.5], [-3, -5.5], [3, -5.5]]) {
    const leg = box(2.2, 6.5, 2.2, dark);
    leg.geometry.translate(0, -3.25, 0);            // pivot at hip
    leg.position.set(lx, 6.5, lz);
    g.add(leg); legs.push(leg);
  }
  const tail = box(1.5, 1.5, 6, dark);
  tail.geometry.translate(0, 0, -3);
  tail.position.set(0, 10.5, -8); tail.rotation.x = 0.7;
  g.add(body, chest, head, tail);
  g.position.set(home.x, 0, home.z);
  group.add(g);
  dog = { g, head, legs, tail, tongue, home,
    x: home.x, z: home.z, tx: home.x, tz: home.z,
    state: 'idle', t: 2 + Math.random() * 3, yaw: 0, napUntil: 0 };
}
/* tiny circle-vs-box step — same colliders as the player, so the dog
   can't ghost through walls/furniture (doors block it too)          */
function dogStep(nx, nz) {
  const R = 5;
  for (const b of (HP.world3d.colliders || [])) {
    if (nx < b.x0 - R || nx > b.x1 + R || nz < b.z0 - R || nz > b.z1 + R) continue;
    if (b.y0 > 26) continue;                      // above dog height
    const lx = Math.max(b.x0, Math.min(nx, b.x1)), lz = Math.max(b.z0, Math.min(nz, b.z1));
    const dx = nx - lx, dz = nz - lz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = lx + dx / d * R; nz = lz + dz / d * R; }
    else {
      const exL = nx - b.x0 + R, exR = b.x1 - nx + R, exT = nz - b.z0 + R, exB = b.z1 - nz + R;
      const m = Math.min(exL, exR, exT, exB);
      if (m === exL) nx = b.x0 - R; else if (m === exR) nx = b.x1 + R;
      else if (m === exT) nz = b.z0 - R; else nz = b.z1 + R;
    }
  }
  /* the dog doesn't swim — pool water reads as an obstacle           */
  for (const a of (HP.world3d.waterAreas || [])) {
    if (nx > a.x0 - R && nx < a.x1 + R && nz > a.z0 - R && nz < a.z1 + R) {
      const dl = nx - a.x0 + R, dr = a.x1 - nx + R, dtp = nz - a.z0 + R, db = a.z1 - nz + R;
      const m = Math.min(dl, dr, dtp, db);
      if (m === dl) nx = a.x0 - R; else if (m === dr) nx = a.x1 + R;
      else if (m === dtp) nz = a.z0 - R; else nz = a.z1 + R;
    }
  }
  return [nx, nz];
}
/* closed door leaves also block the dog */
function dogDoorBlock(nx, nz) {
  const R = 5;
  for (const d of (HP.world3d.doorPivots || [])) {
    if (d.window || d.open > 0.5) continue;
    const a = d.a;
    if (nx > a.x0 - R && nx < a.x1 + R && nz > a.z0 - R && nz < a.z1 + R) {
      if (a.d === 'h') nz = nz < a.cz ? a.z0 - R : a.z1 + R;
      else nx = nx < a.cx ? a.x0 - R : a.x1 + R;
    }
  }
  return [nx, nz];
}
function dogTick(dt, t, s, cam) {
  if (!dog) return;
  const px = cam ? cam.x : 1e9, pz = cam ? cam.z : 1e9;
  const dp = Math.hypot(px - dog.x, pz - dog.z);
  const night = (s && s.night) || 0;
  /* state */
  dog.t -= dt;
  if (dog.state === 'nap') {
    if (night < 0.4 && dog.t <= 0) { dog.state = 'idle'; dog.t = 1; }
  } else if (dp < 120 && dog.state !== 'follow') {          // see the player → join
    dog.state = 'follow'; dog.t = 20;
  } else if (dog.state === 'follow' && (dp > 220 || dog.t <= 0)) {
    dog.state = 'idle'; dog.t = 0;
  } else if (dog.state === 'idle' && dog.t <= 0) {
    /* night → nap at the dog house; day → wander or nap sometimes    */
    if (night > 0.5 || Math.random() < 0.2) {
      dog.state = 'gonap'; dog.tx = dog.home.x; dog.tz = dog.home.z;
    } else {
      dog.state = 'walk';
      dog.tx = dog.home.x + (Math.random() - 0.5) * 420;
      dog.tz = dog.home.z + (Math.random() - 0.5) * 420;
    }
  } else if (dog.state === 'walk' || dog.state === 'gonap' || dog.state === 'follow') {
    /* steer */
    if (dog.state === 'follow') { dog.tx = px; dog.tz = pz; }
    const dx = dog.tx - dog.x, dz = dog.tz - dog.z, dist = Math.hypot(dx, dz);
    const arrive = dog.state === 'follow' ? 26 : 12;
    if (dist < arrive) {
      if (dog.state === 'gonap') { dog.state = 'nap'; dog.t = 14 + Math.random() * 20; }
      else if (dog.state === 'walk') { dog.state = 'idle'; dog.t = 1.5 + Math.random() * 4; }
      /* follow: just stand and look at the player                    */
    } else {
      const sp = dog.state === 'follow' ? 120 : 55;         // hurry to catch up!
      let nx = dog.x + dx / dist * sp * dt, nz = dog.z + dz / dist * sp * dt;
      [nx, nz] = dogStep(nx, nz); [nx, nz] = dogDoorBlock(nx, nz);
      const moved = Math.hypot(nx - dog.x, nz - dog.z);
      dog.x = nx; dog.z = nz;
      dog.yaw = Math.atan2(dx, dz);
      /* stuck → give up on this target                               */
      if (moved < sp * dt * 0.2) {
        if (dog.state === 'follow') { dog.state = 'idle'; dog.t = 0; }
        else { dog.state = 'idle'; dog.t = 1 + Math.random() * 2; }
      }
    }
  }
  /* pose */
  const walking = dog.state === 'walk' || dog.state === 'gonap' ||
    (dog.state === 'follow' && Math.hypot(dog.tx - dog.x, dog.tz - dog.z) > 26);
  const napping = dog.state === 'nap';
  const g = dog.g;
  g.position.set(dog.x, napping ? -1.5 : 0, dog.z);
  if (!napping) g.rotation.y += (((dog.yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
  g.rotation.z = napping ? 0.5 : g.rotation.z * 0.9;
  for (let i = 0; i < 4; i++) {
    const ph = walking ? t * 11 + (i % 2 ? Math.PI : 0) : 0;
    dog.legs[i].rotation.x = walking ? Math.sin(ph) * 0.55 : 0;
    dog.legs[i].scale.y = napping ? 0.35 : 1;
  }
  /* tail wag: excited when following or being approached             */
  dog.tail.rotation.y = (dog.state === 'follow' || dp < 60) ? Math.sin(t * 14) * 0.5 : Math.sin(t * 4) * 0.15;
  /* head looks at the player when close, down when napping           */
  const wantY = dp < 150 ? Math.atan2(px - dog.x, pz - dog.z) - g.rotation.y : 0;
  dog.head.rotation.y += (((wantY + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
  dog.head.rotation.x = napping ? 0.5 : (dp < 60 ? -0.15 : 0);
  dog.tongue.visible = dog.state === 'follow' && dp < 60;
}
function addFireflies() {
  const n = 22, pos = new Float32Array(n * 3);
  fireflySeed = [];
  for (let i = 0; i < n; i++) {
    const x = (8 + Math.random() * 45) * C(), z = (2 + Math.random() * 38) * C();
    fireflySeed.push({ x, z, ph: Math.random() * 9, sp: 0.3 + Math.random() * 0.5 });
    pos[i * 3] = x; pos[i * 3 + 1] = 10 + Math.random() * 14; pos[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let map = null;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const cx2 = cv.getContext && cv.getContext('2d');
    if (cx2) {
      const gr = cx2.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,240,160,1)'); gr.addColorStop(0.4, 'rgba(200,220,90,.6)');
      gr.addColorStop(1, 'rgba(200,220,90,0)');
      cx2.fillStyle = gr; cx2.fillRect(0, 0, 32, 32);
      map = new THREE.CanvasTexture(cv);
    }
  } catch (_) {}
  fireflies = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 4, map, color: 0xf0e68c, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  fireflies.visible = false;
  group.add(fireflies);
}

/* ---------- build ---------- */
/* entries: [{it, f(ootprint px cells), h(px height), hangs}] — all
   furniture, hung pieces included (clock lives on the wall)        */
L.build = function (g, entries) {
  group = g;
  spinners.length = clockHands.length = fish.length = fires.length =
    screens.length = lampBulbs.length = birds.length = flies.length = 0;
  fireflies = null; fireflySeed = null;
  L.interactables = [];
  const hi = HP.graphics3d && HP.graphics3d.tier !== 'low';
  const spots = [];
  L.ambience = { water: [], fire: [], fan: [] };
  let dogHome = null;
  for (const e of entries) {
    const it = e.it, f = e.f;
    const cx = (f.x + f.w / 2) * C(), cz = (f.y + f.h / 2) * C();
    const t = it.type.toLowerCase();
    const w = Math.max(3, f.w * C() - 3);
    const dep = Math.max(3, f.h * C() - 3);
    if (/ceilingfan/.test(t)) { addFan(cx, cz); L.ambience.fan.push({ x: cx, z: cz }); }
    else if (/clock|^clk/.test(t)) {
      /* hung clocks face out of the wall they hang on                 */
      const hang = it.hang || (HP.state && HP.itemDef(it.type).hangs &&
        HP.hangSide(it.type, it.x, it.y, it.rot || 0, { w: it.w || f.w, h: it.h || f.h }));
      const rot = hang === 'n' ? 0 : hang === 's' ? 2 :
        hang === 'w' ? 3 : hang === 'e' ? 1 : it.rot || 0;
      addClock(cx, cz, rot, w, hang ? w / 2 - 3 : dep * 0.275 + 0.3);
    }
    else if (/walltv|sconce/.test(t)) {
      /* wall-mounted screen / sconce — mount on the wall face          */
      const hang = it.hang || (HP.state && HP.hangSide(it.type, it.x, it.y,
        it.rot || 0, { w: it.w || f.w, h: it.h || f.h }));
      const rot = hang === 'n' ? 0 : hang === 's' ? 2 :
        hang === 'w' ? 3 : hang === 'e' ? 1 : it.rot || 0;
      const lvl = (HP.state && HP.cur && HP.cur()) || null;
      const lvlWalls = (lvl && lvl.walls) || {};
      let geomEnv = null;
      if (HP.state && HP.computeRegions) {
        try {
          const cr = HP.computeRegions();
          if (cr && cr.regionOf && cr.regions) {
            geomEnv = { C: C(), rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : cr.regionOf[y * HP.GRID_W + x], rsz: id => id >= 0 && cr.regions[id] ? cr.regions[id].cells.length : 1e9 };
          }
        } catch (err) {}
      }
      const IN = HP.geom3d && HP.geom3d.wallInset ? HP.geom3d.wallInset(hang, f, lvlWalls, geomEnv) : 7.0;
      let mx = cx, mz = cz;
      if (hang === 'n') mz = f.y * C() + IN;
      else if (hang === 's') mz = (f.y + f.h) * C() - IN;
      else if (hang === 'w') mx = f.x * C() + IN;
      else if (hang === 'e') mx = (f.x + f.w) * C() - IN;
      if (/walltv/.test(t)) addScreen(mx, mz, rot, 47.6, 26.4, 2.52, 42.0);
      else addLampBulb(mx, 38, mz);
    }
    else if (/aquarium/.test(t)) addFish(cx, cz, w, dep, e.h * 0.73);
    else if (/fireplace/.test(t)) { addFire(cx, cz, it.rot || 0, dep, e.h); L.ambience.fire.push({ x: cx, z: cz }); }
    else if (/pool$|pond|jacuzzi|hottub/.test(t)) L.ambience.water.push({ x: cx, z: cz });
    else if (/tvwall/.test(t)) {
      // 85" 4K OLED screen centered on slatted feature wall: exact bezel width=105.0, height=24.0, y=33.28
      addScreen(cx, cz, it.rot || 0, 105.0, 24.0, -0.355 * dep + 0.05, 33.28);
    }
    else if (/tvstand|media.*console/.test(t)) {
      // 65" 16:9 OLED TV screen on lowline credenza: exact bezel width=32.8, height=18.4, y=25.2
      addScreen(cx, cz, it.rot || 0, 32.8, 18.4, -0.04 * dep - 0.65, 25.2);
    }
    else if (/lamp|torch|lantern|light|candle/.test(t)) {
      addLampBulb(cx, /torch/.test(t) ? 30 : (/nightlight/.test(t) ? 6 : Math.max(12, e.h * 0.8)), cz);
    }
    if (hi && /flower|veggie|tomato|seedling|rose/i.test(t)) spots.push({ x: cx, z: cz });
    if (/doghouse|petbed|kennel/.test(t)) dogHome = { x: cx, z: cz + (f.h * C()) / 2 + 14 };
  }
  if (hi) {
    addBirds();
    addButterflies(spots.slice(0, 6));
  }
  addFireflies();
  /* the dog — lives at the dog house, else wanders the yard          */
  dog = null;
  if (HP.world3d.colliders) {
    const home = dogHome || { x: HP.GRID_W * C() / 2, z: HP.GRID_H * C() * 0.75 };
    addDog(home);
  }
};

/* ---------- per-frame ---------- */
const _v = new THREE.Vector3();
L.tick = function (dt, t, s, cam) {
  if (!group) return;
  for (const o of spinners) o.obj.rotation.y += dt * o.speed;
  const hour = s.hour !== undefined ? s.hour : (HP.world3d.time ? HP.world3d.time.hour : 12);
  for (const ch of clockHands) {
    const hFrac = (hour % 12) / 12, mFrac = (hour % 1);
    ch.hour.rotation.z = -hFrac * Math.PI * 2;
    ch.minute.rotation.z = -mFrac * Math.PI * 2;
  }
  for (const f of fish) {
    const a = t * f.sp + f.ph;
    const px = f.cx + Math.cos(a) * f.rx;
    const pz = f.cz + Math.sin(a) * f.rz;
    f.mesh.position.set(px, f.y + Math.sin(t * 1.5 + f.ph) * 1.0, pz);
    const dx = -Math.sin(a) * f.rx;
    const dz = Math.cos(a) * f.rz;
    f.mesh.rotation.y = Math.atan2(-dz, dx);
    if (f.tail) f.tail.rotation.y = Math.sin(t * 9 * f.sp + f.ph) * 0.45;
  }
  for (const f of fires) {
    f.light.intensity = f.on ? 0.9 + Math.sin(t * 11 + f.x) * 0.25 + Math.sin(t * 23) * 0.15 : 0;
    for (let i = 0; i < f.cones.length; i++) {
      const c = f.cones[i];
      c.visible = f.on;
      if (f.on) c.scale.y = 0.8 + Math.abs(Math.sin(t * (7 + i * 3) + i)) * 0.5;
    }
  }
  for (const sc of screens) {
    if (!sc.on) { sc.mat.color.set(0x08090b); continue; }
    const n = Math.sin(t * 13) * 0.5 + Math.sin(t * 4.7) * 0.5;   // channel shimmer
    sc.mat.color.setRGB(0.25 + n * 0.1, 0.3 + n * 0.12, 0.42 + n * 0.12);
  }
  const night = s.night || 0;
  for (const lp of lampBulbs) {
    if (lp.src) lp.src.on = lp.on;
    lp.mesh.visible = lp.on && night > 0.15;
  }
  /* creatures */
  const camX = cam ? cam.x : 0, camZ = cam ? cam.z : 0;
  if (birds.length) {
    const show = (s.day || 0) > 0.2;
    for (const b of birds) {
      b.g.visible = show;
      if (!show) continue;
      const a = t * b.sp + b.ph;
      b.g.position.set(camX + Math.cos(a) * b.r, b.h + Math.sin(t * 0.4 + b.ph) * 4,
        camZ + Math.sin(a) * b.r);
      b.g.rotation.y = -a + (b.sp > 0 ? Math.PI : 0);
      const flap = Math.sin(t * 9 + b.ph) * 0.7;
      b.wl.rotation.y = flap; b.wr.rotation.y = -flap;
    }
  }
  for (const f of flies) {
    const show = (s.day || 0) > 0.25;
    f.g.visible = show;
    if (!show) continue;
    const a = t * 0.35 + f.wph;
    f.g.position.set(f.ax + Math.cos(a) * 22 + Math.sin(t * 1.3 + f.ph) * 6,
      15 + Math.sin(t * 1.7 + f.ph) * 5, f.az + Math.sin(a * 1.3) * 22);
    const flap = Math.sin(t * 16 + f.ph) * 1.1;
    f.wl.rotation.y = flap; f.wr.rotation.y = -flap;
  }
  if (fireflies) {
    fireflies.visible = night > 0.25;
    if (fireflies.visible) {
      const p = fireflies.geometry.attributes.position;
      for (let i = 0; i < fireflySeed.length; i++) {
        const sd = fireflySeed[i];
        p.array[i * 3] = sd.x + Math.sin(t * sd.sp + sd.ph) * 12;
        p.array[i * 3 + 1] = 10 + Math.sin(t * 0.6 + sd.ph * 2) * 5;
        p.array[i * 3 + 2] = sd.z + Math.cos(t * sd.sp * 0.8 + sd.ph) * 12;
      }
      p.needsUpdate = true;
      fireflies.material.opacity = 0.55 + Math.sin(t * 3) * 0.3;
    }
  }
  dogTick(dt, t, s, cam);
};

/* ---------- E interaction ---------- */
L.label = function (g2) {
  const on = g2.kind === 'tv' ? g2.ref.on : g2.ref.on;
  const name = g2.kind === 'lamp' ? 'lamp' : g2.kind === 'tv' ? 'TV' : 'fireplace';
  return (on ? 'turn off ' : 'turn on ') + name;
};
L.toggle = function (g2) {
  const r = g2.ref;
  r.on = !r.on;
  if (g2.kind === 'fire') { r.light.intensity = r.on ? 1 : 0; for (const c of r.cones) c.visible = r.on; }
};
})();
