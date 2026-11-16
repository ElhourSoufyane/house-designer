const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const stage = path.join(root, 'dist-src');

// Clean staging directory
if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

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

function copyFile(name) {
  const src = path.join(root, name);
  const dest = path.join(stage, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

// Copy essential app files
const files = [
  'electron-main.js',
  'preload.js',
  'index.html',
  'play3d.html',
  'style.css',
  'manifest.json',
  'version.json',
  'sw.js',
  'my-house.house.json'
];

for (const f of files) copyFile(f);

// Minimal runtime package.json
const runtimePkg = {
  name: "house-designer",
  productName: "House Designer",
  version: "1.0.0",
  main: "electron-main.js",
  description: "Cozy 2D & 3D Architectural Home Designer with Live Co-op"
};
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(runtimePkg, null, 2));

// Copy asset directories
copyDir(path.join(root, 'assets'), path.join(stage, 'assets'));
copyDir(path.join(root, 'lib'), path.join(stage, 'lib'));
copyDir(path.join(root, 'src'), path.join(stage, 'src'));

console.log('Staged clean app files in dist-src/. Running electron-packager...');

const packagerCmd = `npx.cmd electron-packager "${stage}" "House Designer" --platform=win32 --arch=x64 --icon="${path.join(root, 'assets/icon.ico')}" --out="${path.join(root, 'dist')}" --overwrite`;

execSync(packagerCmd, { stdio: 'inherit', cwd: root });

// Clean up staging directory
fs.rmSync(stage, { recursive: true, force: true });

console.log('Windows PC application built cleanly in dist/House Designer-win32-x64!');
