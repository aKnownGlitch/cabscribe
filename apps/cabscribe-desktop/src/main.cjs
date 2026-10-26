const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { SerialPort } = require('serialport');

const DCC_EX_BAUD_RATE = 115200;
let mainWindow;
let activePort;

function serialPortLabel(port) {
  return port.manufacturer
    ? `${port.manufacturer} · ${port.path}`
    : port.path;
}

function notifyUnexpectedDisconnect(port, message) {
  if (activePort !== port) {
    return;
  }

  activePort = undefined;
  mainWindow?.webContents.send('cabscribe:serial:disconnected', message);
}

function reportSerialMessage(direction, message) {
  mainWindow?.webContents.send('cabscribe:serial:message', {
    direction,
    message,
  });
}

ipcMain.handle('cabscribe:serial:list', async () => {
  const ports = await SerialPort.list();
  return ports.map((port) => ({
    id: port.path,
    label: serialPortLabel(port),
  }));
});

ipcMain.handle('cabscribe:serial:connect', async (_event, portId) => {
  if (activePort?.isOpen) {
    throw new Error(
      'A serial port is already open. Disconnect before switching ports.'
    );
  }
  if (typeof portId !== 'string' || portId.length === 0) {
    throw new Error('Select an available serial port before connecting.');
  }

  const ports = await SerialPort.list();
  if (!ports.some((port) => port.path === portId)) {
    throw new Error(
      'The selected serial port is no longer available. Refresh the list.'
    );
  }

  const port = new SerialPort({
    path: portId,
    baudRate: DCC_EX_BAUD_RATE,
    autoOpen: false,
  });

  await new Promise((resolve, reject) => {
    port.open((error) => {
      if (error) {
        reject(new Error(`Could not open ${portId}: ${error.message}`));
      } else {
        resolve();
      }
    });
  });

  activePort = port;
  port.on('data', (data) => {
    reportSerialMessage('incoming', data.toString('utf8'));
  });
  port.on('error', (error) => {
    notifyUnexpectedDisconnect(
      port,
      `Serial connection lost: ${error.message}`
    );
    if (port.isOpen) {
      port.close((closeError) => {
        if (closeError) {
          mainWindow?.webContents.send(
            'cabscribe:serial:disconnected',
            `Serial connection cleanup failed: ${closeError.message}`
          );
        }
      });
    }
  });
  port.on('close', () => {
    notifyUnexpectedDisconnect(port, 'The serial device disconnected.');
  });

  return {
    capabilities: {
      serviceModeRead: false,
      serviceModeWrite: false,
    },
    message:
      'The serial port is open at 115200 baud. DCC-EX readiness and Service Mode commands are not enabled yet.',
  };
});

ipcMain.handle('cabscribe:serial:disconnect', async () => {
  const port = activePort;
  activePort = undefined;
  if (!port?.isOpen) {
    return;
  }

  await new Promise((resolve, reject) => {
    port.close((error) => {
      if (error) {
        reject(new Error(`Could not close the serial port: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
});

ipcMain.handle('cabscribe:dcc:read-cv', async (_event, address, cv) => {
  if (!Number.isSafeInteger(address) || address < 1) {
    throw new Error('Enter a positive whole-number locomotive or accessory ID.');
  }
  if (!Number.isSafeInteger(cv) || cv < 1) {
    throw new Error('Enter a positive whole-number CV address.');
  }
  throw new Error(
    'DCC-EX Service Mode CV reading is not implemented; no command was sent.'
  );
});

ipcMain.handle('cabscribe:dcc:write-cv', async (_event, address, cv, value) => {
  if (!Number.isSafeInteger(address) || address < 1) {
    throw new Error('Enter a positive whole-number locomotive or accessory ID.');
  }
  if (!Number.isSafeInteger(cv) || cv < 1) {
    throw new Error('Enter a positive whole-number CV address.');
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Enter a non-negative whole-number CV value.');
  }
  throw new Error(
    'DCC-EX Service Mode CV writing is not implemented; no command was sent.'
  );
});

function createWindow() {
  const webAppPath = app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'index.html')
    : path.resolve(
        __dirname,
        '../../../dist/apps/cabscribe/browser/index.html'
      );
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'cabscribe-icon.png')
    : path.resolve(
        __dirname,
        '../../cabscribe/public/cabscribe-icon.png'
      );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#f5f7f8',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const allowedFileUrl = pathToFileURL(webAppPath).href;

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== allowedFileUrl) {
      event.preventDefault();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  void mainWindow.loadFile(webAppPath);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (activePort?.isOpen) {
    activePort.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
