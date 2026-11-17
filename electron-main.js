// electron-main.js — Native Desktop Host for House Designer
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Enable modern GPU & WebGL hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Single instance lock — prevents multiple duplicate windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return { width: 1280, height: 800, isMaximized: false };
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const isMax = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(stateFile, JSON.stringify({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: isMax
    }));
  } catch (e) {}
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1280,
    height: state.height || 800,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'House Designer — 2D & 3D Home Planner',
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#1e1b4b',
    autoHideMenuBar: true,
    show: false, // reveal smoothly on ready-to-show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webgl: true,
      spellcheck: false
    }
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Smooth fade-in presentation
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', saveWindowState);

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Keyboard shortcuts (Fullscreen, Reload)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && input.type === 'keyDown' && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
    } else if (((input.control && input.key === 'r') || input.key === 'F5') && input.type === 'keyDown') {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  // Load the app directly from local files
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8, timeout: 8000 });

function getLocalHash(filePath) {
  try {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
  } catch (e) {
    return null;
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const req = https.get(url, { agent: httpsAgent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => resolve(true));
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

ipcMain.handle('get-version', () => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
    return v.version || '1.3.13';
  } catch (e) {
    return '1.3.13';
  }
});

// In-app updater for standalone desktop application — Differential, Parallel & Blazing Fast
ipcMain.handle('apply-update', async (event) => {
  const baseUrl = 'https://elhoursoufyane.github.io/housedesigner/';
  try {
    const vRes = await new Promise((resolve, reject) => {
      https.get(`${baseUrl}version.json?_t=${Date.now()}`, { agent: httpsAgent }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    const fileList = vRes.files || [];
    const remoteHashes = vRes.hashes || {};

    // 1. Identify only files that actually changed or are missing
    const toDownload = [];
    for (const relPath of fileList) {
      if (relPath === 'version.json') continue;
      const destPath = path.join(__dirname, relPath);
      const expectedHash = remoteHashes[relPath];
      if (!fs.existsSync(destPath) || !expectedHash || getLocalHash(destPath) !== expectedHash) {
        toDownload.push(relPath);
      }
    }

    // Always fetch latest version.json
    toDownload.push('version.json');

    const total = toDownload.length;
    let completed = 0;

    event.sender.send('update-progress', {
      current: 0,
      total,
      percent: 10,
      file: `Diff check: ${total} files need updating`
    });

    // 2. Download changed files concurrently in batches of 4
    const BATCH_SIZE = 4;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = toDownload.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (relPath) => {
        const fileUrl = `${baseUrl}${relPath}?_t=${Date.now()}`;
        const destPath = path.join(__dirname, relPath);
        await downloadFile(fileUrl, destPath);
        completed++;
        event.sender.send('update-progress', {
          current: completed,
          total,
          percent: Math.min(95, Math.round((completed / total) * 100)),
          file: relPath
        });
      }));
    }

    event.sender.send('update-progress', {
      current: total,
      total,
      percent: 100,
      file: 'Reloading...'
    });

    setTimeout(() => {
      if (mainWindow) mainWindow.reload();
    }, 350);

    return { success: true, version: vRes.version, filesUpdated: total };
  } catch (err) {
    console.error('Update failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external', (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Clean immersive borderless UI
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
