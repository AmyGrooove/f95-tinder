import type {
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherLatestGamesResult,
  LauncherLibrarySnapshot,
} from './types'

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
): Promise<LauncherLatestGamesResult | null> => {
  const launcherBridge = getLauncherBridge()
  if (!launcherBridge) {
    return null
  }

  return launcherBridge.fetchLatestGamesPage(pageNumber)
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

export {
  clearCookieInputViaLauncher,
  fetchLatestGamesPageViaLauncher,
  fetchThreadPageHtmlViaLauncher,
  getCookieStatusViaLauncher,
  getLauncherBridge,
  getLauncherLibrarySnapshot,
  isLauncherBridgeAvailable,
  loadBundledTagsMapViaLauncher,
  openExternalUrl,
  requestLauncherDownload,
  requestLauncherGameLaunch,
  requestLauncherRevealGame,
  saveCookieInputViaLauncher,
  subscribeToLauncherLibrarySnapshot,
}
