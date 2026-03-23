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

const getLauncherLocalDataSnapshotSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.getLocalDataSnapshotSync()
}

const saveLauncherLocalListsSync = (value: unknown): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.saveLocalListsSync(value)
}

const saveLauncherLocalSettingsSync = (
  value: unknown,
): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.saveLocalSettingsSync(value)
}

const clearLauncherLocalListsSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.clearLocalListsSync()
}

const clearLauncherLocalSettingsSync = (): LauncherLocalDataSnapshot | null => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.clearLocalSettingsSync()
}

const openLauncherLocalDataFolder = async () => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return false
  }

  await launcherBridge.openLocalDataFolder()
  return true
}

const openExternalUrl = async (targetUrl: string) => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return
  }

  await launcherBridge.openExternal(targetUrl)
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
  clearLauncherLocalListsSync,
  clearLauncherLocalSettingsSync,
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
  saveLauncherLocalListsSync,
  saveLauncherLocalSettingsSync,
  saveCookieInputViaLauncher,
  subscribeToLauncherLibrarySnapshot,
}
