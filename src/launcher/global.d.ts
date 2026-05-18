import type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherLatestGamesResult,
  LauncherLocalDataSnapshot,
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
  saveLocalLists: (value: unknown) => Promise<boolean>
  saveLocalSettings: (value: unknown) => Promise<boolean>
  saveLocalCatalog: (value: unknown) => Promise<boolean>
  saveLocalCatalogCheckpoint: (value: unknown) => Promise<boolean>
  clearLocalLists: () => Promise<boolean>
  clearLocalSettings: () => Promise<boolean>
  clearLocalCatalog: () => Promise<boolean>
  clearLocalCatalogCheckpoint: () => Promise<boolean>
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
  getCookieStatus: () => Promise<LauncherCookieStatus>
  getCookieBackup: () => Promise<LauncherCookieBackup>
  saveCookieInput: (text: string) => Promise<LauncherCookieStatus>
  clearCookieInput: () => Promise<LauncherCookieStatus>
}

declare global {
  interface Window {
    f95Launcher?: LauncherBridge
  }
}

export type { LauncherBridge }
