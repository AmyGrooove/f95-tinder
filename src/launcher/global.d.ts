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

type LauncherBridge = {
  runtime: {
    isElectron: boolean
  }
  getLocalDataSnapshotSync: () => LauncherLocalDataSnapshot
  saveLocalListsSync: (value: unknown) => LauncherLocalDataSnapshot
  saveLocalSettingsSync: (value: unknown) => LauncherLocalDataSnapshot
  clearLocalListsSync: () => LauncherLocalDataSnapshot
  clearLocalSettingsSync: () => LauncherLocalDataSnapshot
  openLocalDataFolder: () => Promise<boolean>
  openExternal: (targetUrl: string) => Promise<boolean>
  loadBundledTagsMap: () => Promise<Record<string, string>>
  loadBundledPrefixesMap: () => Promise<Record<string, string>>
  fetchLatestGamesPage: (
    pageNumber: number,
    latestGamesSort: LatestGamesSort,
    filterState?: FilterState | null,
  ) => Promise<LauncherLatestGamesResult>
  fetchThreadPageHtml: (threadLink: string) => Promise<string>
  getCookieStatus: () => Promise<LauncherCookieStatus>
  getCookieBackup: () => Promise<LauncherCookieBackup>
  saveCookieInput: (text: string) => Promise<LauncherCookieStatus>
  clearCookieInput: () => Promise<LauncherCookieStatus>
  getLibrarySnapshot: () => Promise<LauncherLibrarySnapshot>
  downloadGame: (request: LauncherDownloadRequest) => Promise<unknown>
  chooseInstallFolder: (
    request: LauncherInstallFolderRequest,
  ) => Promise<LauncherLibrarySnapshot | null>
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
