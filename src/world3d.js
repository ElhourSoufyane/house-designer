/* world3d.js — Three.js renderer for the 3D walk mode.
   FPS rules:
   - static geometry = instanced chunks per visibility tile (cull3d.js):
     frustum culling + wall occlusion + distance limits
   - sun shadow map follows the player (only a small box is rendered),
     tiered off on Low; PBR + image-based light on Balanced/High
   - adaptive pixel ratio and bounded textures via graphics3d.js
   - zero per-frame allocation in the render path
*/
window.HP = window.HP || {};
(function () {
const W3 = HP.world3d = {};
let renderer, scene, camera, sun, ambient, sunDir = new THREE.Vector3(900, 1400, 600).normalize();
let envDay = null;
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _lm = new THREE.Matrix4(),
      _li = new THREE.Matrix4(), _zero = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
let doorPivots = [];                      // {pivot, open, target, box}
let markerGroup = null;
const _m = null;                          // (matrices built per-build only)

W3.EYE = 38;                              // eye height ≈ 1.55 m

/* ---------- init ---------- */
W3.init = function (canvas) {
  const coarse = matchMedia('(pointer:coarse)').matches;
  const isTouch = HP.graphics3d ? HP.graphics3d.isMobile(null, coarse) : coarse;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch,
    powerPreference: isTouch ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.25 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec8e8);
  scene.fog = new THREE.Fog(0xd4d7c1, 1800, 6500);
  camera = new THREE.PerspectiveCamera(72, 1, 2, 6000);
  camera.rotation.order = 'YXZ';
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  ambient = new THREE.HemisphereLight(0xe0edf1, 0x897358, 0.92);
  scene.add(ambient);
  sun = new THREE.DirectionalLight(0xffe5bc, 1.05);
  sun.position.copy(sunDir).multiplyScalar(1200);
  /* shadow box follows the player (see W3.render) — sized per tier   */
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 2800;
  scene.add(sun); scene.add(sun.target);
  const fit = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit); fit();
  W3.renderer = renderer; W3.scene = scene; W3.camera = camera;
  if (HP.graphics3d) {
    const G = HP.graphics3d;
    G.onChange = () => {
      if (!sun) return;
      const q = G.current;
      sun.castShadow = q.shadow > 0;
      if (q.shadow && sun.shadow.mapSize.x !== q.shadow) {
        sun.shadow.mapSize.set(q.shadow, q.shadow);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      const R = q.shadowRadius || 400, cam = sun.shadow.camera;
      cam.left = cam.bottom = -R; cam.right = cam.top = R; cam.updateProjectionMatrix();
      sun.shadow.radius = q.shadow >= 2048 ? 3 : 1.5;
      buildLampPool(q.lamps || 0);
      lightTimer = 0;                                   // re-apply time-of-day now
      if (W3.levelGroup) G.applyMaterials(W3.levelGroup);
      if (HP.cull3d) HP.cull3d.invalidate();
      const label = document.getElementById('quality-status');
      if (label) label.textContent = G.status();
      const gpu = document.getElementById('gpu-info');
      if (gpu) gpu.textContent = G.software
        ? 'Your browser is rendering without the graphics card (software mode). ' +
          'Turn on "Use graphics acceleration" in browser settings for smooth 3D.'
        : (G.gpu ? 'GPU: ' + G.gpu.replace(/^ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(',') : '');
    };
    HP.sky3d.build(scene);
    G.init(renderer, fit);
    /* two prefiltered skies; we switch at twilight, when it's too dim
       to notice, and scale reflection strength with daylight between  */
    envDay = G.environment(0xe6e2cf, 0x5f9cc9, 0x8a7a62);
    envNight = G.environment(0x1d2a3e, 0x0b1424, 0x141414);
  }
};

/* ---------- time of day ---------- */
let envNight = null, lightTimer = 0, lampPool = [];
const TIME = W3.time = { hour: 12, flow: true, speed: 1 / 60 };   // 1 game hour = 1 real min
try {
  const saved = JSON.parse(localStorage.getItem('hp_3d_time') || 'null');
  const now = new Date();
  TIME.hour = now.getHours() + now.getMinutes() / 60;                 // start at your real time
  if (saved && saved.flow === false) { TIME.flow = false; TIME.hour = saved.hour; }
} catch (_) {}
const saveTime = () => { try { localStorage.setItem('hp_3d_time', JSON.stringify({ flow: TIME.flow, hour: TIME.hour })); } catch (_) {} };
W3.setTime = h => { TIME.hour = ((h % 24) + 24) % 24; lightTimer = 0; saveTime(); };
W3.setTimeFlow = on => { TIME.flow = !!on; saveTime(); };
W3.setLighting = v => W3.setTime(v === 'golden' ? 17.9 : 12);         // legacy presets

/* a FIXED number of point lights (count changes recompile every shader);
   each frame-ish they're handed to the nearest visible lamps/rooms     */
function buildLampPool(n) {
  for (const l of lampPool) scene.remove(l.light);
  lampPool = [];
  for (let i = 0; i < n; i++) {
    const light = new THREE.PointLight(0xffc98a, 0, 230, 2);   // warm, falls off fast
    light.position.set(0, -1000, 0);
    scene.add(light);
    lampPool.push({ light, src: null, target: 0 });
  }
}
function assignLamps(night) {
  const p = camera.position, srcs = W3.lamps || [];
  const V = HP.cull3d;
  const cand = night < 0.03 ? [] : srcs
    .filter(s => !V || V.visibleAt(s.x, s.z))
    .map(s => ({ s, d: (s.x - p.x) ** 2 + (s.z - p.z) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, lampPool.length).map(c => c.s);
  /* keep lights that stay assigned; hand free ones to new sources      */
  for (const L of lampPool) if (!cand.includes(L.src)) L.src = null;
  for (const s of cand) {
    if (lampPool.some(L => L.src === s)) continue;
    const L = lampPool.find(L => !L.src);
    if (!L) break;
    L.src = s; L.light.intensity = 0;                     // fade in, no pop
    L.light.position.set(s.x, s.y, s.z);
  }
  for (const L of lampPool) L.target = L.src && L.src.on !== false ? L.src.power * night : 0;
}
function tickTime(dt, now) {
  if (TIME.flow) TIME.hour = (TIME.hour + dt * TIME.speed) % 24;
  const G = HP.graphics3d, q = G && G.current, s = HP.sky3d.sample(TIME.hour);
  sunDir.copy(s.lightDir);
  sun.color.copy(s.lightCol);
  /* with real shadows the sun can be strong: lit vs shaded reads     */
  sun.intensity = s.lightI * (q && q.shadow ? 1 + 0.45 * s.day : 1);
  renderer.toneMappingExposure = 0.94 + 0.12 * s.night;   // eyes adapt a little
  ambient.color.copy(s.amb);
  /* IBL replaces most of the hemisphere fill by day on PBR tiers      */
  ambient.intensity = s.ambI * (q && q.env ? 1 - 0.6 * s.day : 1);
  scene.fog.color.copy(s.fog);
  HP.sky3d.apply(s, now / 1000);
  for (const L of lampPool) L.light.intensity += (L.target - L.light.intensity) * Math.min(1, dt * 3);
  if ((lightTimer -= dt) > 0) return s;
  lightTimer = 0.3;                                       // slow-changing work
  if (G) {
    scene.environment = q.env ? (s.night > 0.5 ? envNight : envDay) : null;
    G.setEnvScale(0.25 + 0.75 * s.day);
    G.setNight(s.night);
  }
  assignLamps(s.night);
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = HP.sky3d.clock(TIME.hour);
  return s;
}

/* ---------- geometry env for geom3d ---------- */
function geomEnv() {
  const { regionOf, regions } = HP.computeRegions();
  const lvl = HP.cur();
  return {
    C: HP.CELL,
    fences: lvl.fences,
    garageDoors: (lvl.furniture || []).filter(it => /garagedoor/i.test(it.type)),
    rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : regionOf[y * HP.GRID_W + x],
    rsz: id => id >= 0 ? regions[id].cells.length : 1e9,
  };
}

/* ---------- furniture blockout heights (px) ---------- */
const H3D = [
  [/lamppost/i, 56],
  [/planter$/i, 22],
  [/car_ev/i, 28],
  [/lamparc/i, 52],
  [/lamptorch/i, 50],
  [/floorlamp/i, 48],
  [/halltree/i, 50],
  [/shoji/i, 50],
  [/mirarch/i, 50],
  [/mirwavy/i, 50],
  [/projscreen/i, 48],
  [/lamptripod/i, 48],
  [/miroval/i, 48],
  [/cornershelf/i, 28],
  [/birdcage/i, 46],
  [/cattree/i, 44],
  [/plfiddle/i, 44],
  [/tapestry/i, 40],
  [/statue/i, 38],
  [/stcolumn/i, 38],
  [/woodstove/i, 36],
  [/plmonstera/i, 36],
  [/plpalm/i, 34],
  [/stbust/i, 34],
  [/cinemaseats/i, 32],
  [/shoecab/i, 32],
  [/hifi/i, 32],
  [/lamppaper/i, 32],
  [/flscratch/i, 32],
  [/flvase/i, 32],
  [/stceramic/i, 32],
  [/flspeaker/i, 30],
  [/console/i, 28],
  [/credenza/i, 28],
  [/barcart/i, 28],
  [/keytray/i, 28],
  [/mirsun/i, 28],
  [/plsnake/i, 22],
  [/flwinerack/i, 28],
  [/flplantstand/i, 26],
  [/fllantern/i, 26],
  [/plpothos/i, 24],
  [/umbstand/i, 24],
  [/beanbag$/i, 24],
  [/lamptable/i, 22],
  [/stfount/i, 22],
  [/hamster/i, 20],
  [/plorchid/i, 20],
  [/entrybench/i, 18],
  [/plcactus/i, 18],
  [/lampcandle/i, 18],
  [/lampbanker/i, 18],
  [/plbonsai/i, 16],
  [/lampmush/i, 16],
  [/pathlight/i, 14],
  [/nightlight/i, 10],
  [/ottomanTuft/i, 16],
  [/ottomanStor/i, 16],
  [/flbasket/i, 16],
  [/flmagrack/i, 16],
  [/fllogbasket/i, 16],
  [/poufround/i, 14],
  [/poufsq/i, 14],
  [/flcrate/i, 14],
  [/lampbanker/i, 14],
  [/footstool/i, 12],
  [/petbed/i, 10],
  [/fldogbowl/i, 8],
  [/doormat/i, 2],
  [/bamboofence/i, 36],
  [/latticefence/i, 36],
  [/whitefencewall/i, 34],
  [/reedfence/i, 34],
  [/metalfence/i, 34],
  [/fencewood/i, 32],
  [/ironfence/i, 32],
  [/gate/i, 32],
  [/brickfence/i, 32],
  [/chainlink/i, 32],
  [/hedgefence/i, 30],
  [/ranchfence/i, 28],
  [/glassfence/i, 28],
  [/picket/i, 26],
  [/gardwall/i, 24],
  [/ropefence/i, 20],
  [/stoneedge/i, 8],
  [/modseat/i, 26],
  [/modarmL/i, 26],
  [/modarmR/i, 26],
  [/modcorner/i, 26],
  [/modchaise/i, 26],
  [/modtable/i, 14],
  [/flagpole/i, 60],
  [/treehouse/i, 134],
  [/palmtree/i, 56],
  [/^tree$/i, 56],
  [/lamppost/i, 52],
  [/pergola/i, 50],
  [/greenhouse/i, 96],
  [/shed/i, 48],
  [/swingset/i, 48],
  [/outshower/i, 48],
  [/parasol/i, 46],
  [/patioheater/i, 46],
  [/coatrack/i, 46],
  [/trampoline/i, 44],
  [/playhouse/i, 44],
  [/garch/i, 44],
  [/growshelf/i, 44],
  [/volleyball/i, 42],
  [/gardwell/i, 42],
  [/scarecrow/i, 42],
  [/slide/i, 42],
  [/goal/i, 36],
  [/clothesline/i, 36],
  [/chickencoop/i, 36],
  [/bbq/i, 32],
  [/topiary/i, 32],
  [/potting/i, 32],
  [/birdhouse/i, 32],
  [/birdfeeder/i, 32],
  [/car$/i, 30],
  [/suv$/i, 34],
  [/garagedoor/i, 60],
  [/fountain/i, 28],
  [/rabbithutch/i, 28],
  [/mailbox/i, 28],
  [/planterTall/i, 28],
  [/outsofa/i, 26],
  [/gardenbench/i, 26],
  [/beehive/i, 26],
  [/rainbarrel/i, 26],
  [/tomato/i, 26],
  [/wbins/i, 26],
  [/patiotable/i, 24],
  [/doghouse/i, 24],
  [/hammock/i, 24],
  [/skateramp/i, 24],
  [/sundial/i, 24],
  [/satellite/i, 24],
  [/hedge/i, 24],
  [/compost/i, 24],
  [/picnic/i, 22],
  [/cooler/i, 22],
  [/birdbath/i, 22],
  [/mower/i, 22],
  [/firewood/i, 22],
  [/hottub/i, 20],
  [/acunit/i, 20],
  [/solarpanel/i, 18],
  [/lounger/i, 16],
  [/wheelbarrow/i, 16],
  [/diveboard/i, 14],
  [/planter$/i, 14],
  [/gnome/i, 14],
  [/firepit/i, 12],
  [/sandbox/i, 18],
  [/flowerbox/i, 18],
  [/flowerbed/i, 22],
  [/veggie/i, 8],
  [/poolfloat/i, 8],
  [/seedlings/i, 6],
  [/workbench/i, 28],
  [/shelfunit/i, 48],
  [/bicycle/i, 32],
  [/ironboard/i, 28],
  [/dryrack/i, 30],
  [/utilsink/i, 28],
  [/vacuum/i, 34],
  [/freezer/i, 28],
  [/waterheater/i, 44],
  [/sewing/i, 28],
  [/printer3d/i, 20],
  [/acwall/i, 12],
  [/acportable/i, 26],
  [/actower/i, 36],
  [/acceiling/i, 8],
  [/acwindow/i, 16],
  [/laundrybasket/i, 18],
  [/mopbucket/i, 16],
  [/stepstool/i, 18],
  [/litterbox/i, 16],
  [/motorcycle/i, 34],
  [/toolchest/i, 36],
  [/tires/i, 24],
  [/pegboard/i, 36],
  [/bball/i, 52],
  [/evcharger/i, 42],
  [/carlift/i, 52],
  [/ladder/i, 46],
  [/generator/i, 22],
  [/compressor/i, 26],
  [/kayak/i, 14],
  [/golfbag/i, 32],
  [/surfboard/i, 20],
  [/scooter/i, 30],
  [/carport/i, 54],
  [/ridemower/i, 32],
  [/pingpong/i, 29],
  [/foosball/i, 28],
  [/airhockey/i, 32],
  [/dartboard/i, 44],
  [/arcade/i, 48],
  [/chess$/i, 24],
  [/pinball/i, 44],
  [/cardtable/i, 24],
  [/poolcues/i, 46],
  [/chessclock/i, 34],
  [/drums/i, 36],
  [/guitars/i, 38],
  [/synth/i, 32],
  [/jukebox/i, 44],
  [/ampstack/i, 44],
  [/micstand/i, 46],
  [/violinstand/i, 42],
  [/sauna/i, 52],
  [/massage/i, 26],
  [/playmat/i, 2],
  [/teepee/i, 48],
  [/kidsdesk/i, 22],
  [/toybox/i, 16],
  [/rockchair/i, 32],
  [/ballpit/i, 14],
  [/changetable/i, 32],
  [/highchair/i, 32],
  [/easel/i, 40],
  [/rockhorse/i, 20],
  [/dollhouse/i, 32],
  [/toykitchen/i, 28],
  [/kidstable/i, 18],
  [/nightlight/i, 8],
  [/beanbag2/i, 20],
  [/gamingchair/i, 36],
  [/offchair/i, 34],
  [/treadmill/i, 36],
  [/whiteboard/i, 44],
  [/^fan$|standing.*fan/i, 38],
  [/watercooler/i, 38],
  [/drafting/i, 34],
  [/telescope/i, 44],
  [/serverrack/i, 48],
  [/shredder/i, 18],
  [/kneelchair/i, 20],
  [/scanner/i, 6],
  [/deskorganizer/i, 4],
  [/acsplit/i, 12],
  [/laptop/i, 12],
  [/exbike/i, 36],
  [/weightbench/i, 32],
  [/punchbag/i, 46],
  [/rower/i, 20],
  [/elliptical/i, 44],
  [/dumbbells/i, 24],
  [/pullupbar/i, 16],
  [/gymball/i, 20],
  [/foamroller/i, 6],
  [/stepplatform/i, 8],
  [/kettlebells/i, 10],
  [/wardrobeBig/i, 50],
  [/bsink2/i, 36],
  [/vanity/i, 36],
  [/divider/i, 50],
  [/shower$/i, 52],
  [/linen/i, 48],
  [/towelwarmer/i, 32],
  [/mirrorcab/i, 28],
  [/washer|dryer/i, 25],
  [/toilet|bidet/i, 22],
  [/bathtub|bath$/i, 18],
  [/bsink/i, 26],
  [/bathmat/i, 1],
  [/bathscale/i, 2],
  [/bathcaddy/i, 4],
  [/hamper/i, 18],
  [/rug|mat|carpet|runner|tilefloor|path/i, 1],
  [/tvwall/i, 52],
  [/piano/i, 32],
  [/pooltable/i, 25],
  [/aquarium/i, 36],
  [/fireplace/i, 32],
  [/plantbig|bigplant|fiddle|palm/i, 38],
  [/plantsm|smplant|succulent|cactus/i, 16],
  [/^bench$|entrybench|bedbench/i, 16],
  [/canopy/i, 52],
  [/bunkbed/i, 46],
  [/bedking|kingbed/i, 32],
  [/bedqueen|queenbed/i, 30],
  [/beddouble|doublebed/i, 28],
  [/bedsingle|singlebed/i, 26],
  [/crib/i, 24],
  [/nightstand/i, 16],
  [/dresser/i, 25],
  [/wardrobe/i, 50],
  [/bed|bunk|crib|futon/i, 14],
  [/barstool/i, 32],
  [/^chair$|dining.*chair/i, 25],
  [/daybed|futon/i, 20],
  [/sofa|couch|sectional|chester|loveseat|settee|tuxedo|camel3|track[234]|velvet3|boucle3|midcen|armless3|sleeper|recamier|chaise/i, 32],
  [/armchair|recliner|tubchair/i, 28],
  [/chair|stool|bench|seat|ottoman/i, 22],
  [/buffet|sideboard/i, 24],
  [/barcounter/i, 28],
  [/winecab/i, 26],
  [/coffee.*table|coffeer|coffeeround/i, 14],
  [/sidetable|endtable/i, 18],
  [/microwave|toaster|kettle|coffee|blender|airfryer|mixer|ricecooker/i, 12],
  [/trashbin|bin\b/i, 18],
  [/table|desk|counter|dresser|nightstand|vanity|island|bar\b/i, 25],
  [/bookshelf|bookcase|wardrobe|closet|shelf|cabinet|pantry|locker|armoire|fridge|refrigerator/i, 52],
  [/floorlamp/i, 46],
  [/lamp|torchiere/i, 34],
  [/plant|tree|bush|flower|cactus|palm/i, 21],
  [/toilet|bidet|urinal/i, 16],
  [/bath|tub|jacuzzi|hottub/i, 14],
  [/shower/i, 50],
  [/sink|basin|stove|oven|washer|dryer|dishwasher|machine|counter/i, 25],
  [/tvstand|media.*console/i, 36],
  [/tv|monitor|screen/i, 26],
  [/piano|keyboard|organ|drum/i, 27],
  [/stairs/i, 36],
  [/^clock$|clkgrand|grandfather/i, 52],
  [/rangehood/i, 72],
  [/ceilingfan/i, 74],
  [/pool|pond/i, 4],
];
function itemH3D(def, it) {
  if (def.hangs) return 0;                  // wall-mounted: handled separately
  const itType = (it && it.type) || (def && def.id) || '';
  if (/^greenhouse/i.test(itType)) {
    const span = it ? Math.max(it.w || def.w || 6, it.h || def.h || 8) : ((def && def.w) || 6);
    return Math.max(92, Math.min(125, Math.round(56 + span * 6.5)));
  }
  for (const [re, h] of H3D) if (re.test(itType) || re.test(def.name || '')) return h;
  return 16;
}
HP.itemH3D = itemH3D;
const FLAT = t => /rug|mat|carpet|runner|path/i.test(t);
/* light enough to shove with your body — chairs, stools, plants…   */
const PUSHABLE_T = /chair|stool|bench|ottoman|seat|pouf|plant|bush|flower|cactus|palm|lamp|bin|basket|cushion|pillow|toy|nightstand|endtable|sidetable|hamper|cart/i;
const FIXED_T = /toilet|bidet|urinal|sink|basin|stove|oven|washer|dryer|dishwasher|bath|tub|jacuzzi|hottub|shower|fridge|counter|island|vanity|pool|pond|stairs|piano|tv|monitor|bed|sofa|couch|wardrobe|closet|shelf|bookcase|cabinet|pantry|locker|armoire|dresser|desk|counter|buffet|sideboard|china|barcounter|coffeer|coffee.*table|bookshelf/i;
function pushable(it, d, f, h) {
  if (h <= 10 || h > 34) return false;                  // flat or too tall = stays
  if (f.w * f.h > 4) return false;                      // big footprint = heavy
  const s = it.type + ' ' + (d.name || '');
  if (FIXED_T.test(s)) return false;
  return PUSHABLE_T.test(s) || f.w * f.h <= 1;          // tiny items always slide
}

/* ---------- level build ---------- */
W3.buildLevel = function () {
  if (HP.graphics3d) HP.graphics3d.resetTiming();
  /* wipe previous level group */
  if (W3.levelGroup) { scene.remove(W3.levelGroup); disposeGroup(W3.levelGroup); }
  const g = W3.levelGroup = new THREE.Group();
  scene.add(g);
  doorPivots = W3.doorPivots = [];
  W3.garageDoors = [];
  const C = HP.CELL, lvl = HP.cur(), V = HP.cull3d;
  V.reset();
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  /* axis-aligned box → culler part (matrix + footprint)              */
  const boxPart = (b, c) => {
    const m = new THREE.Matrix4().makeScale(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    m.setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return { m, c, x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 };
  };

  /* ---- walls: split at tile lines so long runs cull piecewise,
     and slice painted segments/sides so each room face gets its colour */
  const env = geomEnv();
  const geo = W3.geom = HP.geom3d.build(lvl.walls, env);
  const wallMat = HP.graphics3d
    ? HP.graphics3d.worldUV(HP.graphics3d.material('plaster').clone(), C * 2)
    : new THREE.MeshLambertMaterial({ color: 0xffffff });
  wallMat.userData.shared3d = false;
  if (HP.graphics3d) { HP.graphics3d.untrackAll(); HP.graphics3d.track(wallMat); }
  const wallParts = [];
  for (const b of V.splitBoxes(geo.boxes)) {
    if (b.tag === 'fence') {
      const ft = b.ft && HP.FENCE_TYPES[b.ft];
      wallParts.push(boxPart(b, ft ? ft.c : 0xe9e2d2));
      continue;
    }
    const defC = b.ext ? '#e9e2d2' : '#f4efe4';
    if (b.tag === 'wall' && b.line !== undefined) {
      const isH = b.d === 'h';
      const u0 = isH ? b.x0 : b.z0, u1 = isH ? b.x1 : b.z1;
      const cuts = [u0];
      for (let u = (Math.floor(u0 / C) + 1) * C; u < u1 - 0.5; u += C)
        if (u > u0 + 0.5) cuts.push(u);
      cuts.push(u1);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const s0 = cuts[i], s1 = cuts[i + 1];
        const ci = Math.floor(((s0 + s1) / 2) / C);
        const w = lvl.walls[b.d + ',' + (isH ? ci : b.line) + ',' + (isH ? b.line : ci)];
        const ca = (w && w.ca) || defC, cb = (w && w.cb) || defC;
        const sb = isH ? { ...b, x0: s0, x1: s1 } : { ...b, z0: s0, z1: s1 };
        if (ca === cb) {
          wallParts.push(boxPart(sb, ca));
        } else if (isH) {
          const zm = (sb.z0 + sb.z1) / 2;
          wallParts.push(boxPart({ ...sb, z1: zm }, ca), boxPart({ ...sb, z0: zm }, cb));
        } else {
          const xm = (sb.x0 + sb.x1) / 2;
          wallParts.push(boxPart({ ...sb, x1: xm }, ca), boxPart({ ...sb, x0: xm }, cb));
        }
      }
      continue;
    }
    if (b.tag === 'corner' && b.vx !== undefined) {
      const hL = lvl.walls['h,' + (b.vx - 1) + ',' + b.vy];
      const hR = lvl.walls['h,' + b.vx + ',' + b.vy];
      const vT = lvl.walls['v,' + b.vx + ',' + (b.vy - 1)];
      const vB = lvl.walls['v,' + b.vx + ',' + b.vy];
      const cNW = (hL && hL.ca) || (vT && vT.ca) || defC;
      const cNE = (hR && hR.ca) || (vT && vT.cb) || defC;
      const cSW = (hL && hL.cb) || (vB && vB.ca) || defC;
      const cSE = (hR && hR.cb) || (vB && vB.cb) || defC;
      if (cNW === cNE && cNW === cSW && cNW === cSE) {
        wallParts.push(boxPart(b, cNW));
      } else {
        const xm = (b.x0 + b.x1) / 2, zm = (b.z0 + b.z1) / 2;
        wallParts.push(
          boxPart({ ...b, x1: xm, z1: zm }, cNW),
          boxPart({ ...b, x0: xm, z1: zm }, cNE),
          boxPart({ ...b, x1: xm, z0: zm }, cSW),
          boxPart({ ...b, x0: xm, z0: zm }, cSE)
        );
      }
      continue;
    }
    wallParts.push(boxPart(b, defC));
  }
  V.instanced(g, unitBox(), wallMat, wallParts, { cast: true, receive: true });
  if (HP.graphics3d) {
    // Trim follows the actual solid wall faces; never spans a doorway.
    const rails = [];
    for (const b of geo.boxes) {
      if (b.tag === 'fence' || b.y0 > 0 || b.y1 < 10) continue;
      rails.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.25, z1: b.z0 + 0.01, y0: 0, y1: 2.2 },
        { x0: b.x0, x1: b.x1, z0: b.z1 - 0.01, z1: b.z1 + 0.25, y0: 0, y1: 2.2 },
        { x0: b.x0 - 0.25, x1: b.x0 + 0.01, z0: b.z0, z1: b.z1, y0: 0, y1: 2.2 },
        { x0: b.x1 - 0.01, x1: b.x1 + 0.25, z0: b.z0, z1: b.z1, y0: 0, y1: 2.2 });
    }
    V.instanced(g, unitBox(), HP.graphics3d.material('ceramic', '#dfd8c9'),
      V.splitBoxes(rails).map(b => boxPart(b)), { receive: true, detail: true });
  }

  /* ---- pools: recessed basins carved 1m into the ground. Collected
     before floors/ground so both leave the hole open; walk3d wades   */
  const pools = [];
  for (const it of lvl.furniture || []) {
    if (!HP.itemDef(it.type) || !/pool$|pond/i.test(it.type)) continue;
    const f = HP.footprint(it);
    pools.push({
      x0: f.x * C, z0: f.y * C, x1: (f.x + f.w) * C, z1: (f.y + f.h) * C,
      round: /round|circle|ellipse|oval/i.test(it.type),
    });
  }
  const inPool = (x0, z0, x1, z1) =>
    pools.some(p => x1 > p.x0 && x0 < p.x1 && z1 > p.z0 && z0 < p.z1);
  W3.waterAreas = pools.map(p => ({
    x0: p.x0 + 3, z0: p.z0 + 3, x1: p.x1 - 3, z1: p.z1 - 3,
    floorY: -C, waterY: -3.5,
  }));
  W3.climbs = [];
  W3.elevatedDecks = [];

  /* ---- floors + ceilings: one instanced mesh, per-cell colour ---- */
  const { regionOf } = HP.computeRegions();
  const cells = [];
  for (let y = 0; y < HP.GRID_H; y++) for (let x = 0; x < HP.GRID_W; x++) {
    if ((x * C < 0)) continue;
    const id = regionFloorId(x, y, lvl);
    if (id && !inPool(x * C, y * C, x * C + C, y * C + C))
      cells.push({ x, y, id, in: regionOf[y * HP.GRID_W + x] >= 0 });
  }
  const floorGroups = new Map();
  for (const cell of cells) {
    if (!floorGroups.has(cell.id)) floorGroups.set(cell.id, []);
    floorGroups.get(cell.id).push(cell);
  }
  /* single up-facing quads (2 tris) — a floor box drew 12 tris per
     cell of which only the top face can ever be seen                 */
  const cellPart = (c, y) => {
    const m = new THREE.Matrix4().makeScale(C, 1, C);
    m.setPosition(c.x * C + C / 2, y, c.y * C + C / 2);
    return { m, x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C };
  };
  for (const [id, list] of floorGroups) {
    const material = HP.graphics3d ? HP.graphics3d.floorMaterial(id) :
      new THREE.MeshLambertMaterial({ color: floorColor(id) });
    V.instanced(g, floorQuad(), material, list.map(c => cellPart(c, 0)), { receive: true });
  }
  /* ceilings cap INTERIOR cells only — open-top rooms leaked sky
     through the top of every doorway (the "gap above the door");
     patios/pool decks have floors but must stay open. They cast the
     sun's shadow, so daylight enters rooms only through windows.    */
  const ceilMat = HP.graphics3d ? HP.graphics3d.material('plaster', '#f3ecdc').clone()
                                : new THREE.MeshLambertMaterial({ color: 0xf3ecdc });
  ceilMat.userData.shared3d = false;
  if (HP.graphics3d) HP.graphics3d.track(ceilMat);
  ceilMat.shadowSide = THREE.DoubleSide;
  V.instanced(g, ceilQuad(), ceilMat,
    cells.filter(c => c.in).map(c => cellPart(c, HP.geom3d.WALL_H)), { cast: true });

  /* ---- ground under everything — a Shape with pool holes when any  */
  let groundGeo;
  if (pools.length) {
    const cx = HP.GRID_W * C / 2, cz = HP.GRID_H * C / 2;
    const xzPath = (x0, z0, x1, z1) => {           /* world XZ → shape space */
      const p = new THREE.Path();
      p.moveTo(x0 - cx, cz - z1); p.lineTo(x1 - cx, cz - z1);
      p.lineTo(x1 - cx, cz - z0); p.lineTo(x0 - cx, cz - z0); p.closePath();
      return p;
    };
    const shape = new THREE.Shape(
      xzPath(-2000, -2000, HP.GRID_W * C + 2000, HP.GRID_H * C + 2000).getPoints(4));
    for (const p of pools)
      shape.holes.push(xzPath(p.x0 + 1, p.z0 + 1, p.x1 - 1, p.z1 - 1));
    groundGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  } else {
    groundGeo = new THREE.PlaneGeometry(
      HP.GRID_W * C + 4000, HP.GRID_H * C + 4000).rotateX(-Math.PI / 2);
  }
  const ground = new THREE.Mesh(groundGeo,
    HP.graphics3d ? HP.graphics3d.worldUV(HP.graphics3d.material('grass').clone(), C * 3) :
      new THREE.MeshLambertMaterial({ color: 0x7fa75f }));
  ground.material.userData.shared3d = false;
  if (HP.graphics3d) HP.graphics3d.track(ground.material);
  ground.position.set(HP.GRID_W * C / 2, -1.5, HP.GRID_H * C / 2);
  ground.receiveShadow = true;
  g.add(ground);

  /* ---- pool basins: tiled shell 1m down, coping rim, animated
     water surface + caustic light-web on the floor                  */
  W3.water = [];
  for (const p of pools) {
    const mats = HP.graphics3d ? HP.graphics3d.poolWater() : {
      surf: new THREE.MeshLambertMaterial({ color: 0x5db8d2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      caustic: null, basin: new THREE.MeshLambertMaterial({ color: 0xcfeef2, side: THREE.DoubleSide }),
    };
    const DEPTH = C, WY = -3.5;
    const w = p.x1 - p.x0, d = p.z1 - p.z0, pcx = (p.x0 + p.x1) / 2, pcz = (p.z0 + p.z1) / 2;
    const stone = HP.graphics3d ? HP.graphics3d.material('stone', '#d8d0bd')
                              : new THREE.MeshLambertMaterial({ color: 0xd8d0bd });
    const g2 = new THREE.Group();
    const rec = { caustics: [] };
    /* each pool gets its own caustic map clone so the web tiles at a
       believable ~110px no matter the basin size                    */
    const causticMat = size => {
      const cm = mats.caustic.clone();
      if (mats.caustic.map) {
        cm.map = mats.caustic.map.clone();
        cm.map.repeat.set(size[0] / 110, size[1] / 110);
        cm.map.needsUpdate = true;
      }
      rec.caustics.push(cm);
      return cm;
    };
    if (p.round) {
      const r = Math.min(w, d) / 2 - 2;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), mats.basin);
      floor.position.set(pcx, -DEPTH + 0.4, pcz); floor.receiveShadow = true;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DEPTH - 0.4, 40, 1, true), mats.basin);
      wall.position.set(pcx, -DEPTH / 2 + 0.2, pcz);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 2, 2.2, 8, 40).rotateX(Math.PI / 2), stone);
      rim.position.set(pcx, 0.6, pcz); rim.castShadow = rim.receiveShadow = true;
      const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.5, 40).rotateX(-Math.PI / 2), mats.surf);
      water.position.set(pcx, WY, pcz); water.renderOrder = 2;
      g2.add(floor, wall, rim, water);
      if (mats.caustic) {
        const ca = new THREE.Mesh(new THREE.CircleGeometry(r - 1, 36).rotateX(-Math.PI / 2), causticMat([r * 2, r * 2]));
        ca.position.set(pcx, -DEPTH + 0.9, pcz); ca.renderOrder = 1;
        g2.add(ca);
      }
    } else {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, d - 3).rotateX(-Math.PI / 2), mats.basin);
      floor.position.set(pcx, -DEPTH + 0.4, pcz); floor.receiveShadow = true; g2.add(floor);
      for (const [ox, oz, ww, rot] of [[0, -d / 2 + 1.6, w - 3, 0], [0, d / 2 - 1.6, w - 3, 0],
                                       [-w / 2 + 1.6, 0, d - 3, 1], [w / 2 - 1.6, 0, d - 3, 1]]) {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(ww, DEPTH - 0.4), mats.basin);
        wall.position.set(pcx + ox, -DEPTH / 2 + 0.2, pcz + oz);
        if (rot) wall.rotation.y = Math.PI / 2;
        g2.add(wall);
      }
      /* coping: stone rim around the lip, overhangs the basin edge   */
      for (const [bx, bz, bw, bd] of [[0, -d / 2 + 1, w + 4, 5], [0, d / 2 - 1, w + 4, 5],
                                      [-w / 2 + 1, 0, 5, d - 6], [w / 2 - 1, 0, 5, d - 6]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.4, bd), stone);
        b.position.set(pcx + bx, 0.2, pcz + bz); b.castShadow = b.receiveShadow = true;
        g2.add(b);
      }
      /* corner steps: pick the side whose outside approach is clear
         of furniture and walls — steps hug that wall and descend in  */
      const stairDefs = [
        { ax: 'z', dir: -1, from: p.z1 - 3, u0: p.x0 + 2, u1: p.x0 + 22, ap: [p.x0 + 11, p.z1 + 12] },
        { ax: 'z', dir: -1, from: p.z1 - 3, u0: p.x1 - 22, u1: p.x1 - 2, ap: [p.x1 - 11, p.z1 + 12] },
        { ax: 'z', dir: 1,  from: p.z0 + 3, u0: p.x0 + 2, u1: p.x0 + 22, ap: [p.x0 + 11, p.z0 - 12] },
        { ax: 'z', dir: 1,  from: p.z0 + 3, u0: p.x1 - 22, u1: p.x1 - 2, ap: [p.x1 - 11, p.z0 - 12] },
        { ax: 'x', dir: 1,  from: p.x0 + 3, u0: p.z0 + 2, u1: p.z0 + 22, ap: [p.x0 - 12, p.z0 + 11] },
        { ax: 'x', dir: 1,  from: p.x0 + 3, u0: p.z1 - 22, u1: p.z1 - 2, ap: [p.x0 - 12, p.z1 - 11] },
        { ax: 'x', dir: -1, from: p.x1 - 3, u0: p.z0 + 2, u1: p.z0 + 22, ap: [p.x1 + 12, p.z0 + 11] },
        { ax: 'x', dir: -1, from: p.x1 - 3, u0: p.z1 - 22, u1: p.z1 - 2, ap: [p.x1 + 12, p.z1 - 11] },
      ];
      const clutter = (x, z) => {
        let s = 0;
        for (const it of lvl.furniture) {
          if (/pool$|pond/i.test(it.type)) continue;
          const f = HP.footprint(it);
          if (x > f.x * C - 8 && x < (f.x + f.w) * C + 8 && z > f.y * C - 8 && z < (f.y + f.h) * C + 8) s++;
        }
        for (const b of geo.boxes)
          if (b.y0 < 50 && x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4) s++;
        return s;
      };
      const st = stairDefs.reduce((best, s) => clutter(s.ap[0], s.ap[1]) < clutter(best.ap[0], best.ap[1]) ? s : best);
      const RUN = 30, RISE = 7, TREAD = 10, WALL_TOP = -DEPTH + 0.4;
      /* each step is a solid block from the basin floor to its tread —
         stacked they read as a real staircase                        */
      for (let i = 0; i < 3; i++) {
        const top = -(i + 1) * RISE;
        const s0 = st.from + st.dir * i * TREAD, s1 = st.from + st.dir * RUN;
        const [bx0, bz0, bx1, bz1] = st.ax === 'z'
          ? [st.u0, Math.min(s0, s1), st.u1, Math.max(s0, s1)]
          : [Math.min(s0, s1), st.u0, Math.max(s0, s1)];
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(bx1 - bx0, top - WALL_TOP, bz1 - bz0), mats.basin);
        step.position.set((bx0 + bx1) / 2, (top + WALL_TOP) / 2, (bz0 + bz1) / 2);
        step.receiveShadow = true;
        g2.add(step);
      }
      const zone = st.ax === 'z'
        ? { x0: st.u0, x1: st.u1, z0: Math.min(st.from, st.from + st.dir * RUN), z1: Math.max(st.from, st.from + st.dir * RUN) }
        : { z0: st.u0, z1: st.u1, x0: Math.min(st.from, st.from + st.dir * RUN), x1: Math.max(st.from, st.from + st.dir * RUN) };
      const area = W3.waterAreas[pools.indexOf(p)];
      area.stairs = { ...zone, ax: st.ax, from: st.from, dir: st.dir, rise: RISE, tread: TREAD, run: RUN };

      const seg = Math.max(6, Math.min(26, Math.round(Math.min(w, d) / 6)));
      const wg = new THREE.PlaneGeometry(w - 2, d - 2, seg, seg).rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, mats.surf);
      water.position.set(pcx, WY, pcz); water.renderOrder = 2;
      g2.add(water);
      /* edge taper so ripple verts never poke through the basin walls */
      const pos = wg.attributes.position, taper = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vz = pos.getZ(i);
        const ex = Math.min(vx + (w - 2) / 2, (w - 2) / 2 - vx);
        const ez = Math.min(vz + (d - 2) / 2, (d - 2) / 2 - vz);
        taper[i] = Math.max(0, Math.min(1, Math.min(ex, ez) / 5));
      }
      rec.pos = pos; rec.taper = taper;
      if (mats.caustic) {
        const ca = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, d - 3).rotateX(-Math.PI / 2), causticMat([w - 3, d - 3]));
        ca.position.set(pcx, -DEPTH + 0.9, pcz); ca.renderOrder = 1;
        g2.add(ca);
      }
    }
    W3.water.push(rec);
    g.add(g2);
  }

  /* ---- physics footprints + batched furniture visuals ---- */
  const known = lvl.furniture.filter(it => HP.itemDef(it.type));
  const items = known.filter(it => !HP.itemDef(it.type).hangs);
  const hangs = known.filter(it => HP.itemDef(it.type).hangs);
  const fit2 = new THREE.InstancedMesh(unitBox(), new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length + hangs.length);
  W3.fitMesh = fit2;                                    // movers update instances
  /* colliders = only boxes intersecting the player's body height —
     lintels/headers (y0≥58) must NOT block walking through doors     */
  W3.colliders = geo.boxes.filter(b => b.y0 < 50 && b.y1 > 2);
  W3.movers = [];                                       // pushable furniture
  const models = HP.furniture3d ? HP.furniture3d.builder(g) : null;
  const lifeItems = [];
  items.forEach((it, i) => {
    const d = HP.itemDef(it.type), f = HP.footprint(it);
    const h = itemH3D(d, it);
    lifeItems.push({ it, f, h });
    const c = (it.colors && it.colors[0]) || (d.colors && d.colors[0]) || '#999';
    let baseY = 0;
    if (d.onTop) {                                   // sit on the highest surface under it
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      for (const o of items) {
        if (o === it || !HP.isSurface(o)) continue;
        const of = HP.footprint(o);
        if (cx >= of.x && cx < of.x + of.w && cy >= of.y && cy < of.y + of.h)
          baseY = Math.max(baseY, itemH3D(HP.itemDef(o.type), o));
      }
    }
    // Items placed inside treehouse or on greenhouse benches
    if (it.type !== 'treehouse' && it.type !== 'greenhouse') {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      for (const o of items) {
        if (o === it) continue;
        const of = HP.footprint(o);
        if (cx >= of.x && cx < of.x + of.w && cy >= of.y && cy < of.y + of.h) {
          if (/treehouse/i.test(o.type)) {
            baseY = Math.max(baseY, 54.0);
          } else if (/greenhouse/i.test(o.type)) {
            const relX = (cx - (of.x + of.w / 2)) / of.w;
            const ghH = itemH3D(HP.itemDef(o.type), o);
            if (Math.abs(relX) > 0.20) baseY = Math.max(baseY, Math.round(ghH * 0.22));
          }
        }
      }
    }
    if (/garagedoor/i.test(it.type)) {
      // Build dynamic articulated overhead roll-up sectional garage door
      // Designed for ZERO-GAP seamless connection to adjacent walls and adjacent garage doors!
      const doorGroup = new THREE.Group();
      const bw = it.w || d.w || 3;
      const W = bw * C, D = (it.h || d.h || 1) * C;
      const ph = 14;
      const panels = [];
      const dCol = c || '#f8fafc';
      const panelMat = HP.graphics3d ? HP.graphics3d.material('ceramic', dCol) : new THREE.MeshLambertMaterial({ color: new THREE.Color(dCol) });
      const winMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') : new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.6 });
      const metalMat = HP.graphics3d ? HP.graphics3d.material('metal', '#334155') : new THREE.MeshLambertMaterial({ color: 0x334155 });
      const darkMat = HP.graphics3d ? HP.graphics3d.material('dark', '#181b20') : new THREE.MeshLambertMaterial({ color: 0x181b20 });
      const wallHeaderMat = HP.graphics3d ? HP.graphics3d.material('ceramic', '#e9e2d2') : new THREE.MeshLambertMaterial({ color: 0xe9e2d2 });

      // Determine wall line alignment in Z (or X for vertical doors)
      let tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
      const rot = (it.rot || 0) % 4;
      const lvlWalls = lvl.walls || {};
      let wallLine = null;
      let wt = 0.44 * C;

      if (rot % 2 === 0) {
        for (const testY of [f.y, f.y + f.h, f.y - 1, f.y + 1]) {
          let count = 0;
          for (let cx = 0; cx < HP.GRID_W; cx++) {
            if (lvlWalls['h,' + cx + ',' + testY]) count++;
          }
          if (count > 0 && (wallLine === null || count > wallLine.count)) {
            wallLine = { d: 'h', line: testY, count };
          }
        }
        if (!wallLine) {
          for (const testY of [f.y, f.y + f.h, f.y + 1]) {
            const cx = Math.floor(tcx / C);
            const ra = env.rAt(cx, testY - 1);
            const rb = env.rAt(cx, testY);
            if (ra !== rb) { wallLine = { d: 'h', line: testY, count: 1 }; break; }
          }
        }
        if (!wallLine) wallLine = { d: 'h', line: f.y, count: 0 };
        const ra = env.rAt(Math.floor(tcx / C), wallLine.line - 1);
        const rb = env.rAt(Math.floor(tcx / C), wallLine.line);
        wt = (ra < 0 || rb < 0) ? 0.44 * C : 0.30 * C;
        if (ra < 0 && rb >= 0) tcz = wallLine.line * C - wt / 2;
        else if (rb < 0 && ra >= 0) tcz = wallLine.line * C + wt / 2;
        else tcz = wallLine.line * C;
      } else {
        for (const testX of [f.x, f.x + f.w, f.x - 1, f.x + 1]) {
          let count = 0;
          for (let cy = 0; cy < HP.GRID_H; cy++) {
            if (lvlWalls['v,' + testX + ',' + cy]) count++;
          }
          if (count > 0 && (wallLine === null || count > wallLine.count)) {
            wallLine = { d: 'v', line: testX, count };
          }
        }
        if (!wallLine) {
          for (const testX of [f.x, f.x + f.w, f.x + 1]) {
            const cy = Math.floor(tcz / C);
            const ra = env.rAt(testX - 1, cy);
            const rb = env.rAt(testX, cy);
            if (ra !== rb) { wallLine = { d: 'v', line: testX, count: 1 }; break; }
          }
        }
        if (!wallLine) wallLine = { d: 'v', line: f.x, count: 0 };
        const ra = env.rAt(wallLine.line - 1, Math.floor(tcz / C));
        const rb = env.rAt(wallLine.line, Math.floor(tcz / C));
        wt = (ra < 0 || rb < 0) ? 0.44 * C : 0.30 * C;
        if (ra < 0 && rb >= 0) tcx = wallLine.line * C - wt / 2;
        else if (rb < 0 && ra >= 0) tcx = wallLine.line * C + wt / 2;
        else tcx = wallLine.line * C;
      }

      const wallThick = Math.max(12.5, wt);

      // 1. FULL-HEIGHT WALL HEADER (y = 56 to 74, WALL_H = 74)
      // Spans full width W across opening, matching ceiling height exactly
      const headerBox = new THREE.Mesh(new THREE.BoxGeometry(W, 18, wallThick), wallHeaderMat);
      headerBox.position.set(0, 65, 0);
      headerBox.castShadow = headerBox.receiveShadow = true;
      doorGroup.add(headerBox);

      // Architectural header drip trim moulding in bronze/slate
      const dripTrim = new THREE.Mesh(new THREE.BoxGeometry(W, 1.8, wallThick + 0.8), metalMat);
      dripTrim.position.set(0, 56.5, 0);
      dripTrim.castShadow = true;
      doorGroup.add(dripTrim);

      // 2. FULL-HEIGHT LEFT & RIGHT WALL JAMB PILASTERS (y = 0 to 74)
      // Outer faces reach EXACTLY -W/2 and +W/2
      const jw = 3.6;
      for (const sx of [-W / 2 + jw / 2, W / 2 - jw / 2]) {
        const jambPost = new THREE.Mesh(new THREE.BoxGeometry(jw, 74, wallThick), wallHeaderMat);
        jambPost.position.set(sx, 37, 0);
        jambPost.castShadow = jambPost.receiveShadow = true;
        doorGroup.add(jambPost);

        const trackChannel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 56, 4.2), metalMat);
        trackChannel.position.set(sx > 0 ? sx - jw / 2 - 1.0 : sx + jw / 2 + 1.0, 28, 0);
        trackChannel.castShadow = true;
        doorGroup.add(trackChannel);
      }

      // 3. AUTOMATIC GAP BRIDGING TO NEAREST ADJACENT WALL OR GARAGE DOOR (up to 3.5 cells)
      // Fills any gap between adjacent doors or door and wall with a full-height solid wall pier!
      if (rot % 2 === 0) {
        const leftEdgeWorld = f.x * C;
        const rightEdgeWorld = (f.x + bw) * C;
        // Search left for neighboring garage door or wall
        let leftWallEnd = null;
        // 1. Check neighboring garage doors on left
        for (const o of (lvl.furniture || [])) {
          if (o === it || !/garagedoor/i.test(o.type)) continue;
          if (((o.rot || 0) % 4) % 2 !== 0) continue;
          if (Math.abs(o.y - f.y) > 1.2) continue;
          const obw = o.w || 3;
          const ox_max = (o.x + obw) * C;
          if (ox_max <= leftEdgeWorld + 0.5) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, ox_max);
          }
        }
        // 2. Check walls on left
        for (let cx = Math.floor(leftEdgeWorld / C); cx >= Math.floor(leftEdgeWorld / C) - 4; cx--) {
          const hasH = lvlWalls['h,' + cx + ',' + wallLine.line];
          const hasV = lvlWalls['v,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + (wallLine.line - 1)];
          if (hasH) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, (cx + 1) * C);
            break;
          } else if (hasV) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, cx * C);
            break;
          }
        }
        if (leftWallEnd !== null && leftWallEnd < leftEdgeWorld) {
          const gapLeft = leftEdgeWorld - leftWallEnd;
          if (gapLeft > 0.5 && gapLeft <= 3.5 * C) {
            const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapLeft, 74, wallThick), wallHeaderMat);
            const localX = (rot === 2) ? (W / 2 + gapLeft / 2) : (-W / 2 - gapLeft / 2);
            bridgeMesh.position.set(localX, 37, 0);
            bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
            doorGroup.add(bridgeMesh);
          }
        }
        // Search right for neighboring garage door or wall
        let rightWallStart = null;
        // 1. Check neighboring garage doors on right
        for (const o of (lvl.furniture || [])) {
          if (o === it || !/garagedoor/i.test(o.type)) continue;
          if (((o.rot || 0) % 4) % 2 !== 0) continue;
          if (Math.abs(o.y - f.y) > 1.2) continue;
          const ox_min = o.x * C;
          if (ox_min >= rightEdgeWorld - 0.5) {
            rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, ox_min);
          }
        }
        // 2. Check walls on right
        for (let cx = Math.floor(rightEdgeWorld / C); cx <= Math.floor(rightEdgeWorld / C) + 4; cx++) {
          if (lvlWalls['h,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + (wallLine.line - 1)]) {
            rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, cx * C);
            break;
          }
        }
        if (rightWallStart !== null && rightWallStart > rightEdgeWorld) {
          const gapRight = rightWallStart - rightEdgeWorld;
          if (gapRight > 0.5 && gapRight <= 3.5 * C) {
            const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapRight, 74, wallThick), wallHeaderMat);
            const localX = (rot === 2) ? (-W / 2 - gapRight / 2) : (W / 2 + gapRight / 2);
            bridgeMesh.position.set(localX, 37, 0);
            bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
            doorGroup.add(bridgeMesh);
          }
        }
      } else {
        const leftEdgeWorld = f.y * C;
        const rightEdgeWorld = (f.y + bw) * C;
        let leftWallEnd = null;
        for (const o of (lvl.furniture || [])) {
          if (o === it || !/garagedoor/i.test(o.type)) continue;
          if (((o.rot || 0) % 4) % 2 === 0) continue;
          if (Math.abs(o.x - f.x) > 1.2) continue;
          const obw = o.w || 3;
          const oy_max = (o.y + obw) * C;
          if (oy_max <= leftEdgeWorld + 0.5) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, oy_max);
          }
        }
        for (let cy = Math.floor(leftEdgeWorld / C); cy >= Math.floor(leftEdgeWorld / C) - 4; cy--) {
          const hasV = lvlWalls['v,' + wallLine.line + ',' + cy];
          const hasH = lvlWalls['h,' + wallLine.line + ',' + cy] || lvlWalls['h,' + (wallLine.line - 1) + ',' + cy];
          if (hasV) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, (cy + 1) * C);
            break;
          } else if (hasH) {
            leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, cy * C);
            break;
          }
        }
        if (leftWallEnd !== null && leftWallEnd < leftEdgeWorld) {
          const gapLeft = leftEdgeWorld - leftWallEnd;
          if (gapLeft > 0.5 && gapLeft <= 3.5 * C) {
            const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapLeft, 74, wallThick), wallHeaderMat);
            const localX = (rot === 3) ? (W / 2 + gapLeft / 2) : (-W / 2 - gapLeft / 2);
            bridgeMesh.position.set(localX, 37, 0);
            bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
            doorGroup.add(bridgeMesh);
          }
        }
        let rightWallStart = null;
        for (const o of (lvl.furniture || [])) {
          if (o === it || !/garagedoor/i.test(o.type)) continue;
          if (((o.rot || 0) % 4) % 2 === 0) continue;
          if (Math.abs(o.x - f.x) > 1.2) continue;
          const oy_min = o.y * C;
          if (oy_min >= rightEdgeWorld - 0.5) {
            rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, oy_min);
          }
        }
        for (let cy = Math.floor(rightEdgeWorld / C); cy <= Math.floor(rightEdgeWorld / C) + 4; cy++) {
          if (lvlWalls['v,' + wallLine.line + ',' + cy] || lvlWalls['h,' + wallLine.line + ',' + cy] || lvlWalls['h,' + (wallLine.line - 1) + ',' + cy]) {
            rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, cy * C);
            break;
          }
        }
        if (rightWallStart !== null && rightWallStart > rightEdgeWorld) {
          const gapRight = rightWallStart - rightEdgeWorld;
          if (gapRight > 0.5 && gapRight <= 3.5 * C) {
            const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapRight, 74, wallThick), wallHeaderMat);
            const localX = (rot === 3) ? (-W / 2 - gapRight / 2) : (W / 2 + gapRight / 2);
            bridgeMesh.position.set(localX, 37, 0);
            bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
            doorGroup.add(bridgeMesh);
          }
        }
      }

      // 4. OVERHEAD HORIZONTAL CEILING TRACKS & AUTOMATIC OPENER MOTOR
      for (const sx of [-W / 2 + jw + 1.0, W / 2 - jw - 1.0]) {
        const ceilTrack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 48), metalMat);
        ceilTrack.position.set(sx, 61, -24);
        ceilTrack.castShadow = true;
        doorGroup.add(ceilTrack);

        const hanger = new THREE.Mesh(new THREE.BoxGeometry(1.2, 13, 1.2), metalMat);
        hanger.position.set(sx, 67.5, -42);
        doorGroup.add(hanger);
      }
      const torsionShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, W - 8, 8), metalMat);
      torsionShaft.rotation.z = Math.PI / 2;
      torsionShaft.position.set(0, 58, 1.2);
      doorGroup.add(torsionShaft);

      const trolleyRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 46), metalMat);
      trolleyRail.position.set(0, 61, -23);
      doorGroup.add(trolleyRail);
      const motorUnit = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 14), darkMat);
      motorUnit.position.set(0, 61, -40);
      motorUnit.castShadow = true;
      doorGroup.add(motorUnit);

      // 5. ARTICULATED MOVING DOOR PANELS (OVERLAPPING INSIDE TRACKS)
      const pw = W - jw * 2 + 1.6;
      for (let pi = 0; pi < 4; pi++) {
        const pGroup = new THREE.Group();
        const slab = new THREE.Mesh(new THREE.BoxGeometry(pw, ph - 0.4, 2.6), panelMat);
        slab.castShadow = slab.receiveShadow = true;
        pGroup.add(slab);

        for (const sx of [-pw / 2 + 0.6, pw / 2 - 0.6]) {
          const roller = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), metalMat);
          roller.rotation.z = Math.PI / 2;
          roller.position.x = sx;
          pGroup.add(roller);
        }

        if (pi === 3) {
          const numWindows = W >= 120 ? 8 : 4;
          const stampW = (pw - (numWindows + 1) * 3) / numWindows;
          for (let wi = 0; wi < numWindows; wi++) {
            const wx = -pw / 2 + 3 + stampW / 2 + wi * (stampW + 3);
            const win = new THREE.Mesh(new THREE.BoxGeometry(stampW, 6.5, 2.8), winMat);
            win.position.set(wx, 0, 0);
            pGroup.add(win);
          }
        }

        if (pi === 0) {
          const seal = new THREE.Mesh(new THREE.BoxGeometry(pw, 2.0, 3.2), darkMat);
          seal.position.set(0, -ph / 2 + 1.0, 0);
          pGroup.add(seal);

          const handle = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 3.8), metalMat);
          handle.position.set(0, -ph / 4, 1.2);
          pGroup.add(handle);
        }

        doorGroup.add(pGroup);
        panels.push({ group: pGroup, y0: (pi + 0.5) * ph, idx: pi });
      }

      function updatePanels(open) {
        const travel = 54;
        for (let pi = 0; pi < 4; pi++) {
          const p = panels[pi];
          const s = p.y0 + open * travel;
          let y, z, rx;
          if (s <= 48) {
            y = s; z = 0; rx = 0;
          } else if (s < 60) {
            const u = (s - 48) / 12;
            const ang = u * (Math.PI / 2);
            y = 48 + 12 * Math.sin(ang);
            z = -12 * (1 - Math.cos(ang));
            rx = -ang;
          } else {
            y = 60;
            z = -12 - (s - 60);
            rx = -Math.PI / 2;
          }
          p.group.position.set(0, y, z);
          p.group.rotation.x = rx;
        }
      }

      updatePanels(0); // initially closed

      doorGroup.position.set(tcx, 0, tcz);
      doorGroup.rotation.y = -rot * Math.PI / 2;
      g.add(doorGroup);
      V.add(doorGroup, f.x * C - C, f.y * C - C, (f.x + f.w) * C + C, (f.y + f.h) * C + C);

      // World-space closed door collider box
      let box;
      if (rot % 2 === 0) {
        box = { x0: tcx - pw / 2, x1: tcx + pw / 2, z0: tcz - 5, z1: tcz + 5, y0: 0, y1: 58 };
      } else {
        box = { x0: tcx - 5, x1: tcx + 5, z0: tcz - pw / 2, z1: tcz + pw / 2, y0: 0, y1: 58 };
      }

      W3.garageDoors.push({
        it, def: d, group: doorGroup, panels,
        open: 0, target: 0, vel: 0,
        cx: tcx, cz: tcz, w: W, d: D, rot,
        box,
        updatePanels
      });
    }
    if (/treehouse/i.test(it.type)) {
      // Register elevated deck floor at y = 40.5
      W3.elevatedDecks.push({
        x0: f.x * C, x1: (f.x + f.w) * C,
        z0: f.y * C, z1: (f.y + f.h) * C,
        deckY: 54.0
      });
      // Register ship's ladder climb
      const rot = it.rot || 0;
      const tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
      const W = f.w * C, D = f.h * C;
      // In unrotated model space: ladder is at x in [0.20, 0.34]*W, z in [0.44, 0.65]*D
      const lx0 = 0.20 * W, lx1 = 0.34 * W, lz0 = 0.44 * D, lz1 = 0.65 * D;
      const corners = [
        { x: lx0, z: lz0 }, { x: lx1, z: lz0 },
        { x: lx1, z: lz1 }, { x: lx0, z: lz1 }
      ];
      // Rotate by rot * PI/2
      const rotCorners = corners.map(pt => {
        let rx = pt.x, rz = pt.z;
        if (rot === 1) { rx = -pt.z; rz = pt.x; }
        else if (rot === 2) { rx = -pt.x; rz = -pt.z; }
        else if (rot === 3) { rx = pt.z; rz = -pt.x; }
        return { x: tcx + rx, z: tcz + rz };
      });
      const minX = Math.min(...rotCorners.map(p => p.x));
      const maxX = Math.max(...rotCorners.map(p => p.x));
      const minZ = Math.min(...rotCorners.map(p => p.z));
      const maxZ = Math.max(...rotCorners.map(p => p.z));

      // Spots for prompt & teleport
      let deckPt = { x: 0.27 * W, z: 0.38 * D };
      let gndPt  = { x: 0.27 * W, z: 0.68 * D };
      const rotateSpot = pt => {
        let rx = pt.x, rz = pt.z;
        if (rot === 1) { rx = -pt.z; rz = pt.x; }
        else if (rot === 2) { rx = -pt.x; rz = -pt.z; }
        else if (rot === 3) { rx = pt.z; rz = -pt.x; }
        return { x: tcx + rx, z: tcz + rz };
      };
      const deckSpot = rotateSpot(deckPt);
      const groundSpot = rotateSpot(gndPt);

      // Ladder climb axis:
      let ax = 'z', dir = -1, from = maxZ, run = maxZ - minZ;
      if (rot === 1) { ax = 'x'; dir = 1; from = minX; run = maxX - minX; }
      else if (rot === 2) { ax = 'z'; dir = 1; from = minZ; run = maxZ - minZ; }
      else if (rot === 3) { ax = 'x'; dir = -1; from = maxX; run = maxX - minX; }

      W3.climbs.push({
        x0: minX - 2, x1: maxX + 2,
        z0: minZ - 2, z1: maxZ + 2,
        y0: 0, y1: 54.0,
        ax, dir, from, run,
        deckSpot, groundSpot
      });
    }
    m4.makeScale(Math.max(2, f.w * C - 3), Math.max(1.5, h), Math.max(2, f.h * C - 3));
    m4.setPosition((f.x + f.w / 2) * C, baseY + h / 2, (f.y + f.h / 2) * C);
    fit2.setMatrixAt(i, m4);
    fit2.setColorAt(i, col.set(c));
    if (models) models.add(it, d, f, h, i, baseY);
    if (h > 10 && !FLAT(it.type) && !d.onTop && !d.walkable && it.type !== 'rangehood') {
      const colliders = HP.itemColliders ? HP.itemColliders(it, d, f, h) : [{ x0: f.x * C, x1: (f.x + f.w) * C, z0: f.y * C, z1: (f.y + f.h) * C, y0: 0, y1: h }];
      for (const box of colliders) {
        W3.colliders.push(box);
        if (colliders.length === 1 && pushable(it, d, f, h)) {
          box.mv = W3.movers.length;
          W3.movers.push({ inst: i, box, x: f.x * C, z: f.y * C,
                           w: f.w * C, h: f.h * C,
                           sx: Math.max(2, f.w * C - 3), sy: Math.max(1.5, h),
                           sz: Math.max(2, f.h * C - 3), vx: 0, vz: 0 });
        }
      }
    }
  });
  hangs.forEach((it, i2) => {
    const i = items.length + i2;
    const d = HP.itemDef(it.type), f = HP.footprint(it);
    lifeItems.push({ it, f, h: 0 });
    const c = (it.colors && it.colors[0]) || (d.colors && d.colors[0]) || '#999';
    const w = f.w * C, dep = 4, hy = 52;
    m4.makeScale(it.rot % 2 ? dep : w, Math.max(10, f.h * C * 0.5), it.rot % 2 ? w : dep);
    m4.setPosition((f.x + f.w / 2) * C, hy, (f.y + f.h / 2) * C);
    fit2.setMatrixAt(i, m4);
    fit2.setColorAt(i, col.set(c));
    if (models) models.add(it, d, f, 0, i);
  });
  /* night light sources: real lamps/fireplaces + one ceiling light per
     room (rooms with no lamp would otherwise be black after sunset)   */
  W3.lamps = [];
  for (const it of items) {
    if (!/lamp|torch|candle|fireplace|lantern|light|sconce/i.test(it.type)) continue;
    const f = HP.footprint(it), h = itemH3D(HP.itemDef(it.type), it);
    const isPost = /lamppost/i.test(it.type);
    const isPath = /pathlight/i.test(it.type);
    const isNight = /nightlight/i.test(it.type);
    const isCandle = /candle/i.test(it.type);
    const lightPower = isPost ? 1.6 : (isPath ? 0.9 : (isNight ? 0.8 : (isCandle ? 0.75 : 1.4)));
    const lightY = /fireplace/i.test(it.type) ? 10 : (isNight ? 6 : Math.max(12, h * 0.85));
    W3.lamps.push({ x: (f.x + f.w / 2) * C, z: (f.y + f.h / 2) * C, y: lightY, power: lightPower });
  }
  for (const it of items) {
    if (/^greenhouse/i.test(it.type)) {
      const f = HP.footprint(it), h = itemH3D(HP.itemDef(it.type), it);
      W3.lamps.push({ x: (f.x + f.w / 2) * C, z: (f.y + f.h / 2) * C, y: h * 0.65, power: 1.3 });
    }
  }
  for (const it of items) {
    if (/^treehouse/i.test(it.type)) {
      const f = HP.footprint(it), rot = it.rot || 0;
      const W = f.w * C, D = f.h * C;
      const tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
      let lx = -0.15 * W, lz = -0.15 * D;
      if (rot === 1) { const rx = -lz; lz = lx; lx = rx; }
      else if (rot === 2) { lx = -lx; lz = -lz; }
      else if (rot === 3) { const rx = lz; lz = -lx; lx = rx; }
      W3.lamps.push({ x: tcx + lx, z: tcz + lz, y: 98, power: 1.2 });
    }
  }
  for (const it of hangs) {                            // wall sconces light too
    if (!/sconce/i.test(it.type)) continue;
    const f = HP.footprint(it);
    const hang = it.hang || HP.hangSide(it.type, it.x, it.y, it.rot || 0, { w: it.w || f.w, h: it.h || f.h });
    let mx = (f.x + f.w / 2) * C, mz = (f.y + f.h / 2) * C;
    if (hang === 'n') mz = f.y * C + 5.2; else if (hang === 's') mz = (f.y + f.h) * C - 5.2;
    else if (hang === 'w') mx = f.x * C + 5.2; else if (hang === 'e') mx = (f.x + f.w) * C - 5.2;
    W3.lamps.push({ x: mx, z: mz, y: 38, power: 0.8 });
  }
  for (const r of HP.computeRegions().regions) if (r.cells.length >= 6)
    W3.lamps.push({ x: r.lx, z: r.ly, y: HP.geom3d.WALL_H - 10, power: 0.7 });
  /* animated + interactive furniture (fan, clock, fish, fire, TV,
     E-toggle lamps) and creatures — after lamps so bulbs can link  */
  if (HP.life3d) HP.life3d.build(g, lifeItems);
  fit2.instanceMatrix.needsUpdate = true;
  if (fit2.instanceColor) fit2.instanceColor.needsUpdate = true;
  if (models) {
    fit2.dispose(); fit2.material.dispose(); W3.fitMesh = null;   // physics-only data
    W3.furnitureVisuals = models.finish();
    W3.furnitureVisuals.move(W3.movers);
  } else { g.add(fit2); W3.furnitureVisuals = null; }

  /* Framed windows: multi-panel casements hinge into the room.
     Singles retain a lifting lower sash over a fixed upper sash. */
  W3.windows = [];
  if (geo.windows.length) {
    const paneMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') :
      new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.45 });
    const sashMat = HP.graphics3d ? HP.graphics3d.material('metal', '#eae4d6') :
      new THREE.MeshLambertMaterial({ color: 0xeae4d6 });
    for (const opening of geo.windows) {
      const w = { ...opening }, isH = w.d === 'h';
      const n = Math.max(1, Math.round(((isH ? w.x1 - w.x0 : w.z1 - w.z0) + 4) / C));
      // Junction posts remain structural solids inside an aperture's
      // ends. Seat the entire assembly between their actual faces.
      for (const b of geo.boxes) {
        if (b.tag !== 'corner' || b.y0 >= w.y1 || b.y1 <= w.y0) continue;
        if (isH && b.z1 > w.z0 && b.z0 < w.z1) {
          if (b.x0 <= w.x0 && b.x1 > w.x0) w.x0 = b.x1;
          if (b.x1 >= w.x1 && b.x0 < w.x1) w.x1 = b.x0;
        } else if (!isH && b.x1 > w.x0 && b.x0 < w.x1) {
          if (b.z0 <= w.z0 && b.z1 > w.z0) w.z0 = b.z1;
          if (b.z1 >= w.z1 && b.z0 < w.z1) w.z1 = b.z0;
        }
      }
      const span = isH ? w.x1 - w.x0 : w.z1 - w.z0;
      const height = w.y1 - w.y0, rim = 1.25, rail = 0.85;
      const width = span - rim * 2, insideH = height - rim * 2;
      const a = { ...w, cx: (w.x0 + w.x1) / 2, cz: (w.z0 + w.z1) / 2 };
      const seg = HP.parseWallKey(w.k);
      const minusRoom = isH ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
      const plusRoom = env.rAt(seg.x, seg.y);
      // Exterior windows always open into the enclosed room. For a
      // room-to-room opening choose the smaller room, consistently.
      const inward = minusRoom >= 0 && (plusRoom < 0 || env.rsz(minusRoom) < env.rsz(plusRoom)) ? -1 : 1;
      const wallDepth = isH ? w.z1 - w.z0 : w.x1 - w.x0;
      const root = new THREE.Group();
      root.position.set(a.cx, (w.y0 + w.y1) / 2, a.cz);
      g.add(root);
      V.add(root, w.x0 - span, w.z0 - span, w.x1 + span, w.z1 + span);
      const assembly = { a, root, panels: [], inward, style: n === 1 ? 'single-hung' : 'casement' };
      W3.windows.push(assembly);
      // Local u runs along the wall; depth always runs across it.
      const bars = (parent, specs) => {
        const geometry = unitBox().clone();
        const mesh = new THREE.InstancedMesh(geometry, sashMat, specs.length);
        const bounds = new THREE.Box3(), part = new THREE.Box3();
        specs.forEach(([u, y, depth, bw, bh, bd], i) => {
          const sx = isH ? bw : bd, sz = isH ? bd : bw;
          const x = isH ? u : depth, z = isH ? depth : u;
          m4.makeScale(sx, bh, sz); m4.setPosition(x, y, z);
          mesh.setMatrixAt(i, m4);
          part.min.set(x - sx / 2, y - bh / 2, z - sz / 2);
          part.max.set(x + sx / 2, y + bh / 2, z + sz / 2);
          bounds.union(part);
        });
        // r149 uses geometry bounds for InstancedMesh culling.
        geometry.boundingBox = bounds;
        geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const frameBars = [
        [0, -height / 2 + rim / 2, 0, span, rim, wallDepth],
        [0, height / 2 - rim / 2, 0, span, rim, wallDepth],
        [-span / 2 + rim / 2, 0, 0, rim, height - rim * 2, wallDepth],
        [span / 2 - rim / 2, 0, 0, rim, height - rim * 2, wallDepth]
      ];
      // Continuous track divider on the sill/head (or jambs for a lift sash).
      if (n === 1) {
        for (const u of [-width / 2, width / 2])
          frameBars.push([u, 0, 0, 0.35, insideH, 0.35]);
      } else {
        // Permanent mullions support each sash's hinge and latch.
        for (let i = 1; i < n; i++)
          frameBars.push([-width / 2 + width * i / n, 0, 0, rim, insideH, wallDepth]);
        // Rebate stops bridge the clearance between each sash and the
        // jamb/mullion. Their inside face meets the CLOSED sash's back
        // at wallFace + .35; opening inward pulls the sash away.
        // Overlap the sash rails in projection so oblique views cannot
        // see daylight through a gap behind the floating hinge plane.
        const cell = width / n, pw = cell - rim - 0.3, ph = insideH - 0.2;
        const lip = rail * 0.65, holeH = ph - lip * 2;
        for (let i = 0; i < n; i++) {
          const u = -width / 2 + cell * (i + 0.5);
          const left = i === 0 ? -span / 2 : u - cell / 2;
          const right = i === n - 1 ? span / 2 : u + cell / 2;
          const holeL = u - pw / 2 + lip, holeR = u + pw / 2 - lip;
          const depth = inward * wallDepth / 2, band = (height - holeH) / 2;
          frameBars.push(
            [(left + right) / 2, -(height + holeH) / 4, depth, right - left, band, 0.7],
            [(left + right) / 2, (height + holeH) / 4, depth, right - left, band, 0.7],
            [(left + holeL) / 2, 0, depth, holeL - left, holeH, 0.7],
            [(holeR + right) / 2, 0, depth, right - holeR, holeH, 0.7]
          );
        }
      }
      assembly.frame = bars(root, frameBars);
      const panel = (u, y, pw, ph, moving, du = 0, dy = 0, hinge = 0) => {
        const depth = hinge ? inward * (wallDepth / 2 + 0.95) : moving ? 0.95 : -0.95;
        const pivot = new THREE.Group();
        pivot.position.set(isH ? u : depth, y, isH ? depth : u);
        root.add(pivot);
        const sash = new THREE.Group();
        pivot.add(sash);
        if (hinge) {
          // Put the pin at a stile, keeping all visible parts on the
          // same rotating sash. Pins sit beyond the inside wall face.
          if (isH) { pivot.position.x -= hinge * pw / 2; sash.position.x = hinge * pw / 2; }
          else { pivot.position.z -= hinge * pw / 2; sash.position.z = hinge * pw / 2; }
        }
        // Glass fits INSIDE the sash, rather than overlapping its rails.
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(
          isH ? pw - rail * 2 : 0.3, ph - rail * 2, isH ? 0.3 : pw - rail * 2), paneMat);
        sash.add(leaf);
        const sashBars = [
          [0, -(ph - rail) / 2, 0, pw, rail, 1.2],
          [0, (ph - rail) / 2, 0, pw, rail, 1.2],
          [-(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
          [(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2]
        ];
        // A small pull on each moving sash; no decorative grid obscuring the view.
        if (moving) sashBars.push(n === 1
          ? [0, -ph / 2 + rail, 0.75, 3, 0.45, 0.3]
          : [(hinge || (du > 0 ? 1 : -1)) * (pw - rail) / 2, 0, hinge ? inward * 0.75 : 0.75, 0.45, 3, 0.3]);
        bars(sash, sashBars);
        if (hinge) bars(pivot, [-ph * 0.32, ph * 0.32].map(yh =>
          [0, yh, 0, 0.5, 2, 0.5]));
        const slide = isH ? { x: du, y: dy, z: 0 } : { x: 0, y: dy, z: du };
        const d = { pivot, a, open: 0, target: 0, leaf, lw: pw, li: 0,
          vel: 0, holdT: 0, latched: false, window: true,
          slide: hinge ? null : slide, base: pivot.position.clone(), fixed: !moving,
          casement: !!hinge, hinge, inward, sash,
          swingDir: (isH ? -1 : 1) * inward * hinge,
          ly0: root.position.y + y - ph / 2, ly1: root.position.y + y + ph / 2,
          // Full moving assembly bounds, including its pull handle.
          halfX: (isH ? pw : 1.8) / 2, halfZ: (isH ? 1.8 : pw) / 2, halfY: ph / 2 };
        assembly.panels.push(d);
        if (moving) doorPivots.push(d);
      };
      const ph = insideH - 0.2, overlap = 0.6;
      if (n === 1) {
        const half = insideH / 2;
        panel(0, half / 2 - overlap / 2, width - 0.2, half + overlap - 0.2, false);
        panel(0, -half / 2 + overlap / 2, width - 0.2, half + overlap - 0.2, true, 0, half - overlap);
      } else {
        const cell = width / n;
        for (let i = 0; i < n; i++) {
          panel(-width / 2 + cell * (i + 0.5), 0, cell - rim - 0.3, ph, true,
            0, 0, i === n - 1 ? -1 : 1);
        }
      }
    }
  }

  /* ---- fence gates: real swinging leaves, not permanent holes ---- */
  const gateMat = HP.graphics3d ? HP.graphics3d.material('wood', '#9a774f') :
    new THREE.MeshLambertMaterial({ color: 0x9a774f });
  for (const k in (lvl.fences || {})) {
    const fv = lvl.fences[k];
    if (!fv || fv.t !== 'gate') continue;
    const s = HP.parseWallKey(k), isH = s.d === 'h';
    const gh = 24, gt = 4;
    /* a neighbour gate seg? then hinge at the far end — the pair
       meets in the middle like a double gate                        */
    const nKey = isH ? `h,${s.x + 1},${s.y}` : `v,${s.x},${s.y + 1}`;
    const li = (lvl.fences[nKey] && lvl.fences[nKey].t === 'gate') ? 0 : 1;
    const a = isH
      ? { d: 'h', x0: s.x * C, x1: (s.x + 1) * C, z0: s.y * C - 2, z1: s.y * C + 2, cx: (s.x + 0.5) * C, cz: s.y * C }
      : { d: 'v', x0: s.x * C - 2, x1: s.x * C + 2, z0: s.y * C, z1: (s.y + 1) * C, cx: s.x * C, cz: (s.y + 0.5) * C };
    const pivot = new THREE.Group();
    pivot.position.set(isH ? (li === 0 ? a.x0 : a.x1) : s.x * C, 0,
                       isH ? s.y * C : (li === 0 ? a.z0 : a.z1));
    const lw = C + 0.5, lh3 = gh + 1;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(isH ? lw : gt, lh3, isH ? gt : lw), gateMat);
    leaf.position.set(isH ? (li === 0 ? lw / 2 : -lw / 2) : 0, gh / 2,
                      isH ? 0 : (li === 0 ? lw / 2 : -lw / 2));
    leaf.castShadow = leaf.receiveShadow = true;
    pivot.add(leaf);
    g.add(pivot);
    V.add(pivot, a.x0 - C, a.z0 - C, a.x1 + C, a.z1 + C);
    doorPivots.push({ pivot, a, open: 0, target: 0, leaf, lw, li,
                      vel: 0, holdT: 0, latched: false, gate: true,
                      ly0: 0, ly1: gh });
  }

  /* ---- door leaves: real meshes (they animate) ---- */
  const leafMat = HP.graphics3d ? HP.graphics3d.material('wood', '#cfb394') :
    new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const knobMat = HP.graphics3d ? HP.graphics3d.material('metal', '#5b5f63') :
    new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
  const knobGeo = new THREE.SphereGeometry(1.2, 8, 6);    // was 960 tris per knob
  for (const a of geo.doors) {
    /* usable span excludes corner posts standing at the aperture's
       ends — a leaf sized to the raw aperture would slice through
       them and z-fight (the brown flicker line)                    */
    let s0 = a.d === 'h' ? a.x0 : a.z0, s1 = a.d === 'h' ? a.x1 : a.z1;
    let post0 = false, post1 = false;
    for (const c of geo.boxes) {
      if (c.tag !== 'corner' || c.y0 > 30) continue;
      /* a post matters when it overlaps the doorway's DEPTH and sits
         on/touching either end edge of the opening                */
      const ox = Math.min(c.x1, a.x1) - Math.max(c.x0, a.x0);
      const oz = Math.min(c.z1, a.z1) - Math.max(c.z0, a.z0);
      const depthOverlap = a.d === 'h' ? oz > 0 : ox > 0;
      if (!depthOverlap) continue;
      if (a.d === 'h') { if (c.x1 > a.x0 - 0.6 && c.x0 <= a.x0 + 0.6) { s0 = Math.max(s0, c.x1); post0 = true; }
                         if (c.x0 < a.x1 + 0.6 && c.x1 >= a.x1 - 0.6) { s1 = Math.min(s1, c.x0); post1 = true; } }
      else             { if (c.z1 > a.z0 - 0.6 && c.z0 <= a.z0 + 0.6) { s0 = Math.max(s0, c.z1); post0 = true; }
                         if (c.z0 < a.z1 + 0.6 && c.z1 >= a.z1 - 0.6) { s1 = Math.min(s1, c.z0); post1 = true; } }
    }
    const span = s1 - s0;
    const leaves = a.dbl ? 2 : 1;
    for (let li = 0; li < leaves; li++) {
      /* +1: leaves lap past the far jamb and meet at the centre —
         an inset leaf leaves a slit you can see the sky through.
         NOT past a corner post though — the tip must stop at its
         face or it pokes through and flickers                     */
      const lw = leaves === 2 ? span / 2 + 1
                              : span + (post1 ? 0 : 1);
      const lh = HP.geom3d.DOOR_H + 1;
      /* real leaf: thin (≈18cm), sitting just inside the reveal on the
         swing side, a hair proud of the wall face so the raw jamb
         edge never shows — a slot-deep slab reads as a wall chunk   */
      const dep = 5;
      const pivot = new THREE.Group();
      /* hinge pin at the aperture CORNER on the swing side — the leaf
         folds out of the doorway like a real door, not into the slot */
      pivot.position.set(a.d === 'h' ? (li === 0 ? s0 : s1) : a.x0,
                         0,
                         a.d === 'v' ? (li === 0 ? s0 : s1) : a.z0);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(a.d === 'h' ? lw : dep, lh, a.d === 'h' ? dep : lw), leafMat);
      leaf.position.set(
        a.d === 'h' ? (li === 0 ? lw / 2 : -lw / 2) : dep / 2 - 0.3,
        lh / 2 - 0.5,                      /* sunk 0.5px each end — sealed top+bottom */
        a.d === 'h' ? dep / 2 - 0.3 : (li === 0 ? lw / 2 : -lw / 2));
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);
      const knob = new THREE.Mesh(knobGeo, knobMat);
      knob.position.set(a.d === 'h' ? (li === 0 ? lw - 6 : -lw + 6) : dep - 0.5,
                        27,
                        a.d === 'h' ? dep - 0.5 : (li === 0 ? lw - 6 : -lw + 6));
      pivot.add(knob);
      g.add(pivot);
      V.add(pivot, a.x0 - C, a.z0 - C, a.x1 + C, a.z1 + C);   // swing reach
      /* vel/holdT/latched drive the physics: bump the leaf to swing
         it open, a damped spring pulls it shut behind you, E latches */
      doorPivots.push({ pivot, a, open: 0, target: 0, leaf, knob, lw, li, dep,
                        vel: 0, holdT: 0, latched: false,
                        ly0: 0, ly1: lh });
    }
  }
  V.setWalls(lvl.walls, doorPivots);
  if (HP.graphics3d) HP.graphics3d.applyMaterials(g);
};
function floorQuad() {
  if (!W3._fq) W3._fq = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  return W3._fq;
}
function ceilQuad() {
  if (!W3._cq) W3._cq = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
  return W3._cq;
}

function regionFloorId(x, y, lvl) {
  const { regionOf } = HP.computeRegions();
  if (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) return null;
  const mat = lvl.floors[x + ',' + y];
  if (regionOf[y * HP.GRID_W + x] < 0 && !mat) return null;   // bare outside = ground
  return mat || 'wood';
}
const _fcols = {};
function floorColor(id) {
  if (_fcols[id]) return _fcols[id];
  const m = HP.FLOOR_MATS.find(f => f.id === id);
  return _fcols[id] = m ? m.col : '#c9a877';
}
function unitBox() {
  if (!W3._ub) { W3._ub = new THREE.BoxGeometry(1, 1, 1); }
  return W3._ub;
}
function disposeGroup(gr) {
  const geometries = new Set(), materials = new Set();
  gr.traverse(o => {
    if (o.geometry && o.geometry !== W3._ub) geometries.add(o.geometry);
    if (o.material && !o.material.userData.shared3d) materials.add(o.material);
    if (o.isInstancedMesh && o.dispose) o.dispose();
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => {
    m.dispose();
    const twin = HP.graphics3d && HP.graphics3d.companion(m);
    if (twin && !twin.userData.shared3d) twin.dispose();
  });
}

/* ---------- audit overlay + 3D markers ---------- */
W3.runAudit = function () {
  const { checks } = HP.geom3d.audit(HP.cur().walls, geomEnv());
  if (markerGroup) { W3.levelGroup.remove(markerGroup); markerGroup = null; }
  markerGroup = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55, depthTest: false });
  for (const c of checks) for (const m of c.marks || []) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(
      Math.max(3, m.x1 - m.x0), Math.max(8, m.y1 - m.y0), Math.max(3, m.z1 - m.z0)), mat);
    b.position.set((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, (m.z0 + m.z1) / 2);
    b.renderOrder = 999;
    markerGroup.add(b);
  }
  W3.levelGroup.add(markerGroup);
  return checks;
};

let lastRender = 0;
W3.render = function () {
  if (!renderer) return;
  const p = camera.position, now = performance.now();
  const dt = Math.min(0.1, lastRender ? (now - lastRender) / 1000 : 0); lastRender = now;
  if (HP.cull3d) HP.cull3d.update(p.x, p.z);
  let skyS = null;
  if (HP.sky3d && HP.sky3d.sky) { HP.sky3d.sky.position.copy(p); skyS = tickTime(dt, now); }
  if (HP.graphics3d) HP.graphics3d.animate(now);
  if (HP.life3d && skyS) HP.life3d.tick(dt, now / 1000, skyS, p);
  /* pool water: gentle vertex ripple + caustics fade with the sun    */
  for (const wq of (W3.water || [])) {
    if (wq.pos) {
      const t2 = now / 1000, pos = wq.pos;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, (Math.sin(x * 0.42 + t2 * 1.9) + Math.sin(z * 0.36 + t2 * 2.4))
          * 0.3 * wq.taper[i]);
      }
      pos.needsUpdate = true;
    }
    const co = 0.45 * (skyS ? Math.max(0.06, 1 - skyS.night) : 1);
    for (const cm of wq.caustics) {
      cm.opacity = co;
      const mp = cm.map;
      if (mp) {
        mp.offset.set(Math.sin(now * 0.00013) * 0.09, now * 0.000011 % 1);
        mp.rotation = Math.sin(now * 0.00005) * 0.35;   // sway, don't spin
      }
    }
  }
  if (HP.sound3d && skyS) {
    const C2 = HP.CELL;
    const cx = Math.floor(p.x / C2), cy = Math.floor(p.z / C2);
    const { regionOf } = HP.computeRegions();
    const outside = cx < 0 || cy < 0 || cx >= HP.GRID_W || cy >= HP.GRID_H ||
                    regionOf[cy * HP.GRID_W + cx] === -1;
    const amb2 = (HP.life3d && HP.life3d.ambience) || { water: [], fire: [], fan: [] };
    const near = arr => Math.min(...arr.map(s2 => Math.hypot(s2.x - p.x, s2.z - p.z)), 1e9);
    HP.sound3d.tick(dt, now / 1000, {
      outdoors: outside ? 1 : 0, night: skyS.night, day: skyS.day,
      nearWater: near(amb2.water), nearFire: near(amb2.fire), nearFan: near(amb2.fan),
    });
  }
  if (sun.castShadow) {
    /* shadow box centred a little ahead of the player, snapped to
       whole shadow texels in light space so edges don't shimmer      */
    const R = sun.shadow.camera.right;
    camera.getWorldDirection(_f); _f.y = 0;
    if (_f.lengthSq() > 1e-6) _f.normalize();
    _c.set(p.x, 0, p.z).addScaledVector(_f, R * 0.45);
    _lm.lookAt(sunDir, _zero, _up); _li.copy(_lm).invert();
    _c.applyMatrix4(_li);
    const texel = 2 * R / sun.shadow.mapSize.x;
    _c.x = Math.round(_c.x / texel) * texel; _c.y = Math.round(_c.y / texel) * texel;
    _c.applyMatrix4(_lm);
    sun.target.position.copy(_c);
    sun.position.copy(_c).addScaledVector(sunDir, 1400);
    sun.target.updateMatrixWorld();
  }
  renderer.render(scene, camera);
};
})();
