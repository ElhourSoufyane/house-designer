/* models3d.js — parametric low-poly furniture for Play 3D.
   MODELS3D[type] → fn(ctx) → THREE.Object3D.  ctx = {v, w, h, def}
   w/h = footprint in world px (1 cell = 28 px = 0.5 m). Base sits at y=0,
   model centred on origin — world3d positions + rotates the group.
   {gltf:'models/x.glb'} entries are reserved for real hero models later. */
(function () {
if (typeof THREE === 'undefined') { HP.MODELS3D = {}; return; }

const C = () => HP.CELL;
const std = (c, r = 0.85, m = 0, extra) =>
  new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, extra));
const B = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
const CYL = (r, h, mat, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.castShadow = true; return m; };
const SPH = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); m.castShadow = true; return m; };
const put = (g, m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
const grp = () => new THREE.Group();
const dark = c => HP.shade(c, 0.72);

/* ---------------- shared builders ---------------- */
function bed(ctx) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, B(w * 0.96, 14, h * 0.96, std('#6f543c')), 0, 9, 0);                    // frame
  put(g, B(w * 0.9, 12, h * 0.88, std('#f0ece2', 0.95)), 0, 20, 4);              // mattress
  put(g, B(w * 0.88, 6, h * 0.7, std(c, 0.95)), 0, 25, 10);                      // duvet
  put(g, B(w * 0.96, 46, 6, std(dark('#6f543c'))), 0, 24, -h / 2 + 4);           // headboard
  const pw = w > C() * 2 ? w * 0.28 : w * 0.5;
  for (const s of (w > C() * 2 ? [-1, 1] : [0]))
    put(g, B(pw, 8, h * 0.22, std('#faf8f2', 0.95)), s * w * 0.2, 28, -h / 2 + h * 0.18);
  return g;
}
function seat(ctx, arms = true, backH = 34) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, B(w * 0.96, 16, h * 0.9, std(c, 0.95)), 0, 16, 0);                      // seat base
  put(g, B(w * 0.92, 8, h * 0.8, std(HP.shade(c, 1.06), 0.95)), 0, 26, 1);       // cushion
  put(g, B(w * 0.96, backH, 9, std(c, 0.95)), 0, 20 + backH / 2 - 8, -h / 2 + 5);// back
  if (arms && w > C() * 1.4)
    for (const s of [-1, 1])
      put(g, B(9, backH * 0.8, h * 0.85, std(c, 0.95)), s * (w / 2 - 5), 24, 0); // armrests
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    put(g, CYL(2.4, 10, std('#3a3f47', 0.6, 0.4)), sx * (w / 2 - 8), 4, sz * (h / 2 - 8));
  return g;
}
function table(ctx, legs = true) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  const th = Math.max(34, ctx.th || 62);
  put(g, B(w * 0.98, 6, h * 0.98, std(c, 0.7)), 0, th, 0);
  if (legs) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    put(g, CYL(2.6, th, std(dark(c), 0.6, 0.5)), sx * (w / 2 - 8), th / 2, sz * (h / 2 - 8));
  return g;
}
function storage(ctx, hh, detail) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, B(w * 0.96, hh, h * 0.96, std(c)), 0, hh / 2, 0);
  put(g, B(w, 4, h, std(dark(c))), 0, hh + 2, 0);                                // top slab
  if (detail === 'shelves') for (let i = 1; i < 4; i++)
    put(g, B(w * 0.9, 2, h * 0.9, std(dark(c))), 0, hh * i / 4, 1);
  if (detail === 'screen') { const s = put(g, B(w * 0.6, hh * 0.45, 2, std('#101318', 0.3, 0.4)), 0, hh * 0.62, h / 2 - 2); s.userData.glow = true; }
  if (detail === 'handles') for (const s of [-1, 1])
    put(g, B(2, hh * 0.5, 2, std('#8b939c', 0.4, 0.7)), s * w * 0.08, hh * 0.55, h / 2 + 1);
  return g;
}
function toilet(ctx) {
  const g = grp(), { w, h } = ctx;
  put(g, B(w * 0.7, 18, h * 0.45, std('#eef1f4', 0.4)), 0, 30, -h * 0.22);       // tank
  const bowl = CYL(w * 0.28, 16, std('#f5f7f9', 0.35)); bowl.scale.z = 1.25;
  put(g, bowl, 0, 10, h * 0.12);
  put(g, CYL(w * 0.3, 3, std('#dfe5ea', 0.4)), 0, 19, h * 0.12);                 // seat ring
  return g;
}
function bathtub(ctx) {
  const g = grp(), { w, h } = ctx, c = '#f2f4f6';
  put(g, B(w * 0.98, 40, h * 0.98, std(c, 0.45)), 0, 20, 0);
  put(g, B(w * 0.84, 6, h * 0.84, std('#9cc4d8', 0.15)), 0, 38, 0).userData.glow = true; // water
  put(g, CYL(2.4, 30, std('#8b939c', 0.3, 0.9)), w * 0.4, 48, -h * 0.3);          // faucet
  return g;
}
function appliance(ctx, hh, face) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, B(w * 0.96, hh, h * 0.96, std(c, 0.5, 0.15)), 0, hh / 2, 0);
  if (face) put(g, B(w * 0.7, hh * 0.45, 2, std('#23272e', 0.3)), 0, hh * 0.55, h / 2 - 2);
  put(g, B(w * 0.96, 3, h * 0.96, std('#3a3f47', 0.6)), 0, hh + 1.5, 0);          // top edge
  return g;
}
function stairs(ctx) {
  const g = grp(), { w, h } = ctx, c = '#a08a6a';
  const n = 6, dz = h / n, rise = 24;
  for (let i = 0; i < n; i++)
    put(g, B(w * 0.96, rise * (i + 1) * 0.5 + 8, dz, std(i % 2 ? dark(c) : c)),
      0, (rise * (i + 1) * 0.5 + 8) / 2, -h / 2 + dz * (i + 0.5));
  for (const s of [-1, 1])
    put(g, B(3, h * 0.9, 3, std(dark(c))), s * (w / 2 - 3), h * 0.5, 0);
  return g;
}
function lamp(ctx) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, CYL(w * 0.22, 3, std('#3a3f47', 0.5, 0.6)), 0, 1.5, 0);                 // base
  put(g, CYL(1.6, 52, std('#3a3f47', 0.5, 0.6)), 0, 27, 0);                      // pole
  const shade = put(g, CYL(w * 0.3, 14, new THREE.MeshStandardMaterial({ color: '#f5e6c0', roughness: 0.9, emissive: '#c9a44e', emissiveIntensity: 0.25 }), 14), 0, 55, 0);
  shade.userData.lampShade = true;
  return g;
}
function plant(ctx) {
  const g = grp(), { w } = ctx;
  put(g, CYL(w * 0.28, 12, std('#a06558', 0.9)), 0, 6, 0);
  put(g, SPH(w * 0.34, std('#5d8a5d', 0.9)), 0, 24, 0);
  put(g, SPH(w * 0.24, std('#6d9a68', 0.9)), w * 0.14, 34, 0);
  return g;
}
function rug(ctx) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), std(c, 0.98));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.6; m.receiveShadow = true;
  g.add(m);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.7), std(dark(c), 0.98));
  b.rotation.x = -Math.PI / 2; b.position.y = 0.8; g.add(b);
  return g;
}
function tv(ctx) {
  const g = grp(), { w, h } = ctx;
  put(g, B(w * 0.96, h * 0.5, h * 0.9, std('#3a3f47', 0.5)), 0, h * 0.25, 0);     // stand
  put(g, B(w * 0.8, w * 0.42, 4, std('#101318', 0.35)), 0, h * 0.5 + w * 0.22, 0);// screen
  put(g, CYL(4, 3, std('#23272e', 0.5)), 0, h * 0.5, 0);
  return g;
}
function pool(ctx) {
  const g = grp(), { w, h } = ctx;
  put(g, B(w * 1.04, 8, h * 1.04, std('#dfe5e8', 0.6)), 0, 4, 0);                 // coping
  const wtr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96),
    new THREE.MeshStandardMaterial({ color: '#4fa8d8', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 }));
  wtr.rotation.x = -Math.PI / 2; wtr.position.y = 9; wtr.userData.water = true;
  g.add(wtr);
  return g;
}
function car(ctx) {
  const g = grp(), { w, h } = ctx, c = ctx.def.colors[ctx.v];
  put(g, B(w * 0.9, 22, h * 0.92, std(c, 0.4, 0.3)), 0, 22, 0);
  put(g, B(w * 0.7, 18, h * 0.5, std('#2a3a48', 0.3, 0.2)), 0, 40, -h * 0.05);    // cabin/glass
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const wh = CYL(9, 6, std('#1a1c1f', 0.9)); wh.rotation.z = Math.PI / 2;
    put(g, wh, sx * (w * 0.42), 9, sz * h * 0.3);
  }
  return g;
}

/* ---------------- registry ---------------- */
const M = HP.MODELS3D = {
  bedSingle: bed, bedDouble: bed, bedQueen: bed, bedKing: bed,
  bunkbed: bed, daybed: bed, daybed2: bed, futon: bed, sleeper: bed, crib: bed,
  sofa2: seat, sofa3: seat, sofaL: seat, sofaU: seat, outsofa: seat,
  loveseat2: seat, settee: seat, reclinerSofa: seat, curvedSofa: seat,
  modseat: ctx => seat(ctx, false, 28), modcorner: ctx => seat(ctx, false, 28),
  armchair: seat, recliner: seat, tubchair: seat, clubchair: seat,
  accentchair: seat, swivelchair: seat, chair: c => seat(c, false),
  offchair: c => seat(c, false), gamingchair: c => seat(c, false, 44),
  rockchair: seat, rocker: seat, highchair: c => seat(c, false),
  bench: c => seat(c, false, 22), gardenbench: c => seat(c, true, 26),
  entrybench: c => seat(c, false, 20), bedbench: c => seat(c, false, 20),
  barstool: c => { const g = grp(), c2 = c.def.colors[c.v];
    put(g, CYL(2.4, 44, std('#3a3f47', 0.6, 0.5)), 0, 22, 0);
    put(g, CYL(10, 5, std(c2, 0.9)), 0, 46, 0); return g; },
  ottoman: c => seat(c, false, 14), ottomanTuft: c => seat(c, false, 14),
  ottomanStor: c => seat(c, false, 14), footstool: c => seat(c, false, 14),
  beanbag: c => { const g = grp(), c2 = c.def.colors[c.v];
    const b = SPH(c.w * 0.42, std(c2, 0.98)); b.scale.y = 0.55; put(g, b, 0, c.w * 0.2, 0); return g; },
  beanbag2: c => { const g = grp(), c2 = c.def.colors[c.v];
    const b = SPH(c.w * 0.42, std(c2, 0.98)); b.scale.y = 0.55; put(g, b, 0, c.w * 0.2, 0); return g; },
  lounger: c => seat(c, false, 30), chaise: c => seat(c, false, 30), modchaise: c => seat(c, false, 28),

  tableDin: table, table: table, coffeeR: c => { c.th = 38; return table(c); },
  coffeeRound: c => { const g = grp(), c2 = c.def.colors[c.v];
    const t = CYL(c.w * 0.48, 4, std(c2, 0.7), 24); t.position.y = 40; g.add(t);
    put(g, CYL(4, 40, std(dark(c2), 0.6, 0.5)), 0, 20, 0); return g; },
  desk: table, offdesk: table, sidetable: c => { c.th = 46; return table(c); },
  nightstand: c => storage(c, 34, 'handles'), dresser: c => storage(c, 44, 'handles'),
  wardrobe: c => storage(c, 120, 'handles'), wardrobeBig: c => storage(c, 120, 'handles'),
  bookshelf: c => storage(c, 110, 'shelves'), tvstand: c => storage(c, 30, 'screen'),
  tvwall: c => storage(c, 80, 'screen'), counter: c => storage(c, 52, 'handles'),
  counter3: c => storage(c, 52, 'handles'), island: c => storage(c, 52, 'handles'),
  cabinet: c => storage(c, 60, 'handles'),

  toilet, bathtub, hottub: bathtub,
  shower: c => { const g = grp(), { w, h } = c;
    put(g, B(w * 0.96, 3, h * 0.96, std('#dfe5e8', 0.5)), 0, 1.5, 0);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 90),
      new THREE.MeshStandardMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide }));
    gl.position.set(0, 48, h / 2 - 4); g.add(gl);
    put(g, CYL(1.5, 80, std('#8b939c', 0.3, 0.9)), w * 0.3, 44, -h * 0.35); return g; },
  ksink: c => storage(c, 52, 'handles'), bsink: c => { const g = grp(), { w, h } = c;
    put(g, CYL(w * 0.2, 40, std('#eef1f4', 0.4)), 0, 20, 0);
    put(g, CYL(w * 0.32, 8, std('#f5f7f9', 0.35)), 0, 44, 0); return g; },

  fridge: c => appliance(c, 96, false), stove: c => appliance(c, 56, true),
  oven: c => appliance(c, 56, true), dishwasher: c => appliance(c, 52, true),
  washer: c => appliance(c, 52, true), dryer: c => appliance(c, 52, true),
  microwave: c => appliance(c, 30, true),

  stairs, floorlamp: lamp, lamptable: lamp, lamparc: lamp, lamptripod: lamp,
  lamptorch: lamp, lamppaper: lamp, lampmush: lamp, lampcandle: lamp,
  lampbanker: lamp, fllantern: lamp, nightlight: lamp, lamppost: lamp,
  pathlight: lamp, artneon: lamp,

  plantSm: plant, plantBig: plant, plsnake: plant, plmonstera: plant,
  plpalm: plant, plfiddle: plant, plfern: plant, plzz: plant, plcalathea: plant,
  plbonsai: plant, plorchid: plant, tree: plant, palmTree: plant,

  tv, tvstand2: tv, pc: c => storage(c, 26, 'screen'), mac: c => storage(c, 26, 'screen'),
  monitor: c => storage(c, 30, 'screen'), speaker: c => storage(c, 60),

  pool, car,

  rugA: rug, rugRound: rug, rugB: rug, rugC: rug, rugRunner: rug,
  doormat: rug, bathmat: rug, mat: rug, playmat: rug, yogamat: rug,
};

/* item → Object3D. Registry first, prefix rules, then colored-box fallback. */
const PREFIX = [
  ['bed', bed], ['sofa', seat], ['lamp', lamp], ['table', table],
  ['chair', c => seat(c, false)], ['rug', rug], ['mat', rug], ['plant', plant],
];
const FALLBACK_H = {                                    // default box heights by category
  Kitchen: 52, Bathroom: 45, Bedroom: 40, Living: 45, Office: 50,
  Decor: 55, Garden: 55, Gym: 60, Games: 70, Kids: 45, Music: 60, Utility: 60, Modular: 40
};
HP.model3D = function (it) {
  const def = HP.itemDef(it.type);
  const ctx = { v: it.v || 0, w: (it.w || def.w) * C(), h: (it.h || def.h) * C(), def, it };
  const b = M[it.type];
  if (b && b.gltf) return null;                          // glTF hero items — loader path (later)
  try { const m = b ? b(ctx) : null; if (m) return m; } catch (e) {}
  for (const [p, f] of PREFIX)
    if (it.type.startsWith(p)) { try { const m = f(ctx); if (m) return m; } catch (e) {} }
  const g = grp(), hh = def.height || FALLBACK_H[def.cat] || 45;
  const bm = B(ctx.w * 0.92, Math.min(hh, 140), ctx.h * 0.92, std(def.colors[ctx.v]));
  bm.position.y = Math.min(hh, 140) / 2; g.add(bm);
  return g;
};
})();
