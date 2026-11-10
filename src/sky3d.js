/* sky3d.js — time of day. Keyframed lighting (sky, sun, ambient, fog),
   sun/moon paths, and a sky dome with sun disc, drifting clouds and stars.
   Pure data + one shader: per-frame cost is a handful of uniform writes. */
window.HP = window.HP || {};
(function () {
const S = HP.sky3d = {};
const C = h => new THREE.Color(h);
/* hour → look. sun = direct light colour/strength while the sun is up;
   amb = hemisphere sky colour/strength (fills shadows, rooms at night) */
const KEYS = [
  { h: 0,    zen: 0x0b1424, hor: 0x1d2a3e, sun: 0x9fb4d8, sunI: 0,    amb: 0x4a5a80, ambI: 0.13, fog: 0x18222f, cloud: 0x2a3446 },
  { h: 4.8,  zen: 0x101b30, hor: 0x2b3550, sun: 0x9fb4d8, sunI: 0,    amb: 0x56688a, ambI: 0.16, fog: 0x232c3d, cloud: 0x343d52 },
  { h: 6,    zen: 0x3e5d86, hor: 0xe9a67c, sun: 0xffa66b, sunI: 0.75, amb: 0xc9b4a6, ambI: 0.55, fog: 0xc9a48c, cloud: 0xf2b490 },
  { h: 7.5,  zen: 0x5d8fbd, hor: 0xf1d2b0, sun: 0xffd9a8, sunI: 1.05, amb: 0xd7e0e8, ambI: 0.80, fog: 0xd8cfbf, cloud: 0xfbe9d8 },
  { h: 12,   zen: 0x5f9cc9, hor: 0xe6e2cf, sun: 0xfff1d8, sunI: 1.20, amb: 0xe0edf1, ambI: 0.92, fog: 0xd4d7c8, cloud: 0xffffff },
  { h: 16,   zen: 0x6599c2, hor: 0xead9bd, sun: 0xffe0b2, sunI: 1.15, amb: 0xe4e4dc, ambI: 0.88, fog: 0xd8d1bf, cloud: 0xfff6e8 },
  { h: 17.8, zen: 0x7c97b2, hor: 0xf5be86, sun: 0xffb36b, sunI: 1.05, amb: 0xe8d4b8, ambI: 0.72, fog: 0xdcb894, cloud: 0xffcf9a },
  { h: 18.8, zen: 0x4b5d86, hor: 0xe88a62, sun: 0xff8a52, sunI: 0.45, amb: 0xb79fa4, ambI: 0.50, fog: 0xa57e70, cloud: 0xe9937a },
  { h: 19.8, zen: 0x1c2846, hor: 0x5a4a63, sun: 0x9fb4d8, sunI: 0,    amb: 0x5f6a90, ambI: 0.22, fog: 0x3a3a4e, cloud: 0x4a4458 },
  { h: 24,   zen: 0x0b1424, hor: 0x1d2a3e, sun: 0x9fb4d8, sunI: 0,    amb: 0x4a5a80, ambI: 0.13, fog: 0x18222f, cloud: 0x2a3446 },
].map(k => ({ ...k, zen: C(k.zen), hor: C(k.hor), sun: C(k.sun), amb: C(k.amb), fog: C(k.fog), cloud: C(k.cloud) }));

const out = { zen: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(),
  amb: new THREE.Color(), fog: new THREE.Color(), cloud: new THREE.Color(),
  sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), lightDir: new THREE.Vector3(),
  lightCol: new THREE.Color(), lightI: 0, ambI: 0, night: 0, day: 0, sunI: 0 };
const MOON = new THREE.Color(0x9fb4d8);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* sun rises in the east (+x), crosses high in the south, sets west     */
S.sample = function (hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0; while (KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a.h) / (b.h - a.h);
  for (const k of ['zen', 'hor', 'sun', 'amb', 'fog', 'cloud']) out[k].copy(a[k]).lerp(b[k], t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.ambI = a.ambI + (b.ambI - a.ambI) * t;
  const az = (h - 6) / 12 * Math.PI, el = Math.sin(az) * 1.13;     // peak ≈ 65°
  out.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), 0.45 * Math.cos(el)).normalize();
  out.moonDir.set(-out.sunDir.x, -out.sunDir.y, 0.35).normalize();
  const elDeg = el * 180 / Math.PI;
  out.day = sstep(-4, 6, elDeg);                 // 1 = sun fully up
  out.night = sstep(2, -9, elDeg);               // 1 = deep night
  if (out.day > 0.001) {                          // sun light (never from below)
    out.lightDir.copy(out.sunDir); out.lightDir.y = Math.max(out.lightDir.y, 0.1);
    out.lightDir.normalize();
    out.lightCol.copy(out.sun); out.lightI = out.sunI * out.day;
  } else {                                        // moonlight: dim, cool
    out.lightDir.copy(out.moonDir); out.lightDir.y = Math.max(out.lightDir.y, 0.3);
    out.lightDir.normalize();
    out.lightCol.copy(MOON); out.lightI = 0.16 * out.night;
  }
  return out;
};
S.clock = h => {
  const hh = Math.floor(((h % 24) + 24) % 24), mm = Math.floor((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
};

/* ---------- sky dome: gradient + sun/moon discs + clouds + stars ---- */
S.uniforms = {
  zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() },
  cloudCol: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) },
  night: { value: 0 }, time: { value: 0 },
};
S.build = function (scene) {
  const sky = S.sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: S.uniforms,
    vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec3 p;
      uniform vec3 zen, hor, cloudCol, sunCol, sunDir, moonDir; uniform float night, time;
      float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a*noise(q); q *= 2.03; a *= .5; } return v; }
      void main(){
        vec3 d = normalize(p);
        float h = smoothstep(-.05, .6, d.y);
        vec3 c = mix(hor, zen, h);
        float s = max(dot(d, sunDir), 0.);
        c += sunCol * (pow(s, 900.) * 6. + pow(s, 12.) * .25) * (1. - night);   // disc + halo
        float m = max(dot(d, moonDir), 0.);
        c += vec3(.85, .9, 1.) * (smoothstep(.9994, .9997, m) * 1.4 + pow(m, 40.) * .08) * night;
        if (d.y > 0.) {                                         // clouds on a flat layer
          vec2 uv = d.xz / (d.y + .12) * 1.4 + vec2(time * .006, time * .002);
          float n = fbm(uv);
          float cov = smoothstep(.52, .78, n) * smoothstep(0., .25, d.y);
          vec3 cc = cloudCol * (.82 + .3 * fbm(uv * 2.3 + 4.));
          c = mix(c, cc, cov * .85);
        }
        gl_FragColor = vec4(c, 1.);
      }` }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);
  /* stars: fixed random points above the horizon, fade in at night   */
  const n = 1400, pos = new Float32Array(n * 3);
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const y = 0.05 + rnd() * 0.95, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * r * 4000; pos[i * 3 + 1] = y * 4000; pos[i * 3 + 2] = Math.sin(a) * r * 4000;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = S.stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0,
    depthWrite: false, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -9;
  sky.add(stars);
  return sky;
};
S.apply = function (s, time) {
  const u = S.uniforms;
  u.zen.value.copy(s.zen); u.hor.value.copy(s.hor); u.cloudCol.value.copy(s.cloud);
  u.sunCol.value.copy(s.sun); u.sunDir.value.copy(s.sunDir); u.moonDir.value.copy(s.moonDir);
  u.night.value = s.night; u.time.value = time;
  if (S.stars) { S.stars.material.opacity = s.night * 0.9; S.stars.visible = s.night > 0.02; }
};
})();
