import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import SshClient from 'ssh2-sftp-client';

let ssh: SshClient;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Note: In a real app, you'd copy these files to the dist folder during the build
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (ssh) {
    ssh.end();
  }
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for SSH ---

ipcMain.handle('ssh:connect', async (event: IpcMainInvokeEvent, config: SshClient.ConnectOptions) => {
  ssh = new SshClient();
  try {
    await ssh.connect(config);
    return true;
  } catch (err) {
    console.error((err as Error).message);
    return false;
  }
});

ipcMain.handle('ssh:execute', async (event: IpcMainInvokeEvent, command: string) => {
  if (!ssh) {
    return 'Error: Not connected to any server.';
  }
  try {
    const result = await ssh.exec(command);
    return result.stdout || result.stderr;
  } catch (err) {
    return (err as Error).message;
  }
});
