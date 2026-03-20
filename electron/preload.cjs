const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('f95Launcher', {
  runtime: {
    isElectron: true,
  },
  openExternal: (targetUrl) => ipcRenderer.invoke('app:openExternal', targetUrl),
  loadBundledTagsMap: () => ipcRenderer.invoke('app:loadBundledTagsMap'),
  fetchLatestGamesPage: (pageNumber) =>
    ipcRenderer.invoke('f95:fetchLatestGamesPage', pageNumber),
  fetchThreadPageHtml: (threadLink) =>
    ipcRenderer.invoke('f95:fetchThreadPageHtml', threadLink),
  getCookieStatus: () => ipcRenderer.invoke('f95:getCookieStatus'),
  saveCookieInput: (text) => ipcRenderer.invoke('f95:saveCookieInput', text),
  clearCookieInput: () => ipcRenderer.invoke('f95:clearCookieInput'),
  getLibrarySnapshot: () => ipcRenderer.invoke('launcher:getLibrarySnapshot'),
  downloadGame: (request) => ipcRenderer.invoke('launcher:downloadGame', request),
  launchGame: (threadLink) => ipcRenderer.invoke('launcher:launchGame', threadLink),
  revealGame: (threadLink) => ipcRenderer.invoke('launcher:revealGame', threadLink),
  onLibrarySnapshot: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot)
    ipcRenderer.on('launcher:librarySnapshot', handler)

    return () => {
      ipcRenderer.removeListener('launcher:librarySnapshot', handler)
    }
  },
})
