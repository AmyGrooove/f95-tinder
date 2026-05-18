import type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherLatestGamesResult,
  LauncherLocalDataSnapshot,
} from './types'
import type { FilterState, LatestGamesSort } from '../f95/types'

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

const invokeBoolean = async (
  fn: ((value?: unknown) => Promise<boolean>) | undefined,
  value?: unknown,
) => {
  if (typeof fn !== 'function') {
    return false
  }

  try {
    await fn(value)
    return true
  } catch {
    return false
  }
}

const saveLauncherLocalLists = async (value: unknown) =>
  invokeBoolean(getLauncherBridge()?.saveLocalLists, value)

const saveLauncherLocalSettings = async (value: unknown) =>
  invokeBoolean(getLauncherBridge()?.saveLocalSettings, value)

const saveLauncherLocalCatalog = async (value: unknown) =>
  invokeBoolean(getLauncherBridge()?.saveLocalCatalog, value)

const saveLauncherLocalCatalogCheckpoint = async (value: unknown) =>
  invokeBoolean(getLauncherBridge()?.saveLocalCatalogCheckpoint, value)

const clearLauncherLocalLists = async () =>
  invokeBoolean(getLauncherBridge()?.clearLocalLists)

const clearLauncherLocalSettings = async () =>
  invokeBoolean(getLauncherBridge()?.clearLocalSettings)

const clearLauncherLocalCatalog = async () =>
  invokeBoolean(getLauncherBridge()?.clearLocalCatalog)

const clearLauncherLocalCatalogCheckpoint = async () =>
  invokeBoolean(getLauncherBridge()?.clearLocalCatalogCheckpoint)

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

export {
  clearLauncherLocalCatalog,
  clearLauncherLocalCatalogCheckpoint,
  clearLauncherLocalLists,
  clearLauncherLocalSettings,
  clearCookieInputViaLauncher,
  getCookieBackupViaLauncher,
  getLauncherLocalDataSnapshotSync,
  fetchLatestGamesPageViaLauncher,
  getCookieStatusViaLauncher,
  getLauncherBridge,
  isLauncherBridgeAvailable,
  loadBundledPrefixesMapViaLauncher,
  loadBundledTagsMapViaLauncher,
  openExternalUrl,
  openLauncherLocalDataFolder,
  restartLauncherApp,
  saveLauncherLocalCatalog,
  saveLauncherLocalCatalogCheckpoint,
  saveLauncherLocalLists,
  saveLauncherLocalSettings,
  saveCookieInputViaLauncher,
}
