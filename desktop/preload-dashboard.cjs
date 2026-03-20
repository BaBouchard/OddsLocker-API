const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('olScraper', {
  getDashboardInfo: () => ipcRenderer.invoke('dashboard:get-info'),
  openHostedTerminal: () => ipcRenderer.invoke('dashboard:open-hosted-terminal')
})
