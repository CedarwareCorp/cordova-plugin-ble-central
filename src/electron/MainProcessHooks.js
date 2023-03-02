
// These functions are copied into the bottom of cdv-electron-main.js during build
let createWindowOld = createWindow;
let forwardedDevices = [];

createWindow = () => {
  createWindowOld();

  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    for (const device of deviceList) {
      if (!forwardedDevices.includes(device.deviceId)) {
        forwardedDevices.push(device.deviceId);
        mainWindow.webContents.send('bleCentralPlugin:latestDeviceID', device.deviceId);
        callback(device.deviceId);
        break;
      }
    }
  });
}

ipcMain.handle('bleCentralPlugin:proxyGesture', (event, arg) => {
  console.log(arg);
  mainWindow.webContents.executeJavaScript(
    arg,
    true,
  );
  return true;
});

ipcMain.handle('bleCentralPlugin:flushDeviceList', () => {
  forwardedDevices = [];
});