import type {
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherLatestGamesResult,
  LauncherLibrarySnapshot,
} from './types'

type LauncherBridge = {
  runtime: {
    isElectron: boolean
  }
  openExternal: (targetUrl: string) => Promise<boolean>
  loadBundledTagsMap: () => Promise<Record<string, string>>
  fetchLatestGamesPage: (pageNumber: number) => Promise<LauncherLatestGamesResult>
  fetchThreadPageHtml: (threadLink: string) => Promise<string>
  getCookieStatus: () => Promise<LauncherCookieStatus>
  saveCookieInput: (text: string) => Promise<LauncherCookieStatus>
  clearCookieInput: () => Promise<LauncherCookieStatus>
  getLibrarySnapshot: () => Promise<LauncherLibrarySnapshot>
  downloadGame: (request: LauncherDownloadRequest) => Promise<unknown>
  launchGame: (threadLink: string) => Promise<void>
  revealGame: (threadLink: string) => Promise<void>
  onLibrarySnapshot: (
    listener: (snapshot: LauncherLibrarySnapshot) => void,
  ) => () => void
}

declare global {
  interface Window {
    f95Launcher?: LauncherBridge
  }
}

export type { LauncherBridge }
