// electron-main.js — Native Desktop Host for House Designer
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
