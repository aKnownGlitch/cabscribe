const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cabscribeDesktop', {
  listPorts: () => ipcRenderer.invoke('cabscribe:serial:list'),
  connect: (portId) => ipcRenderer.invoke('cabscribe:serial:connect', portId),
  disconnect: () => ipcRenderer.invoke('cabscribe:serial:disconnect'),
  readCv: (cv) => ipcRenderer.invoke('cabscribe:dcc:read-cv', cv),
  writeCv: (cv, value) =>
    ipcRenderer.invoke('cabscribe:dcc:write-cv', cv, value),
  onDisconnected: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on('cabscribe:serial:disconnected', handler);
    return () =>
      ipcRenderer.removeListener('cabscribe:serial:disconnected', handler);
  },
});
