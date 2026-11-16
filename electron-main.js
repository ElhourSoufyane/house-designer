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

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const req = https.get(url, (res) => {
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
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// In-app updater for standalone desktop application
ipcMain.handle('apply-update', async (event) => {
  const baseUrl = 'https://elhoursoufyane.github.io/housedesigner/';
  try {
    const vRes = await new Promise((resolve, reject) => {
      https.get(`${baseUrl}version.json?_t=${Date.now()}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    const fileList = vRes.files || [
      'version.json', 'index.html', 'play3d.html', 'style.css', 'manifest.json', 'sw.js',
      'src/catalog.js', 'src/cull3d.js', 'src/default-house.js', 'src/furniture3d.js',
      'src/geom3d.js', 'src/graphics3d.js', 'src/grid.js', 'src/input.js', 'src/life3d.js',
      'src/main.js', 'src/presets.js', 'src/rooms.js', 'src/save.js', 'src/sky3d.js',
      'src/sound3d.js', 'src/sprites.js', 'src/sync.js', 'src/sync3d.js', 'src/tools.js',
      'src/ui.js', 'src/walk.js', 'src/walk3d.js', 'src/world3d.js'
    ];

    const total = fileList.length;
    for (let i = 0; i < total; i++) {
      const relPath = fileList[i];
      const fileUrl = `${baseUrl}${relPath}?_t=${Date.now()}`;
      const destPath = path.join(__dirname, relPath);
      event.sender.send('update-progress', {
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        file: relPath
      });
      await downloadFile(fileUrl, destPath);
    }

    setTimeout(() => {
      if (mainWindow) mainWindow.reload();
    }, 600);

    return { success: true, version: vRes.version };
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
