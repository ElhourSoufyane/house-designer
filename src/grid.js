/* grid.js — core constants, shared state, coordinate math */
window.HP = {};

HP.VERSION = 'v36';
HP.GRID_W = 64;          // cells wide  (32 m)
HP.GRID_H = 44;          // cells tall  (22 m)
HP.CELL   = 28;          // world px per cell (1 cell = 0.5 m)
HP.M2_PER_CELL = 0.25;

HP.canvas = null;
HP.ctx    = null;

/* camera: world-px coords of screen center + zoom */
HP.camera = { x: HP.GRID_W * HP.CELL / 2, y: HP.GRID_H * HP.CELL / 2, zoom: 0.9 };
HP.MIN_ZOOM = 0.25; HP.MAX_ZOOM = 3.5;

HP.state = null;         // {bg, level, levels:[{walls,floors,roomNames,furniture}]}
HP.tool  = 'select';
HP.showGrid = true;
HP.dirty = true;         // request re-render
HP.pending = null;       // furniture item being placed {def, rot, v}
HP.selected = null;      // selected furniture object
HP.floorMat = 'wood';    // active floor material
HP.floorName = '';       // room name to apply
HP.regions = null;       // cached flood-fill result
HP.wallPreview = null;   // segments being dragged by wall tool

HP.nextId = 1;
/* stable per-device id — tags locally-created furniture so co-op delta-merge
   can recognize its own items echoing back (prevents duplication) */
HP.oid = localStorage.getItem('hp_oid');
if (!HP.oid) { HP.oid = 'p' + Math.random().toString(36).slice(2, 10); localStorage.setItem('hp_oid', HP.oid); }

HP.FLOOR_MATS = [
  { id: 'wood',     name: 'Wood',     col: '#c9a877' },
  { id: 'walnut',   name: 'Walnut',   col: '#7d5c3f' },
  { id: 'tile',     name: 'Tile',     col: '#dfe5e8' },
  { id: 'carpet',   name: 'Carpet',   col: '#b8a9c9' },
  { id: 'marble',   name: 'Marble',   col: '#eceae6' },
  { id: 'concrete', name: 'Concrete', col: '#b9bcb9' },
  { id: 'parquet',  name: 'Parquet',  col: '#c19a6b' },
  { id: 'checker',  name: 'Checker',  col: '#e8e8e4' },
  { id: 'terracotta', name: 'Terracotta', col: '#c47a4d' },
  { id: 'slate',    name: 'Slate',    col: '#8a93a0' },
  { id: 'mosaic',   name: 'Mosaic',   col: '#a8ccd8' },
  { id: 'brick',    name: 'Brick',    col: '#b06a50' },
  { id: 'hextile',  name: 'Hex Tile', col: '#e4e7e9' },
  { id: 'pebble',   name: 'Pebble',   col: '#b8b2a4' },
  { id: 'travertine', name: 'Travertine', col: '#d8cbb2' },
  { id: 'granite',  name: 'Granite',  col: '#5c6068' },
  { id: 'cork',     name: 'Cork',     col: '#cfa878' },
  { id: 'deck',     name: 'Deck',     col: '#9a7f5e' },
  { id: 'grass',    name: 'Lawn',     col: '#7da464' },
  { id: 'gravel',   name: 'Gravel',   col: '#a8a49c' },
  { id: 'foam',     name: 'Foam Mats', col: '#e8a0a8' },
  { id: 'gym',      name: 'Gym Rubber', col: '#3c4048' },
  { id: 'vinyl',    name: 'Vinyl',    col: '#c8c2b4' },
  { id: 'tatami',   name: 'Tatami',   col: '#cdc494' },
  { id: 'bamboo',   name: 'Bamboo',   col: '#d8c088' },
  { id: 'laminate', name: 'Laminate', col: '#b0a494' },
  { id: 'whitewash', name: 'White Wood', col: '#e2ddd2' },
  { id: 'herring',  name: 'Herringbone', col: '#b98a58' },
  { id: 'lino',     name: 'Linoleum', col: '#b8c8b0' },
  { id: 'sand',     name: 'Sand',     col: '#e0cf9e' },
  { id: 'dirt',     name: 'Soil',     col: '#7a5f45' },
  { id: 'mulch',    name: 'Mulch',    col: '#54402c' },
  { id: 'flagstone', name: 'Flagstone', col: '#b0a898' },
  { id: 'onyx',     name: 'Black Marble', col: '#23262c' },
  { id: 'terrazzo', name: 'Terrazzo', col: '#e4ddd0' },
  /* grass style family — 6 drawn/photo variants */
  { id: 'grassA',   name: 'Tufts',     col: '#86b060', grp: 'grass' },
  { id: 'grassB',   name: 'Blades',    col: '#7fae5e', grp: 'grass' },
  { id: 'grassC',   name: 'Meadow',    col: '#84ae62', grp: 'grass' },
  { id: 'grassD',   name: 'Stipple',   col: '#7aa85a', grp: 'grass' },
  { id: 'grassE',   name: 'Photo',     col: '#7da464', grp: 'grass' },
  { id: 'grassF',   name: 'Mown',      col: '#83ad60', grp: 'grass' },
];

/* Colourway variants — same texture/painter as the family base + tint wash.
   fam = base material id (also groups them in the floor picker). */
const _FV = {
  wood:      [['Narrow Planks','#b8895a','rgba(190,125,55,.22)'],['Versailles','#a89e90','rgba(125,125,118,.15)'],['Wide Planks','#6b4c34','rgba(45,28,15,.30)']],
  walnut:    [['Boards','#a07448','rgba(200,150,80,.18)'],['Vertical','#4c4644','rgba(40,38,40,.30)'],['Chevron','#7c4438','rgba(120,40,30,.18)']],
  tile:      [['Small Tiles','#b9c0c8','rgba(120,130,140,.18)'],['Subway','#d8c8a8','rgba(200,180,140,.18)'],['Octagon','#4a5058','rgba(45,48,55,.35)']],
  carpet:    [['Corduroy','#a8a8b0','rgba(110,115,125,.20)'],['Woven','#8894b4','rgba(90,110,160,.20)'],['Shag','#a4a890','rgba(120,140,105,.18)'],['Patterned','#c09aa4','rgba(200,140,150,.15)']],
  marble:    [['Slab','#c4c8cc','rgba(140,145,155,.15)'],['Veined','#e4d8c4','rgba(215,195,150,.15)'],['Dark Vein','#5c5e66','rgba(60,62,70,.30)']],
  concrete:  [['Scored','#d0d2cf','rgba(255,255,255,.10)'],['Panels','#7c7e7a','rgba(60,62,65,.25)'],['Brushed','#c4b298','rgba(190,160,110,.15)']],
  parquet:   [['Versailles','#c8985c','rgba(200,140,60,.18)'],['Chevron','#74543a','rgba(70,45,25,.30)'],['Strips','#a89e90','rgba(125,120,110,.20)']],
  checker:   [['Small Check','#d8ccb8','rgba(200,170,120,.12)'],['Big Check','#b8c4d8','rgba(90,120,170,.15)'],['Diamond','#dcc8c0','rgba(190,140,140,.12)']],
  terracotta:[['Squares','#a85430','rgba(140,45,20,.22)'],['Subway','#dcb890','rgba(235,200,160,.15)'],['Hex','#b05c34','rgba(160,60,25,.22)']],
  slate:     [['Grid','#7c90a8','rgba(80,100,140,.20)'],['Flagstone','#4c5058','rgba(30,32,38,.30)'],['Subway','#84957f','rgba(80,110,85,.20)']],
  mosaic:    [['Tiny','#8cb8d4','rgba(80,140,200,.20)'],['Hex','#9cc4a8','rgba(110,170,130,.20)'],['Penny','#b4bcc0','rgba(130,135,140,.20)'],['Fan','#e8ecee','rgba(255,255,255,.20)']],
  brick:     [['Stacked','#7c4438','rgba(60,30,25,.30)'],['Thin','#c89878','rgba(220,190,165,.15)'],['Basket','#9c8880','rgba(120,118,112,.22)']],
  hextile:   [['Big Hex','#b8bcc0','rgba(120,125,132,.20)'],['Mini Hex','#9cb8cc','rgba(90,130,175,.20)'],['Dotted','#54585e','rgba(50,52,60,.30)']],
  pebble:    [['River Stones','#c4b090','rgba(190,160,115,.18)'],['Grit','#a8a8a4','rgba(125,128,130,.20)'],['Slabs','#6c6a62','rgba(70,68,62,.30)']],
  travertine:[['Banded','#d0b284','rgba(205,170,95,.18)'],['Tiles','#c0bcb0','rgba(140,138,130,.20)'],['Speckled','#c8a87c','rgba(190,140,90,.20)']],
  granite:   [['Fine','#5c6a84','rgba(70,90,130,.25)'],['Flaked','#745848','rgba(120,85,60,.25)'],['Veined','#8c8e92','rgba(200,200,200,.12)']],
  cork:      [['Tiles','#d4a058','rgba(210,150,70,.18)'],['Granules','#8a6038','rgba(95,60,30,.30)'],['Blocks','#a89878','rgba(135,125,110,.22)']],
  deck:      [['Old Planks','#9c8c78','rgba(120,120,115,.22)'],['Siding','#64503c','rgba(55,38,22,.30)'],['Boards','#a06a50','rgba(160,70,50,.20)']],
  gravel:    [['Fine','#b8a88c','rgba(175,150,105,.18)'],['Gritty','#78746c','rgba(70,68,65,.25)'],['Coarse','#c8c4b8','rgba(210,205,190,.15)']],
  foam:      [['Studs','#a8d4b4','rgba(110,190,150,.15)'],['Check','#a4c4e4','rgba(100,150,210,.15)'],['Tiles','#e8c0a8','rgba(230,150,110,.15)']],
  gym:       [['Rolled','#4c5c78','rgba(60,90,150,.25)'],['Flecked','#50605a','rgba(70,120,80,.25)'],['Studs','#5c5e62','rgba(90,92,95,.20)']],
  vinyl:     [['White','#dcd8cc','rgba(255,255,255,.12)'],['Grey','#a4b4c0','rgba(100,130,165,.18)'],['Marbled','#b8a084','rgba(160,120,70,.20)']],
  tatami:    [['Fine Weave','#dcd4a8','rgba(255,250,220,.15)'],['Wide Weave','#9a8c58','rgba(120,110,60,.25)'],['Mats','#c4b070','rgba(200,160,80,.15)']],
  bamboo:    [['Thin Strips','#a08c54','rgba(120,90,40,.28)'],['Wide Slats','#d8a850','rgba(215,160,70,.18)'],['Woven','#bcae90','rgba(140,130,110,.20)']],
  laminate:  [['Light Oak','#bca47c','rgba(190,140,80,.18)'],['Grey Oak','#78685a','rgba(70,55,40,.30)'],['Dark Oak','#d0ccc4','rgba(230,228,220,.15)']],
  whitewash: [['Narrow','#c8c4ba','rgba(150,150,145,.15)'],['Vertical','#c4d4bc','rgba(150,190,160,.12)'],['Wide','#d8ccb0','rgba(210,190,150,.12)']],
  herring:   [['Chevron Wide','#845c40','rgba(70,45,25,.30)'],['Chevron Fine','#c89858','rgba(200,140,60,.18)'],['Blocks','#a89478','rgba(120,115,105,.22)']],
  lino:      [['Speckled','#9cb8c4','rgba(100,140,175,.18)'],['Sky','#b4b4ac','rgba(130,130,125,.20)'],['Leaf','#d4ccb0','rgba(230,215,180,.15)']],
  sand:      [['Ripples','#e8ddba','rgba(240,235,215,.15)'],['Dunes','#dcc088','rgba(210,150,80,.15)'],['Beach','#e0c8a4','rgba(215,165,140,.15)']],
  dirt:      [['Mud','#5c4a36','rgba(45,30,18,.30)'],['Tilth','#8a6044','rgba(140,60,35,.22)'],['Rocky','#98805e','rgba(200,170,130,.15)']],
  mulch:     [['Nuggets','#744838','rgba(150,55,35,.25)'],['Shredded','#7c5c34','rgba(190,140,60,.20)'],['Chips','#5c544c','rgba(100,95,85,.25)']],
  flagstone: [['Mega Slabs','#b8a47e','rgba(185,155,105,.18)'],['Cobbles','#787470','rgba(60,60,62,.30)'],['Fieldstone','#c4b494','rgba(210,185,135,.15)']],
  onyx:      [['Veined','#2c3c30','rgba(40,90,60,.25)'],['Banded','#2c3854','rgba(45,60,110,.25)'],['Gold Grid','#3c2f2a','rgba(90,60,40,.25)']],
  terrazzo:  [['Big Chips','#ccc8c0','rgba(140,140,145,.18)'],['Micro','#68686c','rgba(60,60,65,.30)'],['Tiles','#dcc8bc','rgba(210,170,160,.15)']],
};
for (const f in _FV)
  _FV[f].forEach((v, i) => HP.FLOOR_MATS.push({ id: f + (i + 2), name: v[0], col: v[1], fam: f, t: v[2] }));
HP.showUnderlay = true;    // ghost of the floor below

/* ---------- state helpers ---------- */
HP.newLevel = function () {
  return { walls: {}, floors: {}, fences: {}, roomNames: {}, furniture: [] };
};
HP.newState = function () {
  return { bg: null, level: 0, levels: [HP.newLevel()] };
};
/* the level currently being edited */
HP.cur = function () { return HP.state.levels[HP.state.level]; };
HP.maxFurnitureId = function () {
  let m = 0;
  for (const l of HP.state.levels)
    for (const it of l.furniture) if (it.id > m) m = it.id;
  return m;
};

/* wall segment keys: "h,x,y" = edge from vertex (x,y)->(x+1,y); "v,x,y" = (x,y)->(x,y+1) */
HP.wallKey  = (d, x, y) => d + ',' + x + ',' + y;
HP.parseWallKey = k => { const p = k.split(','); return { d: p[0], x: +p[1], y: +p[2] }; };

/* is there a blocking wall on the edge between cell (x,y) and its neighbor? */
HP.wallBetween = function (x, y, nx, ny) {
  const w = HP.cur().walls;
  if (nx === x + 1) return !!w[HP.wallKey('v', x + 1, y)];
  if (nx === x - 1) return !!w[HP.wallKey('v', x, y)];
  if (ny === y + 1) return !!w[HP.wallKey('h', x, y + 1)];
  if (ny === y - 1) return !!w[HP.wallKey('h', x, y)];
  return false;
};

/* ---------- coordinate transforms ---------- */
HP.s2w = function (sx, sy) {           // screen -> world px
  const r = HP.canvas.getBoundingClientRect();
  return {
    x: (sx - r.left - r.width  / 2) / HP.camera.zoom + HP.camera.x,
    y: (sy - r.top  - r.height / 2) / HP.camera.zoom + HP.camera.y
  };
};
HP.w2s = function (wx, wy) {
  const r = HP.canvas.getBoundingClientRect();
  return {
    x: (wx - HP.camera.x) * HP.camera.zoom + r.width  / 2 + r.left,
    y: (wy - HP.camera.y) * HP.camera.zoom + r.height / 2 + r.top
  };
};
HP.w2c = p => ({ x: Math.floor(p.x / HP.CELL), y: Math.floor(p.y / HP.CELL) }); // world -> cell
HP.cellIn = (x, y) => x >= 0 && y >= 0 && x < HP.GRID_W && y < HP.GRID_H;
HP.cellKey = (x, y) => x + ',' + y;

/* nearest grid vertex (for wall tool) */
HP.nearestVertex = function (wx, wy) {
  return {
    x: Math.max(0, Math.min(HP.GRID_W, Math.round(wx / HP.CELL))),
    y: Math.max(0, Math.min(HP.GRID_H, Math.round(wy / HP.CELL)))
  };
};

/* wall segments on the straight line between two vertices (axis-locked) */
HP.segmentsBetween = function (a, b) {
  const segs = [];
  if (a.x === b.x) {                       // vertical line
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    for (let y = y0; y < y1; y++) segs.push(HP.wallKey('v', a.x, y));
  } else if (a.y === b.y) {                // horizontal line
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    for (let x = x0; x < x1; x++) segs.push(HP.wallKey('h', x, a.y));
  } else {                                 // lock to dominant axis
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    return HP.segmentsBetween(a, dx >= dy ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
  }
  return segs;
};

/* wall/fence segment nearest to a world point (for door/window/erase).
   dict defaults to the level's walls; pass HP.cur().fences for fences. */
HP.nearestWallSeg = function (wx, wy, maxDist, dict) {
  const vx = wx / HP.CELL, vy = wy / HP.CELL;
  let best = null, bestD = (maxDist || 0.6) * (maxDist || 0.6);
  for (const k in (dict || HP.cur().walls)) {
    const s = HP.parseWallKey(k);
    let d;
    if (s.d === 'h') {                     // horizontal seg: (s.x,s.y)-(s.x+1,s.y)
      const cx = Math.max(s.x, Math.min(s.x + 1, vx));
      d = (cx - vx) * (cx - vx) + (s.y - vy) * (s.y - vy);
    } else {                               // vertical seg
      const cy = Math.max(s.y, Math.min(s.y + 1, vy));
      d = (s.x - vx) * (s.x - vx) + (cy - vy) * (cy - vy);
    }
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
};

/* ---------- fences (edge-based, drawn like walls) ---------- */
HP.FENCE_TYPES = {
  wood:      { name: 'Wood Fence',      c: '#9a774f', post: '#6f4f33' },
  picket:    { name: 'Picket Fence',    c: '#e8e0d0', post: '#d0c7b4' },
  iron:      { name: 'Iron Fence',      c: '#3a3f47', post: '#23262b' },
  stone:     { name: 'Garden Wall',     c: '#a8a294', post: '#8a8078' },
  brick:     { name: 'Brick Wall',      c: '#b0705a', post: '#9a5f4a' },
  whitewall: { name: 'Plastered Wall',  c: '#efe9da', post: '#ddd5c2' },
  hedge:     { name: 'Hedge',           c: '#4e7d45', post: '#3f6d55' },
  bamboo:    { name: 'Bamboo Screen',   c: '#c9a55f', post: '#a8873f' },
  reed:      { name: 'Reed Screen',     c: '#d0bd90', post: '#b0a070' },
  chainlink: { name: 'Chain Link',      c: '#aab4bb', post: '#8a949b' },
  lattice:   { name: 'Lattice Trellis', c: '#caa96f', post: '#a8873f' },
  ranch:     { name: 'Ranch Rail',      c: '#8a6844', post: '#6f4f33' },
  glass:     { name: 'Glass Balustrade', c: '#8cc8dc', post: '#9aa4ab' },
  metal:     { name: 'Metal Panel',     c: '#96a2b0', post: '#6a7684' },
  fieldstone:{ name: 'Fieldstone Edge', c: '#a8a294', post: '#847c6c' },
  rope:      { name: 'Post & Rope',     c: '#d0c4a8', post: '#8a6844' },
  gate:      { name: 'Gate (walk-through)', c: '#7c5a38', post: '#5c4028' },
};
HP.fenceType = 'wood';
HP.fencePreview = null;      // segments being dragged by the fence tool

/* ---------- furniture footprint ---------- */
HP.itemDef   = id => HP.CATALOG.find(c => c.id === id);
HP.footprint = function (item) {          // {x,y,w,h} in cells, rotation applied
  const d = HP.itemDef(item.type);
  const bw = item.w || d.w, bh = item.h || d.h;   // item may override def size
  const w = (item.rot % 2 === 0) ? bw : bh;
  const h = (item.rot % 2 === 0) ? bh : bw;
  return { x: item.x, y: item.y, w, h };
};
HP.itemAt = function (cx, cy) {
  const list = HP.cur().furniture;
  for (let i = list.length - 1; i >= 0; i--) {
    const f = HP.footprint(list[i]);
    if (cx >= f.x && cx < f.x + f.w && cy >= f.y && cy < f.y + f.h)
      return list[i];
  }
  return null;
};
/* cells that must stay clear so doors can open (both sides of each door seg) */
HP.doorCells = function () {
  const set = {};
  const walls = HP.cur().walls;
  for (const k in walls) {
    if (walls[k].f !== 'door') continue;
    const s = HP.parseWallKey(k);
    if (s.d === 'h') { set[s.x + ',' + (s.y - 1)] = 1; set[s.x + ',' + s.y] = 1; }
    else { set[(s.x - 1) + ',' + s.y] = 1; set[s.x + ',' + s.y] = 1; }
  }
  return set;
};

HP.canPlace = function (type, x, y, rot, ignore, sz) {
  const d = HP.itemDef(type);
  const bw = (sz && sz.w) || d.w, bh = (sz && sz.h) || d.h;   // sz = unrotated size
  const w = (rot % 2 === 0) ? bw : bh, h = (rot % 2 === 0) ? bh : bw;
  if (x < 0 || y < 0 || x + w > HP.GRID_W || y + h > HP.GRID_H) return false;
  // no wall may cross the interior of the footprint (flush against walls is ok)
  for (const k in HP.cur().walls) {
    const s = HP.parseWallKey(k);
    if (s.d === 'h') { if (s.x >= x && s.x < x + w && s.y > y && s.y < y + h) return false; }
    else { if (s.x > x && s.x < x + w && s.y >= y && s.y < y + h) return false; }
  }
  // keep door swings clear
  const dc = HP.doorCells();
  for (let cy = y; cy < y + h; cy++)
    for (let cx = x; cx < x + w; cx++)
      if (dc[cx + ',' + cy]) return false;
  for (const it of HP.cur().furniture) {
    if (Array.isArray(ignore) ? ignore.includes(it) : it === ignore) continue;
    const f = HP.footprint(it);
    if (x < f.x + f.w && x + w > f.x && y < f.y + f.h && y + h > f.y) return false;
  }
  return true;
};

/* ---------- furniture groups ("connected" pieces act as one) ---------- */
HP.groupOf = function (it) {               // [items] sharing it.g, else just [it]
  if (!it) return [];
  if (!it.g) return [it];
  return HP.cur().furniture.filter(f => f.g === it.g);
};
HP.maxGroup = function () {
  let m = 0;
  for (const lvl of HP.state.levels)
    for (const f of lvl.furniture) if (f.g && f.g > m) m = f.g;
  return m;
};
HP.touching = function (a, b) {            // footprints share an edge (adjacent)
  const A = HP.footprint(a), B = HP.footprint(b);
  const ovX = A.x < B.x + B.w && B.x < A.x + A.w;
  const ovY = A.y < B.y + B.h && B.y < A.y + A.h;
  return ((A.x + A.w === B.x || B.x + B.w === A.x) && ovY) ||
         ((A.y + A.h === B.y || B.y + B.h === A.y) && ovX);
};
/* grow `members` by transitively absorbing every eligible touching item (with its group) */
HP._absorb = function (gid, members, eligible) {
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of HP.cur().furniture) {
      if (members.includes(f) || !eligible(f)) continue;
      if (members.some(m => HP.touching(m, f))) {
        for (const fm of HP.groupOf(f))
          if (!members.includes(fm)) { fm.g = gid; members.push(fm); }
        grew = true;
      }
    }
  }
};
/* absorb the selected item's group AND everything touching it into one group */
HP.connectSelected = function () {
  const it = HP.selected; if (!it) return;
  HP.pushUndo();
  const gid = it.g || (HP.maxGroup() + 1);
  it.g = gid;
  const members = HP.groupOf(it);
  HP._absorb(gid, members, () => true);
  if (members.length === 1) {                        // nothing touched — don't keep a group of one
    delete it.g;
    HP.saveState(); HP.markDirty(); HP.refreshContext();
    HP.status('Nothing touching to connect with — push pieces together first');
    return;
  }
  HP.saveState(); HP.markDirty(); HP.refreshContext();
  HP.status('Connected ' + members.length + ' pieces — they move as one');
};
/* modular pieces snap together automatically when placed touching */
HP.autoConnect = function (it) {
  if (HP.itemDef(it.type).cat !== 'Modular') return;
  const isLinkable = f => f.g || HP.itemDef(f.type).cat === 'Modular';
  if (!HP.cur().furniture.some(f => f !== it && isLinkable(f) && HP.touching(it, f))) return;
  const gid = (HP.cur().furniture.find(f => f !== it && f.g && HP.touching(it, f)) || {}).g
    || (HP.maxGroup() + 1);
  it.g = gid;
  HP._absorb(gid, HP.groupOf(it), isLinkable);
};
HP.disconnectSelected = function () {
  const it = HP.selected; if (!it || !it.g) return;
  HP.pushUndo();
  const members = HP.groupOf(it);
  delete it.g;
  if (members.length === 2) {              // a group of 1 dissolves
    const last = members.find(f => f !== it);
    if (last) delete last.g;
  }
  HP.saveState(); HP.markDirty(); HP.refreshContext();
};

HP.invalidateRegions = () => { HP.regions = null; HP.dirty = true; };
HP.markDirty = () => { HP.dirty = true; };

/* ---------- misc ---------- */
HP.shade = function (col, f) {             // f<1 darker, f>1 lighter
  let r, g, b;
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(col);
  if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  else {
    const n = parseInt(col.slice(1), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  }
  const s = v => Math.min(255, Math.round(v * f));
  return `rgb(${s(r)},${s(g)},${s(b)})`;
};
