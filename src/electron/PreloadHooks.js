
// These functions are copied into the bottom of cdv-electron-preload.js during build
contextBridge.exposeInMainWorld('bleCentralPlugin', {
  flushDeviceList: () => ipcRenderer.invoke('bleCentralPlugin:flushDeviceList'),
  proxyGesture: (callback) => ipcRenderer.invoke('bleCentralPlugin:proxyGesture', callback),
  handleLatestDeviceID: (callback) => ipcRenderer.on('bleCentralPlugin:latestDeviceID', callback)
});