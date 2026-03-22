import type { F95ThreadItem } from '../f95/types'

type LauncherGameStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'extracting'
  | 'installed'
  | 'error'

type LauncherGameRecord = {
  threadLink: string
  threadTitle: string
  status: LauncherGameStatus
  progressPercent: number | null
  message: string | null
  archivePath: string | null
  installDir: string | null
  launchTargetPath: string | null
  launchTargetName: string | null
  lastHostLabel: string | null
  lastDownloadUrl: string | null
  errorMessage: string | null
  updatedAtUnixMs: number
}

type LauncherDownloadSource = {
  downloadUrl: string
  hostLabel: string | null
}

type LauncherLibrarySnapshot = {
  libraryRootPath: string
  gamesByThreadLink: Record<string, LauncherGameRecord>
}

type LauncherDownloadRequest = {
  threadLink: string
  threadTitle: string
  downloadUrl: string
  hostLabel: string | null
  downloadSources?: LauncherDownloadSource[]
  manualOnly?: boolean
}

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

export type {
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherDownloadSource,
  LauncherGameRecord,
  LauncherGameStatus,
  LauncherLatestGamesResult,
  LauncherLibrarySnapshot,
}
