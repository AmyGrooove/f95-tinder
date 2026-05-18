import type { F95ThreadItem } from '../f95/types'

type LauncherCookieStatus = {
  configured: boolean
  source: 'settings' | 'env' | 'none'
  cookieNames: string[]
  missingRecommendedCookieNames: string[]
  updatedAtUnixMs: number | null
}

type LauncherCookieBackup = {
  source: 'settings' | 'env' | 'none'
  text: string | null
  updatedAtUnixMs: number | null
}

type LauncherLatestGamesResult = {
  threadItemList: F95ThreadItem[]
  pageFromResponse: number
  totalPages: number
}

type LauncherLocalDataFile = {
  path: string
  exists: boolean
  updatedAtUnixMs: number | null
}

type LauncherLocalDataSnapshot = {
  listsFile: LauncherLocalDataFile
  settingsFile: LauncherLocalDataFile
  catalogFile: LauncherLocalDataFile
  catalogCheckpointFile: LauncherLocalDataFile
  lists: unknown | null
  settings: unknown | null
  catalog: unknown | null
  catalogCheckpoint: unknown | null
}

export type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherLatestGamesResult,
  LauncherLocalDataFile,
  LauncherLocalDataSnapshot,
}
