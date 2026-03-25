const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('f95Launcher', {
  runtime: {
    isElectron: true,
  },
  getLocalDataSnapshotSync: () => ipcRenderer.sendSync('localData:getSnapshotSync'),
  saveLocalListsSync: (value) => ipcRenderer.sendSync('localData:saveListsSync', value),
  saveLocalLists: (value) => ipcRenderer.invoke('localData:saveLists', value),
  saveLocalSettingsSync: (value) => ipcRenderer.sendSync('localData:saveSettingsSync', value),
  saveLocalSettings: (value) => ipcRenderer.invoke('localData:saveSettings', value),
  saveLocalCatalogSync: (value) => ipcRenderer.sendSync('localData:saveCatalogSync', value),
  saveLocalCatalog: (value) => ipcRenderer.invoke('localData:saveCatalog', value),
  clearLocalListsSync: () => ipcRenderer.sendSync('localData:clearListsSync'),
  clearLocalLists: () => ipcRenderer.invoke('localData:clearLists'),
  clearLocalSettingsSync: () => ipcRenderer.sendSync('localData:clearSettingsSync'),
  clearLocalSettings: () => ipcRenderer.invoke('localData:clearSettings'),
  clearLocalCatalogSync: () => ipcRenderer.sendSync('localData:clearCatalogSync'),
  clearLocalCatalog: () => ipcRenderer.invoke('localData:clearCatalog'),
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
  fetchThreadPageHtml: (threadLink) =>
    ipcRenderer.invoke('f95:fetchThreadPageHtml', threadLink),
  getCookieStatus: () => ipcRenderer.invoke('f95:getCookieStatus'),
  getCookieBackup: () => ipcRenderer.invoke('f95:getCookieBackup'),
  saveCookieInput: (text) => ipcRenderer.invoke('f95:saveCookieInput', text),
  clearCookieInput: () => ipcRenderer.invoke('f95:clearCookieInput'),
  getLibrarySnapshot: () => ipcRenderer.invoke('launcher:getLibrarySnapshot'),
  downloadGame: (request) => ipcRenderer.invoke('launcher:downloadGame', request),
  cancelDownloadGame: (threadLink) =>
    ipcRenderer.invoke('launcher:cancelDownloadGame', threadLink),
  chooseInstallFolder: (request) =>
    ipcRenderer.invoke('launcher:chooseInstallFolder', request),
  launchGame: (threadLink) => ipcRenderer.invoke('launcher:launchGame', threadLink),
  revealGame: (threadLink) => ipcRenderer.invoke('launcher:revealGame', threadLink),
  deleteGameFiles: (threadLink) =>
    ipcRenderer.invoke('launcher:deleteGameFiles', threadLink),
  chooseLaunchTarget: (threadLink) =>
    ipcRenderer.invoke('launcher:chooseLaunchTarget', threadLink),
  openLibraryFolder: () => ipcRenderer.invoke('launcher:openLibraryFolder'),
  openMirrorForGame: (threadLink) =>
    ipcRenderer.invoke('launcher:openMirrorForGame', threadLink),
  clearLibrary: () => ipcRenderer.invoke('launcher:clearLibrary'),
  onLibrarySnapshot: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot)
    ipcRenderer.on('launcher:librarySnapshot', handler)

    return () => {
      ipcRenderer.removeListener('launcher:librarySnapshot', handler)
    }
  },
})
