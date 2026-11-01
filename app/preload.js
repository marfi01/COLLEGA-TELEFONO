const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('info'),
  open: (k, n) => ipcRenderer.invoke('open', k, n),
  reveal: (k, n) => ipcRenderer.invoke('reveal', k, n),
  openDir: k => ipcRenderer.invoke('openDir', k),
  trash: (k, n) => ipcRenderer.invoke('trash', k, n),
  copy: t => ipcRenderer.invoke('copy', t),
  addFiles: p => ipcRenderer.invoke('addFiles', p),
  pick: () => ipcRenderer.invoke('pick'),
  skip: () => ipcRenderer.send('skip'),
  remote: on => ipcRenderer.invoke('remote', on),
  pathFor: f => webUtils.getPathForFile(f),
  onChange: cb => ipcRenderer.on('changed', () => cb()),
});
