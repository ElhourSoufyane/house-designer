/* Render every floor material through a stub canvas — catches painter errors. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const g = {
  fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
  save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
  setTransform() {}, clearRect() {},
  beginPath() {}, rect() {}, fillRect() {}, strokeRect() {},
  moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {},
  arc() {}, ellipse() {}, closePath() {}, fill() {}, stroke() {},
  createImageData: (w, h) => ({ width: Math.ceil(w), height: Math.ceil(h), data: new Uint8ClampedArray(Math.ceil(w) * Math.ceil(h) * 4) }),
  putImageData() {}, drawImage() {},
};
const ctx = {
  document: {
    createElement: () => ({ getContext: () => g, width: 0, height: 0 }),
    addEventListener: () => {},
  },
  localStorage: { getItem: () => null, setItem: () => {} },
};
ctx.window = ctx;                       // in-browser, window IS the global
vm.createContext(ctx);
for (const f of ['grid.js', 'main.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
const HP = ctx.HP;
HP.CELL = 28; HP.shade = (c) => c;      // helpers living in other files
const errs = [];
for (const m of HP.FLOOR_MATS) {
  try { HP.floorPreview(m.id, 68, 68); }
  catch (e) { errs.push(m.id + ': ' + e.message); }
}
console.log('materials:', HP.FLOOR_MATS.length, 'errors:', errs.length);
if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
