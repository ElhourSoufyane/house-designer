/* wallgeom.js — PURE wall/door/window geometry for the 3D preview.
   No THREE, no DOM — world3d.js renders these boxes; test-3d-walls.js and
   the in-page audit check the exact same output. One implementation.

   Model: SURFACE walls — each edge contributes two facing plates (one per
   side). Openings are holes cut in the plates; jambs/headers/sills connect
   the faces around each hole; junctions are plane meetings, so no solid
   can ever occupy an opening. The wall zone [w0,w1] is placed so the
   smaller region keeps its face ON the line (corridors stay full-width). */
(function (root) {
'use strict';
const WALL_H = 140, DOOR_H = 104, WIN_SILL = 54, WIN_TOP = 112, FACE = 0.35;
const pkey = (k) => { const [d, x, y] = k.split(','); return { d, x: +x, y: +y }; };

/* env = { C, GRID_W, GRID_H, cellIn(x,y), regionOf, zoneFn? }
   zoneFn(s) lets tests inject zones without regions; default derives from
   region sizes. */
function wallGeom(walls, env) {
  const C = env.C, cellIn = env.cellIn, regionOf = env.regionOf, GW = env.GRID_W;
  const rAt = (x, y) => cellIn(x, y) ? regionOf[y * GW + x] : -1;
  const isDoor = (d, x, y) => { const w = walls[d + ',' + x + ',' + y]; return w && w.f === 'door'; };

  const segThick = (s) => {
    const out = (x, y) => !cellIn(x, y) || regionOf[y * GW + x] < 0;
    if (s.d === 'h') return (out(s.x, s.y - 1) || out(s.x, s.y)) ? 0.44 * C : 0.30 * C;
    return (out(s.x - 1, s.y) || out(s.x, s.y)) ? 0.44 * C : 0.30 * C;
  };
  const rsz = {};
  for (let i = 0; i < regionOf.length; i++) if (regionOf[i] >= 0) rsz[regionOf[i]] = (rsz[regionOf[i]] || 0) + 1;
  const segZone = env.zoneFn || ((s) => {
    const t = segThick(s);
    const a = s.d === 'h' ? rAt(s.x, s.y - 1) : rAt(s.x - 1, s.y);   // − side
    const b = s.d === 'h' ? rAt(s.x, s.y) : rAt(s.x, s.y);           // + side
    if (a < 0 && b < 0) return [-t / 2, t / 2];
    if (a < 0) return [0, t];                    // outside keeps face on line
    if (b < 0) return [-t, 0];
    return (rsz[a] || 1) <= (rsz[b] || 1) ? [0, t] : [-t, 0];        // smaller keeps line
  });
  const eat = (d, x, y) => {
    const w = walls[d + ',' + x + ',' + y];
    if (!w || w.f === 'door') return 0;
    const doors = (isDoor(d, x - (d === 'h'), y - (d === 'v')) ? 1 : 0)
                + (isDoor(d, x + (d === 'h'), y + (d === 'v')) ? 1 : 0);
    return (doors > 1 ? 0.28 : 0.45) * C;
  };
  const perpAt = (d, vx, vy) => {
    if (d === 'h') return walls['v,' + vx + ',' + vy] || walls['v,' + vx + ',' + (vy - 1)] ? 1 : 0;
    return walls['h,' + vx + ',' + vy] || walls['h,' + (vx - 1) + ',' + vy] ? 1 : 0;
  };
  const perpExt = (d, vx, vy, dir) => {
    let m = 0;
    const edges = d === 'h' ? ['v,' + vx + ',' + vy, 'v,' + vx + ',' + (vy - 1)]
                            : ['h,' + vx + ',' + vy, 'h,' + (vx - 1) + ',' + vy];
    for (const ek of edges) if (walls[ek]) {
      const z = segZone(pkey(ek));
      m = Math.max(m, dir > 0 ? z[1] : -z[0]);
    }
    return m;
  };

  /* ---------- face runs ---------- */
  const runMap = {};
  for (const k in walls) {
    const s = pkey(k), z = segZone(s);
    for (const sd of [-1, 1]) {
      const reg = s.d === 'h' ? rAt(s.x, s.y + (sd < 0 ? -1 : 0))
                              : rAt(s.x + (sd < 0 ? -1 : 0), s.y);
      const key = s.d + '|' + (s.d === 'h' ? s.y : s.x) + '|' + sd + '|'
                + z[0].toFixed(1) + '|' + z[1].toFixed(1) + '|' + reg;
      const R = runMap[key] || (runMap[key] = { d: s.d, line: s.d === 'h' ? s.y : s.x, sd, w0: z[0], w1: z[1], cells: [] });
      R.cells.push(s.d === 'h' ? s.x : s.y);
    }
  }
  const runs = [];
  for (const key in runMap) {
    const R = runMap[key];
    R.cells.sort((a, b) => a - b);
    let st = R.cells[0], pr = R.cells[0];
    for (let i = 1; i <= R.cells.length; i++) {
      if (i < R.cells.length && R.cells[i] === pr + 1) { pr = R.cells[i]; continue; }
      const vx0 = R.d === 'h' ? st : R.line, vy0 = R.d === 'h' ? R.line : st;
      const vx1 = R.d === 'h' ? pr + 1 : R.line, vy1 = R.d === 'h' ? R.line : pr + 1;
      const e0 = perpExt(R.d, vx0, vy0, -1), e1 = perpExt(R.d, vx1, vy1, 1);
      runs.push({ d: R.d, line: R.line, sd: R.sd, w0: R.w0, w1: R.w1,
        p0: (R.d === 'h' ? vx0 : vy0) * C - e0, p1: (R.d === 'h' ? vx1 : vy1) * C + e1,
        free0: e0 === 0, free1: e1 === 0 });
      if (i < R.cells.length) st = pr = R.cells[i];
    }
  }

  /* ---------- apertures ---------- */
  const aps = [], wins = [], doors = [];
  for (const k in walls) {
    const s = pkey(k), feat = walls[k].f, z = segZone(s), t = segThick(s);
    const x0 = s.x * C, y0 = s.y * C;
    if (feat === 'window') { wins.push({ s, w0: z[0], w1: z[1] }); continue; }
    if (feat !== 'door') continue;
    let off = 0;
    if (s.d === 'h') { for (let x = s.x - 1; isDoor('h', x, s.y); x--) off++; }
    else { for (let y = s.y - 1; isDoor('v', s.x, y); y--) off++; }
    if (off % 2 === 1) continue;
    const dbl = s.d === 'h' ? isDoor('h', s.x + 1, s.y) : isDoor('v', s.x, s.y + 1);
    const n = dbl ? 2 : 1;
    const p0 = s.d === 'h' ? x0 : y0, pEnd = p0 + n * C;
    const nbL = walls[s.d + ',' + (s.d === 'h' ? s.x - 1 : s.x) + ',' + (s.d === 'h' ? s.y : s.y - 1)];
    const nbR = walls[s.d + ',' + (s.d === 'h' ? s.x + n : s.x) + ',' + (s.d === 'h' ? s.y : s.y + n)];
    const jL = perpAt(s.d, s.x, s.y) > 0;
    const jR = s.d === 'h' ? perpAt(s.d, s.x + n, s.y) > 0 : perpAt(s.d, s.x, s.y + n) > 0;
    const ox0 = jL ? p0 : p0 - eat(s.d, s.d === 'h' ? s.x - 1 : s.x, s.d === 'h' ? s.y : s.y - 1) + 1;
    const ox1 = jR ? pEnd : pEnd + eat(s.d, s.d === 'h' ? s.x + n : s.x, s.d === 'h' ? s.y : s.y + n) - 1;
    const apTop = (nbL && nbL.f === 'window') || (nbR && nbR.f === 'window') ? WIN_TOP : DOOR_H;
    aps.push({ d: s.d, line: s.d === 'h' ? s.y : s.x, lo: ox0, hi: ox1, y0: 0, y1: apTop, w0: z[0], w1: z[1] });
    doors.push({ key: k, d: s.d, line: s.d === 'h' ? s.y : s.x, lo: ox0, hi: ox1,
      n, dbl, w0: z[0], w1: z[1], t, cx: x0, cy: y0 });
  }
  const gap = Math.min(0.82 * C, C - 6), jw = (C - gap) / 2;
  for (const w of wins) {
    const s = w.s;
    let a0 = (s.d === 'h' ? s.x : s.y) * C + jw;
    let a1 = (s.d === 'h' ? s.x : s.y) * C + C - jw;
    const ln = s.d === 'h' ? s.y : s.x;
    for (const a of aps) {
      if (a.d !== s.d || a.line !== ln) continue;
      if (a.hi <= a0 || a.lo >= a1) continue;
      if (a.lo <= a0) a0 = a.hi;
      else if (a.hi >= a1) a1 = a.lo;
      else if (a.lo - a0 >= a1 - a.hi) a1 = a.lo; else a0 = a.hi;
    }
    if (a1 - a0 < 8) { w.eaten = true; continue; }
    aps.push({ d: s.d, line: ln, lo: a0, hi: a1, y0: WIN_SILL, y1: WIN_TOP, w0: w.w0, w1: w.w1 });
    w.a0 = a0; w.a1 = a1;
  }

  /* ---------- emit boxes ---------- */
  const boxes = [];
  const box = (tag, x0, y0, z0, x1, y1, z1) => boxes.push({ tag, x0, y0, z0, x1, y1, z1 });
  for (const r of runs) {
    const off = r.line * C + (r.sd < 0 ? r.w0 : r.w1);
    const hits = aps.filter(a => a.d === r.d && a.line === r.line && a.hi > r.p0 && a.lo < r.p1);
    const pts = [r.p0, r.p1];
    for (const a of hits) {
      if (a.lo > r.p0 && a.lo < r.p1) pts.push(a.lo);
      if (a.hi > r.p0 && a.hi < r.p1) pts.push(a.hi);
    }
    pts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a0 = pts[i], a1 = pts[i + 1];
      let bands = [[0, WALL_H]];
      for (const a of hits) {
        if (a.lo > a0 + 0.01 || a.hi < a1 - 0.01) continue;
        const nb = [];
        for (const bnd of bands) {
          if (a.y1 <= bnd[0] + 0.01 || a.y0 >= bnd[1] - 0.01) { nb.push(bnd); continue; }
          if (bnd[0] < a.y0 - 0.01) nb.push([bnd[0], a.y0]);
          if (bnd[1] > a.y1 + 0.01) nb.push([a.y1, bnd[1]]);
        }
        bands = nb;
      }
      for (const bnd of bands) {
        if (bnd[1] - bnd[0] < 0.01) continue;
        if (r.d === 'h') box('face', a0, bnd[0], off - FACE, a1, bnd[1], off + FACE);
        else box('face', off - FACE, bnd[0], a0, off + FACE, bnd[1], a1);
      }
    }
    const lc = r.line * C, z0 = lc + r.w0, z1 = lc + r.w1;
    if (r.d === 'h') {
      box('cap', r.p0, WALL_H - 0.4, z0, r.p1, WALL_H, z1);
      if (r.free0) box('cap', r.p0 - 0.4, 0, z0, r.p0 + 0.4, WALL_H, z1);
      if (r.free1) box('cap', r.p1 - 0.4, 0, z0, r.p1 + 0.4, WALL_H, z1);
    } else {
      box('cap', z0, WALL_H - 0.4, r.p0, z1, WALL_H, r.p1);
      if (r.free0) box('cap', z0, 0, r.p0 - 0.4, z1, WALL_H, r.p0 + 0.4);
      if (r.free1) box('cap', z0, 0, r.p1 - 0.4, z1, WALL_H, r.p1 + 0.4);
    }
  }
  for (const a of aps) {
    const lc = a.line * C, z0 = lc + a.w0, z1 = lc + a.w1;
    for (const x of [a.lo, a.hi]) {
      if (a.d === 'h') box('jamb', x - 0.4, a.y0, z0, x + 0.4, a.y1, z1);
      else box('jamb', z0, a.y0, x - 0.4, z1, a.y1, x + 0.4);
    }
    if (a.d === 'h') {
      box('jamb', a.lo, a.y1 - 0.4, z0, a.hi, a.y1, z1);
      if (a.y0 > 0.5) box('jamb', a.lo, a.y0, z0, a.hi, a.y0 + 0.4, z1);
    } else {
      box('jamb', z0, a.y1 - 0.4, a.lo, z1, a.y1, a.hi);
      if (a.y0 > 0.5) box('jamb', z0, a.y0, a.lo, z1, a.y0 + 0.4, a.hi);
    }
  }
  return { boxes, aps, doors, runs, wins };
}

/* ---------- audit checklist ----------
   Returns [{name, ok, detail, marks[]}] — marks are boxes to highlight. */
function wallAudit(walls, env) {
  const { boxes, aps, doors } = wallGeom(walls, env);
  const C = env.C;
  const checks = [];
  const vol = (a) => {
    const lc = a.line * C, z0 = lc + a.w0 - 1, z1 = lc + a.w1 + 1;
    return a.d === 'h' ? { x0: a.lo, x1: a.hi, z0, z1 } : { x0: z0, x1: z1, z0: a.lo, z1: a.hi };
  };
  /* 1 — nothing of the wall's own line inside its openings */
  const intr = [];
  for (const a of aps) {
    const v = vol(a);
    for (const b of boxes) {
      const ox = Math.min(b.x1, v.x1) - Math.max(b.x0, v.x0);
      const oz = Math.min(b.z1, v.z1) - Math.max(b.z0, v.z0);
      const oy = Math.min(b.y1, a.y1) - Math.max(b.y0, a.y0);
      if (ox > 0.5 && oz > 0.5 && oy > 0.5 && (b.tag === 'face' && (
          (a.d === 'h' && b.x1 - b.x0 > b.z1 - b.z0) || (a.d === 'v' && b.z1 - b.z0 > b.x1 - b.x0)))) intr.push(b);
    }
  }
  checks.push({ name: 'Openings empty — no wall material inside doors/windows',
    ok: intr.length === 0, detail: intr.length ? intr.length + ' boxes intrude' : 'all clear', marks: intr });
  /* 2 — walkable passage through every door */
  const narrow = [], nmarks = [];
  for (const d of doors) {
    const a = aps[aps.findIndex(x => x.d === d.d && x.line === d.line && x.lo === d.lo)];
    if (!a) continue;
    const v = vol(a);
    const blocked = [];
    for (const b of boxes) {
      const oy = Math.min(b.y1, a.y1) - Math.max(b.y0, a.y0);
      if (oy <= 0.5) continue;
      if (a.d === 'h') {
        if (b.z0 <= v.z0 + 0.5 && b.z1 >= v.z1 - 0.5)
          blocked.push([Math.max(b.x0, v.x0), Math.min(b.x1, v.x1)]);
      } else if (b.x0 <= v.x0 + 0.5 && b.x1 >= v.x1 - 0.5)
        blocked.push([Math.max(b.z0, v.z0), Math.min(b.z1, v.z1)]);
    }
    blocked.sort((p, q) => p[0] - q[0]);
    let bw = 0, cur = null;
    for (const [l, h] of blocked) {
      if (!cur || l > cur[1]) { if (cur) bw += cur[1] - cur[0]; cur = [l, h]; }
      else cur[1] = Math.max(cur[1], h);
    }
    if (cur) bw += cur[1] - cur[0];
    const clear = (a.hi - a.lo) - bw;
    if (clear < 18) {
      narrow.push(d.key + ' ' + clear.toFixed(0) + 'px');
      nmarks.push({ x0: v.x0, y0: 0, z0: v.z0, x1: v.x1, y1: a.y1, z1: v.z1 });
    }
    d.clear = clear;
  }
  checks.push({ name: 'Doorways walkable — ≥18px clear passage',
    ok: narrow.length === 0, detail: narrow.length ? narrow.join(', ') : 'all doors pass', marks: nmarks });
  /* 3 — door size consistency */
  const sw = doors.filter(d => !d.dbl).map(d => d.hi - d.lo);
  const dw = doors.filter(d => d.dbl).map(d => d.hi - d.lo);
  const spread = (a) => a.length ? Math.max(...a) - Math.min(...a) : 0;
  checks.push({ name: 'Door sizes consistent — singles/doubles uniform',
    ok: spread(sw) <= 4 && spread(dw) <= 4,
    detail: `singles ${sw.length ? Math.min(...sw).toFixed(0) + '–' + Math.max(...sw).toFixed(0) : '—'}px, ` +
            `doubles ${dw.length ? Math.min(...dw).toFixed(0) + '–' + Math.max(...dw).toFixed(0) : '—'}px`,
    marks: [] });
  /* 4 — no coplanar faces z-fighting */
  const zf = [];
  const faces = boxes.filter(b => b.tag === 'face');
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const a = faces[i], b = faces[j];
    const samePlane = (a.z0 === b.z0 && a.x0 !== b.x0) || (a.x0 === b.x0 && a.z0 !== b.z0)
                   || (a.x0 === b.x0 && a.x1 === b.x1) || (a.z0 === b.z0 && a.z1 === b.z1);
    if (!samePlane) continue;
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 1 && oz > 1 && oy > 1) zf.push(a);
  }
  checks.push({ name: 'No z-fighting — no overlapping coplanar faces',
    ok: zf.length === 0, detail: zf.length ? zf.length + ' overlaps' : 'clean', marks: zf });
  return { checks, doors, boxes, aps };
}

root.HP3D = root.HP3D || {};
root.HP3D.wallGeom = wallGeom;
root.HP3D.wallAudit = wallAudit;
root.HP3D.WALL_H = WALL_H; root.HP3D.DOOR_H = DOOR_H;
root.HP3D.WIN_SILL = WIN_SILL; root.HP3D.WIN_TOP = WIN_TOP;
})(typeof window !== 'undefined' ? window : globalThis);
