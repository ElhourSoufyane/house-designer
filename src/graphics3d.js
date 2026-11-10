/* Shared, bounded textures and adaptive rendering. No external asset service. */
window.HP = window.HP || {};
(function () {
const G = HP.graphics3d = {};
/* lite = cheap Lambert shading, no shadows/IBL (phones, weak iGPUs).
   far = draw distance (px) for small furniture; big items always draw. */
const presets = G.presets = {
  low: { label: 'Low', dpr: 0.85, texture: 128, anisotropy: 1, detail: false,
         lite: true, shadow: 0, shadowRadius: 0, env: false, far: 520, lamps: 2 },
  medium: { label: 'Balanced', dpr: 1, texture: 256, anisotropy: 2, detail: true,
            lite: false, shadow: 1024, shadowRadius: 380, env: true, far: 950, lamps: 4 },
  high: { label: 'High', dpr: 1.5, texture: 512, anisotropy: 4, detail: true,
          lite: false, shadow: 2048, shadowRadius: 560, env: true, far: 1700, lamps: 6 },
};
const ORDER = ['low', 'medium', 'high'];
const textures = new Map(), materials = new Map();
const liteOf = new WeakMap(), fullOf = new WeakMap();
let renderer, mode = 'auto', tier, slow = 0, fast = 0, settle = 5, resize, photoCount = 0;
G.isMobile = function (nav, coarse) {
  nav = nav || (typeof navigator === 'undefined' ? {} : navigator);
  return !!(coarse || (nav.userAgentData && nav.userAgentData.mobile) ||
    /Android|iPhone|iPad|iPod/i.test(nav.userAgent || '') ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
};
G.deviceTier = function (nav, coarse) {
  const small = (nav.deviceMemory && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
  return G.isMobile(nav, coarse) || small ? 'low' : 'high';
};
/* Auto starts one step below the device ceiling and earns its way up —
   a weak laptop never opens at 8 fps on High                         */
const startTier = cap => cap === 'high' ? 'medium' : 'low';
G.init = function (r, onResize) {
  renderer = r; resize = onResize;
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const coarse = matchMedia('(pointer:coarse)').matches;
  G.touch = G.isMobile(nav, coarse);
  if (document.documentElement) document.documentElement.classList.toggle('touch-controls', G.touch);
  G.initialTier = G.deviceTier(nav, coarse);
  /* which GPU actually renders? Software rasterizers (browser
     hardware acceleration off) can't run shadows/PBR at all         */
  G.gpu = '';
  try {
    const gl = renderer.getContext && renderer.getContext();
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    G.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  } catch (_) {}
  G.software = /swiftshader|llvmpipe|software|basic render/i.test(G.gpu);
  if (G.software) G.initialTier = 'low';
  try { mode = localStorage.getItem('hp_3d_quality') || 'auto'; } catch (_) {}
  if (mode !== 'auto' && !presets[mode]) mode = 'auto';
  apply(mode === 'auto' ? startTier(G.initialTier) : mode);
};
function apply(next) {
  const prev = G.current;
  tier = next; G.current = presets[tier]; G.tier = tier; G.mode = mode;
  const maxDpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  renderer.setPixelRatio(Math.min(maxDpr, G.current.dpr));
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = G.current.shadow > 0;
    renderer.shadowMap.type = tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }
  /* shadow on/off changes shader variants → recompile on next frame  */
  G.shadowChanged = !prev || (prev.shadow > 0) !== (G.current.shadow > 0) || prev.lite !== G.current.lite;
  for (const t of textures.values()) {
    if (t.image && t.image.width > G.current.texture) {
      const c = canvas(G.current.texture);
      if (c) {
        c.getContext('2d').drawImage(t.image, 0, 0, c.width, c.height);
        t.image = c;
      }
    }
    t.anisotropy = Math.min(G.current.anisotropy,
      renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    t.needsUpdate = true;
  }
  if (resize) resize();
  slow = fast = 0; settle = 5;
  if (G.onChange) G.onChange();
}
G.setQuality = function (value) {
  mode = value === 'auto' || presets[value] ? value : 'auto';
  try { localStorage.setItem('hp_3d_quality', mode); } catch (_) {}
  apply(mode === 'auto' ? startTier(G.initialTier) : mode);
};
// Called with a half-second FPS sample, never with individual noisy frames.
G.sample = function (fps, seconds) {
  if (mode !== 'auto' || (typeof document !== 'undefined' && document.hidden)) return;
  if (settle > 0) { settle -= seconds; return; }
  slow = fps < 40 ? slow + seconds : 0;
  fast = fps > 57 ? fast + seconds : 0;
  const index = ORDER.indexOf(tier);
  if (slow >= 2 && index > 0) apply(ORDER[index - 1]);
  // Never auto-promote past the device ceiling (phones stay Low).
  else if (fast >= 8 && index < ORDER.indexOf(G.initialTier)) apply(ORDER[index + 1]);
};
/* cheap Lambert twin of a PBR material — same maps/colour/transparency;
   swapped in on Low so phones skip the PBR fragment shader entirely   */
G.lite = function (full) {
  if (liteOf.has(full)) return liteOf.get(full);
  const l = new THREE.MeshLambertMaterial({
    color: full.color, map: full.map, transparent: full.transparent, opacity: full.opacity,
    depthWrite: full.depthWrite, side: full.side, vertexColors: full.vertexColors });
  if (full.onBeforeCompile) l.onBeforeCompile = full.onBeforeCompile;
  if (full.customProgramCacheKey) l.customProgramCacheKey = full.customProgramCacheKey;
  l.userData.shared3d = full.userData.shared3d;
  liteOf.set(full, l); fullOf.set(l, full);
  return l;
};
G.companion = m => liteOf.get(m) || fullOf.get(m) || null;
G.setMap = function (m, t) {
  for (const x of [m, liteOf.get(m)]) if (x) { x.map = t; x.color.set(0xffffff); x.needsUpdate = true; }
};
/* swap every PBR material ↔ its lite twin for the current tier        */
G.applyMaterials = function (root) {
  const lite = G.current.lite, recompile = G.shadowChanged;
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (lite && m.isMeshStandardMaterial) o.material = G.lite(m);
    else if (!lite && fullOf.has(m)) o.material = fullOf.get(m);
    if (recompile) o.material.needsUpdate = true;
  });
};
/* image-based lighting: prefiltered sky so PBR surfaces pick up soft
   sky light and subtle reflections (built once, rebuilt on lighting)  */
G.environment = function (horizon, zenith, ground) {
  if (!renderer || typeof renderer.getContext !== 'function') return null;
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { h: { value: new THREE.Color(horizon) }, z: { value: new THREE.Color(zenith) },
                g: { value: new THREE.Color(ground) } },
    vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 p; uniform vec3 h; uniform vec3 z; uniform vec3 g; void main(){
      float y = normalize(p).y;
      vec3 c = y > 0. ? mix(h, z, smoothstep(0., .6, y)) : mix(h, g, smoothstep(0., .25, -y));
      gl_FragColor = vec4(c, 1.); }` })));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  if (G.envRT) G.envRT.dispose();
  G.envRT = rt;
  return rt.texture;
};
G.status = () => (mode === 'auto' ? 'Auto / ' : '') + presets[tier || 'low'].label;
G.resetTiming = () => { slow = fast = 0; settle = 5; };
G.animate = function (time) {
  G.wind.value = time * 0.001;
  if (G.waterMap && G.current.detail) {
    G.waterMap.offset.set(Math.sin(time * 0.0003) * 0.06, time * 0.00004 % 1);
  }
  if (G._waterN && G.current.detail) {
    G._waterN.offset.set(time * 0.000021 % 1, Math.sin(time * 0.00022) * 0.05);
  }
};
function canvas(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  return c.getContext && c.getContext('2d') ? c : null;
}
function texture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const size = G.current ? G.current.texture : 256, c = canvas(size);
  if (!c) return null; // Headless physics tests do not need a canvas.
  const ctx = c.getContext('2d');
  let seed = 129;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = kind === 'wood' ? '#b79a77' : kind === 'grass' ? '#788b53' :
    kind === 'fabric' ? '#e3dfd3' : '#eee9df';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 22; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,.09)' : 'rgba(35,28,18,.07)';
    ctx.fillRect(rand() * size, rand() * size, kind === 'wood' ? 1 : 2,
      kind === 'wood' ? 4 + rand() * 40 : 1);
  }
  if (kind === 'wood') {
    ctx.strokeStyle = 'rgba(54,36,22,.28)'; ctx.lineWidth = 1;
    for (let x = 0; x < 4; x++) {
      ctx.strokeRect(x * size / 4, 0, size / 4, size);
      ctx.beginPath(); const y = (x % 2 ? 0.3 : 0.75) * size;
      ctx.moveTo(x * size / 4, y); ctx.lineTo((x + 1) * size / 4, y); ctx.stroke();
    }
  }
  if (kind === 'tile') {
    ctx.strokeStyle = 'rgba(100,95,83,.28)'; ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }
  if (kind === 'art') {
    ctx.fillStyle = '#dfd2b5'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#a85f40'; ctx.beginPath();
    ctx.arc(size * 0.65, size * 0.28, size * 0.19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#566b58'; ctx.beginPath();
    ctx.moveTo(0, size); ctx.lineTo(0, size * 0.7);
    ctx.quadraticCurveTo(size * 0.5, size * 0.2, size, size * 0.65);
    ctx.lineTo(size, size); ctx.fill();
    ctx.fillStyle = '#bda782'; ctx.beginPath();
    ctx.moveTo(0, size); ctx.lineTo(0, size * 0.84);
    ctx.quadraticCurveTo(size * 0.7, size * 0.43, size, size);
    ctx.fill();
  }
  if (kind === 'water') {
    ctx.fillStyle = '#82c3c8'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(239,255,241,.38)'; ctx.lineWidth = 1.4;
    for (let j = -1; j < 14; j++) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 3) {
        const y = j * size / 12 + Math.sin(x / size * Math.PI * 4 + j) * size / 48;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  t.anisotropy = G.current ? G.current.anisotropy : 1;
  textures.set(kind, t); return t;
}
G.material = function (kind, color) {
  const key = kind + ':' + (color || '');
  if (materials.has(key)) return materials.get(key);
  const smooth = /metal|glass|water|ceramic/.test(kind);
  const m = new THREE.MeshStandardMaterial({
    color: color || 0xffffff, roughness: smooth ? 0.27 : 0.86,
    metalness: kind === 'metal' ? 0.45 : 0,
    map: texture(kind === 'art' ? 'art' : kind === 'water' ? 'water' :
      kind === 'wood' ? 'wood' : kind === 'fabric' ? 'fabric' :
      kind === 'grass' ? 'grass' : kind === 'tile' ? 'tile' : 'plaster'),
  });
  /* sky IBL is a fill, not a second sun — keeps shadows readable      */
  m.envMapIntensity = smooth ? 0.9 : 0.5;
  m.userData.envBase = m.envMapIntensity;
  if (kind === 'glass') {
    m.transparent = true; m.opacity = 0.28; m.depthWrite = false;
    m.side = THREE.DoubleSide;
    m.emissive.set(0xffc27a); m.emissiveIntensity = 0;   // warm glow at night
    m.userData.nightGlow = 0.55;
  }
  if (kind === 'glow') {                                  // lamp shades
    m.emissive.set(0xffa64d); m.emissiveIntensity = 0;
    m.userData.nightGlow = 1.3;
  }
  if (kind === 'water') {
    G.waterMap = m.map;
    m.bumpMap = m.map; m.bumpScale = 0.8; m.roughness = 0.08;   // moving sun glints
  }
  m.userData.shared3d = true;
  materials.set(key, m); return m;
};
/* tileable ripple normal map — a few integer-frequency sine waves so
   the edges wrap; the gradient of that heightfield becomes RGB         */
function waterNormal() {
  const key = 'waterNormal';
  if (textures.has(key)) return textures.get(key);
  const size = 128, c = canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  const H = (x, y) =>
    Math.sin(x / size * Math.PI * 6) * Math.cos(y / size * Math.PI * 4) * 0.55 +
    Math.sin(x / size * Math.PI * 10 + y / size * Math.PI * 4) * 0.3 +
    Math.cos(x / size * Math.PI * 4 - y / size * Math.PI * 12) * 0.35;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = H((x + 1) % size, y) - H((x + size - 1) % size, y);
    const dy = H(x, (y + 1) % size) - H(x, (y + size - 1) % size);
    const i = (y * size + x) * 4;
    img.data[i]     = Math.max(0, Math.min(255, 128 - dx * 700));
    img.data[i + 1] = Math.max(0, Math.min(255, 128 - dy * 700));
    img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  G._waterN = t;
  textures.set(key, t); return t;
}
/* pool caustics — the dancing light-web on the floor is a Voronoi edge
   field: bright where the 1st/2nd nearest feature points are tied      */
function causticTexture() {
  const key = 'caustics';
  if (textures.has(key)) return textures.get(key);
  const size = 256, c = canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  let seed = 77;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pts = [];
  for (let i = 0; i < 34; i++) pts.push([rand(), rand()]);
  /* toroidal distance so the tile wraps */
  const d2 = (x, y, p) => {
    let dx = Math.abs(x - p[0]); if (dx > 0.5) dx = 1 - dx;
    let dy = Math.abs(y - p[1]); if (dy > 0.5) dy = 1 - dy;
    return dx * dx + dy * dy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let f1 = 9, f2 = 9;
    for (const p of pts) { const d = d2(u, v, p); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    const edge = Math.sqrt(f2) - Math.sqrt(f1);            // ≈0 at cell borders
    const w = Math.max(0, 1 - edge * 9);
    const b = Math.min(255, Math.pow(w, 5) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);                          // rotate around the tile centre
  G._caustics = t;
  textures.set(key, t); return t;
}
/* pool water surface: transparent so the tiled floor shows through,
   normal-map ripples + env glints on PBR tiers; Lambert fallback still
   gets vertex waves + transparency so it reads as water on Low        */
G.poolWater = function () {
  const surf = G.current.lite ?
    new THREE.MeshLambertMaterial({ color: 0x2e9cc4, transparent: true, opacity: 0.5 }) :
    new THREE.MeshStandardMaterial({
      color: 0x1e8fb9, transparent: true, opacity: 0.38, roughness: 0.06, metalness: 0,
      normalMap: waterNormal(), envMapIntensity: 1.1,
    });
  if (surf.normalScale) surf.normalScale.set(0.45, 0.45);
  surf.depthWrite = false; surf.side = THREE.DoubleSide;
  surf.userData.shared3d = false;
  const caustic = new THREE.MeshBasicMaterial({
    map: causticTexture(), transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fdcff,
  });
  caustic.userData.shared3d = false;
  const basin = G.worldUV(G.material('tile', '#93d2dd').clone(), 7);
  basin.userData.shared3d = false;
  basin.side = THREE.DoubleSide;                   // basin wall planes face inward
  return { surf, caustic, basin };
};
/* same look as G.material, but tinted per vertex — used by baked
   (merged) furniture where each part carries its own colour           */
G.vertexColorMaterial = function (kind, color) {
  const key = 'vc:' + kind + ':' + (color || '');
  if (materials.has(key)) return materials.get(key);
  const m = G.material(kind, color).clone();
  m.vertexColors = true;
  m.userData.shared3d = true;
  if (kind === 'foliage') G.windify(m);
  materials.set(key, m); return m;
};
/* ---------- living-world hooks ---------- */
G.wind = { value: 0 };
/* leaves sway: displacement grows with height above the ground, phase
   varies across the yard so plants don't move in lockstep            */
G.windify = function (m) {
  m.onBeforeCompile = shader => {
    shader.uniforms.uWind = G.wind;
    shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 wp = transformed;
      #ifdef USE_INSTANCING
        wp = (instanceMatrix * vec4(transformed, 1.)).xyz;
      #endif
      float hw = clamp(wp.y / 40., 0., 1.); hw *= hw;
      transformed.x += (sin(uWind * 1.6 + wp.x * .045 + wp.z * .03) + .5 * sin(uWind * 2.9 + wp.z * .08)) * 1.3 * hw;
      transformed.z += cos(uWind * 1.3 + wp.x * .05) * .9 * hw;`);
  };
  m.customProgramCacheKey = () => 'wind';
  return m;
};
const tracked = new Set();          // per-level clones (walls, ground…) — cleared each build
G.track = m => { tracked.add(m); return m; };
G.untrackAll = () => tracked.clear();
const eachPBR = fn => { for (const m of materials.values()) fn(m); for (const m of tracked) fn(m); };
/* sky reflections fade with daylight — no environment rebuild needed  */
G.setEnvScale = f => eachPBR(m => {
  if (m.userData.envBase !== undefined) m.envMapIntensity = m.userData.envBase * f;
});
/* lamp shades and window glass glow after dark                        */
G.setNight = n => eachPBR(m => {
  if (!m.userData.nightGlow) return;
  m.emissiveIntensity = m.userData.nightGlow * n;
  const l = liteOf.get(m);
  if (l) { l.emissive.copy(m.emissive); l.emissiveIntensity = m.emissiveIntensity; }
});
// World-space UVs keep grain and plaster the same scale on long wall instances.
G.worldUV = function (mat, scale) {
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vSurfaceP; varying vec3 vSurfaceN;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vec4 surfaceP = vec4(transformed, 1.0);
      vec3 surfaceN = normal;
      #ifdef USE_INSTANCING
        surfaceP = instanceMatrix * surfaceP;
        surfaceN = mat3(instanceMatrix) * surfaceN;
      #endif
      vSurfaceP = (modelMatrix * surfaceP).xyz;
      vSurfaceN = normalize(mat3(modelMatrix) * surfaceN);
    `);
    shader.fragmentShader = 'varying vec3 vSurfaceP; varying vec3 vSurfaceN;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 n = abs(vSurfaceN);
        vec2 uv = n.y > n.x && n.y > n.z ? vSurfaceP.xz :
          (n.x > n.z ? vSurfaceP.zy : vSurfaceP.xy);
        diffuseColor *= texture2D(map, uv / ${Number(scale).toFixed(3)});
      #endif
    `);
  };
  mat.customProgramCacheKey = () => 'world-uv-' + scale;
  return mat;
};
G.floorMaterial = function (id) {
  const def = HP.FLOOR_MATS.find(m => m.id === id);
  const family = def ? def.fam || def.grp || id : id;
  const kind = /wood|walnut|parquet|deck|bamboo|laminate|herring/.test(family) ? 'wood' :
    /grass/.test(family) ? 'grass' : /carpet|tatami|gym|foam/.test(family) ? 'fabric' : 'tile';
  const key = 'floor:' + id;
  if (materials.has(key)) return materials.get(key);
  const m = G.material(kind, (def && def.col) || '#c9a877').clone();
  m.userData.shared3d = true;
  G.worldUV(m, /wood|fabric/.test(kind) ? HP.CELL * 2 : HP.CELL);
  materials.set(key, m);
  // Use local photos, downsample before GPU upload; procedural map remains on error.
  if (typeof Image !== 'undefined' && photoCount < 24 && !/^grass[A-DF]$/.test(id)) {
    photoCount++;
    const image = new Image();
    image.onload = () => {
      const c = canvas(G.current.texture);
      if (!c) return;
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      t.anisotropy = G.current.anisotropy;
      textures.set(key, t); G.setMap(m, t);
      image.onload = image.onerror = null;
    };
    image.onerror = () => { image.onload = image.onerror = null; };
    image.src = 'textures/' + (id === 'grassE' ? 'grassE' : id) + '.jpg';
  }
  return m;
};
G.contactMaterial = function () {
  if (G._contact) return G._contact;
  const c = canvas(64);
  let map = null;
  if (c) {
    const ctx = c.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    grad.addColorStop(0, 'rgba(32,25,16,.38)');
    grad.addColorStop(0.55, 'rgba(32,25,16,.18)');
    grad.addColorStop(1, 'rgba(32,25,16,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    map = new THREE.CanvasTexture(c);
  }
  G._contact = new THREE.MeshBasicMaterial({ map, color: 0x514333,
    transparent: true, opacity: map ? 0.65 : 0, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -1 });
  G._contact.userData.shared3d = true;
  return G._contact;
};
})();
