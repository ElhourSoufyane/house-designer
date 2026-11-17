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
  const size = Math.max(512, G.current ? G.current.texture : 512), c = canvas(size);
  if (!c) return null; // Headless physics tests do not need a canvas.
  const ctx = c.getContext('2d');
  let seed = 129;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  if (kind === 'brick') {
    // Ultra-realistic architectural running-bond clay brick masonry
    // 1. Natural coarse sandy cementitious mortar bed
    ctx.fillStyle = '#c5beaf';
    ctx.fillRect(0, 0, size, size);
    // Sandy aggregate particles & mineral specks in mortar bed
    for (let i = 0; i < size * 16; i++) {
      const gRand = rand();
      ctx.fillStyle = gRand > 0.65 ? 'rgba(255,255,255,0.32)'
        : (gRand > 0.3 ? 'rgba(65,55,45,0.16)' : 'rgba(150,140,125,0.22)');
      ctx.fillRect(rand() * size, rand() * size, 1.2, 1.2);
    }

    // 2. 26 courses of architectural stretcher bricks (8 bricks across = 2.0m x 2.0m wall repeat)
    // 8 bricks across & 26 rows ensures 100% mathematically seamless tiling horizontally & vertically!
    const cols = 8, rows = 26;
    const brickW = size / cols;
    const rowH = size / rows;
    const mortarY = Math.max(2.5, rowH * 0.125);
    const mortarX = Math.max(2.8, brickW * 0.045);
    const bw = brickW - mortarX;
    const bh = rowH - mortarY;
    const cr = Math.min(3.0, bh * 0.12);

    // Rich, authentic kiln-fired clay & shale brick palette
    const brickPal = [
      '#833223', '#8d3727', '#973e2d', '#782a1d', '#a04533',
      '#883424', '#702519', '#933b2b', '#a64b37', '#622014',
      '#51190f', '#41130c', '#592116', // prized kiln-flashed / iron-burnt clinkers
      '#a8523e', '#954331', '#853525'  // weathered warm terracotta
    ];

    const drawBrick = (bx, by, col, bRand) => {
      // Ambient occlusion in joint around brick perimeter
      ctx.fillStyle = 'rgba(30,22,15,0.25)';
      ctx.fillRect(bx - mortarX * 0.35, by - mortarY * 0.3, bw + mortarX * 0.7, bh + mortarY * 0.6);

      // Base brick face with organic rounded corners
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, cr);
      else ctx.rect(bx, by, bw, bh);

      // Subtle kiln firing gradient across brick face
      let num = parseInt(col.slice(1), 16);
      let r0 = (num >> 16) & 255, g0 = (num >> 8) & 255, b0 = num & 255;
      const shadeFact = 0.82 + bRand() * 0.36;
      let r1 = Math.min(255, Math.max(0, Math.round(r0 * shadeFact)));
      let g1 = Math.min(255, Math.max(0, Math.round(g0 * shadeFact)));
      let b1 = Math.min(255, Math.max(0, Math.round(b0 * shadeFact)));

      const grad = ctx.createLinearGradient(bx, by, bx + bw, by + (bRand() - 0.5) * bh);
      grad.addColorStop(0, col);
      grad.addColorStop(1, `rgb(${r1},${g1},${b1})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle clay extrusion stratification flow lines
      ctx.fillStyle = bRand() > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.035)';
      for (let k = 0; k < 2; k++) {
        const sy = by + (k + 1) * (bh / 3) + (bRand() - 0.5) * 1.5;
        ctx.fillRect(bx, sy, bw, 1.2);
      }

      // Natural porous clay grain and sand specks
      for (let k = 0; k < bw * 0.3; k++) {
        const pRand = bRand();
        ctx.fillStyle = pRand > 0.6 ? 'rgba(255,255,255,0.14)'
          : (pRand > 0.25 ? 'rgba(40,20,12,0.12)' : 'rgba(180,100,60,0.15)');
        ctx.fillRect(bx + bRand() * bw, by + bRand() * bh, 1.2, 1.2);
      }

      // Occasional dark iron kiln flecks
      if (bRand() > 0.4) {
        ctx.fillStyle = 'rgba(25,10,6,0.35)';
        const spots = Math.floor(1 + bRand() * 4);
        for (let s = 0; s < spots; s++) {
          ctx.fillRect(bx + bRand() * bw, by + bRand() * bh, 1.4, 1.4);
        }
      }

      // Soft perimeter edge feathering (gentle organic pillowed relief, NO fake harsh 3D bevels!)
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, cr);
      else ctx.rect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.stroke();
    };

    for (let r = 0; r < rows; r++) {
      const y = r * rowH + mortarY / 2;
      const offset = (r % 2) * (brickW / 2);
      for (let x = offset - brickW; x < size + brickW; x += brickW) {
        // Deterministic seed per brick grid index ensuring 100% seamless tile wraps
        const colIndex = ((Math.round((x - offset) / brickW) % cols) + cols) % cols;
        let bSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
        const bRand = () => { bSeed = (bSeed * 1664525 + 1013904223) >>> 0; return bSeed / 4294967296; };
        const col = brickPal[Math.floor(bRand() * brickPal.length)];

        drawBrick(x, y, col, bRand);

        // Seamless wrap handling
        if (x < 0) {
          let wrapSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
          const wrapRand = () => { wrapSeed = (wrapSeed * 1664525 + 1013904223) >>> 0; return wrapSeed / 4294967296; };
          wrapRand(); // advance past col pick
          drawBrick(x + size, y, col, wrapRand);
        } else if (x + bw > size) {
          let wrapSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
          const wrapRand = () => { wrapSeed = (wrapSeed * 1664525 + 1013904223) >>> 0; return wrapSeed / 4294967296; };
          wrapRand(); // advance past col pick
          drawBrick(x - size, y, col, wrapRand);
        }
      }
    }
  } else if (kind === 'stone') {
    // Ultra-realistic luxury architectural ashlar limestone / quarried stacked masonry
    // 1. Sandy limestone mortar background bed
    ctx.fillStyle = '#d8d2c6';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 10; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(70,58,45,0.08)';
      ctx.fillRect(rand() * size, rand() * size, 1.2, 1.2);
    }

    // 2. 6 architectural courses of quarried ashlar stones with natural varied widths
    const rows = 6, rowH = size / rows, mortar = 2.0;
    // Rich, warm, luminous natural stone palette (limestone, sandstone, soft warm travertine)
    // High luminosity (avg ~0.90) so multiplying with any object color produces rich, natural stone tones!
    const stonePal = [
      '#f2ece1', '#ede6dc', '#e6dfd3', '#f5efe5',
      '#ded6c9', '#e9e2d5', '#e3dbce', '#ebd8c9'
    ];

    for (let r = 0; r < rows; r++) {
      const y = r * rowH + mortar / 2;
      const h = rowH - mortar;
      let x = -((r * 73) % 90);
      while (x < size + 120) {
        // Vary stone widths naturally (some long stretchers, some shorter headers)
        const sw = (size / 3.4) * (0.65 + rand() * 0.75);
        const col = stonePal[Math.floor(rand() * stonePal.length)];
        const bw = sw - mortar;

        // Base stone block with subtle rounded dressed edges
        ctx.fillStyle = col;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, h, 2.5);
        else ctx.rect(x, y, bw, h);
        ctx.fill();

        // Delicate organic sedimentary strata (wavy horizontal mineral veins)
        for (let v = 0; v < 3; v++) {
          const vy = y + (v + 1) * (h / 4) + (rand() - 0.5) * 4;
          ctx.strokeStyle = rand() > 0.5 ? 'rgba(80,65,45,0.05)' : 'rgba(255,255,255,0.10)';
          ctx.lineWidth = 1.0 + rand() * 1.5;
          ctx.beginPath();
          ctx.moveTo(x, vy);
          ctx.quadraticCurveTo(x + bw * 0.5, vy + (rand() - 0.5) * 3, x + bw, vy);
          ctx.stroke();
        }

        // Microscopic stone pore and mineral grain
        for (let g = 0; g < bw * 0.35; g++) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(50,38,25,0.06)';
          ctx.fillRect(x + rand() * bw, y + rand() * h, 1.2, 1.2);
        }

        // Soft dressed stone top/left edge light reflection
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x, y, bw, 1.2);
        ctx.fillRect(x, y, 1.2, h);

        // Soft natural bottom/right joint ambient occlusion
        ctx.fillStyle = 'rgba(40,30,20,0.16)';
        ctx.fillRect(x, y + h - 1.2, bw, 1.2);
        ctx.fillRect(x + bw - 1.2, y, 1.2, h);

        x += sw;
      }
    }
  } else if (kind === 'wood') {
    // Ultra-realistic vertical architectural timber cladding
    const planks = 8, pW = size / planks;
    const woodPal = ['#b7956f', '#c19f79', '#ab8a64', '#bd9c75', '#a5845e', '#ba9872'];
    for (let p = 0; p < planks; p++) {
      const px = p * pW;
      ctx.fillStyle = woodPal[p % woodPal.length];
      ctx.fillRect(px, 0, pW, size);
      // Fine wood grain fibers
      for (let g = 0; g < 35; g++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(70,45,22,0.12)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(px + rand() * pW, 0, 1.2, size);
      }
      // V-groove shadow between planks
      ctx.fillStyle = 'rgba(35,20,10,0.65)';
      ctx.fillRect(px + pW - 2, 0, 2, size);
      // Edge bevel highlight
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(px, 0, 1.2, size);
    }
  } else if (kind === 'tile') {
    // Luxury ceramic subway tiles
    ctx.fillStyle = '#b6b0a4'; // Grout bed
    ctx.fillRect(0, 0, size, size);
    const rows = 12, cols = 6, tW = size / cols, tH = size / rows, grout = 2.4;
    for (let r = 0; r < rows; r++) {
      const y = r * tH + grout / 2;
      const h = tH - grout;
      const offset = (r % 2) * (tW / 2);
      for (let x = offset - tW; x < size + tW; x += tW) {
        ctx.fillStyle = '#f4efe6';
        ctx.fillRect(x, y, tW - grout, h);
        // Glossy bevel highlight
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x, y, tW - grout, 1.5);
        ctx.fillRect(x, y, 1.5, h);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, y + h - 1.5, tW - grout, 1.5);
        ctx.fillRect(x + tW - grout - 1.5, y, 1.5, h);
      }
    }
  } else if (kind === 'art') {
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
  } else if (kind === 'water') {
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
  } else {
    // Plaster / Default wall
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 18; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,.14)' : 'rgba(40,32,22,.06)';
      ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  t.anisotropy = G.current ? G.current.anisotropy : 1;
  textures.set(kind, t); return t;
}

function bumpTexture(kind) {
  const key = 'bump_' + kind;
  if (textures.has(key)) return textures.get(key);
  const size = Math.max(512, G.current ? G.current.texture : 512), c = canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d');
  let seed = 129;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  if (kind === 'brick') {
    // Ultra-smooth architectural bump map: soft recessed mortar (#4a4a4a), raised tactile brick face (#c8c8c8)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 0, size, size);

    // Sandy aggregate micro-roughness in mortar joints
    for (let i = 0; i < size * 10; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#585858' : '#3e3e3e';
      ctx.fillRect(rand() * size, rand() * size, 1.2, 1.2);
    }

    const cols = 8, rows = 26;
    const brickW = size / cols;
    const rowH = size / rows;
    const mortarY = Math.max(2.5, rowH * 0.125);
    const mortarX = Math.max(2.8, brickW * 0.045);
    const bw = brickW - mortarX;
    const bh = rowH - mortarY;
    const cr = Math.min(3.0, bh * 0.12);

    const drawBumpBrick = (bx, by, bRand) => {
      // Base raised brick face with soft chamfered transition
      ctx.fillStyle = '#b6b6b6';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, cr);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();

      // Raised plateau
      const pad = Math.min(2.0, Math.min(bw, bh) * 0.08);
      ctx.fillStyle = '#cccccc';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx + pad, by + pad, bw - pad * 2, bh - pad * 2, cr * 0.7);
      else ctx.rect(bx + pad, by + pad, bw - pad * 2, bh - pad * 2);
      ctx.fill();

      // Gentle organic clay surface clefts
      for (let k = 0; k < 2; k++) {
        const cy = by + pad + bRand() * (bh - pad * 2);
        ctx.fillStyle = 'rgba(140,140,140,0.22)';
        ctx.fillRect(bx + pad, cy, bw - pad * 2, 1.2);
      }

      // Micro surface clay pores
      for (let k = 0; k < 12; k++) {
        ctx.fillStyle = bRand() > 0.5 ? '#dedede' : '#9a9a9a';
        ctx.fillRect(bx + bRand() * bw, by + bRand() * bh, 1.2, 1.2);
      }
    };

    for (let r = 0; r < rows; r++) {
      const y = r * rowH + mortarY / 2;
      const offset = (r % 2) * (brickW / 2);
      for (let x = offset - brickW; x < size + brickW; x += brickW) {
        const colIndex = ((Math.round((x - offset) / brickW) % cols) + cols) % cols;
        let bSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
        const bRand = () => { bSeed = (bSeed * 1664525 + 1013904223) >>> 0; return bSeed / 4294967296; };

        drawBumpBrick(x, y, bRand);

        if (x < 0) {
          let wrapSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
          const wrapRand = () => { wrapSeed = (wrapSeed * 1664525 + 1013904223) >>> 0; return wrapSeed / 4294967296; };
          drawBumpBrick(x + size, y, wrapRand);
        } else if (x + bw > size) {
          let wrapSeed = (r * 7919 + colIndex * 6271 + 3821) >>> 0;
          const wrapRand = () => { wrapSeed = (wrapSeed * 1664525 + 1013904223) >>> 0; return wrapSeed / 4294967296; };
          drawBumpBrick(x - size, y, wrapRand);
        }
      }
    }
  } else if (kind === 'stone') {
    // Ultra-smooth architectural bump map: soft recessed mortar (#686868), raised dressed stone face (#dedede)
    ctx.fillStyle = '#686868';
    ctx.fillRect(0, 0, size, size);
    const rows = 6, rowH = size / rows, mortar = 2.0;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH + mortar / 2, h = rowH - mortar;
      let x = -((r * 73) % 90);
      while (x < size + 120) {
        const sw = (size / 3.4) * (0.65 + rand() * 0.75);
        const bw = sw - mortar;

        // Base stone height with subtle chamfered edge falloff
        ctx.fillStyle = '#c4c4c4';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, h, 2.5);
        else ctx.rect(x, y, bw, h);
        ctx.fill();

        // Raised plateau
        const pad = Math.min(3, Math.min(bw, h) * 0.12);
        ctx.fillStyle = '#dcdcdc';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x + pad, y + pad, bw - pad * 2, h - pad * 2, 2);
        else ctx.rect(x + pad, y + pad, bw - pad * 2, h - pad * 2);
        ctx.fill();

        // Subtle organic surface cleft variation
        for (let k = 0; k < 2; k++) {
          const cy = y + pad + rand() * (h - pad * 2);
          ctx.fillStyle = 'rgba(125,125,125,0.25)';
          ctx.fillRect(x + pad, cy, bw - pad * 2, 1.2);
        }

        x += sw;
      }
    }
  } else if (kind === 'wood') {
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, 0, size, size);
    const planks = 8, pW = size / planks;
    for (let p = 0; p < planks; p++) {
      const px = p * pW;
      ctx.fillStyle = '#080808';
      ctx.fillRect(px + pW - 2.5, 0, 2.5, size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, 0, 1.5, size);
    }
  } else if (kind === 'tile') {
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, size, size);
    const rows = 12, cols = 6, tW = size / cols, tH = size / rows, grout = 2.4;
    for (let r = 0; r < rows; r++) {
      const y = r * tH + grout / 2, h = tH - grout;
      const offset = (r % 2) * (tW / 2);
      for (let x = offset - tW; x < size + tW; x += tW) {
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(x, y, tW - grout, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1.5, y + 1.5, tW - grout - 3, h - 3);
      }
    }
  } else {
    // Plaster subtle stipple
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 12; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#999999' : '#666666';
      ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  t.anisotropy = G.current ? G.current.anisotropy : 1;
  textures.set(key, t); return t;
}

G.material = function (kind, color) {
  const key = kind + ':' + (color || '');
  if (materials.has(key)) return materials.get(key);
  const smooth = /metal|glass|water|ceramic/.test(kind);
  const m = new THREE.MeshStandardMaterial({
    color: color || 0xffffff,
    roughness: kind === 'glass' ? 0.04 : (smooth ? 0.22 : (kind === 'stone' ? 0.76 : (kind === 'brick' ? 0.90 : (kind === 'wood' ? 0.58 : 0.82)))),
    metalness: kind === 'metal' ? 0.55 : (kind === 'glass' ? 0.12 : 0),
    map: texture(kind === 'art' ? 'art' : kind === 'water' ? 'water' :
      kind === 'wood' ? 'wood' : kind === 'fabric' ? 'fabric' :
      kind === 'grass' ? 'grass' : kind === 'tile' ? 'tile' :
      kind === 'brick' ? 'brick' : kind === 'stone' ? 'stone' : 'plaster'),
  });
  /* sky IBL is a fill, not a second sun — keeps shadows readable      */
  m.envMapIntensity = kind === 'glass' ? 1.4 : (smooth ? 0.95 : (kind === 'stone' ? 0.65 : (kind === 'brick' ? 0.45 : 0.5)));
  m.userData.envBase = m.envMapIntensity;
  if (kind === 'brick' || kind === 'stone' || kind === 'wood' || kind === 'tile') {
    m.bumpMap = bumpTexture(kind);
    m.bumpScale = kind === 'stone' ? 0.18 : (kind === 'brick' ? 0.10 : (kind === 'wood' ? 0.18 : 0.25));
  }
  if (kind === 'glass') {
    m.transparent = true; m.opacity = 0.26; m.depthWrite = false;
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
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', `
      #ifdef USE_BUMPMAP
        uniform sampler2D bumpMap;
        uniform float bumpScale;
        vec2 dHdxy_fwd() {
          vec3 n = abs(vSurfaceN);
          vec2 uv = (n.y > n.x && n.y > n.z ? vSurfaceP.xz : (n.x > n.z ? vSurfaceP.zy : vSurfaceP.xy)) / ${Number(scale).toFixed(3)};
          vec2 dSTdx = dFdx(uv);
          vec2 dSTdy = dFdy(uv);
          float Hll = bumpScale * texture2D(bumpMap, uv).x;
          float dBx = bumpScale * texture2D(bumpMap, uv + dSTdx).x - Hll;
          float dBy = bumpScale * texture2D(bumpMap, uv + dSTdy).x - Hll;
          return vec2(dBx, dBy);
        }
        vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
          vec3 vSigmaX = dFdx(surf_pos);
          vec3 vSigmaY = dFdy(surf_pos);
          vec3 vN = surf_norm;
          vec3 R1 = cross(vSigmaY, vN);
          vec3 R2 = cross(vN, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          return normalize(abs(fDet) * surf_norm - vGrad);
        }
      #endif
    `);
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
