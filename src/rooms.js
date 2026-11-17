/* rooms.js — flood-fill room detection.
   Cells reachable from the grid border through non-wall edges = "outside" (-1).
   Remaining cells grouped into enclosed regions = rooms. Doors/windows block
   like walls so rooms on each side stay distinct. */
(function () {
HP.computeRegions = function () {
  if (HP.regions) return HP.regions;
  const W = HP.GRID_W, H = HP.GRID_H;
  const regionOf = new Int16Array(W * H).fill(-9);   // -9 unvisited
  const outside = -1;
  const q = [];

  const tryPush = (x, y, tag, queue) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (regionOf[y * W + x] !== -9) return;
    regionOf[y * W + x] = tag;
    queue.push([x, y]);
  };

  // flood outside from all border cells
  for (let x = 0; x < W; x++) { tryPush(x, 0, outside, q); tryPush(x, H - 1, outside, q); }
  for (let y = 0; y < H; y++) { tryPush(0, y, outside, q); tryPush(W - 1, y, outside, q); }
  while (q.length) {
    const [x, y] = q.pop();
    if (!HP.wallBetween(x, y, x + 1, y)) tryPush(x + 1, y, outside, q);
    if (!HP.wallBetween(x, y, x - 1, y)) tryPush(x - 1, y, outside, q);
    if (!HP.wallBetween(x, y, x, y + 1)) tryPush(x, y + 1, outside, q);
    if (!HP.wallBetween(x, y, x, y - 1)) tryPush(x, y - 1, outside, q);
  }

  // group remaining cells into room regions
  const regions = [];
  const sharedDist = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (regionOf[y * W + x] !== -9) continue;
    const id = regions.length;
    const cells = [];
    tryPush(x, y, id, q);
    while (q.length) {
      const [cx, cy] = q.pop();
      cells.push([cx, cy]);
      if (!HP.wallBetween(cx, cy, cx + 1, cy)) tryPush(cx + 1, cy, id, q);
      if (!HP.wallBetween(cx, cy, cx - 1, cy)) tryPush(cx - 1, cy, id, q);
      if (!HP.wallBetween(cx, cy, cx, cy + 1)) tryPush(cx, cy + 1, id, q);
      if (!HP.wallBetween(cx, cy, cx, cy - 1)) tryPush(cx, cy - 1, id, q);
    }
    // most common room name
    const names = {};
    cells.forEach(([cx, cy]) => {
      const n = HP.cur().roomNames[HP.cellKey(cx, cy)];
      if (n) names[n] = (names[n] || 0) + 1;
    });
    let name = '';
    for (const n in names) if (!name || names[n] > names[name]) name = n;

    let best = cells[0];
    if (cells.length <= 4) {
      best = cells[Math.floor(cells.length / 2)];
    } else {
      const bq = [];
      for (const [cx, cy] of cells) {
        const edge = cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1 ||
          regionOf[cy * W + cx - 1] !== id || regionOf[cy * W + cx + 1] !== id ||
          regionOf[(cy - 1) * W + cx] !== id || regionOf[(cy + 1) * W + cx] !== id;
        if (edge) { sharedDist[cy * W + cx] = 0; bq.push([cx, cy]); }
      }
      for (let head = 0; head < bq.length; head++) {
        const [cx, cy] = bq[head];
        const d = sharedDist[cy * W + cx];
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const i = ny * W + nx;
          if (regionOf[i] !== id || sharedDist[i] !== -1) continue;
          sharedDist[i] = d + 1; bq.push([nx, ny]);
        }
      }
      let bd = -1;
      for (const [cx, cy] of cells) {
        if (sharedDist[cy * W + cx] > bd) { bd = sharedDist[cy * W + cx]; best = [cx, cy]; }
        sharedDist[cy * W + cx] = -1; // reset for next room
      }
    }

    regions.push({
      id, cells, name,
      lx: (best[0] + 0.5) * HP.CELL,
      ly: (best[1] + 0.5) * HP.CELL,
      m2: cells.length * HP.M2_PER_CELL
    });
  }

  HP.regions = { regionOf, regions };
  return HP.regions;
};

/* the enclosed region containing cell (x,y), or null if outside */
HP.regionAt = function (x, y) {
  const { regionOf, regions } = HP.computeRegions();
  if (!HP.cellIn(x, y)) return null;
  const id = regionOf[y * HP.GRID_W + x];
  return id >= 0 ? regions[id] : null;
};

/* enclosed (interior) cell count on a given floor — temporarily swaps the
   active level like drawBelowWorld does, restores everything after */
HP.interiorCells = function (lvlIdx) {
  const saveLvl = HP.state.level, saveReg = HP.regions;
  HP.state.level = lvlIdx; HP.regions = null;
  const { regionOf } = HP.computeRegions();
  let n = 0;
  for (let i = 0; i < regionOf.length; i++) if (regionOf[i] >= 0) n++;
  HP.state.level = saveLvl; HP.regions = saveReg;
  return n;
};
})();
