const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFile(relPath) {
  const src = path.join(root, relPath);
  const dest = path.join(out, relPath);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

// Ensure www exists
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

// Copy individual files
const files = [
  'index.html',
  'play3d.html',
  'style.css',
  'manifest.json',
  'version.json',
  'sw.js',
  'my-house.house.json'
];

for (const f of files) copyFile(f);

// Copy folders
copyDir(path.join(root, 'assets'), path.join(out, 'assets'));
copyDir(path.join(root, 'lib'), path.join(out, 'lib'));
copyDir(path.join(root, 'src'), path.join(out, 'src'));

console.log('Synchronized web assets to www/ for Capacitor!');
