import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('api', {
  connect: (host: string, username: string, password: string) => 
    ipcRenderer.invoke('ssh:connect', { host, username, password }),
  
  execute: (command: string) => 
    ipcRenderer.invoke('ssh:execute', command),

  onCommandOutput: (callback: (data: string) => void) => 
    ipcRenderer.on('ssh:output', (event: IpcRendererEvent, data: string) => callback(data)),
});
