const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('f95Launcher', {
  runtime: {
    isElectron: true,
  },
  getLocalDataSnapshotSync: () => ipcRenderer.sendSync('localData:getSnapshotSync'),
  saveLocalLists: (value) => ipcRenderer.invoke('localData:saveLists', value),
  saveLocalSettings: (value) => ipcRenderer.invoke('localData:saveSettings', value),
  saveLocalCatalog: (value) => ipcRenderer.invoke('localData:saveCatalog', value),
  saveLocalCatalogCheckpoint: (value) =>
    ipcRenderer.invoke('localData:saveCatalogCheckpoint', value),
  clearLocalLists: () => ipcRenderer.invoke('localData:clearLists'),
  clearLocalSettings: () => ipcRenderer.invoke('localData:clearSettings'),
  clearLocalCatalog: () => ipcRenderer.invoke('localData:clearCatalog'),
  clearLocalCatalogCheckpoint: () =>
    ipcRenderer.invoke('localData:clearCatalogCheckpoint'),
  openLocalDataFolder: () => ipcRenderer.invoke('localData:openFolder'),
  openExternal: (targetUrl, options) =>
    ipcRenderer.invoke('app:openExternal', targetUrl, options),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  loadBundledTagsMap: () => ipcRenderer.invoke('app:loadBundledTagsMap'),
  loadBundledPrefixesMap: () => ipcRenderer.invoke('app:loadBundledPrefixesMap'),
  fetchLatestGamesPage: (pageNumber, latestGamesSort, filterState) =>
    ipcRenderer.invoke(
      'f95:fetchLatestGamesPage',
      pageNumber,
      latestGamesSort,
      filterState,
    ),
  getCookieStatus: () => ipcRenderer.invoke('f95:getCookieStatus'),
  getCookieBackup: () => ipcRenderer.invoke('f95:getCookieBackup'),
  saveCookieInput: (text) => ipcRenderer.invoke('f95:saveCookieInput', text),
  clearCookieInput: () => ipcRenderer.invoke('f95:clearCookieInput'),
})
