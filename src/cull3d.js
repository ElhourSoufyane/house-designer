/* cull3d.js — draw only what the player can actually see.
   1. Spatial tiles: static instances are bucketed into TILE×TILE-cell
      chunks, each with real instance bounds, so Three's frustum culling
      (main camera AND shadow camera) finally works for instanced meshes
      — r149 tests instanced meshes against the unit geometry at origin.
   2. Occlusion: 2D ray cast over the wall grid from the player. Rays
      stop at solid walls and closed doors, pass windows and open doors.
      Tiles no ray reached (rooms behind walls) are not drawn at all.
   3. Distance: small furniture beyond the quality tier's range is skipped. */
window.HP = window.HP || {};
(function () {
const V = HP.cull3d = {};
V.TILE = 8;                                   // cells per tile edge
const RAYS = 1024;
let nx = 1, nz = 1, tileVis = new Uint8Array(1), entries = [];
let vEdge = null, hEdge = null, gw = 0, gh = 0, doorEdges = [];
let lastCell = -1, lastDoorSig = '', dirty = true;
const box3 = new THREE.Box3(), tmpBox = new THREE.Box3();

V.reset = function () {
  gw = HP.GRID_W; gh = HP.GRID_H;
  nx = Math.ceil(gw / V.TILE) + 1; nz = Math.ceil(gh / V.TILE) + 1;
  tileVis = new Uint8Array(nx * nz);
  entries = []; doorEdges = []; dirty = true; lastCell = -1;
};
const tilePx = () => V.TILE * HP.CELL;
const clampT = (t, n) => Math.max(0, Math.min(n - 1, t));
V.tileOf = (x, z) => clampT(Math.floor(z / tilePx()), nz) * nx + clampT(Math.floor(x / tilePx()), nx);
function cover(x0, z0, x1, z1) {
  const P = tilePx(), out = [];
  const a = clampT(Math.floor(x0 / P), nx), b = clampT(Math.floor((x1 - 0.01) / P), nx);
  const c = clampT(Math.floor(z0 / P), nz), d = clampT(Math.floor((z1 - 0.01) / P), nz);
  for (let tz = c; tz <= d; tz++) for (let tx = a; tx <= b; tx++) out.push(tz * nx + tx);
  return out;
}

/* register any object (door pivot, single mesh) for occlusion         */
V.add = function (obj, x0, z0, x1, z1, opts) {
  entries.push({ obj, tiles: cover(x0, z0, x1, z1), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2,
    far: opts && opts.far, detail: opts && opts.detail });
  dirty = true;
};

/* split boxes at tile lines so a long wall run is not culled as a whole
   just because its centre sits in a hidden tile                       */
V.splitBoxes = function (boxes) {
  const P = tilePx(), out = [];
  for (const b of boxes) {
    const xs = [b.x0], zs = [b.z0];
    for (let x = (Math.floor(b.x0 / P) + 1) * P; x < b.x1 - 0.5; x += P) if (x > b.x0 + 0.5) xs.push(x);
    for (let z = (Math.floor(b.z0 / P) + 1) * P; z < b.z1 - 0.5; z += P) if (z > b.z0 + 0.5) zs.push(z);
    xs.push(b.x1); zs.push(b.z1);
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++)
      out.push({ ...b, x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] });
  }
  return out;
};

/* parts: [{ m: Matrix4, c?: colour, x0, z0, x1, z1 }] — bucketed per tile.
   Returns where[k] = { mesh, i } so movers can rewrite their instance.  */
V.instanced = function (group, geometry, material, parts, opts) {
  if (!entries || nx * nz !== tileVis.length || gw !== HP.GRID_W) V.reset();
  opts = opts || {};
  const buckets = new Map(), where = new Array(parts.length);
  parts.forEach((p, k) => {
    const t = V.tileOf((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2);
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(k);
  });
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const col = new THREE.Color();
  for (const ks of buckets.values()) {
    const geo = geometry.clone();           // own bounds per chunk (tiny attrs)
    const mesh = new THREE.InstancedMesh(geo, material, ks.length);
    box3.makeEmpty();
    const tiles = new Set();
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    ks.forEach((k, i) => {
      const p = parts[k];
      mesh.setMatrixAt(i, p.m);
      if (p.c !== undefined && p.c !== null) mesh.setColorAt(i, col.set(p.c));
      tmpBox.copy(geometry.boundingBox).applyMatrix4(p.m);
      box3.union(tmpBox);
      for (const t of cover(p.x0, p.z0, p.x1, p.z1)) tiles.add(t);
      x0 = Math.min(x0, p.x0); z0 = Math.min(z0, p.z0); x1 = Math.max(x1, p.x1); z1 = Math.max(z1, p.z1);
      where[k] = { mesh, i };
    });
    geo.boundingBox = box3.clone();
    geo.boundingSphere = box3.getBoundingSphere(new THREE.Sphere());
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !!opts.cast; mesh.receiveShadow = !!opts.receive;
    if (opts.userData) Object.assign(mesh.userData, opts.userData);
    group.add(mesh);
    entries.push({ obj: mesh, tiles: [...tiles], cx: (x0 + x1) / 2, cz: (z0 + z1) / 2,
      far: opts.far, detail: opts.detail });
  }
  dirty = true;
  return where;
};

/* opaque wall edges: v-edge (x,y) blocks crossing between cells x-1|x  */
V.setWalls = function (walls, pivots) {
  vEdge = new Uint8Array((gw + 2) * (gh + 2));
  hEdge = new Uint8Array((gw + 2) * (gh + 2));
  for (const k in walls) {
    const w = walls[k];
    if (w.f === 'window') continue;          // glass: see straight through
    const s = HP.parseWallKey(k);
    if (s.x < 0 || s.y < 0 || s.x > gw || s.y > gh) continue;
    (s.d === 'v' ? vEdge : hEdge)[s.y * (gw + 2) + s.x] = w.f === 'door' ? 2 : 1;
  }
  /* door families: transparency follows the leaf, recomputed on change */
  doorEdges = [];
  const seen = new Set();
  for (const d of pivots || []) {
    if (d.gate || d.window || seen.has(d.a)) continue;
    seen.add(d.a);
    const s = HP.parseWallKey(d.a.k), n = d.a.dbl ? 2 : 1, idx = [];
    for (let i = 0; i < n; i++) {
      const x = s.d === 'h' ? s.x + i : s.x, y = s.d === 'h' ? s.y : s.y + i;
      idx.push(y * (gw + 2) + x);
    }
    doorEdges.push({ arr: s.d === 'v' ? vEdge : hEdge, idx,
      fam: pivots.filter(o => o.a === d.a) });
  }
  dirty = true;
};

function doorSig() {
  let s = '';
  for (const e of doorEdges) {
    const open = e.fam.some(o => o.open > 0.02);
    s += open ? '1' : '0';
    for (const i of e.idx) e.arr[i] = open ? 0 : 2;
  }
  return s;
}

const cellVis = { a: new Uint8Array(1) };
function castRays(px, pz) {
  const C = HP.CELL, W = gw + 2;
  if (cellVis.a.length !== gw * gh) cellVis.a = new Uint8Array(gw * gh);
  const cv = cellVis.a; cv.fill(0);
  const sx = px / C, sz = pz / C, maxSteps = gw + gh;
  const mark = (x, z) => { if (x >= 0 && z >= 0 && x < gw && z < gh) cv[z * gw + x] = 1; };
  for (let r = 0; r < RAYS; r++) {
    const a = r / RAYS * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let cx = Math.floor(sx), cz = Math.floor(sz);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (dx || 1e-9)), tdz = Math.abs(1 / (dz || 1e-9));
    let tx = (dx > 0 ? cx + 1 - sx : sx - cx) * tdx;
    let tz = (dz > 0 ? cz + 1 - sz : sz - cz) * tdz;
    mark(cx, cz);
    for (let s = 0; s < maxSteps; s++) {
      if (tx < tz) {
        const ex = stepX > 0 ? cx + 1 : cx;
        if (ex >= 0 && ex <= gw && cz >= 0 && cz < gh && vEdge[cz * W + ex]) break;
        cx += stepX; tx += tdx;
      } else {
        const ez = stepZ > 0 ? cz + 1 : cz;
        if (ez >= 0 && ez <= gh && cx >= 0 && cx < gw && hEdge[ez * W + cx]) break;
        cz += stepZ; tz += tdz;
      }
      if (cx < -1 || cz < -1 || cx > gw || cz > gh) break;
      mark(cx, cz);
    }
  }
  /* 1-cell dilation → tiles: walls on a visible cell's edge always show */
  tileVis.fill(0);
  const P = V.TILE;
  for (let z = 0; z < gh; z++) for (let x = 0; x < gw; x++) {
    if (!cv[z * gw + x]) continue;
    for (let tz = Math.floor(Math.max(0, z - 1) / P); tz <= Math.floor((z + 1) / P); tz++)
      for (let tx = Math.floor(Math.max(0, x - 1) / P); tx <= Math.floor((x + 1) / P); tx++)
        if (tx < nx && tz < nz) tileVis[tz * nx + tx] = 1;
  }
  /* outside the lot, nothing occludes: border tiles follow their edge */
  if (sx < 0 || sz < 0 || sx >= gw || sz >= gh) tileVis.fill(1);
}

V.stats = { tiles: 0, drawn: 0, total: 0, casts: 0 };
V.update = function (px, pz, force) {
  if (!vEdge) return;
  const C = HP.CELL;
  const cell = Math.floor(pz / C) * 4096 + Math.floor(px / C);
  const sig = doorSig();
  if (!force && !dirty && cell === lastCell && sig === lastDoorSig) return;
  lastCell = cell; lastDoorSig = sig; dirty = false;
  castRays(px, pz);
  V.stats.casts++;
  const G = HP.graphics3d, q = G && G.current;
  const detail = !q || q.detail, farScale = q ? q.far : 1e9;
  let drawn = 0;
  for (const e of entries) {
    let vis = false;
    for (const t of e.tiles) if (tileVis[t]) { vis = true; break; }
    if (vis && e.detail && !detail) vis = false;
    if (vis && e.far && Math.hypot(e.cx - px, e.cz - pz) > e.far * farScale) vis = false;
    e.obj.visible = vis;
    if (vis) drawn++;
  }
  let tv = 0; for (const t of tileVis) tv += t;
  V.stats.tiles = tv; V.stats.drawn = drawn; V.stats.total = entries.length;
};
V.invalidate = () => { dirty = true; };
V.visibleAt = (x, z) => !!tileVis[V.tileOf(x, z)];
})();
