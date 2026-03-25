import type { F95ThreadItem } from '../f95/types'

type LauncherGameStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'extracting'
  | 'installed'
  | 'error'

type LauncherAutomationDebugWindowMode = 'visible' | 'hidden'

type LauncherAutomationDebugInfo = {
  scenarioId: string | null
  scenarioLabel: string | null
  phase: string | null
  reasonCode: string | null
  note: string | null
  lastUrl: string | null
  retryAfterMs: number | null
  attemptCount: number
  lastUpdatedAtUnixMs: number | null
  windowMode: LauncherAutomationDebugWindowMode
  sessionDir: string | null
  logFilePath: string | null
  lastHtmlPath: string | null
  lastScreenshotPath: string | null
}

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
  downloadSpeedBytesPerSecond: number | null
  errorMessage: string | null
  sizeBytes: number | null
  automationDebug: LauncherAutomationDebugInfo | null
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

type LauncherInstallFolderRequest = {
  threadLink: string
  threadTitle: string
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

type LauncherLocalDataFile = {
  path: string
  exists: boolean
  updatedAtUnixMs: number | null
}

type LauncherLocalDataSnapshot = {
  listsFile: LauncherLocalDataFile
  settingsFile: LauncherLocalDataFile
  catalogFile: LauncherLocalDataFile
  lists: unknown | null
  settings: unknown | null
  catalog: unknown | null
}

export type {
  LauncherAutomationDebugInfo,
  LauncherAutomationDebugWindowMode,
  LauncherCookieBackup,
  LauncherCookieStatus,
  LauncherDownloadRequest,
  LauncherDownloadSource,
  LauncherGameRecord,
  LauncherGameStatus,
  LauncherInstallFolderRequest,
  LauncherLatestGamesResult,
  LauncherLocalDataFile,
  LauncherLocalDataSnapshot,
  LauncherLibrarySnapshot,
}
