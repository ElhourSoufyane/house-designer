// Renders every catalog sprite through a mock canvas to catch draw() runtime errors.
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;

function mockCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern')
        return () => grad;
      if (k === 'canvas') return { width: 100, height: 100 };
      if (typeof t[k] !== 'undefined') return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: () => mockCtx(), width: 0, height: 0, toDataURL: () => '' }),
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.requestAnimationFrame = () => {};

for (const f of ['grid.js', 'catalog.js', 'sprites.js'])
  eval(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));

let fail = 0, count = 0;
for (const def of HP.CATALOG) {
  for (let v = 0; v < def.colors.length; v++) {
    try {
      const g = mockCtx();
      def.draw.call(def, g, def.w * 64, def.h * 64, v);
      count++;
    } catch (e) {
      fail++;
      console.log('FAIL', def.id, 'v' + v, '-', e.message);
    }
  }
}
console.log(`${count} sprite variants rendered, ${fail} failed`);
process.exit(fail ? 1 : 0);
