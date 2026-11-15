const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG encoder in pure Node
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      let bit = (crc ^ byte) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rawRows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawRows[(width * 4 + 1) * y] = 0; // filter none
    rgbaBuffer.copy(rawRows, (width * 4 + 1) * y + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(rawRows, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Windows .ico encoder containing multiple PNGs
function encodeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  const datas = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    const w = item.width >= 256 ? 0 : item.width;
    const h = item.height >= 256 ? 0 : item.height;
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    datas.push(item.png);
    offset += item.png.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

// Procedural renderer for isometric House Designer icon
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size / 512; // scale factor

  function setPixel(x, y, r, g, b, a = 1) {
    if (x < 0 || x >= size || y < 0 || y >= size || a <= 0) return;
    const idx = (y * size + x) * 4;
    if (a >= 1) {
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    } else {
      const srcA = a;
      const dstA = buf[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
        buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
        buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
        buf[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  // Draw smooth rounded squircle background
  const rCorner = 110 * s;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      if (x < rCorner) dx = rCorner - x;
      else if (x > size - 1 - rCorner) dx = x - (size - 1 - rCorner);
      if (y < rCorner) dy = rCorner - y;
      else if (y > size - 1 - rCorner) dy = y - (size - 1 - rCorner);

      const dist = Math.hypot(dx, dy);
      if (dist <= rCorner) {
        let alpha = 1;
        if (dist > rCorner - 1) alpha = rCorner - dist; // antialias edge
        // Gradient: Indigo #1e1b4b (top-left) to deep violet #4338ca (bottom-right)
        const t = (x + y) / (size * 2);
        const red = Math.round(30 + t * 37);
        const green = Math.round(27 + t * 29);
        const blue = Math.round(75 + t * 127);
        setPixel(x, y, red, green, blue, alpha);

        // Subtle inner rim glow
        if (dist >= rCorner - 3 || x <= 3 || y <= 3 || x >= size - 4 || y >= size - 4) {
          setPixel(x, y, 255, 255, 255, alpha * 0.18);
        }
      }
    }
  }

  // Helper: polygon fill with antialiasing
  function fillPoly(points, r, g, b, alpha = 1) {
    let minX = size, maxX = 0, minY = size, maxY = 0;
    const pts = points.map(([px, py]) => [px * s, py * s]);
    for (const [px, py] of pts) {
      if (px < minX) minX = Math.floor(px);
      if (px > maxX) maxX = Math.ceil(px);
      if (py < minY) minY = Math.floor(py);
      if (py > maxY) maxY = Math.ceil(py);
    }
    minX = Math.max(0, minX); maxX = Math.min(size - 1, maxX);
    minY = Math.max(0, minY); maxY = Math.min(size - 1, maxY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Point in polygon (ray casting with subpixel sampling 2x2)
        let insideCount = 0;
        for (const [subX, subY] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const testX = x + subX, testY = y + subY;
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1];
            const xj = pts[j][0], yj = pts[j][1];
            const intersect = ((yi > testY) !== (yj > testY)) &&
              (testX < (xj - xi) * (testY - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) insideCount++;
        }
        if (insideCount > 0) {
          setPixel(x, y, r, g, b, alpha * (insideCount / 4));
        }
      }
    }
  }

  // Helper: circle fill
  function fillCircle(cx, cy, radius, r, g, b, alpha = 1) {
    const rx = cx * s, ry = cy * s, rad = radius * s;
    const minX = Math.max(0, Math.floor(rx - rad - 1));
    const maxX = Math.min(size - 1, Math.ceil(rx + rad + 1));
    const minY = Math.max(0, Math.floor(ry - rad - 1));
    const maxY = Math.min(size - 1, Math.ceil(ry + rad + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x + 0.5 - rx, y + 0.5 - ry);
        if (d <= rad) {
          let a = alpha;
          if (d > rad - 1) a *= (rad - d);
          setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  // 1. Blueprint Grid Lines (subtle isometric lines)
  function drawIsoLine(x1, y1, x2, y2, r, g, b, a) {
    const dx = (x2 - x1) * s, dy = (y2 - y1) * s;
    const steps = Math.ceil(Math.hypot(dx, dy) * 1.5);
    for (let i = 0; i <= steps; i++) {
      const px = Math.round((x1 * s) + dx * (i / steps));
      const py = Math.round((y1 * s) + dy * (i / steps));
      setPixel(px, py, r, g, b, a);
    }
  }
  drawIsoLine(256, 330, 380, 400, 165, 180, 252, 0.22);
  drawIsoLine(380, 400, 256, 470, 165, 180, 252, 0.22);
  drawIsoLine(256, 470, 132, 400, 165, 180, 252, 0.22);
  drawIsoLine(132, 400, 256, 330, 165, 180, 252, 0.22);

  // 2. Foundation Plinth
  fillPoly([[256, 350], [366, 288], [256, 226], [146, 288]], 248, 250, 252, 0.95);
  fillPoly([[146, 288], [256, 350], [256, 372], [146, 310]], 203, 213, 225, 0.95);
  fillPoly([[256, 350], [366, 288], [366, 310], [256, 372]], 148, 163, 184, 0.95);

  // 3. Walls
  // Left Wall (Lit warm cream)
  fillPoly([[160, 278], [256, 334], [256, 206], [160, 150]], 254, 243, 199, 1.0);
  // Right Wall (Warm shaded cedar)
  fillPoly([[256, 334], [352, 278], [352, 150], [256, 206]], 217, 119, 6, 1.0);

  // 4. Front Gables
  fillPoly([[160, 150], [256, 206], [256, 92]], 254, 215, 170, 1.0);
  fillPoly([[256, 206], [352, 150], [256, 92]], 253, 186, 116, 1.0);

  // 5. Chimney
  fillPoly([[310, 102], [330, 113], [330, 76], [310, 65]], 194, 65, 12, 1.0);
  fillPoly([[330, 113], [344, 105], [344, 68], [330, 76]], 154, 52, 18, 1.0);
  fillPoly([[307, 64], [329, 76], [346, 67], [324, 55]], 248, 250, 252, 1.0);

  // 6. Architectural Overhanging Terracotta Roof
  fillPoly([[256, 76], [138, 144], [234, 200], [352, 132]], 249, 115, 22, 1.0);
  fillPoly([[256, 76], [374, 144], [256, 212], [234, 200]], 194, 65, 12, 1.0);
  fillPoly([[256, 74], [256, 78], [376, 146], [376, 142]], 255, 237, 213, 0.95);

  // 7. Glowing Windows (Left wall)
  fillPoly([[182, 176], [218, 197], [218, 228], [182, 207]], 254, 240, 138, 1.0);
  drawIsoLine(200, 186, 200, 218, 120, 53, 15, 0.8);
  drawIsoLine(181, 191, 219, 213, 120, 53, 15, 0.8);

  // 8. Front Door (Right wall)
  fillPoly([[274, 310], [304, 293], [304, 228], [274, 245]], 69, 26, 3, 1.0);
  fillPoly([[277, 306], [301, 292], [301, 232], [277, 246]], 120, 53, 15, 1.0);
  fillPoly([[280, 276], [298, 266], [298, 236], [280, 246]], 254, 240, 138, 0.95);
  fillCircle(282, 285, 2.5, 254, 240, 138, 1.0); // Brass knob

  // 9. Modern Picture Window (Right wall)
  fillPoly([[316, 270], [342, 255], [342, 205], [316, 220]], 254, 240, 138, 0.95);
  drawIsoLine(329, 212, 329, 262, 120, 53, 15, 0.8);

  // 10. Porch Potted Plant
  fillPoly([[234, 352], [248, 360], [248, 346], [234, 338]], 180, 83, 9, 1.0);
  fillPoly([[248, 360], [256, 355], [256, 341], [248, 346]], 146, 64, 14, 1.0);
  fillCircle(245, 326, 14, 21, 128, 61, 1.0);
  fillCircle(243, 324, 11, 34, 197, 94, 0.95);
  fillCircle(240, 321, 6, 134, 239, 172, 0.9);

  // 11. Subtle Stars / Sparkles
  fillCircle(120, 115, 5, 254, 240, 138, 0.9);
  fillCircle(395, 195, 4, 254, 240, 138, 0.9);
  fillCircle(365, 110, 2.5, 255, 255, 255, 0.9);
  fillCircle(150, 85, 2.5, 255, 255, 255, 0.9);

  return encodePng(size, size, buf);
}

// Generate all standard asset sizes
const sizes = [1024, 512, 256, 192, 180, 144, 128, 96, 72, 64, 48, 32, 16];
const pngs = {};
for (const sz of sizes) {
  console.log(`Rendering ${sz}x${sz} icon...`);
  const png = renderIcon(sz);
  pngs[sz] = png;
}

// Write PNG files in assets/
fs.writeFileSync(path.join(__dirname, '../assets/icon-512.png'), pngs[512]);
fs.writeFileSync(path.join(__dirname, '../assets/icon-192.png'), pngs[192]);
fs.writeFileSync(path.join(__dirname, '../assets/apple-touch-icon.png'), pngs[180]);
fs.writeFileSync(path.join(__dirname, '../assets/icon-128.png'), pngs[128]);
fs.writeFileSync(path.join(__dirname, '../assets/icon-64.png'), pngs[64]);
fs.writeFileSync(path.join(__dirname, '../assets/icon-32.png'), pngs[32]);
fs.writeFileSync(path.join(__dirname, '../assets/icon-16.png'), pngs[16]);

// Write multi-resolution Windows .ico file (16, 32, 48, 64, 128, 256)
const icoPngs = [16, 32, 48, 64, 128, 256].map(sz => ({ width: sz, height: sz, png: pngs[sz] }));
const icoBuf = encodeIco(icoPngs);
fs.writeFileSync(path.join(__dirname, '../assets/icon.ico'), icoBuf);

// Copy to Android mipmaps if android folder exists
const androidRes = path.join(__dirname, '../android/app/src/main/res');
if (fs.existsSync(androidRes)) {
  const mipmaps = [
    { dir: 'mipmap-mdpi', sz: 48 },
    { dir: 'mipmap-hdpi', sz: 72 },
    { dir: 'mipmap-xhdpi', sz: 96 },
    { dir: 'mipmap-xxhdpi', sz: 144 },
    { dir: 'mipmap-xxxhdpi', sz: 192 },
  ];
  for (const m of mipmaps) {
    const targetDir = path.join(androidRes, m.dir);
    if (fs.existsSync(targetDir)) {
      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), pngs[m.sz]);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), pngs[m.sz]);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), pngs[m.sz]);
    }
  }
  console.log('Updated Android launcher mipmaps!');
}

// Copy to iOS AppIcon catalog if ios folder exists
const iosAppIcon = path.join(__dirname, '../ios/App/App/Assets.xcassets/AppIcon.appiconset');
if (fs.existsSync(iosAppIcon)) {
  fs.writeFileSync(path.join(iosAppIcon, 'AppIcon-512@2x.png'), pngs[1024]);
  console.log('Updated iOS AppIcon catalog!');
}

console.log('All app icons and Windows icon.ico generated successfully!');
