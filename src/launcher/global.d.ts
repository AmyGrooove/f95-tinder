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

type BundledLookupMap = Record<string, string>
type BundledPrefixesPayload =
  | BundledLookupMap
  | {
      prefixes?: BundledLookupMap
      engines?: BundledLookupMap
    }
type LauncherOpenExternalOptions = {
  background?: boolean
}

type LauncherBridge = {
  runtime: {
    isElectron: boolean
  }
  getLocalDataSnapshotSync: () => LauncherLocalDataSnapshot
  saveLocalListsSync: (value: unknown) => LauncherLocalDataSnapshot
  saveLocalLists: (value: unknown) => Promise<boolean>
  saveLocalSettingsSync: (value: unknown) => LauncherLocalDataSnapshot
  saveLocalSettings: (value: unknown) => Promise<boolean>
  saveLocalCatalogSync: (value: unknown) => LauncherLocalDataSnapshot
  saveLocalCatalog: (value: unknown) => Promise<boolean>
  clearLocalListsSync: () => LauncherLocalDataSnapshot
  clearLocalLists: () => Promise<boolean>
  clearLocalSettingsSync: () => LauncherLocalDataSnapshot
  clearLocalSettings: () => Promise<boolean>
  clearLocalCatalogSync: () => LauncherLocalDataSnapshot
  clearLocalCatalog: () => Promise<boolean>
  openLocalDataFolder: () => Promise<boolean>
  openExternal: (
    targetUrl: string,
    options?: LauncherOpenExternalOptions,
  ) => Promise<boolean>
  restartApp: () => Promise<boolean>
  loadBundledTagsMap: () => Promise<BundledLookupMap>
  loadBundledPrefixesMap: () => Promise<BundledPrefixesPayload>
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
  cancelDownloadGame: (threadLink: string) => Promise<LauncherLibrarySnapshot>
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
