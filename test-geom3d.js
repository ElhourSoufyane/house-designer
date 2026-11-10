/* test-geom3d.js — exercises the REAL src/geom3d.js the renderer uses.
   Run: node test-geom3d.js */
const fs = require('fs');
global.window = global;
global.HP = {};
HP.parseWallKey = k => { const p = k.split(','); return { d: p[0], x: +p[1], y: +p[2] }; };
eval(fs.readFileSync('src/geom3d.js', 'utf8'));

const C = 28;
let allOk = true;

/* fixture env: no regions → everything biases by rsz(∞)=1e9… make a
   real region map so zones behave like the app: rooms are bigger than
   corridors. env maps cell→region id; sizes from cell counts.        */
function env(regionCells) {
  const sizes = {};
  for (const k in regionCells) sizes[regionCells[k]] = (sizes[regionCells[k]] || 0) + 1;
  return {
    C,
    rAt: (x, y) => regionCells[x + ',' + y] !== undefined ? regionCells[x + ',' + y] : -1,
    rsz: id => sizes[id] || 1,
  };
}
/* fill a rect of cells with a region id */
function fill(rc, id, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rc[x + ',' + y] = id;
}

/* run a layout: assert no intrusions + print per-door clear width */
function check(name, walls, e, minClear) {
  const { boxes, doors, apertures } = HP.geom3d.build(walls, e);
  const problems = [];
  for (const a of apertures) {
    const cx0 = a.x0 + 0.4, cx1 = a.x1 - 0.4, cz0 = a.z0 + 0.4, cz1 = a.z1 - 0.4;
    const alongZ = (a.z1 - a.z0) > (a.x1 - a.x0);
    for (const b of boxes) {
      const ox = Math.min(b.x1, cx1) - Math.max(b.x0, cx0);
      const oz = Math.min(b.z1, cz1) - Math.max(b.z0, cz0);
      const oy = Math.min(b.y1, a.y1) - Math.max(b.y0, a.y0);
      if (ox > 0 && oz > 0 && oy > 0) {
        /* a corner post at the aperture's end is a legal jamb — the
           crossing wall's own end face, not material in the opening */
        if (b.tag === 'corner') {
          const t0 = alongZ ? b.z0 - a.z0 : b.x0 - a.x0;
          const t1 = alongZ ? a.z1 - b.z1 : a.x1 - b.x1;
          if (t0 <= 0.6 || t1 <= 0.6) continue;
        }
        problems.push(`slab ${ox.toFixed(1)}x${oz.toFixed(1)}x${oy.toFixed(1)} in ${a.k || a.kind} ${JSON.stringify(b)}`);
      }
    }
    if (a.kind === 'door') {
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
      console.log(`  door ${a.k}: opening ${(a.d === 'h' ? a.x1 - a.x0 : a.z1 - a.z0).toFixed(1)}px, clear ${clear.toFixed(1)}px`);
      if (minClear && clear < minClear) problems.push(`clear ${clear.toFixed(1)} < ${minClear}`);
    }
  }
  if (problems.length) {
    allOk = false;
    console.log(`✗ FAIL ${name} — ${boxes.length} boxes, ${problems.length} problems`);
    problems.forEach(p => console.log('    ' + p));
  } else console.log(`✓ PASS ${name} — ${boxes.length} boxes, 0 problems`);
  return allOk;
}

/* ---------------- layouts ---------------- */
/* plain room: door alone in a wall — biggest possible opening */
let rc = {}; fill(rc, 0, 0, 0, 10, 4); fill(rc, 1, 0, 6, 10, 10);
check('plain door', { 'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': {} }, env(rc), 26);

/* corridor mouth: 1-cell corridor (region 1) between two rooms (0,2) */
rc = {}; fill(rc, 0, 0, 0, 1, 4); fill(rc, 1, 2, 0, 2, 4); fill(rc, 2, 3, 0, 4, 4);
fill(rc, 3, 0, 6, 10, 6);
check('corridor-mouth door', {
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': {},
  'v,2,5': {}, 'v,2,6': {}, 'v,3,5': {}, 'v,3,6': {},
}, env(rc), 14);   /* corner posts at both ends are the jambs */

/* corner door: door right against an L corner */
rc = {}; fill(rc, 0, 0, 0, 6, 4); fill(rc, 1, 0, 6, 6, 10); fill(rc, 2, 7, 0, 10, 10);
check('corner door', {
  'h,2,5': { f: 'door' }, 'h,3,5': {},
  'v,2,4': {}, 'v,2,5': {}, 'v,3,4': {}, 'v,3,5': {},
}, env(rc), 15);   /* the corner post is the jamb — 28-12 = 16px clear */

/* T-junction: corridor meets the door wall on one side */
rc = {}; fill(rc, 0, 0, 0, 5, 4); fill(rc, 1, 0, 6, 5, 7); fill(rc, 2, 6, 0, 9, 4);
check('T-junction door', {
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': {},
  'v,3,5': {}, 'v,3,6': {},
}, env(rc), 20);

/* double door */
rc = {}; fill(rc, 0, 0, 0, 6, 4); fill(rc, 1, 0, 6, 6, 10);
check('double door', {
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': { f: 'door' }, 'h,4,5': {},
}, env(rc), 40);

/* double door with corridor at the end vertex */
rc = {}; fill(rc, 0, 0, 0, 6, 4); fill(rc, 1, 0, 6, 6, 8); fill(rc, 2, 7, 6, 8, 8);
check('double door end junction', {
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': { f: 'door' }, 'h,4,5': {},
  'v,4,5': {}, 'v,4,6': {},
}, env(rc), 40);

/* door beside window */
rc = {}; fill(rc, 0, 0, 0, 6, 4); fill(rc, 1, 0, 6, 6, 10);
check('door + window', {
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': { f: 'window' }, 'h,4,5': {},
}, env(rc), 26);

/* vertical door with corridor walls */
rc = {}; fill(rc, 0, 0, 0, 3, 8); fill(rc, 1, 5, 0, 5, 8); fill(rc, 2, 6, 0, 9, 8);
check('v door + corridor', {
  'v,4,4': {}, 'v,4,5': { f: 'door' }, 'v,4,6': {},
  'h,4,5': {}, 'h,5,5': {},
}, env(rc), 18);

/* ------- the audit on a real-ish mixed layout ------- */
rc = {}; fill(rc, 0, 0, 0, 10, 4); fill(rc, 1, 0, 6, 10, 8);
const { checks } = HP.geom3d.audit({
  'h,1,5': {}, 'h,2,5': { f: 'door' }, 'h,3,5': {},
  'v,2,5': {}, 'v,2,6': {}, 'v,3,5': {}, 'v,3,6': {},
}, env(rc));
for (const c of checks) {
  console.log((c.ok ? '✓' : '✗') + ' ' + c.name + ' — ' + c.detail);
  if (!c.ok) allOk = false;
}

console.log(allOk ? '\nALL PASS' : '\nFAILURES');
process.exit(allOk ? 0 : 1);
