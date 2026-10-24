/* presets.js — starter house layouts + tiny plan previews for the picker. */
(function () {

/* helpers — write into state `s` */
function hwall(s, x0, x1, y, skip) {
  for (let x = x0; x < x1; x++) if (!(skip && skip.has(x))) s.walls['h,' + x + ',' + y] = { f: null };
}
function vwall(s, x, y0, y1, skip) {
  for (let y = y0; y < y1; y++) if (!(skip && skip.has(y))) s.walls['v,' + x + ',' + y] = { f: null };
}
function rect(s, x0, y0, x1, y1) {       // walls enclosing cells [x0,x1)×[y0,y1)
  hwall(s, x0, x1, y0); hwall(s, x0, x1, y1);
  vwall(s, x0, y0, y1); vwall(s, x1, y0, y1);
}
function feat(s, d, x, y, f) { const k = d + ',' + x + ',' + y; if (s.walls[k]) s.walls[k].f = f; }
function fillRoom(s, x0, y0, x1, y1, mat, name) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    s.floors[x + ',' + y] = mat;
    if (name) s.roomNames[x + ',' + y] = name;
  }
}
function put(s, type, x, y, rot, v) {
  s.furniture.push({ id: s.furniture.length + 1, type, x, y, rot: rot || 0, v: v || 0 });
}

/* ---------------- Cozy Apartment (1 bed, ~12×10m) ---------------- */
function cozy() {
  const s = HP.newLevel();
  // outer shell: cells x∈[22,46) y∈[13,33)  → 24×20 cells = 12×10 m
  rect(s, 22, 13, 46, 33);
  // right block split: bedrooms/bath/office at x≥34
  vwall(s, 34, 13, 33);
  hwall(s, 34, 46, 22);                    // bedroom (top) | bath+office (bottom)
  hwall(s, 34, 46, 27);                    // bath | office
  // doors
  feat(s, 'v', 34, 17, 'door');            // living → bedroom
  feat(s, 'v', 34, 24, 'door');            // living → bath
  feat(s, 'v', 34, 29, 'door');            // living → office
  feat(s, 'v', 22, 23, 'door');            // entry door (left wall)
  // windows
  feat(s, 'h', 25, 13, 'window'); feat(s, 'h', 29, 13, 'window');   // living top
  feat(s, 'h', 37, 13, 'window'); feat(s, 'h', 41, 13, 'window');   // bedroom top
  feat(s, 'h', 36, 33, 'window');                                    // bath bottom
  feat(s, 'h', 42, 33, 'window');                                    // office bottom
  feat(s, 'v', 46, 15, 'window');                                    // bedroom right
  feat(s, 'v', 46, 30, 'window');                                    // office right
  // floors + names
  fillRoom(s, 22, 13, 34, 33, 'wood', 'LIVING / KITCHEN');
  fillRoom(s, 34, 13, 46, 22, 'wood', 'SUITE');
  fillRoom(s, 34, 22, 46, 27, 'tile', 'BWC');
  fillRoom(s, 34, 27, 46, 33, 'carpet', 'OFFICE');
  // furnishing — living/kitchen side
  put(s, 'sofa3', 25, 15, 0, 0);
  put(s, 'rugA', 24, 17, 0, 0);
  put(s, 'coffeeR', 26, 18, 0, 0);
  put(s, 'tvstand', 25, 21, 0, 0);
  put(s, 'plantBig', 22, 13, 0, 0);
  put(s, 'counter3', 22, 30, 0, 0);
  put(s, 'stove', 25, 30, 0, 0);
  put(s, 'ksink', 27, 30, 0, 0);
  put(s, 'counter', 29, 30, 0, 0);
  put(s, 'fridge', 31, 30, 0, 0);
  put(s, 'tableRound', 28, 24, 0, 0);
  put(s, 'chair', 27, 24, 0, 0); put(s, 'chair', 30, 24, 0, 0);
  put(s, 'chair', 28, 26, 0, 0);
  // bedroom
  put(s, 'bedQueen', 37, 14, 0, 0);
  put(s, 'nightstand', 36, 14, 0, 0); put(s, 'nightstand', 41, 14, 0, 0);
  put(s, 'wardrobe', 42, 19, 0, 0);
  put(s, 'dresser', 35, 20, 0, 0);
  // bath
  put(s, 'bathtub', 43, 22, 0, 0);
  put(s, 'toilet', 35, 24, 0, 0);
  put(s, 'bsink', 37, 22, 0, 0);
  put(s, 'washer', 34, 22, 0, 0);
  // office
  put(s, 'desk', 35, 28, 0, 0);
  put(s, 'offchair', 36, 30, 0, 0);
  put(s, 'bookcase', 41, 31, 0, 0);
  return s;
}

/* ---------------- Family House (2 bed, ~20×13m) ---------------- */
function family() {
  const s = HP.newLevel();
  // outer shell: x∈[12,52) y∈[9,35) → 40×26 cells = 20×13 m
  rect(s, 12, 9, 52, 35);
  hwall(s, 12, 52, 20);                    // top bedrooms | big living
  vwall(s, 25, 9, 20);                     // bedroom1 | rest
  vwall(s, 39, 9, 20);                     // bedroom2 | bath
  // doors
  feat(s, 'h', 18, 20, 'door');            // bedroom1 → living
  feat(s, 'h', 31, 20, 'door');            // bedroom2 → living
  feat(s, 'h', 45, 20, 'door');            // bath → living
  feat(s, 'h', 30, 35, 'door');            // main entry (bottom)
  feat(s, 'v', 12, 14, 'door');            // bedroom1 balcony door
  // windows
  feat(s, 'h', 15, 9, 'window'); feat(s, 'h', 20, 9, 'window');     // b1 top
  feat(s, 'h', 28, 9, 'window'); feat(s, 'h', 33, 9, 'window');     // b2 top
  feat(s, 'h', 42, 9, 'window'); feat(s, 'h', 47, 9, 'window');     // bath top
  feat(s, 'h', 16, 35, 'window'); feat(s, 'h', 21, 35, 'window');   // living bottom L
  feat(s, 'h', 40, 35, 'window'); feat(s, 'h', 45, 35, 'window');   // living bottom R
  feat(s, 'v', 52, 23, 'window'); feat(s, 'v', 52, 28, 'window');   // living right
  feat(s, 'v', 12, 24, 'window'); feat(s, 'v', 12, 29, 'window');   // living left
  // floors + names
  fillRoom(s, 12, 9, 25, 20, 'wood', 'SUITE 01');
  fillRoom(s, 25, 9, 39, 20, 'wood', 'SUITE 02');
  fillRoom(s, 39, 9, 52, 20, 'tile', 'BWC');
  fillRoom(s, 12, 20, 52, 35, 'wood', 'LIVING / KITCHEN');
  // bedroom 1
  put(s, 'bedQueen', 14, 10, 0, 0);
  put(s, 'nightstand', 13, 10, 0, 0); put(s, 'nightstand', 18, 10, 0, 0);
  put(s, 'wardrobeBig', 19, 18, 0, 0);
  put(s, 'vanity', 14, 17, 0, 0);
  // bedroom 2
  put(s, 'bedDouble', 27, 10, 0, 2);
  put(s, 'nightstand', 26, 10, 0, 0); put(s, 'nightstand', 30, 10, 0, 0);
  put(s, 'wardrobe', 35, 10, 0, 0);
  put(s, 'desk', 27, 16, 0, 0);
  put(s, 'offchair', 28, 18, 0, 0);
  // bath
  put(s, 'bathtub', 49, 10, 0, 0);
  put(s, 'shower', 49, 15, 0, 0);
  put(s, 'toilet', 40, 10, 0, 0);
  put(s, 'bsink', 42, 10, 0, 0);
  put(s, 'washer', 40, 17, 0, 0);
  put(s, 'towelrack', 40, 13, 0, 0);
  // living — lounge zone left, kitchen right, dining middle
  put(s, 'sofaL', 14, 22, 0, 0);
  put(s, 'rugA', 15, 26, 0, 0);
  put(s, 'coffeeR', 16, 27, 0, 0);
  put(s, 'tvstand', 15, 32, 0, 0);
  put(s, 'plantBig', 12, 20, 0, 0); put(s, 'plantSm', 23, 33, 0, 0);
  put(s, 'floorlamp', 12, 33, 0, 0);
  put(s, 'bookshelf', 20, 32, 0, 0);
  put(s, 'tableDin', 28, 26, 0, 0);
  put(s, 'chair', 28, 24, 0, 0); put(s, 'chair', 30, 24, 0, 0);
  put(s, 'chair', 29, 28, 0, 0); put(s, 'chair', 31, 26, 0, 0);
  put(s, 'counter3', 46, 32, 0, 0);
  put(s, 'stove', 49, 32, 0, 0);
  put(s, 'ksink', 49, 29, 0, 1);
  put(s, 'counter', 47, 29, 0, 0);
  put(s, 'fridge', 49, 21, 0, 0);
  put(s, 'dishwash', 44, 32, 0, 0);
  return s;
}

/* ---------------- Empty Plot ---------------- */
function empty() {
  return HP.newLevel();
}

/* ---------------- Duplex (2 floors, like the reference image) ---------------- */
function duplex() {
  const L0 = HP.newLevel(), L1 = HP.newLevel();
  // shared shell: x∈[16,52) y∈[14,34) → 36×20 cells = 18×10 m
  for (const s of [L0, L1]) {
    rect(s, 16, 14, 52, 34);
    hwall(s, 16, 52, 24);                 // top band | bottom living/bedroom band
    vwall(s, 32, 14, 24);                 // kitchen/suite | hall
    vwall(s, 44, 14, 24);                 // hall | bath/suite2
  }
  // --- ground floor doors ---
  feat(L0, 'v', 16, 28, 'door');          // entry → living
  feat(L0, 'v', 32, 18, 'door');          // kitchen → hall
  feat(L0, 'v', 44, 18, 'door');          // hall → bath
  feat(L0, 'h', 22, 24, 'door');          // kitchen → living
  feat(L0, 'h', 37, 24, 'door');          // hall → living
  for (const [d, x, y] of [['h', 20, 14], ['h', 26, 14], ['h', 47, 14],
    ['v', 52, 17], ['h', 20, 34], ['h', 30, 34], ['h', 47, 34]])
    feat(L0, d, x, y, 'window');
  // floors
  fillRoom(L0, 16, 14, 32, 24, 'tile', 'KITCHEN');
  fillRoom(L0, 32, 14, 44, 24, 'marble', 'HALL');
  fillRoom(L0, 44, 14, 52, 24, 'tile', 'BWC');
  fillRoom(L0, 16, 24, 52, 34, 'wood', 'LIVING');
  // furniture — kitchen
  put(L0, 'counter3', 16, 14, 0, 0); put(L0, 'stove', 19, 14, 0, 0);
  put(L0, 'ksink', 21, 14, 0, 0); put(L0, 'counter', 23, 14, 0, 0);
  put(L0, 'fridge', 29, 14, 0, 0); put(L0, 'tableDin', 19, 19, 0, 0);
  put(L0, 'chair', 19, 21, 0, 0); put(L0, 'chair', 21, 21, 0, 0);
  // hall + stairs + bath
  put(L0, 'stairs', 38, 15, 1, 0);
  put(L0, 'plantSm', 32, 22, 0, 0);
  put(L0, 'bathtub', 49, 15, 0, 0); put(L0, 'toilet', 45, 15, 0, 0);
  put(L0, 'bsink', 46, 21, 0, 0); put(L0, 'washer', 45, 21, 0, 0);
  // living
  put(L0, 'sofaL', 18, 26, 0, 0); put(L0, 'rugA', 19, 29, 0, 0);
  put(L0, 'coffeeR', 20, 30, 0, 0); put(L0, 'tvstand', 18, 32, 0, 0);
  put(L0, 'plantBig', 16, 24, 0, 0); put(L0, 'floorlamp', 30, 32, 0, 0);
  put(L0, 'bookshelf', 47, 32, 0, 0); put(L0, 'sidetable', 24, 25, 0, 0);

  // --- upper floor ---
  feat(L1, 'v', 32, 18, 'door');          // suite1 → hall
  feat(L1, 'v', 44, 18, 'door');          // hall → suite2
  feat(L1, 'h', 22, 24, 'door');          // suite1 → family
  feat(L1, 'h', 37, 24, 'door');          // hall → family
  feat(L1, 'h', 47, 24, 'door');          // suite2 → family
  for (const [d, x, y] of [['h', 20, 14], ['h', 26, 14], ['h', 47, 14],
    ['v', 52, 17], ['h', 20, 34], ['h', 30, 34], ['h', 47, 34]])
    feat(L1, d, x, y, 'window');
  fillRoom(L1, 16, 14, 32, 24, 'wood', 'SUITE 01');
  fillRoom(L1, 32, 14, 44, 24, 'marble', 'HALL');
  fillRoom(L1, 44, 14, 52, 24, 'carpet', 'SUITE 02');
  fillRoom(L1, 16, 24, 52, 34, 'wood', 'FAMILY ROOM');
  put(L1, 'stairs', 38, 15, 1, 0);        // same spot as below
  put(L1, 'bedQueen', 18, 15, 0, 0);
  put(L1, 'nightstand', 17, 15, 0, 0); put(L1, 'nightstand', 22, 15, 0, 0);
  put(L1, 'wardrobeBig', 26, 21, 0, 0); put(L1, 'dresser', 18, 21, 0, 0);
  put(L1, 'bedDouble', 46, 15, 0, 2);
  put(L1, 'nightstand', 45, 15, 0, 0); put(L1, 'wardrobe', 48, 21, 0, 0);
  put(L1, 'desk', 45, 19, 0, 0); put(L1, 'offchair', 46, 20, 0, 0);
  put(L1, 'sofa3', 20, 26, 0, 0); put(L1, 'rugRound', 22, 29, 0, 0);
  put(L1, 'coffeeRound', 23, 30, 0, 0); put(L1, 'tvstand', 20, 32, 0, 0);
  put(L1, 'bookshelf', 33, 32, 0, 0); put(L1, 'plantBig', 50, 32, 0, 0);
  return { bg: null, level: 0, levels: [L0, L1] };
}

HP.PRESETS = [
  { id: 'cozy', name: 'Cozy Apartment', desc: '1 suite · bath · office · open living/kitchen — 12×10 m, furnished', build: cozy },
  { id: 'family', name: 'Family House', desc: '2 suites · bath · big living/kitchen — 20×13 m, furnished', build: family },
  { id: 'duplex', name: 'Duplex', desc: '2 floors · stairs · 2 suites · living + family room — 18×10 m each', build: duplex },
  { id: 'empty', name: 'Empty Plot', desc: 'Blank 32×22 m lot — draw your own walls from scratch', build: empty },
];

/* mini preview of a state into a canvas (walls+floors only, ground floor) */
HP.presetPreview = function (canvas, st) {
  st = st.levels ? st.levels[0] : st;
  const mats = {};
  for (const m of HP.FLOOR_MATS) mats[m.id] = m.col;
  const g = canvas.getContext('2d');
  const sx = canvas.width / (HP.GRID_W * HP.CELL), sy = canvas.height / (HP.GRID_H * HP.CELL);
  const k = Math.min(sx, sy);
  g.fillStyle = '#aebfa0'; g.fillRect(0, 0, canvas.width, canvas.height);
  for (const key in st.floors) {
    const [x, y] = key.split(',').map(Number);
    g.fillStyle = mats[st.floors[key]] || '#e8e2d6';
    g.fillRect(x * HP.CELL * k, y * HP.CELL * k, HP.CELL * k + 0.5, HP.CELL * k + 0.5);
  }
  g.fillStyle = '#2e3138';
  for (const key in st.walls) {
    const s = HP.parseWallKey(key);
    if (s.d === 'h') g.fillRect(s.x * HP.CELL * k, s.y * HP.CELL * k - 1.5, HP.CELL * k, 3);
    else g.fillRect(s.x * HP.CELL * k - 1.5, s.y * HP.CELL * k, 3, HP.CELL * k);
  }
  for (const it of st.furniture) {
    const d = HP.itemDef(it.type);
    const w = (it.rot % 2 === 0) ? d.w : d.h, h = (it.rot % 2 === 0) ? d.h : d.w;
    g.fillStyle = 'rgba(120,110,95,.7)';
    g.fillRect(it.x * HP.CELL * k, it.y * HP.CELL * k, w * HP.CELL * k, h * HP.CELL * k);
  }
};
})();
