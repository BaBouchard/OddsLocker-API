const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('olDesktop', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  pickEnvFile: () => ipcRenderer.invoke('config:pick-env'),
  saveSetup: (payload) => ipcRenderer.invoke('setup:save', payload),
  cancelSetup: () => ipcRenderer.invoke('setup:cancel')
})
