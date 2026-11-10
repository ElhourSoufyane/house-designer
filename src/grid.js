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
  return { w: 64, h: 44, bg: null, level: 0, levels: [HP.newLevel()] };
};
HP.newEmpty = function (w, h) {
  return { w, h, bg: null, level: 0, levels: [HP.newLevel()] };
};
/* adopt the plot dimensions stored in state — every GRID_W/H read is already
   dynamic, so this just swaps constants and rebuilds cached layers */
HP.applyGridSize = function () {
  HP.GRID_W = HP.state.w || 64;
  HP.GRID_H = HP.state.h || 44;
  HP.regions = null;
  if (HP.resetLayers) HP.resetLayers();              // static/below layers rebuild at new size
  HP.invalidateRegions();
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
/* fine placement: snapStep 1 = normal cell snap (0.5m), 0.5 = half-cell (0.25m).
   Wall-mounted items always keep step 1 — they must align to wall edges. */
HP.snapStep = 1;
HP.snapCoord = v => HP.snapStep === 1 ? Math.floor(v)
                                      : Math.round(v / HP.snapStep) * HP.snapStep;
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

/* ---------- wall paint palette + helpers ---------- */
HP.WALL_PAINTS = [
  { id: '',        name: 'Default Plaster', col: '#f4efe4' },
  { id: '#f7f5f0', name: 'Chalk White',     col: '#f7f5f0' },
  { id: '#ebe3d2', name: 'Warm Cream',      col: '#ebe3d2' },
  { id: '#ddd2be', name: 'Sandstone',       col: '#ddd2be' },
  { id: '#c8b89e', name: 'Greige',          col: '#c8b89e' },
  { id: '#d6dfd4', name: 'Mist Sage',       col: '#d6dfd4' },
  { id: '#9cb29b', name: 'Sage Green',      col: '#9cb29b' },
  { id: '#6e846d', name: 'Olive',           col: '#6e846d' },
  { id: '#d4e2ea', name: 'Powder Blue',     col: '#d4e2ea' },
  { id: '#8faec4', name: 'Coastal Blue',    col: '#8faec4' },
  { id: '#3f566e', name: 'Navy',            col: '#3f566e' },
  { id: '#eed9d4', name: 'Blush Pink',      col: '#eed9d4' },
  { id: '#d8a499', name: 'Dusty Rose',      col: '#d8a499' },
  { id: '#c87d5c', name: 'Terracotta',      col: '#c87d5c' },
  { id: '#dfc28b', name: 'Warm Ochre',      col: '#dfc28b' },
  { id: '#dcd6e4', name: 'Soft Lavender',   col: '#dcd6e4' },
  { id: '#c5c9ce', name: 'Cool Grey',       col: '#c5c9ce' },
  { id: '#7d848d', name: 'Slate Grey',      col: '#7d848d' },
  { id: '#3a3f47', name: 'Charcoal',        col: '#3a3f47' },
  { id: '#b06a50', name: 'Brick Red',       col: '#b06a50' },
  { id: '#9a774f', name: 'Warm Wood',       col: '#9a774f' },
];
HP.wallColor = '';       // '' = default plaster; else '#rrggbb'
HP.wallMode  = 'draw';   // 'draw' | 'room' | 'wall'

/* paint all interior wall faces bounding room region `r` */
HP.paintRoomWalls = function (r, col) {
  if (!r || !r.cells) return 0;
  const walls = HP.cur().walls;
  let n = 0;
  const setSide = (k, side) => {
    const w = walls[k]; if (!w) return;
    if (col) w[side] = col; else delete w[side];
    n++;
  };
  for (const [x, y] of r.cells) {
    setSide(HP.wallKey('h', x, y),     'cb');   // north edge: room is on +y (cb) side
    setSide(HP.wallKey('h', x, y + 1), 'ca');   // south edge: room is on -y (ca) side
    setSide(HP.wallKey('v', x, y),     'cb');   // west edge:  room is on +x (cb) side
    setSide(HP.wallKey('v', x + 1, y), 'ca');   // east edge:  room is on -x (ca) side
  }
  return n;
};
HP.roomWallColor = function (r) {
  if (!r || !r.cells) return '';
  const walls = HP.cur().walls;
  for (const [x, y] of r.cells) {
    for (const [k, s] of [[HP.wallKey('h', x, y), 'cb'], [HP.wallKey('h', x, y + 1), 'ca'],
                          [HP.wallKey('v', x, y), 'cb'], [HP.wallKey('v', x + 1, y), 'ca']]) {
      if (walls[k] && walls[k][s]) return walls[k][s];
    }
  }
  return '';
};
/* paint the face of the nearest wall segment on the cursor's side */
HP.paintWallAt = function (wx, wy, col) {
  const k = HP.nearestWallSeg(wx, wy, 0.75);
  if (!k) return null;
  const s = HP.parseWallKey(k), w = HP.cur().walls[k];
  const side = s.d === 'h' ? (wy < s.y * HP.CELL ? 'ca' : 'cb')
                           : (wx < s.x * HP.CELL ? 'ca' : 'cb');
  if (col) w[side] = col; else delete w[side];
  return k + ':' + side;
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
HP.itemAt = function (cx, cy, px, py) {
  /* px/py = world px (sub-cell) — lets the wall-edge strip test work
     inside a single cell; callers without them get whole-cell hits    */
  const fx = px !== undefined ? px / HP.CELL : cx + 0.5;
  const fy = py !== undefined ? py / HP.CELL : cy + 0.5;
  const list = HP.cur().furniture;
  let floorHit = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i], f = HP.footprint(it);
    if (!(fx >= f.x && fx < f.x + f.w && fy >= f.y && fy < f.y + f.h)) continue;
    const d = HP.itemDef(it.type);
    if (d && d.hangs) {
      /* hung sprites draw pinned to the wall edge — only that strip
         is the item; the rest of the cell belongs to what's below    */
      const hs = it.hang || HP.hangSide(it.type, it.x, it.y, it.rot,
        { w: it.w || f.w, h: it.h || f.h });
      const S = 0.62;
      if (hs === 'n' && fy >= f.y + S) continue;
      if (hs === 's' && fy < f.y + f.h - S) continue;
      if (hs === 'w' && fx >= f.x + S) continue;
      if (hs === 'e' && fx < f.x + f.w - S) continue;
      return it;
    }
    if (d && d.onTop) return it;
    if (!floorHit) floorHit = it;
  }
  return floorHit;
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

/* flat-topped furniture a tabletop (onTop) item may sit on */
const SURFACE_T = /table|desk|counter|dresser|nightstand|vanity|island|shelf|bookcase|cabinet|sideboard|buffet|bench|chest|console|drawer|fridge|washer|dryer|stove|dishwash|ksink|kitcart|credenza|worktop|machine|piano|stand|bar\b|coffeetable|ottoman/i;
HP.isSurface = function (it) {
  const d = HP.itemDef(it.type);
  return d && !d.hangs && !d.onTop && SURFACE_T.test(it.type + ' ' + (d.name || ''));
};

/* which footprint edge touches the most wall — for hangs:true items.
   Returns 'n'|'s'|'e'|'w' (the wall side) or null if no edge touches a wall. */
HP.hangSide = function (type, x, y, rot, sz) {
  const d = HP.itemDef(type);
  const bw = (sz && sz.w) || d.w, bh = (sz && sz.h) || d.h;
  const w = (rot % 2 === 0) ? bw : bh, h = (rot % 2 === 0) ? bh : bw;
  const walls = HP.cur().walls;
  const has = (k) => !!walls[k];
  const score = { n: 0, s: 0, w: 0, e: 0 };
  for (let cx = x; cx < x + w; cx++) {
    if (has('h,' + cx + ',' + y)) score.n++;
    if (has('h,' + cx + ',' + (y + h))) score.s++;
  }
  for (let cy = y; cy < y + h; cy++) {
    if (has('v,' + x + ',' + cy)) score.w++;
    if (has('v,' + (x + w) + ',' + cy)) score.e++;
  }
  let best = null, bs = 0;
  for (const s of ['n', 's', 'w', 'e'])
    if (score[s] > bs) { bs = score[s]; best = s; }
  return best;
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
  // keep door swings clear (floor/ceil → every cell the footprint overlaps)
  const dc = HP.doorCells();
  for (let cy = Math.floor(y); cy < Math.ceil(y + h); cy++)
    for (let cx = Math.floor(x); cx < Math.ceil(x + w); cx++)
      if (dc[cx + ',' + cy]) return false;
  if (d.onTop) {
    /* tabletop items must sit on a flat surface — and only that.
       ignored items (a moving set) still qualify: the host may be
       travelling with the item                                        */
    let host = false;
    for (const it of HP.cur().furniture) {
      const ignored = Array.isArray(ignore) ? ignore.includes(it) : it === ignore;
      const fd = HP.itemDef(it.type);
      if (fd && fd.hangs) continue;
      const f = HP.footprint(it);
      if (!(x < f.x + f.w && x + w > f.x && y < f.y + f.h && y + h > f.y)) continue;
      if (fd.onTop || !HP.isSurface(it)) { if (!ignored) return false; continue; }
      host = true;
    }
    return host;
  }
  if (d.hangs) {
    if (!HP.hangSide(type, x, y, rot, sz)) return false;    // art needs a wall
    for (const it of HP.cur().furniture) {                  // may hang above floor items;
      if (Array.isArray(ignore) ? ignore.includes(it) : it === ignore) continue;   // but not over other wall items
      if (!HP.itemDef(it.type).hangs) continue;
      const f = HP.footprint(it);
      if (x < f.x + f.w && x + w > f.x && y < f.y + f.h && y + h > f.y) return false;
    }
    return true;
  }
  const isSurf = HP.isSurface({ type });
  for (const it of HP.cur().furniture) {
    if (Array.isArray(ignore) ? ignore.includes(it) : it === ignore) continue;
    const fd = HP.itemDef(it.type);
    if (fd && (fd.hangs || (isSurf && fd.onTop))) continue;  // wall/top items share the cell with their surface
    const f = HP.footprint(it);
    if (x < f.x + f.w && x + w > f.x && y < f.y + f.h && y + h > f.y) {
      if (HP.itemsClash ? HP.itemsClash({ type, x, y, rot }, it) : true) return false;
    }
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

/* ---------- item sub-colliders & open footprint spaces ---------- */
HP.itemSubBoxes = function (type, bw, bh, H) {
  const t = (type || '').toLowerCase();
  const C = HP.CELL;
  const W = bw * C, D = bh * C;
  if (/^sofau$|sectional.*5|^u.*sofa/i.test(t)) {
    return [
      // Rear backrest & seat row
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 1.1 * C, y0: 0, y1: H },
      // Left chaise lounge
      { x0: -W / 2, x1: -W / 2 + 1.65 * C, z0: -D / 2 + 1.1 * C, z1: D / 2, y0: 0, y1: H },
      // Right chaise lounge
      { x0: W / 2 - 1.65 * C, x1: W / 2, z0: -D / 2 + 1.1 * C, z1: D / 2, y0: 0, y1: H }
    ];
  }
  if (/^sofal$|^l.*sofa/i.test(t)) {
    return [
      // Rear seats along back
      { x0: -W / 2, x1: W / 2 - 1.6 * C, z0: -D / 2, z1: -D / 2 + 1.25 * C, y0: 0, y1: H },
      // Right chaise lounge extending forward
      { x0: W / 2 - 1.6 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H }
    ];
  }
  if (/^deskl$|corner.*desk/i.test(t)) {
    return [
      // Main desk along back
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 1.1 * C, y0: 0, y1: H },
      // Return along left
      { x0: -W / 2, x1: -W / 2 + 1.1 * C, z0: -D / 2 + 1.1 * C, z1: D / 2, y0: 0, y1: H }
    ];
  }
  if (/^garch$/i.test(t)) {
    return [
      { x0: -W / 2, x1: -W / 2 + 0.35 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: W / 2 - 0.35 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 44, y1: H }
    ];
  }
  if (/^swingset$/i.test(t)) {
    return [
      { x0: -W / 2, x1: -W / 2 + 0.35 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: W / 2 - 0.35 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 44, y1: H }
    ];
  }
  if (/^carport$/i.test(t)) {
    return [
      // Left 3 support posts
      { x0: -W / 2, x1: -W / 2 + 0.4 * C, z0: -D / 2, z1: -D / 2 + 0.4 * C, y0: 0, y1: H },
      { x0: -W / 2, x1: -W / 2 + 0.4 * C, z0: -0.2 * C, z1: 0.2 * C, y0: 0, y1: H },
      { x0: -W / 2, x1: -W / 2 + 0.4 * C, z0: D / 2 - 0.4 * C, z1: D / 2, y0: 0, y1: H },
      // Right 3 support posts
      { x0: W / 2 - 0.4 * C, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.4 * C, y0: 0, y1: H },
      { x0: W / 2 - 0.4 * C, x1: W / 2, z0: -0.2 * C, z1: 0.2 * C, y0: 0, y1: H },
      { x0: W / 2 - 0.4 * C, x1: W / 2, z0: D / 2 - 0.4 * C, z1: D / 2, y0: 0, y1: H },
      // Overhead roof canopy
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 44, y1: H }
    ];
  }
  if (/^pergola$/i.test(t)) {
    return [
      // 4 corner posts
      { x0: -W / 2, x1: -W / 2 + 0.35 * C, z0: -D / 2, z1: -D / 2 + 0.35 * C, y0: 0, y1: H },
      { x0: W / 2 - 0.35 * C, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.35 * C, y0: 0, y1: H },
      { x0: -W / 2, x1: -W / 2 + 0.35 * C, z0: D / 2 - 0.35 * C, z1: D / 2, y0: 0, y1: H },
      { x0: W / 2 - 0.35 * C, x1: W / 2, z0: D / 2 - 0.35 * C, z1: D / 2, y0: 0, y1: H },
      // Overhead rafters
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 44, y1: H }
    ];
  }
  if (/^treehouse$/i.test(t)) {
    return [
      // Central ancient oak trunk (ground to tree canopy)
      { x0: -0.28 * C, x1: 0.28 * C, z0: -0.28 * C, z1: 0.28 * C, y0: 0, y1: H },
      // 4 Heavy timber corner stilts with clearance underneath (y=0 to 54)
      { x0: -W / 2, x1: -W / 2 + 0.25 * C, z0: -D / 2, z1: -D / 2 + 0.25 * C, y0: 0, y1: 54 },
      { x0: W / 2 - 0.25 * C, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.25 * C, y0: 0, y1: 54 },
      { x0: -W / 2, x1: -W / 2 + 0.25 * C, z0: D / 2 - 0.25 * C, z1: D / 2, y0: 0, y1: 54 },
      { x0: W / 2 - 0.25 * C, x1: W / 2, z0: D / 2 - 0.25 * C, z1: D / 2, y0: 0, y1: 54 },
      // Elevated timber deck floor slab (y=50 to 54.0 - flush with feetY=54.0)
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 50, y1: 54.0 },
      // Cabin rear wall (y=54 to 86)
      { x0: -W / 2, x1: 0.12 * W, z0: -D / 2, z1: -D / 2 + 0.25 * C, y0: 54, y1: 104 },
      // Cabin left wall (y=54 to 86)
      { x0: -W / 2, x1: -W / 2 + 0.25 * C, z0: -D / 2, z1: 0.12 * D, y0: 54, y1: 104 },
      // Cabin front wall (leaving walk-in Dutch doorway)
      { x0: -W / 2, x1: -0.16 * W, z0: 0.10 * D, z1: 0.10 * D + 0.25 * C, y0: 54, y1: 104 },
      // Cabin right wall
      { x0: 0.10 * W, x1: 0.10 * W + 0.25 * C, z0: -D / 2, z1: 0.12 * D, y0: 54, y1: 104 },
      // Cabin gabled roof (only over cabin footprint, leaves deck open & clear)
      { x0: -W / 2, x1: 0.12 * W, z0: -D / 2, z1: 0.12 * D, y0: 104, y1: H },
      // Observation deck perimeter guardrails (leaves ladder opening at front-right)
      { x0: -W / 2, x1: 0.18 * W, z0: D / 2 - 0.20 * C, z1: D / 2, y0: 54, y1: 66 },
      { x0: 0.35 * W, x1: W / 2, z0: D / 2 - 0.20 * C, z1: D / 2, y0: 54, y1: 66 },
      { x0: 0.10 * W, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.20 * C, y0: 54, y1: 66 },
      { x0: W / 2 - 0.20 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 54, y1: 66 }
    ];
  }
  if (/^greenhouse/i.test(t)) {
    const doorHalfW = Math.max(0.6 * C, W * 0.16);
    const benchW = Math.max(0.8 * C, W * 0.26);
    const eaveY = Math.max(54, Math.round(H * 0.56));
    const benchH = Math.max(18, Math.round(H * 0.22));
    return [
      // Left exterior glass wall & brick knee-wall
      { x0: -W / 2, x1: -W / 2 + 0.25 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      // Right exterior glass wall & brick knee-wall
      { x0: W / 2 - 0.25 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      // Left staging potting workbench
      { x0: -W / 2, x1: -W / 2 + benchW, z0: -D / 2, z1: D / 2, y0: 0, y1: benchH },
      // Right staging potting workbench
      { x0: W / 2 - benchW, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: benchH },
      // Rear brick knee-wall & glass wall
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.25 * C, y0: 0, y1: H },
      // Front wall left side of walk-in entrance
      { x0: -W / 2, x1: -doorHalfW, z0: D / 2 - 0.25 * C, z1: D / 2, y0: 0, y1: H },
      // Front wall right side of walk-in entrance
      { x0: doorHalfW, x1: W / 2, z0: D / 2 - 0.25 * C, z1: D / 2, y0: 0, y1: H },
      // Overhead roof canopy (headroom clearance below eaves)
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: eaveY, y1: H }
    ];
  }
  if (/^sandbox$/i.test(t)) {
    return [
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.2 * C, y0: 0, y1: 14 },
      { x0: -W / 2, x1: W / 2, z0: D / 2 - 0.2 * C, z1: D / 2, y0: 0, y1: 14 },
      { x0: -W / 2, x1: -W / 2 + 0.2 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: 14 },
      { x0: W / 2 - 0.2 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: 14 }
    ];
  }
  if (/^goal$/i.test(t)) {
    return [
      { x0: -W / 2, x1: -W / 2 + 0.25 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: W / 2 - 0.25 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 0.25 * C, y0: 0, y1: H },
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 44, y1: H }
    ];
  }
  if (/^cornershelf$/i.test(t)) {
    return [
      { x0: -W / 2, x1: 0.15 * C, z0: -D / 2, z1: 0.15 * C, y0: 0, y1: H }
    ];
  }
  if (/^garagedoor/i.test(t)) {
    return [
      // Left jamb vertical track post
      { x0: -W / 2, x1: -W / 2 + 0.15 * C, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      // Right jamb vertical track post
      { x0: W / 2 - 0.15 * C, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H },
      // Top header beam (lintel)
      { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 54, y1: H }
    ];
  }
  if (/^car$|^suv$/i.test(t)) {
    return [
      { x0: -W / 2 + 0.08 * C, x1: W / 2 - 0.08 * C, z0: -D / 2 + 0.08 * C, z1: D / 2 - 0.08 * C, y0: 0, y1: H }
    ];
  }
  return [{ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: 0, y1: H }];
};

HP.itemColliders = function (it, def, f, H) {
  const C = HP.CELL;
  const bw = it.w || def.w, bh = it.h || def.h;
  const rot = (it.rot || 0) % 4;
  const cx = (f.x + f.w / 2) * C, cz = (f.y + f.h / 2) * C;
  const subs = HP.itemSubBoxes(it.type, bw, bh, H);
  return subs.map(b => {
    let x0, x1, z0, z1;
    if (rot === 0) {
      x0 = cx + b.x0; x1 = cx + b.x1;
      z0 = cz + b.z0; z1 = cz + b.z1;
    } else if (rot === 1) {
      x0 = cx - b.z1; x1 = cx - b.z0;
      z0 = cz + b.x0; z1 = cz + b.x1;
    } else if (rot === 2) {
      x0 = cx - b.x1; x1 = cx - b.x0;
      z0 = cz - b.z1; z1 = cz - b.z0;
    } else {
      x0 = cx + b.z0; x1 = cx + b.z1;
      z0 = cz - b.x1; z1 = cz - b.x0;
    }
    return { x0, x1, z0, z1, y0: b.y0, y1: b.y1 };
  });
};

HP.itemBlockedCells = function (it, def, f, H = 24) {
  const C = HP.CELL;
  const colliders = HP.itemColliders(it, def, f, H);
  const groundColliders = colliders.filter(b => b.y0 < 30);
  const blocked = [];
  for (let cy = f.y; cy < f.y + f.h; cy++) {
    for (let cx = f.x; cx < f.x + f.w; cx++) {
      const cellCx = (cx + 0.5) * C, cellCz = (cy + 0.5) * C;
      const isSolid = groundColliders.some(b =>
        cellCx >= b.x0 && cellCx <= b.x1 && cellCz >= b.z0 && cellCz <= b.z1
      );
      if (isSolid) blocked.push(cx + ',' + cy);
    }
  }
  return blocked;
};

HP.itemsClash = function (a, b) {
  const ad = HP.itemDef(a.type), bd = HP.itemDef(b.type);
  if (!ad || !bd) return true;
  const at = (a.type || '').toLowerCase(), bt = (b.type || '').toLowerCase();
  // Allow garden/plant/flower/tree/potting items inside greenhouse
  if (at === 'greenhouse' || bt === 'greenhouse') {
    const other = at === 'greenhouse' ? b : a;
    const otherDef = at === 'greenhouse' ? bd : ad;
    const otherType = (other.type || '').toLowerCase();
    const otherCat = otherDef.cat || '';
    if (otherCat === 'Outdoor' || otherCat === 'Plants' || /plant|tree|flower|pot|veggie|tomato|bench|seed|growshelf|compost|watering|shrub|bush/i.test(otherType)) {
      return false;
    }
  }
  // Allow vehicles to cross garage door threshold
  if (/^garagedoor/i.test(at) || /^garagedoor/i.test(bt)) {
    const other = /^garagedoor/i.test(at) ? b : a;
    const otherType = (other.type || '').toLowerCase();
    if (/car|suv|vehicle|motorcycle|scooter|bike|mower/i.test(otherType)) {
      return false;
    }
  }
  // Allow cabin furniture, decor, toys, lamps on treehouse deck
  if (at === 'treehouse' || bt === 'treehouse') {
    const other = at === 'treehouse' ? b : a;
    const otherDef = at === 'treehouse' ? bd : ad;
    const otherType = (other.type || '').toLowerCase();
    const otherCat = otherDef.cat || '';
    if (otherCat !== 'Structure' && !/carport|pergola|shed|swingset/i.test(otherType)) {
      return false;
    }
  }
  const af = HP.footprint(a), bf = HP.footprint(b);
  const aCells = HP.itemBlockedCells(a, ad, af);
  const bCells = HP.itemBlockedCells(b, bd, bf);
  const bSet = new Set(bCells);
  return aCells.some(c => bSet.has(c));
};

/* furniture you can sit on / lie down in (walk-mode interact in 2D and 3D) */
const SEATS = new Set(['sofa2', 'sofa3', 'sofaL', 'sofaU', 'outsofa', 'modseat', 'loveseat2',
  'settee', 'reclinerSofa', 'curvedSofa', 'recliner', 'armchair', 'tubchair', 'clubchair',
  'accentchair', 'swivelchair', 'rockchair', 'rocker', 'chair', 'highchair', 'offchair',
  'gamingchair', 'kneelchair', 'bench', 'gardenbench', 'entrybench', 'showerbench',
  'bedbench', 'weightbench', 'barstool', 'footstool', 'ottoman', 'ottomanTuft', 'ottomanStor',
  'beanbag', 'beanbag2', 'toilet', 'bathtub', 'hottub', 'lounger', 'cinemaseats', 'swingset', 'car',
  'sectional5', 'tuxedo3', 'camel3', 'track4', 'velvet3', 'boucle3', 'armless3', 'recamier',
  'wingback', 'papasan', 'slipper', 'stepstool', 'modcorner', 'chester2', 'chester3',
  'english3', 'midcen3', 'track2', 'track3']);
const LIES = new Set(['bedSingle', 'bedDouble', 'bedQueen', 'bedKing', 'bunkbed', 'daybed',
  'daybed2', 'futon', 'sleeper', 'hammock', 'crib', 'petbed', 'chaise', 'modchaise', 'canopy', 'treehouse']);
HP.seatKind = t => SEATS.has(t) ? 'sit' : LIES.has(t) ? 'lie' : null;

HP.itemSeatSpots = function (it, def) {
  const C = HP.CELL;
  const t = (it.type || '').toLowerCase();
  const bw = it.w || def.w, bh = it.h || def.h;
  const W = bw * C, D = bh * C;
  const rot = (it.rot || 0) % 4;
  const f = HP.footprint(it);
  const cx = (f.x + f.w / 2) * C, cz = (f.y + f.h / 2) * C;

  let modelSpots = [];
  if (/^sofau$|sectional.*5|^u.*sofa/i.test(t)) {
    modelSpots = [
      { x: -0.30 * W, z: -0.18 * D }, // rear left
      { x: 0,         z: -0.18 * D }, // rear center
      { x: 0.30 * W,  z: -0.18 * D }, // rear right
      { x: -0.30 * W, z: 0.18 * D },  // left chaise lounge
      { x: 0.30 * W,  z: 0.18 * D },  // right chaise lounge
    ];
  } else if (/^sofal$|^l.*sofa/i.test(t)) {
    modelSpots = [
      { x: -0.33 * W, z: -0.18 * D }, // left rear seat 1
      { x: -0.06 * W, z: -0.18 * D }, // left rear seat 2
      { x: 0.28 * W,  z: 0.07 * D },  // right chaise lounge
    ];
  } else if (/^treehouse$/i.test(t)) {
    modelSpots = [
      { x: -0.14 * W, z: -0.32 * D }  // daybed bench inside treehouse cabin
    ];
  } else if (HP.seatKind && HP.seatKind(it.type) === 'lie') {
    if (bw >= bh) {
      modelSpots.push({ x: -W / 4, z: 0 }, { x: W / 4, z: 0 });
    } else {
      modelSpots.push({ x: 0, z: -D / 4 }, { x: 0, z: D / 4 });
    }
  } else if (bw >= bh) {
    for (let i = 0; i < bw; i++) {
      modelSpots.push({ x: -W / 2 + (i + 0.5) * (W / bw), z: 0 });
    }
  } else {
    for (let i = 0; i < bh; i++) {
      modelSpots.push({ x: 0, z: -D / 2 + (i + 0.5) * (D / bh) });
    }
  }

  return modelSpots.map(s => {
    let wx, wz;
    if (rot === 0) {
      wx = cx + s.x; wz = cz + s.z;
    } else if (rot === 1) {
      wx = cx - s.z; wz = cz + s.x;
    } else if (rot === 2) {
      wx = cx - s.x; wz = cz - s.z;
    } else {
      wx = cx + s.z; wz = cz - s.x;
    }
    return { x: wx, y: wz, z: wz };
  });
};
