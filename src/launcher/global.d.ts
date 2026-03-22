import type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherLatestGamesResult,
  LauncherLibrarySnapshot,
} from './types'
import type { LatestGamesSort } from '../f95/types'

type LauncherBridge = {
  runtime: {
    isElectron: boolean
  }
  openExternal: (targetUrl: string) => Promise<boolean>
  loadBundledTagsMap: () => Promise<Record<string, string>>
  loadBundledPrefixesMap: () => Promise<Record<string, string>>
  fetchLatestGamesPage: (
    pageNumber: number,
    latestGamesSort: LatestGamesSort,
  ) => Promise<LauncherLatestGamesResult>
  fetchThreadPageHtml: (threadLink: string) => Promise<string>
  getCookieStatus: () => Promise<LauncherCookieStatus>
  getCookieBackup: () => Promise<LauncherCookieBackup>
  saveCookieInput: (text: string) => Promise<LauncherCookieStatus>
  clearCookieInput: () => Promise<LauncherCookieStatus>
  getLibrarySnapshot: () => Promise<LauncherLibrarySnapshot>
  downloadGame: (request: LauncherDownloadRequest) => Promise<unknown>
  launchGame: (threadLink: string) => Promise<void>
  revealGame: (threadLink: string) => Promise<void>
  deleteGameFiles: (threadLink: string) => Promise<LauncherLibrarySnapshot>
  chooseLaunchTarget: (threadLink: string) => Promise<LauncherLibrarySnapshot | null>
  openLibraryFolder: () => Promise<void>
  openMirrorForGame: (threadLink: string) => Promise<void>
  clearLibrary: () => Promise<LauncherLibrarySnapshot>
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
