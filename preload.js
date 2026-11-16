// preload.js — Secure bridge between Electron host and House Designer web client
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  applyUpdate: () => ipcRenderer.invoke('apply-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  }
});
