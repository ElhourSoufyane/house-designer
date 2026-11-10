/* geom3d.js — pure wall/door/window geometry for the 3D walk mode.
   Single source of truth: world3d renders build()'s boxes; the node test
   and the in-page wall-check both run audit() on the same output.
   No THREE dependency — everything is plain {x0,z0,x1,z1,y0,y1} boxes.

   Model (learned the hard way):
   - walls are SOLID boxes filling a thickness "zone"
   - the zone is biased so the SMALLER region keeps its face on the line
     (corridors keep full cell width, posts hide inside big rooms)
   - doors/windows are apertures SUBTRACTED from whatever they overlap —
     jambs, headers, sills and corner posts all emerge from the cut
   - door openings may borrow up to 0.45 cell from a plain same-line
     neighbour, but can never cross a vertex a perpendicular wall holds
*/
window.HP = window.HP || {};
(function () {
/* 1 cell = 1 m in 3D (C=28px → 28px/m). Real proportions:
   2.6 m walls, 2.05 m doors, 0.9–2.1 m window band                  */
const WALL_H = 74, DOOR_H = 58, WIN_SILL = 26, WIN_TOP = 59;
const EXT = 0;             // doorway opening = exactly its cells (1 cell = 1 m door)
const POST = 6;            // min post width left between two door claims (px)
const EPS = 0.05;

/* ---- env helpers ------------------------------------------------
   env = { C, rAt(x,y)->regionId|-1, rsz(id)->cellCount }            */

/* thickness + placement of one wall segment's solid, offsets relative
   to the wall line: negative w0 = toward the −axis neighbour cell   */
function segZone(s, env) {
  const C = env.C;
  const ra = s.d === 'h' ? env.rAt(s.x, s.y - 1) : env.rAt(s.x - 1, s.y);
  const rb = s.d === 'h' ? env.rAt(s.x, s.y)     : env.rAt(s.x, s.y);
  const t = (ra < 0 || rb < 0) ? 0.44 * C : 0.30 * C;
  if (ra < 0 && rb < 0) return { w0: -t / 2, w1: t / 2, t, ext: true };
  if (ra < 0) return { w0: -t, w1: 0, t, ext: true };
  if (rb < 0) return { w0: 0, w1: t, t, ext: true };
  const sa = env.rsz(ra), sb = env.rsz(rb);
  return sa <= sb ? { w0: 0, w1: t, t, ext: false } : { w0: -t, w1: 0, t, ext: false };
}

/* distance from the item footprint cell edge to the visible plaster face of the wall */
function wallInset(hang, f, walls, env) {
  const C = (env && env.C) || (HP && HP.CELL) || 28;
  env = env || { C, rAt: () => -1, rsz: () => 1e9 };
  let wallFace = 0.22 * C;
  if (!hang || !f || !walls) return wallFace + 0.8;
  const w = f.w || 1, h = f.h || 1;
  let s = null;
  if (hang === 'n') {
    for (let cx = f.x; cx < f.x + w; cx++) {
      if (walls['h,' + cx + ',' + f.y]) { s = { d: 'h', x: cx, y: f.y }; break; }
    }
    if (s) wallFace = Math.max(0, segZone(s, env).w1);
  } else if (hang === 's') {
    for (let cx = f.x; cx < f.x + w; cx++) {
      if (walls['h,' + cx + ',' + (f.y + h)]) { s = { d: 'h', x: cx, y: f.y + h }; break; }
    }
    if (s) wallFace = Math.max(0, -segZone(s, env).w0);
  } else if (hang === 'w') {
    for (let cy = f.y; cy < f.y + h; cy++) {
      if (walls['v,' + f.x + ',' + cy]) { s = { d: 'v', x: f.x, y: cy }; break; }
    }
    if (s) wallFace = Math.max(0, segZone(s, env).w1);
  } else if (hang === 'e') {
    for (let cy = f.y; cy < f.y + h; cy++) {
      if (walls['v,' + (f.x + w) + ',' + cy]) { s = { d: 'v', x: f.x + w, y: cy }; break; }
    }
    if (s) wallFace = Math.max(0, -segZone(s, env).w0);
  }
  return wallFace + 0.8;
}

const W = (walls, d, x, y) => walls[d + ',' + x + ',' + y];
const F = (walls, d, x, y) => { const w = W(walls, d, x, y); return w ? w.f : null; };

/* ---- rectangle subtraction ------------------------------------- */
/* cut rect a out of box b in XZ → up to 4 remaining pieces */
function subXZ(b, a) {
  if (a.x1 - b.x0 <= EPS || b.x1 - a.x0 <= EPS ||
      a.z1 - b.z0 <= EPS || b.z1 - a.z0 <= EPS) return [b];
  const out = [];
  const x0 = Math.max(b.x0, a.x0), x1 = Math.min(b.x1, a.x1);
  const z0 = Math.max(b.z0, a.z0), z1 = Math.min(b.z1, a.z1);
  if (x0 - b.x0 > EPS) out.push({ ...b, x1: x0 });
  if (b.x1 - x1 > EPS) out.push({ ...b, x0: x1 });
  if (z0 - b.z0 > EPS) out.push({ ...b, x0, x1, z1: z0 });
  if (b.z1 - z1 > EPS) out.push({ ...b, x0, x1, z0: z1 });
  return out;
}
/* cut aperture a out of box b — only inside a's y-band */
function subBox(b, a) {
  /* no XZ overlap → nothing to cut (don't fragment the y-ranges) */
  if (a.x1 - b.x0 <= EPS || b.x1 - a.x0 <= EPS ||
      a.z1 - b.z0 <= EPS || b.z1 - a.z0 <= EPS) return [b];
  /* no y overlap → the aperture doesn't reach this band — cutting
     its XZ column anyway would eat the header above a neighbour
     door (the "sky slit above the doorway" bug)                  */
  if (b.y1 <= a.y0 + EPS || b.y0 >= a.y1 - EPS) return [b];
  const out = [];
  if (b.y0 < a.y0 - EPS) out.push({ ...b, y1: a.y0 });
  if (b.y1 > a.y1 + EPS) out.push({ ...b, y0: a.y1 });
  const mid = { ...b, y0: Math.max(b.y0, a.y0), y1: Math.min(b.y1, a.y1) };
  for (const p of subXZ(mid, a)) out.push(p);
  return out;
}
function subtractAll(boxes, a) {
  const out = [];
  for (const b of boxes) for (const p of subBox(b, a)) out.push(p);
  return out;
}

/* ---- door/window apertures -------------------------------------- */
function apertures(walls, env, zoneOf) {
  const C = env.C, aps = [], claims = {};

  /* junction check: does a perpendicular wall hold this vertex?      */
  const perpL = s => !!(W(walls, 'v', s.x, s.y) || W(walls, 'v', s.x, s.y - 1));   // h door, left vertex
  const perpR = s => !!(W(walls, 'v', s.x + 1, s.y) || W(walls, 'v', s.x + 1, s.y - 1));
  const perpT = s => !!(W(walls, 'h', s.x, s.y) || W(walls, 'h', s.x - 1, s.y));   // v door, top vertex
  const perpB = s => !!(W(walls, 'h', s.x, s.y + 1) || W(walls, 'h', s.x - 1, s.y + 1));

  /* resolve extension claims: each non-door seg records px claimed   */
  /* by doors on each side — must sum to ≤ C−POST                     */
  const claim = (d, x, y, side, px) => {
    const k = d + ',' + x + ',' + y;
    (claims[k] = claims[k] || { a: 0, b: 0 })[side] = px;
  };
  const resolved = (d, x, y) => {
    const c = claims[d + ',' + x + ',' + y];
    if (!c) return { a: 0, b: 0 };
    const max = C - POST;
    if (c.a + c.b <= max) return c;
    const f = max / (c.a + c.b);
    return { a: c.a * f, b: c.b * f };
  };

  /* door runs: consecutive door segs pair up (even offset + next)    */
  const doors = [];
  for (const k in walls) if (walls[k].f === 'door') {
    const s = HP.parseWallKey(k); s.k = k; doors.push(s);
  }
  const doorOffset = s => {
    let n = 0;
    if (s.d === 'h') { for (let x = s.x - 1; F(walls, 'h', x, s.y) === 'door'; x--) n++; }
    else             { for (let y = s.y - 1; F(walls, 'v', s.x, y) === 'door'; y--) n++; }
    return n;
  };
  const paired = new Set();
  for (const s of doors) {
    if (paired.has(s.k)) continue;
    const off = doorOffset(s);
    const nk = s.d === 'h' ? 'h,' + (s.x + 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y + 1);
    const dbl = off % 2 === 0 && F(walls, s.d, s.d === 'h' ? s.x + 1 : s.x, s.d === 'h' ? s.y : s.y + 1) === 'door';
    if (dbl) paired.add(nk);
    s.dbl = dbl;
    s.span = dbl ? 2 : 1;
  }

  /* merged perpendicular zone at a vertex — the corner post's
     footprint, i.e. how far it protrudes into the door cell          */
  const pzAt = (d, x, y) => {
    let z = null;
    const cands = d === 'v' ? [['v', x, y], ['v', x, y - 1]]
                            : [['h', x, y], ['h', x - 1, y]];
    for (const [dd, xx, yy] of cands) {
      const k = dd + ',' + xx + ',' + yy;
      if (!walls[k]) continue;
      const zz = (zoneOf && zoneOf[k]) || segZone({ d: dd, x: xx, y: yy, k }, env);
      z = z ? { w0: Math.min(z.w0, zz.w0), w1: Math.max(z.w1, zz.w1) } : { ...zz };
    }
    return z;
  };

  /* register extension claims first (both directions at once).
     A door ending at a wall junction loses part of its opening to the
     corner post — it borrows that width back from the plain wall cell
     on its FREE end, so a junction door still opens ~1m.             */
  for (const s of doors) {
    if (paired.has(s.k)) continue;                       // 2nd cell of a double
    if (s.d === 'h') {
      const jL = perpL(s), jR = perpR(s.dbl ? { d: 'h', x: s.x + 1, y: s.y } : s);
      const pL = jL ? Math.max(0, (pzAt('v', s.x, s.y) || { w1: 0 }).w1) : 0;
      const pR = jR ? Math.max(0, -(pzAt('v', s.x + 1, s.y) || { w0: 0 }).w0) : 0;
      const exL = jR && !jL ? pR : EXT * C;                  // free side borrows
      const exR = jL && !jR ? pL : EXT * C;                  // the junction's bite
      if (exL > 0 && W(walls, 'h', s.x - 1, s.y) && F(walls, 'h', s.x - 1, s.y) !== 'door')
        claim('h', s.x - 1, s.y, 'b', exL);                  // extend left into neighbour
      const ex = s.x + s.span;
      if (exR > 0 && W(walls, 'h', ex, s.y) && F(walls, 'h', ex, s.y) !== 'door')
        claim('h', ex, s.y, 'a', exR);                       // extend right
    } else {
      const jT = perpT(s), jB = perpB(s.dbl ? { d: 'v', x: s.x, y: s.y + 1 } : s);
      const pT = jT ? Math.max(0, (pzAt('h', s.x, s.y) || { w1: 0 }).w1) : 0;
      const pB = jB ? Math.max(0, -(pzAt('h', s.x, s.y + s.span) || { w0: 0 }).w0) : 0;
      const exT = jB && !jT ? pB : EXT * C;
      const exB = jT && !jB ? pT : EXT * C;
      if (exT > 0 && W(walls, 'v', s.x, s.y - 1) && F(walls, 'v', s.x, s.y - 1) !== 'door')
        claim('v', s.x, s.y - 1, 'b', exT);
      const ey = s.y + s.span;
      if (exB > 0 && W(walls, 'v', s.x, ey) && F(walls, 'v', s.x, ey) !== 'door')
        claim('v', s.x, ey, 'a', exB);
    }
  }

  /* build the apertures                                            */
  for (const s of doors) {
    if (paired.has(s.k)) continue;
    /* use the RUN's voted zone — a door seg's own zone can be wider
       than its run's, cutting past the wall face into the jamb
       and leaving a hairline slit through the corner               */
    const z = (zoneOf && zoneOf[s.k]) || segZone(s, env);
    let x0, x1, z0, z1;
    if (s.d === 'h') {
      const rL = resolved('h', s.x - 1, s.y), rR = resolved('h', s.x + s.span, s.y);
      x0 = s.x * C - (perpL(s) ? 0 : rL.b);
      x1 = (s.x + s.span) * C + (perpR(s.dbl ? { d: 'h', x: s.x + 1, y: s.y } : s) ? 0 : rR.a);
      z0 = s.y * C + z.w0; z1 = s.y * C + z.w1;
    } else {
      const rT = resolved('v', s.x, s.y - 1), rB = resolved('v', s.x, s.y + s.span);
      z0 = s.y * C - (perpT(s) ? 0 : rT.b);
      z1 = (s.y + s.span) * C + (perpB(s.dbl ? { d: 'v', x: s.x, y: s.y + 1 } : s) ? 0 : rB.a);
      x0 = s.x * C + z.w0; x1 = s.x * C + z.w1;
    }
    aps.push({ kind: 'door', d: s.d, x0, z0, x1, z1, y0: 0, y1: DOOR_H,
               dbl: s.dbl, k: s.k, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  }
  /* windows: consecutive segs on a line merge into one aperture —
     a 4px post between two windows reads as a crack in the wall    */
  const winRuns = {};
  for (const k in walls) {
    if (walls[k].f !== 'window') continue;
    const s = HP.parseWallKey(k); s.k = k;
    const gk = s.d === 'h' ? 'h,' + s.y : 'v,' + s.x;
    (winRuns[gk] = winRuns[gk] || []).push(s);
  }
  for (const gk in winRuns) {
    const segs = winRuns[gk].sort((a, b) => (a.d === 'h' ? a.x - b.x : a.y - b.y));
    let run = null;
    const groups = [];
    for (const s of segs) {
      const pos = s.d === 'h' ? s.x : s.y;
      if (run && run.next === pos) { run.next = pos + 1; run.segs.push(s); continue; }
      run = { next: pos + 1, segs: [s], s0: s };
      groups.push(run);
    }
    for (const gr of groups) {
      const s = gr.s0, z = (zoneOf && zoneOf[s.k]) || segZone(s, env);
      const n = gr.next - (s.d === 'h' ? s.x : s.y);          // cells spanned
      let x0, x1, z0, z1;
      if (s.d === 'h') { x0 = s.x * C + 2; x1 = (s.x + n) * C - 2; z0 = s.y * C + z.w0; z1 = s.y * C + z.w1; }
      else             { z0 = s.y * C + 2; z1 = (s.y + n) * C - 2; x0 = s.x * C + z.w0; x1 = s.x * C + z.w1; }
      /* glass can't float over a doorway — shrink the window where a
         door aperture claimed part of its cell                      */
      for (const a of aps) if (a.kind === 'door') {
        if (s.d === 'h') {
          if (a.x0 > x0 && a.x0 < x1) x1 = a.x0;
          if (a.x1 > x0 && a.x1 < x1) x0 = a.x1;
        } else {
          if (a.z0 > z0 && a.z0 < z1) z1 = a.z0;
          if (a.z1 > z0 && a.z1 < z1) z0 = a.z1;
        }
      }
      if ((s.d === 'h' ? x1 - x0 : z1 - z0) > 4)
        aps.push({ kind: 'window', d: s.d, x0, z0, x1, z1, y0: WIN_SILL, y1: WIN_TOP, k: s.k });
    }
  }
  /* garage doors cut wall apertures if placed across walls */
  if (env.garageDoors && env.garageDoors.length) {
    for (const gd of env.garageDoors) {
      const bw = gd.w || 3, bh = gd.h || 1;
      const rot = (gd.rot || 0) % 4;
      const w = rot % 2 === 0 ? bw : bh, h = rot % 2 === 0 ? bh : bw;
      let x0, x1, z0, z1;
      if (rot % 2 === 0) {
        let bestLine = gd.y;
        let maxCount = 0;
        for (const testY of [gd.y, gd.y + h, gd.y - 1, gd.y + 1]) {
          let count = 0;
          for (let cx = Math.floor(gd.x) - 3; cx <= Math.ceil(gd.x + w) + 3; cx++) {
            if (walls['h,' + cx + ',' + testY]) count++;
          }
          if (count > maxCount) { maxCount = count; bestLine = testY; }
        }
        x0 = gd.x * C; x1 = (gd.x + w) * C;
        z0 = bestLine * C - C; z1 = bestLine * C + C;
      } else {
        let bestLine = gd.x;
        let maxCount = 0;
        for (const testX of [gd.x, gd.x + w, gd.x - 1, gd.x + 1]) {
          let count = 0;
          for (let cy = Math.floor(gd.y) - 3; cy <= Math.ceil(gd.y + h) + 3; cy++) {
            if (walls['v,' + testX + ',' + cy]) count++;
          }
          if (count > maxCount) { maxCount = count; bestLine = testX; }
        }
        z0 = gd.y * C; z1 = (gd.y + h) * C;
        x0 = bestLine * C - C; x1 = bestLine * C + C;
      }
      aps.push({ kind: 'garagedoor', x0, z0, x1, z1, y0: 0, y1: DOOR_H, k: 'garagedoor_' + (gd.id || gd.x) });
    }
  }  return aps;
}

/* ---- the build -------------------------------------------------- */
function build(walls, env) {
  const C = env.C;

  /* 1 · merge ALL contiguous same-line segs into runs, then vote    */
  /*     ONE zone per run — a straight wall in the plan is a single  */
  /*     straight plane in 3D, never a jogged/stepped face           */
  const byLine = {};
  for (const k in walls) {
    const s = HP.parseWallKey(k);
    s.k = k; s.f = walls[k].f;
    s.zone = segZone(s, env);
    const gk = s.d === 'h' ? 'h,' + s.y : 'v,' + s.x;
    (byLine[gk] = byLine[gk] || []).push(s);
  }
  const boxes = [];
  for (const gk in byLine) {
    const segs = byLine[gk].sort((a, b) => (a.d === 'h' ? a.x - b.x : a.y - b.y));
    let run = null;
    const flush = () => {
      if (!run) return;
      /* majority zone across the run's cells (ties → first-seen)    */
      const tally = {};
      let best = null;
      for (const s of run.segs) {
        const key = s.zone.w0.toFixed(2) + '|' + s.zone.w1.toFixed(2);
        const t = tally[key] = tally[key] || { n: 0, z: s.zone };
        if (++t.n > (best ? best.n : 0)) best = t;
      }
      const z = best.z;
      run.y0 = 0; run.y1 = WALL_H; run.tag = 'wall'; run.ext = z.ext;
      if (run.d === 'h') { run.x0 = run.p0 * C; run.x1 = run.next * C;
                           run.z0 = run.line * C + z.w0; run.z1 = run.line * C + z.w1; }
      else               { run.z0 = run.p0 * C; run.z1 = run.next * C;
                           run.x0 = run.line * C + z.w0; run.x1 = run.line * C + z.w1; }
      for (const s of run.segs) s.zone = z;   // apertures/corners see run zone
      delete run.segs; delete run.next; delete run.p0;
      boxes.push(run); run = null;
    };
    for (const s of segs) {
      const pos = s.d === 'h' ? s.x : s.y;
      if (run && run.next === pos) { run.next = pos + 1; run.segs.push(s); continue; }
      flush();
      run = { next: pos + 1, p0: pos, line: s.d === 'h' ? s.y : s.x,
              d: s.d, segs: [s] };
    }
    flush();
  }

  /* 1b · junction ownership: v-runs run through, h-runs butt into   */
  /*      them — no doubled material where walls meet                */
  const vRuns = boxes.filter(b => b.d === 'v');
  let hRuns = boxes.filter(b => b.d === 'h');
  for (const v of vRuns) hRuns = hRuns.flatMap(h => subXZ(h, v));
  boxes.length = 0;
  boxes.push(...hRuns, ...vRuns);

  /* 2 · corner fills — the quadrant two perpendicular zones leave   */
  /*     uncovered at a vertex (only where both axes hold walls)     */
  const cornerRects = [];
  const vAt = {}, hAt = {};
  const merge = (m, key, z) => {
    const p = m[key];
    m[key] = p ? { w0: Math.min(p.w0, z.w0), w1: Math.max(p.w1, z.w1), ext: p.ext || z.ext } : { ...z };
  };
  for (const gk in byLine) for (const s of byLine[gk]) {
    const verts = s.d === 'h' ? [[s.x, s.y], [s.x + 1, s.y]] : [[s.x, s.y], [s.x, s.y + 1]];
    for (const [vx, vy] of verts)
      merge(s.d === 'h' ? hAt : vAt, vx + ',' + vy, s.zone);
  }
  for (const key in hAt) {
    if (!vAt[key]) continue;
    const [vx, vy] = key.split(',').map(Number);
    const hz = hAt[key], vz = vAt[key];
    cornerRects.push({ x0: vx * C + vz.w0, x1: vx * C + vz.w1,
                       z0: vy * C + hz.w0, z1: vy * C + hz.w1,
                       y0: 0, y1: WALL_H, tag: 'corner', ext: hz.ext || vz.ext, vx, vy });
  }
  /* 3 · apertures, then subtract them from every solid — built with
       the runs' VOTED zones so a cut never overshoots a jamb        */
  const zoneOf = {};
  for (const gk in byLine) for (const s of byLine[gk]) zoneOf[s.k] = s.zone;
  const aps = apertures(walls, env, zoneOf);
  let solids = boxes;
  for (const a of aps) solids = subtractAll(solids, a);

  /* 4 · corner fills — emitted AFTER aperture subtraction so a door
       that ends at a wall corner leaves the corner post standing
       (it is the jamb). Computed vs post-cut solids so they backfill
       exactly the slit an aperture would otherwise leave             */
  let corners = [];
  for (const c of cornerRects) {
    let pieces = [c];
    /* subBox (3D) — NOT subXZ: a header/sill only overlaps the top
       or bottom band of the corner column and must not erase the
       rest of it                                              */
    for (const b of solids) pieces = pieces.flatMap(p => subBox(p, b));
    corners = corners.concat(pieces);
  }
  solids = solids.concat(corners);

  const doors = aps.filter(a => a.kind === 'door');
  const windows = aps.filter(a => a.kind === 'window');

  /* fences: thin low rails (gates = walkable gaps); wall wins a shared
     edge; v-rails own the corners so nothing doubles up; rails never
     z-fight a wall volume                                          */
  if (env.fences) {
    let fs = fenceBoxes(env.fences, walls, C);
    const vF = fs.filter(f => f.d === 'v');
    let hF = fs.filter(f => f.d === 'h');
    for (const v of vF) hF = hF.flatMap(h => subXZ(h, v));
    fs = vF.concat(hF);
    for (const w of solids) fs = fs.flatMap(f => subXZ(f, w));
    for (const f of fs) solids.push(f);
  }

  return { boxes: solids, doors, windows, apertures: aps };
}

/* ---- fences -------------------------------------------------------
   Edge-based like walls but NOT wall geometry: thin centred rail,
   low height, never doors/windows. 'gate' = a walkable gap.          */
const FENCE_H = {   // px ≈ metres × 28
  wood: 26, picket: 22, iron: 30, stone: 34, brick: 34, whitewall: 34,
  hedge: 30, bamboo: 30, reed: 24, chainlink: 30, lattice: 28,
  ranch: 24, glass: 30, metal: 32, fieldstone: 20, rope: 20, gate: 0,
};
function fenceBoxes(fences, walls, C) {
  const out = [];
  const byLine = {};
  for (const k in fences) {
    if (walls && walls[k]) continue;                    // wall wins the edge
    const s = HP.parseWallKey(k);
    s.t = fences[k].t || 'wood';
    const gk = s.d === 'h' ? 'h,' + s.y : 'v,' + s.x;
    (byLine[gk] = byLine[gk] || []).push(s);
  }
  const T2 = 4;                                          // ~14 cm rail
  for (const gk in byLine) {
    const segs = byLine[gk].sort((a, b) => (a.d === 'h' ? a.x - b.x : a.y - b.y));
    let run = null;
    const flush = () => {
      if (!run) return;
      const h = FENCE_H[run.t] || 26;
      const b = { d: run.d, y0: 0, y1: h, tag: 'fence', ft: run.t };
      if (run.d === 'h') { b.x0 = run.p0 * C; b.x1 = run.next * C;
                           b.z0 = run.line * C - T2 / 2; b.z1 = run.line * C + T2 / 2; }
      else               { b.z0 = run.p0 * C; b.z1 = run.next * C;
                           b.x0 = run.line * C - T2 / 2; b.x1 = run.line * C + T2 / 2; }
      out.push(b); run = null;
    };
    for (const s of segs) {
      const pos = s.d === 'h' ? s.x : s.y;
      /* gates break the run — they stay open air */
      if (run && run.next === pos && s.t === run.t && s.t !== 'gate') {
        run.next = pos + 1; continue;
      }
      flush();
      if (s.t === 'gate') continue;
      run = { next: pos + 1, p0: pos, line: s.d === 'h' ? s.y : s.x, d: s.d, t: s.t };
    }
    flush();
  }
  return out;
}

/* ---- the audit (physical wall checklist) -------------------------
   Runs on the REAL house — the same boxes world3d renders.         */
function audit(walls, env) {
  const { boxes, doors, apertures } = build(walls, env);
  const checks = [];

  /* 1 · openings empty — no wall material inside a door/window band.
       Corner posts standing at the aperture's END are legal jambs;
       anything intruding into the middle of an opening is a bug.   */
  const intr = [];
  for (const a of apertures) {
    const cx0 = a.x0 + 0.4, cx1 = a.x1 - 0.4, cz0 = a.z0 + 0.4, cz1 = a.z1 - 0.4;
    const alongZ = (a.z1 - a.z0) > (a.x1 - a.x0);   // aperture run direction
    for (const b of boxes) {
      const ox = Math.min(b.x1, cx1) - Math.max(b.x0, cx0);
      const oz = Math.min(b.z1, cz1) - Math.max(b.z0, cz0);
      const oy = Math.min(b.y1, a.y1) - Math.max(b.y0, a.y0);
      if (ox > 0 && oz > 0 && oy > 0) {
        if (b.tag === 'corner') {                  // jamb at the opening's end?
          const t0 = alongZ ? b.z0 - a.z0 : b.x0 - a.x0;
          const t1 = alongZ ? a.z1 - b.z1 : a.x1 - b.x1;
          if (t0 <= 0.6 || t1 <= 0.6) continue;    // touches an end — legal
        }
        intr.push({ k: a.k || a.kind, box: b, ox, oz, oy });
      }
    }
  }
  checks.push({
    name: 'Openings empty — no wall material inside doors/windows',
    ok: intr.length === 0,
    detail: intr.length ? intr.slice(0, 3).map(i =>
      `slab ${i.ox.toFixed(1)}×${i.oz.toFixed(1)} in ${i.k}`).join('; ') : 'all clear',
    marks: intr.map(i => i.box),
  });

  /* 2 · doorways walkable — ≥18px clear passage through each door   */
  const bad = [], widths = [];
  for (const a of doors) {
    const blocked = [];
    for (const b of boxes) {
      if (a.d === 'h') {
        const oz = Math.min(b.z1, a.z1) - Math.max(b.z0, a.z0);
        if (oz >= (a.z1 - a.z0) * 0.75 && b.y0 < a.y1) {
          const l = Math.max(b.x0, a.x0), h = Math.min(b.x1, a.x1);
          if (h - l > 0.5) blocked.push([l, h]);
        }
      } else {
        const ox = Math.min(b.x1, a.x1) - Math.max(b.x0, a.x0);
        if (ox >= (a.x1 - a.x0) * 0.75 && b.y0 < a.y1) {
          const l = Math.max(b.z0, a.z0), h = Math.min(b.z1, a.z1);
          if (h - l > 0.5) blocked.push([l, h]);
        }
      }
    }
    blocked.sort((p, q) => p[0] - q[0]);
    let bw = 0, ce = -1e9;
    for (const [l, h] of blocked) { const s = Math.max(l, ce); if (h > s) bw += h - s; ce = Math.max(ce, h); }
    const clear = (a.d === 'h' ? a.x1 - a.x0 : a.z1 - a.z0) - bw;
    widths.push(clear);
    /* a door that ends at a wall corner keeps the corner post as its
       jamb — clear width drops by the post (~12px) but is legal     */
    if (clear < 15) bad.push({ k: a.k, clear, a });
  }
  checks.push({
    name: 'Doorways walkable — ≥15px clear passage',
    ok: bad.length === 0,
    detail: bad.length ? bad.map(b => `${b.k}: ${b.clear.toFixed(0)}px`).join('; ')
                       : doors.map((d, i) => `${d.k}: ${widths[i].toFixed(0)}px`).join('  '),
    marks: bad.map(b => b.a),
  });

  /* 3 · door size consistency (informational)                       */
  const singles = widths.filter((_, i) => !doors[i].dbl);
  const min = singles.length ? Math.min(...singles) : 0;
  const max = singles.length ? Math.max(...singles) : 0;
  checks.push({
    name: 'Door sizes consistent — singles uniform',
    ok: max - min <= 30,                          // junction doors may be narrower
    detail: singles.length ? `singles ${min.toFixed(0)}–${max.toFixed(0)}px` : 'no single doors',
    marks: [],
  });

  /* 4 · no overlapping solids (double-built walls = z-fight/shimmer) */
  const over = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 0.5 && oz > 0.5 && oy > 0.5) over.push({ a, b, ox, oz });
  }
  checks.push({
    name: 'No overlapping solids — clean construction',
    ok: over.length === 0,
    detail: over.length ? `${over.length} intersecting volumes` : 'none',
    marks: over.map(o => o.a),
  });

  /* 5 · every door got an aperture                                  */
  const nDoorSegs = Object.keys(walls).filter(k => walls[k].f === 'door').length;
  const cuts = doors.reduce((n, d) => n + (d.dbl ? 2 : 1), 0);
  checks.push({
    name: 'Every door has an opening cut',
    ok: cuts >= nDoorSegs,
    detail: `${cuts} of ${nDoorSegs} door cells open`,
    marks: [],
  });

  /* 6 · headers + sills solid — a later aperture must never punch   */
  /*     through the band above/below a neighbouring opening         */
  const leaks = [];
  const cover = (x, z, y0, y1) => boxes.some(b =>
    b.tag !== 'fence' && x > b.x0 - 1 && x < b.x1 + 1 &&
    z > b.z0 - 1 && z < b.z1 + 1 && b.y0 <= y0 && b.y1 >= y1);
  for (const a of apertures) {
    const mx = (a.x0 + a.x1) / 2, mz = (a.z0 + a.z1) / 2;
    if (a.kind === 'door') {
      if (!cover(mx, mz, 60, 72)) leaks.push({ k: a.k, a });
    } else {
      if (!cover(mx, mz, 60, 72) || !cover(mx, mz, 2, 24))
        leaks.push({ k: a.k, a });
    }
  }
  checks.push({
    name: 'Headers and sills solid — no sky slits above/below openings',
    ok: leaks.length === 0,
    detail: leaks.length ? leaks.map(l => l.k).join('  ') : 'all sealed',
    marks: leaks.map(l => l.a),
  });

  return { checks, boxes, doors, apertures };
}

HP.geom3d = { build, audit, WALL_H, DOOR_H, WIN_SILL, WIN_TOP, segZone, wallInset };
})();
