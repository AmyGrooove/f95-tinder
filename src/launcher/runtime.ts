import type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherLatestGamesResult,
  LauncherLibrarySnapshot,
} from './types'
import type { LatestGamesSort } from '../f95/types'

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
): Promise<LauncherLatestGamesResult | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.fetchLatestGamesPage(pageNumber, latestGamesSort)
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
  clearCookieInputViaLauncher,
  getCookieBackupViaLauncher,
  fetchLatestGamesPageViaLauncher,
  fetchThreadPageHtmlViaLauncher,
  getCookieStatusViaLauncher,
  getLauncherBridge,
  getLauncherLibrarySnapshot,
  isLauncherBridgeAvailable,
  loadBundledPrefixesMapViaLauncher,
  loadBundledTagsMapViaLauncher,
  openExternalUrl,
  requestLauncherDownload,
  requestLauncherGameDeletion,
  requestLauncherGameLaunch,
  requestLauncherLibraryClear,
  requestLauncherLibraryFolderOpen,
  requestLauncherLaunchTargetChoice,
  requestLauncherMirrorOpen,
  requestLauncherRevealGame,
  saveCookieInputViaLauncher,
  subscribeToLauncherLibrarySnapshot,
}
