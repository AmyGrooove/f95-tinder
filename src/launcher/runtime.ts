import type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherInstallFolderRequest,
  LauncherLatestGamesResult,
  LauncherLocalDataSnapshot,
  LauncherLibrarySnapshot,
} from './types'
import type { FilterState, LatestGamesSort } from '../f95/types'

const createEmptyLibrarySnapshot = (): LauncherLibrarySnapshot => ({
  libraryRootPath: '',
  gamesByThreadLink: {},
})

const getLauncherBridge = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.f95Launcher ?? null
}

const isLauncherBridgeAvailable = () => getLauncherBridge() !== null

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizeLauncherLocalDataFile = (
  value: unknown,
): LauncherLocalDataSnapshot['listsFile'] => {
  if (!isRecord(value)) {
    return {
      path: '',
      exists: false,
      updatedAtUnixMs: null,
    }
  }

  return {
    path: typeof value.path === 'string' ? value.path : '',
    exists: value.exists === true,
    updatedAtUnixMs:
      typeof value.updatedAtUnixMs === 'number' ? value.updatedAtUnixMs : null,
  }
}

const normalizeLauncherLocalDataSnapshot = (
  value: unknown,
): LauncherLocalDataSnapshot | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    listsFile: normalizeLauncherLocalDataFile(value.listsFile),
    settingsFile: normalizeLauncherLocalDataFile(value.settingsFile),
    catalogFile: normalizeLauncherLocalDataFile(value.catalogFile),
    catalogCheckpointFile: normalizeLauncherLocalDataFile(
      value.catalogCheckpointFile,
    ),
    lists: 'lists' in value ? value.lists ?? null : null,
    settings: 'settings' in value ? value.settings ?? null : null,
    catalog: 'catalog' in value ? value.catalog ?? null : null,
    catalogCheckpoint:
      'catalogCheckpoint' in value ? value.catalogCheckpoint ?? null : null,
  }
}

const getLauncherLocalDataSnapshotSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    return normalizeLauncherLocalDataSnapshot(launcherBridge.getLocalDataSnapshotSync())
  } catch {
    return null
  }
}

const saveLauncherLocalListsSync = (value: unknown): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    return normalizeLauncherLocalDataSnapshot(launcherBridge.saveLocalListsSync(value))
  } catch {
    return null
  }
}

const saveLauncherLocalLists = async (value: unknown) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.saveLocalLists !== 'function') {
    return false
  }

  try {
    await launcherBridge.saveLocalLists(value)
    return true
  } catch {
    return false
  }
}

const saveLauncherLocalSettingsSync = (
  value: unknown,
): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.saveLocalSettingsSync(value),
    )
  } catch {
    return null
  }
}

const saveLauncherLocalSettings = async (value: unknown) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.saveLocalSettings !== 'function') {
    return false
  }

  try {
    await launcherBridge.saveLocalSettings(value)
    return true
  } catch {
    return false
  }
}

const saveLauncherLocalCatalogSync = (
  value: unknown,
): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    if (typeof launcherBridge.saveLocalCatalogSync !== 'function') {
      return getLauncherLocalDataSnapshotSync()
    }

    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.saveLocalCatalogSync(value),
    )
  } catch {
    return getLauncherLocalDataSnapshotSync()
  }
}

const saveLauncherLocalCatalog = async (value: unknown) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.saveLocalCatalog !== 'function') {
    return false
  }

  try {
    await launcherBridge.saveLocalCatalog(value)
    return true
  } catch {
    return false
  }
}

const saveLauncherLocalCatalogCheckpointSync = (
  value: unknown,
): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    if (typeof launcherBridge.saveLocalCatalogCheckpointSync !== 'function') {
      return getLauncherLocalDataSnapshotSync()
    }

    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.saveLocalCatalogCheckpointSync(value),
    )
  } catch {
    return getLauncherLocalDataSnapshotSync()
  }
}

const saveLauncherLocalCatalogCheckpoint = async (value: unknown) => {
  const launcherBridge = getLauncherBridge()
  if (
    !launcherBridge ||
    typeof launcherBridge.saveLocalCatalogCheckpoint !== 'function'
  ) {
    return false
  }

  try {
    await launcherBridge.saveLocalCatalogCheckpoint(value)
    return true
  } catch {
    return false
  }
}

const clearLauncherLocalListsSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    return normalizeLauncherLocalDataSnapshot(launcherBridge.clearLocalListsSync())
  } catch {
    return null
  }
}

const clearLauncherLocalLists = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.clearLocalLists !== 'function') {
    return false
  }

  try {
    await launcherBridge.clearLocalLists()
    return true
  } catch {
    return false
  }
}

const clearLauncherLocalSettingsSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.clearLocalSettingsSync(),
    )
  } catch {
    return null
  }
}

const clearLauncherLocalSettings = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.clearLocalSettings !== 'function') {
    return false
  }

  try {
    await launcherBridge.clearLocalSettings()
    return true
  } catch {
    return false
  }
}

const clearLauncherLocalCatalogSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    if (typeof launcherBridge.clearLocalCatalogSync !== 'function') {
      return getLauncherLocalDataSnapshotSync()
    }

    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.clearLocalCatalogSync(),
    )
  } catch {
    return getLauncherLocalDataSnapshotSync()
  }
}

const clearLauncherLocalCatalog = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.clearLocalCatalog !== 'function') {
    return false
  }

  try {
    await launcherBridge.clearLocalCatalog()
    return true
  } catch {
    return false
  }
}

const clearLauncherLocalCatalogCheckpointSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  try {
    if (typeof launcherBridge.clearLocalCatalogCheckpointSync !== 'function') {
      return getLauncherLocalDataSnapshotSync()
    }

    return normalizeLauncherLocalDataSnapshot(
      launcherBridge.clearLocalCatalogCheckpointSync(),
    )
  } catch {
    return getLauncherLocalDataSnapshotSync()
  }
}

const clearLauncherLocalCatalogCheckpoint = async () => {
  const launcherBridge = getLauncherBridge()
  if (
    !launcherBridge ||
    typeof launcherBridge.clearLocalCatalogCheckpoint !== 'function'
  ) {
    return false
  }

  try {
    await launcherBridge.clearLocalCatalogCheckpoint()
    return true
  } catch {
    return false
  }
}

const openLauncherLocalDataFolder = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.openLocalDataFolder()
  return true
}

type OpenExternalUrlOptions = {
  background?: boolean
}

const openLinkViaAnchor = (targetUrl: string) => {
  const linkElement = document.createElement('a')
  linkElement.href = targetUrl
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.click()
}

const openBackgroundTarget = () => {
  const openedWindow = window.open('', '_blank')
  if (!openedWindow) {
    return null
  }

  try {
    openedWindow.opener = null
    openedWindow.blur()
    window.focus()
  } catch {
    // ignore browser-specific focus restrictions
  }

  return openedWindow
}

const navigateBackgroundTarget = (
  openedWindow: Window | null,
  targetUrl: string,
) => {
  if (openedWindow && !openedWindow.closed) {
    try {
      openedWindow.location.replace(targetUrl)
      openedWindow.blur()
      window.focus()
      return
    } catch {
      // ignore and fallback to a regular new tab open
    }
  }

  openLinkViaAnchor(targetUrl)
}

const openExternalUrl = async (
  targetUrl: string,
  options: OpenExternalUrlOptions = {},
) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    if (options.background) {
      navigateBackgroundTarget(openBackgroundTarget(), targetUrl)
      return
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return
  }

  await launcherBridge.openExternal(targetUrl, options)
}

const restartLauncherApp = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge || typeof launcherBridge.restartApp !== 'function') {
    window.location.reload()
    return false
  }

  try {
    await launcherBridge.restartApp()
    return true
  } catch {
    window.location.reload()
    return false
  }
}

const fetchLatestGamesPageViaLauncher = async (
  pageNumber: number,
  latestGamesSort: LatestGamesSort,
  filterState?: FilterState | null,
): Promise<LauncherLatestGamesResult | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.fetchLatestGamesPage(
    pageNumber,
    latestGamesSort,
    filterState,
  )
}

const fetchThreadPageHtmlViaLauncher = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.fetchThreadPageHtml(threadLink)
}

const getCookieStatusViaLauncher = async (): Promise<LauncherCookieStatus | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.getCookieStatus()
}

const getCookieBackupViaLauncher = async (): Promise<LauncherCookieBackup | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.getCookieBackup()
}

const saveCookieInputViaLauncher = async (
  text: string,
): Promise<LauncherCookieStatus | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.saveCookieInput(text)
}

const clearCookieInputViaLauncher = async (): Promise<LauncherCookieStatus | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.clearCookieInput()
}

const loadBundledTagsMapViaLauncher = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.loadBundledTagsMap()
}

const loadBundledPrefixesMapViaLauncher = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.loadBundledPrefixesMap()
}

const getLauncherLibrarySnapshot = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return createEmptyLibrarySnapshot()
  }

  return launcherBridge.getLibrarySnapshot()
}

const subscribeToLauncherLibrarySnapshot = (
  listener: (snapshot: LauncherLibrarySnapshot) => void,
) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return () => {
      // noop
    }
  }

  return launcherBridge.onLibrarySnapshot(listener)
}

const requestLauncherDownload = async (request: LauncherDownloadRequest) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.downloadGame(request)
}

const requestLauncherDownloadCancel = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.cancelDownloadGame(threadLink)
}

const requestLauncherInstallFolderChoice = async (
  request: LauncherInstallFolderRequest,
) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.chooseInstallFolder(request)
}

const requestLauncherGameLaunch = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.launchGame(threadLink)
  return true
}

const requestLauncherRevealGame = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.revealGame(threadLink)
  return true
}

const requestLauncherGameDeletion = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.deleteGameFiles(threadLink)
}

const requestLauncherLaunchTargetChoice = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.chooseLaunchTarget(threadLink)
}

const requestLauncherLibraryFolderOpen = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.openLibraryFolder()
  return true
}

const requestLauncherMirrorOpen = async (threadLink: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.openMirrorForGame(threadLink)
  return true
}

const requestLauncherLibraryClear = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.clearLibrary()
}

export {
  clearLauncherLocalCatalog,
  clearLauncherLocalCatalogCheckpoint,
  clearLauncherLocalCatalogCheckpointSync,
  clearLauncherLocalListsSync,
  clearLauncherLocalLists,
  clearLauncherLocalSettingsSync,
  clearLauncherLocalSettings,
  clearLauncherLocalCatalogSync,
  clearCookieInputViaLauncher,
  getCookieBackupViaLauncher,
  getLauncherLocalDataSnapshotSync,
  fetchLatestGamesPageViaLauncher,
  fetchThreadPageHtmlViaLauncher,
  getCookieStatusViaLauncher,
  getLauncherBridge,
  getLauncherLibrarySnapshot,
  isLauncherBridgeAvailable,
  loadBundledPrefixesMapViaLauncher,
  loadBundledTagsMapViaLauncher,
  openExternalUrl,
  openLauncherLocalDataFolder,
  restartLauncherApp,
  requestLauncherDownload,
  requestLauncherDownloadCancel,
  requestLauncherInstallFolderChoice,
  requestLauncherGameDeletion,
  requestLauncherGameLaunch,
  requestLauncherLibraryClear,
  requestLauncherLibraryFolderOpen,
  requestLauncherLaunchTargetChoice,
  requestLauncherMirrorOpen,
  requestLauncherRevealGame,
  saveLauncherLocalCatalog,
  saveLauncherLocalCatalogCheckpoint,
  saveLauncherLocalCatalogCheckpointSync,
  saveLauncherLocalListsSync,
  saveLauncherLocalLists,
  saveLauncherLocalSettingsSync,
  saveLauncherLocalSettings,
  saveLauncherLocalCatalogSync,
  saveCookieInputViaLauncher,
  subscribeToLauncherLibrarySnapshot,
}
