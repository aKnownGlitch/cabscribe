const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cabscribeDesktop', {
  requestLocomotiveAddress: () =>
    ipcRenderer.invoke('cabscribe:dcc:read-address'),
  listPorts: () => ipcRenderer.invoke('cabscribe:serial:list'),
  connect: (portId) => ipcRenderer.invoke('cabscribe:serial:connect', portId),
  disconnect: () => ipcRenderer.invoke('cabscribe:serial:disconnect'),
  readCv: (address, cv) =>
    ipcRenderer.invoke('cabscribe:dcc:read-cv', address, cv),
  writeCv: (address, cv, value) =>
    ipcRenderer.invoke('cabscribe:dcc:write-cv', address, cv, value),
  onDisconnected: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on('cabscribe:serial:disconnected', handler);
    return () =>
      ipcRenderer.removeListener('cabscribe:serial:disconnected', handler);
  },
  onSerialMessage: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on('cabscribe:serial:message', handler);
    return () =>
      ipcRenderer.removeListener('cabscribe:serial:message', handler);
  },
});
