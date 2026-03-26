const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const {
  AUTOMATION_REASON_CODES,
  resolveDownloadHostScenario,
  runDownloadHostAutomationStep,
} = require('./download-host-automation.cjs')
let path7za = null

try {
  ;({ path7za } = require('7zip-bin'))
} catch {
  path7za = null
}

const APP_ROOT = path.resolve(__dirname, '..')
const F95_ORIGIN = 'https://f95zone.to'
const RECOMMENDED_COOKIE_NAMES = ['xf_user', 'xf_session', 'xf_csrf']
const DOWNLOAD_SESSION_PARTITION = 'persist:f95-tinder-downloads'
const DOWNLOAD_TIMEOUT_MS = 120_000
const MANUAL_DOWNLOAD_TIMEOUT_MS = 1000 * 60 * 15
const DOWNLOAD_POLL_INTERVAL_MS = 1_250
const SUPPORTED_ARCHIVE_EXTENSIONS = new Set(['.zip', '.7z', '.rar'])
const AUTOMATION_LOG_FILE_NAME = 'automation-log.jsonl'
const LAUNCHABLE_FILE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.lnk',
  '.html',
  '.htm',
  '.url',
])
const LAUNCH_TARGET_DIALOG_FILTERS = [
  {
    name: 'Launch Targets',
    extensions: ['exe', 'bat', 'cmd', 'lnk', 'html', 'htm', 'url'],
  },
]
const NEGATIVE_LAUNCH_NAME_PATTERN =
  /(unins|uninstall|vc_redist|redist|directx|dxsetup|crashpad|updater|notification_helper|elevate|cleanup|launcherupdater)/i
const NEGATIVE_LAUNCH_PATH_PATTERN =
  /(__macosx|_commonredist|redist|redistributable|directx|support|crashpad)/i
const isTruthyEnvFlag = (value) =>
  typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim())
const AUTOMATION_DEBUG_WINDOW_VISIBLE = isTruthyEnvFlag(
  process.env.F95_DEBUG_DOWNLOAD_WINDOW,
)
const AUTOMATION_DEBUG_ARTIFACTS = isTruthyEnvFlag(
  process.env.F95_DEBUG_DOWNLOAD_ARTIFACTS,
)

let mainWindow = null
let runtimeCookieState = null
let libraryState = null
let localDataFilesState = null
const activeDownloadJobs = new Map()

const normalizeOpenExternalOptions = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      background: false,
    }
  }

  return {
    background: value.background === true,
  }
}

const refocusWindowAfterExternalOpen = (browserWindow) => {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return
  }

  const attemptRefocus = () => {
    if (browserWindow.isDestroyed() || !browserWindow.isVisible()) {
      return
    }

    browserWindow.focus()
  }

  setTimeout(attemptRefocus, 0)
  setTimeout(attemptRefocus, 100)
}

const createCancelledDownloadError = () => {
  const error = new Error('Загрузка отменена пользователем.')
  error.code = 'DOWNLOAD_CANCELLED'
  return error
}

const isDownloadCancelledError = (error) => {
  return (
    Boolean(error && typeof error === 'object' && error.code === 'DOWNLOAD_CANCELLED') ||
    (error instanceof Error && error.message === 'Загрузка отменена пользователем.')
  )
}

const throwIfDownloadCancelled = (jobState) => {
  if (jobState?.cancelled) {
    throw createCancelledDownloadError()
  }
}

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true })
}

const isPathInsideDirectory = (directoryPath, targetPath) => {
  const relativePath = path.relative(directoryPath, targetPath)
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  )
}

const getFileSizeBytes = (targetPath) => {
  try {
    return fs.statSync(targetPath).size
  } catch {
    return 0
  }
}

const getDirectorySizeBytes = (targetPath) => {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return 0
  }

  let totalSizeBytes = 0
  const stack = [targetPath]

  while (stack.length > 0) {
    const currentDirectoryPath = stack.pop()
    if (!currentDirectoryPath) {
      continue
    }

    let directoryEntries = []
    try {
      directoryEntries = fs.readdirSync(currentDirectoryPath, {
        withFileTypes: true,
      })
    } catch {
      continue
    }

    for (const directoryEntry of directoryEntries) {
      const absolutePath = path.join(currentDirectoryPath, directoryEntry.name)

      if (directoryEntry.isDirectory()) {
        stack.push(absolutePath)
        continue
      }

      if (directoryEntry.isFile()) {
        totalSizeBytes += getFileSizeBytes(absolutePath)
      }
    }
  }

  return totalSizeBytes
}

const resolveInstalledGameSizeBytes = (record) => {
  if (
    typeof record?.installDir === 'string' &&
    record.installDir &&
    fs.existsSync(record.installDir)
  ) {
    return getDirectorySizeBytes(record.installDir)
  }

  if (
    typeof record?.archivePath === 'string' &&
    record.archivePath &&
    fs.existsSync(record.archivePath)
  ) {
    return getFileSizeBytes(record.archivePath)
  }

  return null
}

const delay = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })

const toJsonClone = (value) => JSON.parse(JSON.stringify(value))

const getCookieStorePath = () => path.resolve(process.cwd(), '.f95-cookie.local')

const getLibraryStatePath = () =>
  path.join(app.getPath('userData'), 'launcher-library.json')

const getLocalListsStatePath = () =>
  path.join(app.getPath('userData'), 'local-lists.json')

const getLocalSettingsStatePath = () =>
  path.join(app.getPath('userData'), 'local-settings.json')

const getLatestCatalogStatePath = () =>
  path.join(app.getPath('userData'), 'latest-catalog.json')

const getDefaultLibraryRoot = () => path.join(app.getPath('userData'), 'games')

const readJsonFile = (targetPath) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return null
    }

    return JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  } catch {
    return null
  }
}

const readJsonFileWithMetadata = (targetPath) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return {
        exists: false,
        updatedAtUnixMs: null,
        value: null,
      }
    }

    const stat = fs.statSync(targetPath)
    const fileText = fs.readFileSync(targetPath, 'utf8')
    let parsedValue = null

    try {
      parsedValue = fileText.trim() ? JSON.parse(fileText) : null
    } catch {
      parsedValue = null
    }

    return {
      exists: true,
      updatedAtUnixMs: Math.round(stat.mtimeMs),
      value: parsedValue,
    }
  } catch {
    return {
      exists: false,
      updatedAtUnixMs: null,
      value: null,
    }
  }
}

const writeJsonFile = (targetPath, value) => {
  ensureDirectory(path.dirname(targetPath))
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const parseThreadIdentifierFromLink = (threadLink) => {
  const match = /\/threads\/(\d+)/.exec(threadLink)
  if (!match) {
    return null
  }

  return Number(match[1])
}

const sanitizePathSegment = (value) => {
  const normalizedValue = value
    .normalize('NFKD')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizedValue) {
    return 'game'
  }

  return normalizedValue.slice(0, 80)
}

const sanitizeFileName = (value) => {
  const sanitizedValue = sanitizePathSegment(value)
  return sanitizedValue === 'game' ? 'download' : sanitizedValue
}

const buildGameFolderName = (threadLink, threadTitle) => {
  const threadIdentifier = parseThreadIdentifierFromLink(threadLink)
  const titlePart = sanitizePathSegment(threadTitle).replace(/\s+/g, '-')
  return threadIdentifier !== null
    ? `${threadIdentifier}-${titlePart}`
    : titlePart
}

const buildGameRootPath = (threadLink, threadTitle) =>
  path.join(libraryState.libraryRootPath, buildGameFolderName(threadLink, threadTitle))

const buildGameDebugRootPath = (threadLink, threadTitle) =>
  path.join(buildGameRootPath(threadLink, threadTitle), 'debug')

const formatDebugSessionId = (unixMs) => {
  const sessionDate = new Date(unixMs)
  const part = (value, length = 2) => String(value).padStart(length, '0')
  return [
    sessionDate.getFullYear(),
    part(sessionDate.getMonth() + 1),
    part(sessionDate.getDate()),
    '-',
    part(sessionDate.getHours()),
    part(sessionDate.getMinutes()),
    part(sessionDate.getSeconds()),
    '-',
    part(sessionDate.getMilliseconds(), 3),
  ].join('')
}

const normalizeAutomationWindowMode = (value) =>
  value === 'visible' ? 'visible' : 'hidden'

const createEmptyAutomationDebugInfo = (patch = {}) => ({
  scenarioId: null,
  scenarioLabel: null,
  phase: null,
  reasonCode: null,
  note: null,
  lastUrl: null,
  retryAfterMs: null,
  attemptCount: 0,
  lastUpdatedAtUnixMs: null,
  windowMode: 'hidden',
  sessionDir: null,
  logFilePath: null,
  lastHtmlPath: null,
  lastScreenshotPath: null,
  ...patch,
})

const createDownloadDebugState = (request) => {
  const createdAtUnixMs = Date.now()
  const windowMode = AUTOMATION_DEBUG_WINDOW_VISIBLE ? 'visible' : 'hidden'
  const sessionDir = path.join(
    buildGameDebugRootPath(request.threadLink, request.threadTitle),
    formatDebugSessionId(createdAtUnixMs),
  )
  const logFilePath = path.join(sessionDir, AUTOMATION_LOG_FILE_NAME)

  return {
    sessionDir,
    logFilePath,
    eventSequence: 0,
    artifactSequence: 0,
    info: createEmptyAutomationDebugInfo({
      phase: 'queued',
      note: 'Загрузка поставлена в очередь.',
      lastUrl:
        typeof request.downloadUrl === 'string' ? request.downloadUrl : null,
      lastUpdatedAtUnixMs: createdAtUnixMs,
      windowMode,
      sessionDir,
      logFilePath,
    }),
  }
}

const createEmptyCookieState = () => ({
  header: '',
  source: 'none',
  updatedAtUnixMs: null,
})

const createDefaultGameRecord = (threadLink, threadTitle = '') => ({
  threadLink,
  threadTitle,
  status: 'queued',
  progressPercent: null,
  message: null,
  archivePath: null,
  installDir: null,
  launchTargetPath: null,
  launchTargetName: null,
  lastHostLabel: null,
  lastDownloadUrl: null,
  downloadSpeedBytesPerSecond: null,
  errorMessage: null,
  sizeBytes: null,
  automationDebug: null,
  updatedAtUnixMs: Date.now(),
})

const createDefaultLibraryState = () => ({
  libraryRootPath: getDefaultLibraryRoot(),
  gamesByThreadLink: {},
})

const loadLocalDataFilesState = () => ({
  lists: readJsonFileWithMetadata(getLocalListsStatePath()),
  settings: readJsonFileWithMetadata(getLocalSettingsStatePath()),
  catalog: readJsonFileWithMetadata(getLatestCatalogStatePath()),
})

const buildLocalDataFileDescriptor = (targetPath, entry) => ({
  path: targetPath,
  exists: Boolean(entry?.exists),
  updatedAtUnixMs:
    typeof entry?.updatedAtUnixMs === 'number' ? entry.updatedAtUnixMs : null,
})

const buildLocalDataFilesSnapshot = () => ({
  listsFile: buildLocalDataFileDescriptor(getLocalListsStatePath(), localDataFilesState?.lists),
  settingsFile: buildLocalDataFileDescriptor(
    getLocalSettingsStatePath(),
    localDataFilesState?.settings,
  ),
  catalogFile: buildLocalDataFileDescriptor(
    getLatestCatalogStatePath(),
    localDataFilesState?.catalog,
  ),
  lists: localDataFilesState?.lists?.value ? toJsonClone(localDataFilesState.lists.value) : null,
  settings: localDataFilesState?.settings?.value
    ? toJsonClone(localDataFilesState.settings.value)
    : null,
  catalog: localDataFilesState?.catalog?.value
    ? toJsonClone(localDataFilesState.catalog.value)
    : null,
})

const writeLocalDataFileValue = (fileKind, value) => {
  const targetPath =
    fileKind === 'lists'
      ? getLocalListsStatePath()
      : fileKind === 'catalog'
        ? getLatestCatalogStatePath()
        : getLocalSettingsStatePath()

  if (value === null || value === undefined) {
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath)
      }
    } catch {
      // ignore
    }

    localDataFilesState[fileKind] = {
      exists: false,
      updatedAtUnixMs: null,
      value: null,
    }

    return buildLocalDataFilesSnapshot()
  }

  const nextValue = toJsonClone(value)
  writeJsonFile(targetPath, nextValue)
  localDataFilesState[fileKind] = {
    exists: true,
    updatedAtUnixMs: Date.now(),
    value: nextValue,
  }

  return buildLocalDataFilesSnapshot()
}

const patchLocalSettingsFileValue = (patch) => {
  const currentValue = localDataFilesState?.settings?.value
  if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
    return buildLocalDataFilesSnapshot()
  }

  return writeLocalDataFileValue('settings', {
    ...currentValue,
    ...patch,
  })
}

const normalizeAutomationDebugInfo = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const debugInfo = value
  return createEmptyAutomationDebugInfo({
    scenarioId:
      typeof debugInfo.scenarioId === 'string' ? debugInfo.scenarioId : null,
    scenarioLabel:
      typeof debugInfo.scenarioLabel === 'string'
        ? debugInfo.scenarioLabel
        : null,
    phase: typeof debugInfo.phase === 'string' ? debugInfo.phase : null,
    reasonCode:
      typeof debugInfo.reasonCode === 'string' ? debugInfo.reasonCode : null,
    note: typeof debugInfo.note === 'string' ? debugInfo.note : null,
    lastUrl: typeof debugInfo.lastUrl === 'string' ? debugInfo.lastUrl : null,
    retryAfterMs:
      typeof debugInfo.retryAfterMs === 'number' &&
      Number.isFinite(debugInfo.retryAfterMs) &&
      debugInfo.retryAfterMs > 0
        ? Math.round(debugInfo.retryAfterMs)
        : null,
    attemptCount:
      typeof debugInfo.attemptCount === 'number' &&
      Number.isFinite(debugInfo.attemptCount) &&
      debugInfo.attemptCount >= 0
        ? Math.max(0, Math.floor(debugInfo.attemptCount))
        : 0,
    lastUpdatedAtUnixMs:
      typeof debugInfo.lastUpdatedAtUnixMs === 'number' &&
      Number.isFinite(debugInfo.lastUpdatedAtUnixMs)
        ? debugInfo.lastUpdatedAtUnixMs
        : null,
    windowMode: normalizeAutomationWindowMode(debugInfo.windowMode),
    sessionDir:
      typeof debugInfo.sessionDir === 'string' ? debugInfo.sessionDir : null,
    logFilePath:
      typeof debugInfo.logFilePath === 'string' ? debugInfo.logFilePath : null,
    lastHtmlPath:
      typeof debugInfo.lastHtmlPath === 'string' ? debugInfo.lastHtmlPath : null,
    lastScreenshotPath:
      typeof debugInfo.lastScreenshotPath === 'string'
        ? debugInfo.lastScreenshotPath
        : null,
  })
}

const normalizeGameRecord = (threadLink, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value
  const statusValue = record.status
  if (
    statusValue !== 'queued' &&
    statusValue !== 'resolving' &&
    statusValue !== 'downloading' &&
    statusValue !== 'extracting' &&
    statusValue !== 'installed' &&
    statusValue !== 'error'
  ) {
    return null
  }

  return {
    threadLink,
    threadTitle:
      typeof record.threadTitle === 'string' ? record.threadTitle : threadLink,
    status: statusValue,
    progressPercent:
      typeof record.progressPercent === 'number' ? record.progressPercent : null,
    message: typeof record.message === 'string' ? record.message : null,
    archivePath:
      typeof record.archivePath === 'string' ? record.archivePath : null,
    installDir: typeof record.installDir === 'string' ? record.installDir : null,
    launchTargetPath:
      typeof record.launchTargetPath === 'string' ? record.launchTargetPath : null,
    launchTargetName:
      typeof record.launchTargetName === 'string' ? record.launchTargetName : null,
    lastHostLabel:
      typeof record.lastHostLabel === 'string' ? record.lastHostLabel : null,
    lastDownloadUrl:
      typeof record.lastDownloadUrl === 'string' ? record.lastDownloadUrl : null,
    downloadSpeedBytesPerSecond:
      typeof record.downloadSpeedBytesPerSecond === 'number' &&
      Number.isFinite(record.downloadSpeedBytesPerSecond) &&
      record.downloadSpeedBytesPerSecond >= 0
        ? record.downloadSpeedBytesPerSecond
        : null,
    errorMessage:
      typeof record.errorMessage === 'string' ? record.errorMessage : null,
    sizeBytes:
      typeof record.sizeBytes === 'number' &&
      Number.isFinite(record.sizeBytes) &&
      record.sizeBytes >= 0
        ? record.sizeBytes
        : statusValue === 'installed'
        ? resolveInstalledGameSizeBytes(record)
        : null,
    automationDebug: normalizeAutomationDebugInfo(record.automationDebug),
    updatedAtUnixMs:
      typeof record.updatedAtUnixMs === 'number'
        ? record.updatedAtUnixMs
        : Date.now(),
  }
}

const loadLibraryState = () => {
  const parsedValue = readJsonFile(getLibraryStatePath())
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return createDefaultLibraryState()
  }

  const gamesByThreadLink = {}
  const rawGames =
    parsedValue.gamesByThreadLink &&
    typeof parsedValue.gamesByThreadLink === 'object' &&
    !Array.isArray(parsedValue.gamesByThreadLink)
      ? parsedValue.gamesByThreadLink
      : {}

  for (const [threadLink, rawRecord] of Object.entries(rawGames)) {
    const normalizedRecord = normalizeGameRecord(threadLink, rawRecord)
    if (normalizedRecord) {
      gamesByThreadLink[threadLink] = normalizedRecord
    }
  }

  return {
    libraryRootPath:
      typeof parsedValue.libraryRootPath === 'string' &&
      parsedValue.libraryRootPath.trim().length > 0
        ? parsedValue.libraryRootPath
        : getDefaultLibraryRoot(),
    gamesByThreadLink,
  }
}

const persistLibraryState = () => {
  ensureDirectory(libraryState.libraryRootPath)
  writeJsonFile(getLibraryStatePath(), libraryState)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('launcher:librarySnapshot', toJsonClone(libraryState))
  }
}

const updateGameRecord = (threadLink, patch) => {
  const currentRecord =
    libraryState.gamesByThreadLink[threadLink] ??
    createDefaultGameRecord(threadLink, patch.threadTitle)

  const nextRecord = {
    ...currentRecord,
    ...patch,
    threadLink,
    threadTitle:
      typeof patch.threadTitle === 'string' && patch.threadTitle.trim().length > 0
        ? patch.threadTitle
        : currentRecord.threadTitle,
    updatedAtUnixMs: Date.now(),
  }

  libraryState.gamesByThreadLink[threadLink] = nextRecord
  persistLibraryState()
  return nextRecord
}

const ensureAutomationDebugDirectory = (jobState) => {
  const sessionDir = jobState?.debug?.sessionDir
  if (!sessionDir) {
    return null
  }

  ensureDirectory(sessionDir)
  return sessionDir
}

const buildAutomationDebugLogEntry = (jobState, eventType, payload = {}) => ({
  sequence: (jobState?.debug?.eventSequence ?? 0) + 1,
  atUnixMs: Date.now(),
  eventType,
  ...payload,
})

const appendAutomationDebugLogEntry = (jobState, entry) => {
  if (!jobState?.debug?.logFilePath) {
    return
  }

  const sessionDir = ensureAutomationDebugDirectory(jobState)
  if (!sessionDir) {
    return
  }

  try {
    fs.appendFileSync(
      jobState.debug.logFilePath,
      `${JSON.stringify(entry)}\n`,
      'utf8',
    )
    jobState.debug.eventSequence = entry.sequence
  } catch {
    // ignore debug write failures
  }
}

const updateAutomationDebugInfo = (request, jobState, patch = {}) => {
  if (!jobState?.debug) {
    return null
  }

  const nextInfo = createEmptyAutomationDebugInfo({
    ...jobState.debug.info,
    ...patch,
    windowMode: normalizeAutomationWindowMode(
      patch.windowMode ?? jobState.debug.info.windowMode,
    ),
    sessionDir: jobState.debug.sessionDir,
    logFilePath: jobState.debug.logFilePath,
    lastUpdatedAtUnixMs: Date.now(),
  })

  jobState.debug.info = nextInfo
  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    automationDebug: nextInfo,
  })
  return nextInfo
}

const getBrowserWindowDebugUrl = (browserWindow, fallbackUrl = null) => {
  try {
    const targetUrl = browserWindow?.webContents?.getURL?.()
    return typeof targetUrl === 'string' && targetUrl.trim().length > 0
      ? targetUrl
      : fallbackUrl
  } catch {
    return fallbackUrl
  }
}

const captureAutomationArtifacts = async (
  browserWindow,
  request,
  jobState,
  label,
) => {
  if (!browserWindow || browserWindow.isDestroyed() || !jobState?.debug) {
    return {
      htmlPath: null,
      screenshotPath: null,
    }
  }

  const sessionDir = ensureAutomationDebugDirectory(jobState)
  if (!sessionDir) {
    return {
      htmlPath: null,
      screenshotPath: null,
    }
  }

  const nextArtifactIndex = (jobState.debug.artifactSequence ?? 0) + 1
  jobState.debug.artifactSequence = nextArtifactIndex
  const artifactBaseName = `${String(nextArtifactIndex).padStart(3, '0')}-${sanitizeFileName(
    label,
  )}`
  const htmlPath = path.join(sessionDir, `${artifactBaseName}.html`)
  const screenshotPath = path.join(sessionDir, `${artifactBaseName}.png`)
  let savedHtmlPath = null
  let savedScreenshotPath = null

  try {
    const htmlText = await browserWindow.webContents.executeJavaScript(
      'document.documentElement?.outerHTML ?? ""',
      true,
    )
    if (typeof htmlText === 'string' && htmlText.length > 0) {
      fs.writeFileSync(htmlPath, htmlText, 'utf8')
      savedHtmlPath = htmlPath
    }
  } catch {
    // ignore artifact capture failures
  }

  try {
    const image = await browserWindow.webContents.capturePage()
    const imageBuffer = image?.toPNG?.()
    if (imageBuffer) {
      fs.writeFileSync(screenshotPath, imageBuffer)
      savedScreenshotPath = screenshotPath
    }
  } catch {
    // ignore artifact capture failures
  }

  updateAutomationDebugInfo(request, jobState, {
    lastHtmlPath: savedHtmlPath ?? jobState.debug.info.lastHtmlPath,
    lastScreenshotPath:
      savedScreenshotPath ?? jobState.debug.info.lastScreenshotPath,
  })

  return {
    htmlPath: savedHtmlPath,
    screenshotPath: savedScreenshotPath,
  }
}

const logAutomationEvent = (jobState, eventType, payload = {}) => {
  const entry = buildAutomationDebugLogEntry(jobState, eventType, payload)
  appendAutomationDebugLogEntry(jobState, entry)
}

const logAutomationStepResult = async (
  browserWindow,
  request,
  jobState,
  automationState,
  automationResult,
) => {
  const nextDebugInfo = updateAutomationDebugInfo(request, jobState, {
    scenarioId:
      typeof automationResult?.scenarioId === 'string'
        ? automationResult.scenarioId
        : automationState?.hostScenarioId ?? null,
    scenarioLabel:
      typeof automationResult?.scenarioLabel === 'string'
        ? automationResult.scenarioLabel
        : automationState?.hostScenarioLabel ?? null,
    phase:
      typeof automationResult?.phase === 'string' ? automationResult.phase : null,
    reasonCode:
      typeof automationResult?.reasonCode === 'string'
        ? automationResult.reasonCode
        : automationResult?.hasCaptcha
        ? AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED
        : null,
    note:
      typeof automationResult?.note === 'string'
        ? automationResult.note
        : typeof automationResult?.label === 'string'
        ? automationResult.label
        : null,
    lastUrl: getBrowserWindowDebugUrl(
      browserWindow,
      automationResult?.location ?? request.downloadUrl,
    ),
    retryAfterMs:
      typeof automationResult?.retryAfterMs === 'number'
        ? automationResult.retryAfterMs
        : null,
    attemptCount:
      typeof automationState?.hostScenarioAttempts === 'number'
        ? automationState.hostScenarioAttempts
        : jobState?.debug?.info?.attemptCount ?? 0,
  })

  logAutomationEvent(jobState, 'automation_step', {
    threadLink: request.threadLink,
    hostLabel: request.hostLabel ?? null,
    automationResult,
    automationDebug: nextDebugInfo,
  })

  if (
    AUTOMATION_DEBUG_ARTIFACTS &&
    (automationResult?.clicked || automationResult?.reasonCode)
  ) {
    await captureAutomationArtifacts(
      browserWindow,
      request,
      jobState,
      automationResult?.phase || automationResult?.scenarioId || 'automation-step',
    )
  }
}

const recordAutomationFailure = async (
  browserWindow,
  request,
  jobState,
  error,
  stage,
) => {
  const errorCode = getDownloadAutomationErrorCode(error)
  const errorMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'Неизвестная ошибка automation.'
  const lastAutomationResult = error?.automationResult ?? null
  const artifactPaths = await captureAutomationArtifacts(
    browserWindow,
    request,
    jobState,
    `${stage}-failure`,
  )
  const nextDebugInfo = updateAutomationDebugInfo(request, jobState, {
    phase:
      typeof lastAutomationResult?.phase === 'string'
        ? lastAutomationResult.phase
        : stage,
    reasonCode: errorCode ?? AUTOMATION_REASON_CODES.AUTOMATION_ERROR,
    note: errorMessage,
    lastUrl: getBrowserWindowDebugUrl(
      browserWindow,
      lastAutomationResult?.location ?? request.downloadUrl,
    ),
    retryAfterMs: null,
    lastHtmlPath:
      artifactPaths.htmlPath ?? jobState?.debug?.info?.lastHtmlPath ?? null,
    lastScreenshotPath:
      artifactPaths.screenshotPath ??
      jobState?.debug?.info?.lastScreenshotPath ??
      null,
  })

  logAutomationEvent(jobState, 'automation_failure', {
    threadLink: request.threadLink,
    hostLabel: request.hostLabel ?? null,
    stage,
    error: {
      code: errorCode,
      message: errorMessage,
    },
    automationResult: lastAutomationResult,
    automationDebug: nextDebugInfo,
    artifactPaths,
  })
}

const loadRuntimeCookieState = (envCookieHeader = '') => {
  try {
    const cookieStorePath = getCookieStorePath()
    if (fs.existsSync(cookieStorePath)) {
      const fileText = fs.readFileSync(cookieStorePath, 'utf8').trim()
      if (fileText) {
        const stat = fs.statSync(cookieStorePath)
        return {
          header: fileText,
          source: 'settings',
          updatedAtUnixMs: Math.round(stat.mtimeMs),
        }
      }
    }
  } catch {
    // ignore
  }

  if (typeof envCookieHeader === 'string' && envCookieHeader.trim()) {
    return {
      header: envCookieHeader.trim(),
      source: 'env',
      updatedAtUnixMs: null,
    }
  }

  return createEmptyCookieState()
}

const unwrapCookieInput = (value) => {
  let normalizedValue = value.trim()

  if (normalizedValue.startsWith('F95_COOKIE=')) {
    normalizedValue = normalizedValue.slice('F95_COOKIE='.length).trim()
  }

  if (
    (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
    (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
  ) {
    normalizedValue = normalizedValue.slice(1, -1).trim()
  }

  return normalizedValue
}

const isF95Domain = (value) => {
  const normalizedValue = value.trim().replace(/^\./, '').toLowerCase()
  return normalizedValue === 'f95zone.to' || normalizedValue.endsWith('.f95zone.to')
}

const appendCookiePair = (cookieMap, name, value) => {
  const normalizedName = name.trim()
  const normalizedValue = value.trim()
  if (!normalizedName || !normalizedValue) {
    return
  }

  cookieMap.set(normalizedName, normalizedValue)
}

const extractCookiePairsFromHeader = (value) => {
  const cookieMap = new Map()
  const normalizedValue = unwrapCookieInput(value).replace(/\r?\n/g, '; ')

  for (const part of normalizedValue.split(';')) {
    const trimmedPart = part.trim()
    const separatorIndex = trimmedPart.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    appendCookiePair(
      cookieMap,
      trimmedPart.slice(0, separatorIndex),
      trimmedPart.slice(separatorIndex + 1),
    )
  }

  return Array.from(cookieMap.entries())
}

const extractCookiePairsFromJson = (value) => {
  try {
    const parsedValue = JSON.parse(value)
    const cookieMap = new Map()

    if (Array.isArray(parsedValue)) {
      for (const item of parsedValue) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          continue
        }

        const nameValue = item.name
        const cookieValue = item.value
        const domainValue = item.domain

        if (typeof nameValue !== 'string' || typeof cookieValue !== 'string') {
          continue
        }

        if (typeof domainValue === 'string' && !isF95Domain(domainValue)) {
          continue
        }

        appendCookiePair(cookieMap, nameValue, cookieValue)
      }
    } else if (parsedValue && typeof parsedValue === 'object') {
      for (const [key, cookieValue] of Object.entries(parsedValue)) {
        if (typeof cookieValue === 'string') {
          appendCookiePair(cookieMap, key, cookieValue)
        }
      }
    }

    return Array.from(cookieMap.entries())
  } catch {
    return []
  }
}

const extractCookiePairsFromTable = (value) => {
  const cookieMap = new Map()
  const lineList = value.replace(/\r/g, '').split('\n')

  for (const rawLine of lineList) {
    const trimmedLine = rawLine.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    if (/^name\s+value/i.test(trimmedLine)) {
      continue
    }

    if (trimmedLine.includes('\t')) {
      const tokenList = trimmedLine
        .split('\t')
        .map((item) => item.trim())
        .filter(Boolean)

      if (tokenList.length >= 7 && isF95Domain(tokenList[0])) {
        appendCookiePair(cookieMap, tokenList[5], tokenList[6])
        continue
      }

      if (
        tokenList.length >= 3 &&
        isF95Domain(tokenList[2]) &&
        tokenList[0].toLowerCase() !== 'name'
      ) {
        appendCookiePair(cookieMap, tokenList[0], tokenList[1])
        continue
      }

      if (tokenList.length >= 2 && /^xf_/i.test(tokenList[0])) {
        appendCookiePair(cookieMap, tokenList[0], tokenList[1])
        continue
      }
    }

    const tokenList = trimmedLine.split(/\s+/)
    if (tokenList.length >= 2 && /^xf_/i.test(tokenList[0])) {
      appendCookiePair(cookieMap, tokenList[0], tokenList[1])
    }
  }

  return Array.from(cookieMap.entries())
}

const extractCookiePairsFromInput = (value) => {
  const normalizedValue = unwrapCookieInput(value)
  if (!normalizedValue) {
    return []
  }

  const jsonPairs = extractCookiePairsFromJson(normalizedValue)
  if (jsonPairs.length > 0) {
    return jsonPairs
  }

  const tablePairs = extractCookiePairsFromTable(normalizedValue)
  if (tablePairs.length > 0) {
    return tablePairs
  }

  return extractCookiePairsFromHeader(normalizedValue)
}

const serializeCookiePairs = (cookiePairList) =>
  cookiePairList.map(([name, value]) => `${name}=${value}`).join('; ')

const extractCookieNames = (headerValue) =>
  extractCookiePairsFromHeader(headerValue).map(([name]) => name)

const buildCookieStatus = (cookieState) => {
  const cookieNameList = extractCookieNames(cookieState.header)
  const normalizedCookieNameList = cookieNameList.map((item) => item.toLowerCase())

  return {
    configured: cookieState.header.length > 0,
    source: cookieState.source,
    cookieNames: cookieNameList,
    missingRecommendedCookieNames: RECOMMENDED_COOKIE_NAMES.filter(
      (cookieName) => !normalizedCookieNameList.includes(cookieName),
    ),
    updatedAtUnixMs: cookieState.updatedAtUnixMs,
  }
}

const buildCookieBackup = (cookieState) => ({
  source: cookieState.source,
  text: cookieState.source === 'settings' && cookieState.header ? cookieState.header : null,
  updatedAtUnixMs: cookieState.updatedAtUnixMs,
})

const saveCookieInput = (text) => {
  const cookiePairList = extractCookiePairsFromInput(text)
  if (cookiePairList.length === 0) {
    throw new Error(
      'Не удалось распознать куки. Вставь F95_COOKIE, cookies.txt, JSON или таблицу из DevTools.',
    )
  }

  const nextHeaderValue = serializeCookiePairs(cookiePairList)
  fs.writeFileSync(getCookieStorePath(), `${nextHeaderValue}\n`, 'utf8')
  runtimeCookieState = {
    header: nextHeaderValue,
    source: 'settings',
    updatedAtUnixMs: Date.now(),
  }
  patchLocalSettingsFileValue({
    cookieProxy: buildCookieBackup(runtimeCookieState),
  })

  return buildCookieStatus(runtimeCookieState)
}

const clearCookieInput = () => {
  try {
    const cookieStorePath = getCookieStorePath()
    if (fs.existsSync(cookieStorePath)) {
      fs.unlinkSync(cookieStorePath)
    }
  } catch {
    // ignore
  }

  runtimeCookieState = loadRuntimeCookieState(process.env.F95_COOKIE?.trim())
  patchLocalSettingsFileValue({
    cookieProxy: buildCookieBackup(runtimeCookieState),
  })
  return buildCookieStatus(runtimeCookieState)
}

const createF95Headers = (acceptValue) => {
  const headers = new Headers()
  headers.set('Accept', acceptValue)
  if (runtimeCookieState.header) {
    headers.set('cookie', runtimeCookieState.header)
  }
  return headers
}

const normalizeLatestGamesSort = (value) => {
  return value === 'views' ? 'views' : 'date'
}

const normalizeLatestGamesFilterIdList = (value, limit = Number.POSITIVE_INFINITY) => {
  if (!Array.isArray(value)) {
    return []
  }

  const normalizedIdList = []
  const seenIdSet = new Set()

  for (const item of value) {
    const parsedValue =
      typeof item === 'number'
        ? item
        : typeof item === 'string'
          ? Number(item)
          : Number.NaN

    if (
      !Number.isInteger(parsedValue) ||
      seenIdSet.has(parsedValue) ||
      normalizedIdList.length >= limit
    ) {
      continue
    }

    seenIdSet.add(parsedValue)
    normalizedIdList.push(parsedValue)
  }

  return normalizedIdList
}

const normalizeLatestGamesFilterState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const includeTagIds = normalizeLatestGamesFilterIdList(value.includeTagIds, 10)
  const excludeTagIds = normalizeLatestGamesFilterIdList(value.excludeTagIds, 10).filter(
    (tagId) => !includeTagIds.includes(tagId),
  )
  const includePrefixIds = normalizeLatestGamesFilterIdList(value.includePrefixIds)
  const excludePrefixIds = normalizeLatestGamesFilterIdList(value.excludePrefixIds).filter(
    (prefixId) => !includePrefixIds.includes(prefixId),
  )

  return {
    searchText: typeof value.searchText === 'string' ? value.searchText.trim() : '',
    includeTagIds,
    excludeTagIds,
    includePrefixIds,
    excludePrefixIds,
  }
}

const hasLatestGamesServerFilters = (filterState) => {
  return Boolean(
    filterState &&
      (
        filterState.searchText.length > 0 ||
        filterState.includeTagIds.length > 0 ||
        filterState.excludeTagIds.length > 0 ||
        filterState.includePrefixIds.length > 0 ||
        filterState.excludePrefixIds.length > 0
      ),
  )
}

const encodeLatestGamesRequestKey = (value) =>
  encodeURIComponent(value)
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')

const serializeLatestGamesRequestEntries = (entries) => {
  return entries
    .map(([key, value]) => `${encodeLatestGamesRequestKey(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

const buildLatestGamesRequestEntries = (
  pageNumber,
  latestGamesSort = 'date',
  filterState,
  includeTimestamp = true,
) => {
  const normalizedFilterState = normalizeLatestGamesFilterState(filterState)
  const entries = [
    ['cmd', 'list'],
    ['cat', 'games'],
    ['page', String(pageNumber)],
  ]

  if (hasLatestGamesServerFilters(normalizedFilterState)) {
    if (normalizedFilterState.searchText.length > 0) {
      entries.push(['search', normalizedFilterState.searchText])
    }

    normalizedFilterState.includePrefixIds.forEach((prefixId) => {
      entries.push(['prefixes[]', String(prefixId)])
    })
    normalizedFilterState.excludePrefixIds.forEach((prefixId) => {
      entries.push(['noprefixes[]', String(prefixId)])
    })
    normalizedFilterState.includeTagIds.forEach((tagId) => {
      entries.push(['tags[]', String(tagId)])
    })
    normalizedFilterState.excludeTagIds.forEach((tagId) => {
      entries.push(['notags[]', String(tagId)])
    })
  }

  entries.push(['sort', normalizeLatestGamesSort(latestGamesSort)])

  if (includeTimestamp) {
    entries.push(['_', String(Date.now())])
  }

  return entries
}

const buildLatestGamesEndpointUrl = (pageNumber, latestGamesSort = 'date', filterState) => {
  return `/sam/latest_alpha/latest_data.php?${serializeLatestGamesRequestEntries(
    buildLatestGamesRequestEntries(pageNumber, latestGamesSort, filterState),
  )}`
}

const fetchLatestGamesPage = async (
  pageNumber,
  latestGamesSort = 'date',
  filterState,
) => {
  const response = await fetch(
    new URL(
      buildLatestGamesEndpointUrl(pageNumber, latestGamesSort, filterState),
      F95_ORIGIN,
    ),
    {
      method: 'GET',
      headers: createF95Headers('application/json'),
    },
  )

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Не удалось проверить обновления: F95 вернул неожиданный ответ. Похоже, куки устарели или сломались. Обнови их во вкладке Куки.',
      )
    }

    throw new Error(`Network error: ${response.status}`)
  }

  const responseText = await response.text()
  let parsedJson = null

  try {
    parsedJson = JSON.parse(responseText)
  } catch {
    throw new Error(
      'Не удалось проверить обновления: F95 вернул неожиданный ответ. Похоже, куки устарели или сломались. Обнови их во вкладке Куки.',
    )
  }

  if (
    !parsedJson ||
    parsedJson.status !== 'ok' ||
    !parsedJson.msg ||
    !Array.isArray(parsedJson.msg.data)
  ) {
    throw new Error(
      'Не удалось проверить обновления: F95 вернул неожиданный ответ. Похоже, куки устарели или сломались. Обнови их во вкладке Куки.',
    )
  }

  return {
    threadItemList: parsedJson.msg.data,
    pageFromResponse: parsedJson.msg.pagination?.page ?? pageNumber,
    totalPages: parsedJson.msg.pagination?.total ?? 0,
  }
}

const fetchThreadPageHtml = async (threadLink) => {
  const response = await fetch(threadLink, {
    method: 'GET',
    headers: createF95Headers('text/html'),
  })

  if (!response.ok) {
    throw new Error(`Не удалось загрузить тред: ${response.status}`)
  }

  return response.text()
}

const resolveBundledLookupPath = (fileName) => {
  const candidatePathList = [
    path.join(APP_ROOT, 'public', fileName),
    path.join(APP_ROOT, 'dist', fileName),
    path.join(app.getAppPath(), 'dist', fileName),
    path.join(app.getAppPath(), 'public', fileName),
  ]

  return candidatePathList.find((candidatePath) => fs.existsSync(candidatePath)) ?? null
}

const loadBundledLookupMap = (fileName) => {
  const bundledLookupPath = resolveBundledLookupPath(fileName)
  if (!bundledLookupPath) {
    throw new Error(`Не удалось найти ${fileName}`)
  }

  const parsedValue = JSON.parse(fs.readFileSync(bundledLookupPath, 'utf8'))
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error(`${fileName} имеет неверный формат`)
  }

  return parsedValue
}

const loadBundledTagsMap = () => loadBundledLookupMap('tags.json')

const loadBundledPrefixesMap = () => loadBundledLookupMap('prefixes.json')

const safeDestroyWindow = (targetWindow) => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return
  }

  targetWindow.destroy()
}

const createDownloadWindow = (show) =>
  new BrowserWindow({
    show,
    width: 1320,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      partition: DOWNLOAD_SESSION_PARTITION,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

const getHiddenDownloadWindow = () => createDownloadWindow(false)

const getVisibleDownloadWindow = () => createDownloadWindow(true)

const getAutomaticDownloadWindow = () =>
  AUTOMATION_DEBUG_WINDOW_VISIBLE
    ? getVisibleDownloadWindow()
    : getHiddenDownloadWindow()

const isSupportedArchiveFileName = (fileName) =>
  SUPPORTED_ARCHIVE_EXTENSIONS.has(path.extname(fileName).toLowerCase())

const isLaunchableFileName = (fileName) =>
  LAUNCHABLE_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase())

const normalizeForMatch = (value) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const applyF95CookiesToSession = async (targetSession) => {
  const cookiePairList = extractCookiePairsFromHeader(runtimeCookieState.header)
  for (const [name, value] of cookiePairList) {
    await targetSession.cookies.set({
      url: F95_ORIGIN,
      domain: 'f95zone.to',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'lax',
      name,
      value,
    })
  }
}

const formatDownloadProgress = (receivedBytes, totalBytes) => {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return null
  }

  return Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100)))
}

const removeDirectoryWithRetries = async (targetPath, attemptCount = 6) => {
  let lastError = null

  for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      await delay(120)
    }
  }

  if (lastError) {
    throw lastError
  }
}

const clearCancelledDownloadArtifacts = async (threadLink, threadTitle) => {
  const gameRoot = buildGameRootPath(threadLink, threadTitle)

  try {
    await removeDirectoryWithRetries(gameRoot)
  } catch (error) {
    updateGameRecord(threadLink, {
      threadTitle,
      status: 'error',
      progressPercent: null,
      message: null,
      archivePath: null,
      installDir: null,
      launchTargetPath: null,
      launchTargetName: null,
      lastDownloadUrl: null,
      downloadSpeedBytesPerSecond: null,
      errorMessage:
        error instanceof Error
          ? `Загрузка отменена, но не удалось удалить временные файлы: ${error.message}`
          : 'Загрузка отменена, но не удалось удалить временные файлы.',
      sizeBytes: null,
    })
    return
  }

  if (!libraryState.gamesByThreadLink[threadLink]) {
    return
  }

  const nextGamesByThreadLink = { ...libraryState.gamesByThreadLink }
  delete nextGamesByThreadLink[threadLink]
  libraryState = {
    ...libraryState,
    gamesByThreadLink: nextGamesByThreadLink,
  }
  persistLibraryState()
}

const extractArchiveToInstallDir = async (archivePath, gameRoot, jobState) => {
  if (!path7za) {
    throw new Error('Не найден 7zip-bin. Распаковка недоступна.')
  }

  throwIfDownloadCancelled(jobState)

  const nextInstallDir = path.join(gameRoot, 'current.next')
  const finalInstallDir = path.join(gameRoot, 'current')

  fs.rmSync(nextInstallDir, { recursive: true, force: true })
  ensureDirectory(nextInstallDir)

  await new Promise((resolve, reject) => {
    const childProcess = spawn(
      path7za,
      ['x', archivePath, `-o${nextInstallDir}`, '-y'],
      {
        windowsHide: true,
      },
    )
    if (jobState) {
      jobState.extractProcess = childProcess
    }

    let stderrText = ''
    childProcess.stderr.on('data', (chunk) => {
      stderrText += chunk.toString('utf8')
    })

    childProcess.once('error', (error) => {
      reject(error)
    })

    childProcess.once('close', (exitCode) => {
      if (jobState?.extractProcess === childProcess) {
        jobState.extractProcess = null
      }

      if (jobState?.cancelled) {
        reject(createCancelledDownloadError())
        return
      }

      if (exitCode === 0 || exitCode === 1) {
        resolve()
        return
      }

      reject(
        new Error(stderrText.trim() || `7z завершился с кодом ${String(exitCode)}`),
      )
    })
  })

  throwIfDownloadCancelled(jobState)

  fs.rmSync(finalInstallDir, { recursive: true, force: true })
  fs.renameSync(nextInstallDir, finalInstallDir)
  return finalInstallDir
}

const collectLaunchCandidates = (rootDir) => {
  const candidateList = []
  const stack = [{ directoryPath: rootDir, depth: 0 }]

  while (stack.length > 0) {
    const currentEntry = stack.pop()
    if (!currentEntry) {
      continue
    }

    let directoryEntries = []
    try {
      directoryEntries = fs.readdirSync(currentEntry.directoryPath, {
        withFileTypes: true,
      })
    } catch {
      continue
    }

    for (const directoryEntry of directoryEntries) {
      const absolutePath = path.join(currentEntry.directoryPath, directoryEntry.name)
      const relativePath = path.relative(rootDir, absolutePath)

      if (directoryEntry.isDirectory()) {
        if (NEGATIVE_LAUNCH_PATH_PATTERN.test(relativePath)) {
          continue
        }

        stack.push({ directoryPath: absolutePath, depth: currentEntry.depth + 1 })
        continue
      }

      if (!directoryEntry.isFile() || !isLaunchableFileName(directoryEntry.name)) {
        continue
      }

      if (NEGATIVE_LAUNCH_NAME_PATTERN.test(directoryEntry.name)) {
        continue
      }

      let sizeBytes = 0
      try {
        sizeBytes = fs.statSync(absolutePath).size
      } catch {
        sizeBytes = 0
      }

      candidateList.push({
        absolutePath,
        relativePath,
        fileName: directoryEntry.name,
        extension: path.extname(directoryEntry.name).toLowerCase(),
        sizeBytes,
        depth: currentEntry.depth,
      })
    }
  }

  return candidateList
}

const findBestLaunchTarget = (installDir, threadTitle) => {
  const candidateList = collectLaunchCandidates(installDir)
  if (candidateList.length === 0) {
    return null
  }

  const titleTokenList = normalizeForMatch(threadTitle)
    .split(' ')
    .filter((token) => token.length >= 3)

  const scoredCandidateList = candidateList.map((candidate) => {
    const normalizedName = normalizeForMatch(candidate.fileName)
    const normalizedRelativePath = normalizeForMatch(candidate.relativePath)
    let score = 0

    if (candidate.extension === '.exe') {
      score += 90
    } else if (candidate.extension === '.bat' || candidate.extension === '.cmd') {
      score += 50
    } else {
      score += 30
    }

    score += Math.min(80, Math.round(candidate.sizeBytes / 1_000_000))
    score += Math.max(0, 30 - candidate.depth * 8)

    for (const titleToken of titleTokenList) {
      if (normalizedName.includes(titleToken)) {
        score += 20
      }
      if (normalizedRelativePath.includes(titleToken)) {
        score += 10
      }
    }

    if (/game|start|play|launch/i.test(candidate.fileName)) {
      score += 20
    }

    return {
      candidate,
      score,
    }
  })

  scoredCandidateList.sort((first, second) => {
    if (first.score !== second.score) {
      return second.score - first.score
    }

    if (first.candidate.depth !== second.candidate.depth) {
      return first.candidate.depth - second.candidate.depth
    }

    return second.candidate.sizeBytes - first.candidate.sizeBytes
  })

  return scoredCandidateList[0]?.candidate.absolutePath ?? null
}

const driveBrowserWindowUntilDownloadStarts = async (
  browserWindow,
  downloadUrl,
  request,
  automationState,
  jobState,
) => {
  const hostScenario = resolveDownloadHostScenario(request.hostLabel)
  logAutomationEvent(jobState, 'automatic_attempt_started', {
    threadLink: request.threadLink,
    hostLabel: request.hostLabel ?? null,
    downloadUrl,
    hostScenarioId: hostScenario?.id ?? null,
    hostScenarioLabel: hostScenario?.label ?? null,
    windowMode: jobState?.debug?.info?.windowMode ?? 'hidden',
  })
  transitionAutomationMachineState(
    request,
    jobState,
    automationState,
    AUTOMATION_MACHINE_STATES.LOADING_HOST_PAGE,
    {
      scenarioId: hostScenario?.id ?? null,
      scenarioLabel: hostScenario?.label ?? null,
      phase: 'loading_host_page',
      reasonCode: null,
      note: hostScenario
        ? `Открываю зеркало и запускаю сценарий ${hostScenario.label}.`
        : 'Открываю зеркало и жду архив.',
      lastUrl: downloadUrl,
      retryAfterMs: null,
    },
  )
  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'resolving',
    progressPercent: null,
    message: hostScenario
      ? `Открываю зеркало и запускаю сценарий ${hostScenario.label}...`
      : 'Открываю зеркало и жду архив...',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (hostScenario?.suppressWindowOpenNavigation) {
      return { action: 'deny' }
    }

    void browserWindow.loadURL(url).catch(() => {
      // ignore
    })

    return { action: 'deny' }
  })

  throwIfDownloadCancelled(jobState)

  try {
    await browserWindow.loadURL(downloadUrl)
  } catch (error) {
    if (jobState?.cancelled) {
      throw createCancelledDownloadError()
    }

    throw error
  }

  transitionAutomationMachineState(
    request,
    jobState,
    automationState,
    AUTOMATION_MACHINE_STATES.INSPECTING_HOST_PAGE,
    {
      phase: 'host_page_loaded',
      reasonCode: null,
      note: 'Страница зеркала загружена, начинаю анализ DOM.',
      lastUrl: getBrowserWindowDebugUrl(browserWindow, downloadUrl),
      retryAfterMs: null,
    },
  )

  const startedAtUnixMs = Date.now()

  while (!automationState.downloadStarted) {
    throwIfDownloadCancelled(jobState)

    if (Date.now() - startedAtUnixMs > DOWNLOAD_TIMEOUT_MS) {
      throw buildAutomaticDownloadTimeoutError(automationState)
    }

    let nextPollDelayMs = DOWNLOAD_POLL_INTERVAL_MS

    try {
      const clickResult = await runDownloadHostAutomationStep(
        browserWindow,
        request,
        automationState,
      )
      await logAutomationStepResult(
        browserWindow,
        request,
        jobState,
        automationState,
        clickResult,
      )
      const automationDecision = createAutomationDecisionFromResult(clickResult)
      nextPollDelayMs = automationDecision.pollDelayMs

      transitionAutomationMachineState(
        request,
        jobState,
        automationState,
        automationDecision.nextState,
        {
          scenarioId: clickResult?.scenarioId ?? automationState?.hostScenarioId ?? null,
          scenarioLabel:
            clickResult?.scenarioLabel ?? automationState?.hostScenarioLabel ?? null,
          phase: clickResult?.phase ?? automationDecision.nextState,
          reasonCode:
            clickResult?.clicked === true
              ? null
              : automationDecision.reasonCode ?? clickResult?.reasonCode ?? null,
          note:
            automationDecision.statusText ||
            clickResult?.note ||
            clickResult?.label ||
            null,
          lastUrl: getBrowserWindowDebugUrl(
            browserWindow,
            clickResult?.location ?? request.downloadUrl,
          ),
          retryAfterMs:
            automationDecision.kind === 'waiting' ? nextPollDelayMs : null,
        },
      )

      if (automationDecision.kind === 'blocked') {
        throw automationDecision.error
      }

      updateGameRecord(request.threadLink, {
        threadTitle: request.threadTitle,
        status: 'resolving',
        message: automationDecision.statusText,
        downloadSpeedBytesPerSecond: null,
        lastHostLabel: request.hostLabel ?? null,
        lastDownloadUrl: request.downloadUrl,
      })
    } catch (error) {
      if (!isRecoverableAutomationDriverError(error)) {
        if (jobState?.cancelled) {
          throw createCancelledDownloadError()
        }

        transitionAutomationMachineState(
          request,
          jobState,
          automationState,
          AUTOMATION_MACHINE_STATES.FAILED,
          {
            phase: automationState?.machineState ?? 'automatic_attempt_failed',
            reasonCode:
              getDownloadAutomationErrorCode(error) ??
              AUTOMATION_REASON_CODES.AUTOMATION_ERROR,
            note:
              error instanceof Error ? error.message : 'Ошибка automation.',
            lastUrl: getBrowserWindowDebugUrl(browserWindow, downloadUrl),
            retryAfterMs: null,
          },
        )
        throw error
      }
    }

    await delay(nextPollDelayMs)
  }
}

const waitForArchiveDownload = async (
  browserWindow,
  request,
  automationState,
  jobState,
  options = {},
) => {
  const targetSession = browserWindow.webContents.session
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : DOWNLOAD_TIMEOUT_MS
  const gameRoot = path.join(
    libraryState.libraryRootPath,
    buildGameFolderName(request.threadLink, request.threadTitle),
  )
  const downloadsDir = path.join(gameRoot, 'downloads')
  ensureDirectory(downloadsDir)

  return new Promise((resolve, reject) => {
    if (jobState?.cancelled) {
      reject(createCancelledDownloadError())
      return
    }

    let settled = false
    let timeoutId = null
    const handleWindowClosed = () => {
      finishReject(
        jobState?.cancelled
          ? createCancelledDownloadError()
          : createDownloadAutomationError(
              'Окно зеркала закрыто до старта скачивания.',
              AUTOMATION_REASON_CODES.MANUAL_ACTION_REQUIRED,
              {
                automationResult: jobState?.debug?.info ?? null,
              },
            ),
      )
    }

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      targetSession.removeListener('will-download', handleWillDownload)
      browserWindow.removeListener('closed', handleWindowClosed)
    }

    const finishResolve = (value) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }

    const finishReject = (error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    const handleWillDownload = (_event, item, webContents) => {
      if (jobState?.cancelled) {
        item.cancel()
        finishReject(createCancelledDownloadError())
        return
      }

      if (webContents.id !== browserWindow.webContents.id) {
        return
      }

      const originalFileName = item.getFilename() || 'download.bin'
      if (!isSupportedArchiveFileName(originalFileName)) {
        item.cancel()
        finishReject(
          new Error('Поддерживаются только архивы .zip, .7z и .rar. Этот файл пропущен.'),
        )
        return
      }

      automationState.downloadStarted = true
      if (jobState) {
        jobState.downloadItem = item
      }
      const archivePath = path.join(downloadsDir, sanitizeFileName(originalFileName))
      item.setSavePath(archivePath)
      let lastReceivedBytes = item.getReceivedBytes()
      let lastProgressUpdateUnixMs = Date.now()

      updateGameRecord(request.threadLink, {
        threadTitle: request.threadTitle,
        status: 'downloading',
        archivePath,
        installDir: null,
        launchTargetPath: null,
        launchTargetName: null,
        progressPercent: 0,
        message: 'Архив скачивается...',
        downloadSpeedBytesPerSecond: null,
        errorMessage: null,
        lastHostLabel: request.hostLabel ?? null,
        lastDownloadUrl: request.downloadUrl,
      })
      transitionAutomationMachineState(
        request,
        jobState,
        automationState,
        AUTOMATION_MACHINE_STATES.DOWNLOAD_STARTED,
        {
          phase: 'download_started',
          reasonCode: null,
          note: `Electron поймал скачивание архива ${originalFileName}.`,
          lastUrl: getBrowserWindowDebugUrl(browserWindow, request.downloadUrl),
          retryAfterMs: null,
        },
      )
      logAutomationEvent(jobState, 'download_started', {
        threadLink: request.threadLink,
        hostLabel: request.hostLabel ?? null,
        archivePath,
        fileName: originalFileName,
      })

      item.on('updated', () => {
        const receivedBytes = item.getReceivedBytes()
        const totalBytes = item.getTotalBytes()
        const now = Date.now()
        const elapsedMs = Math.max(1, now - lastProgressUpdateUnixMs)
        const bytesDelta = Math.max(0, receivedBytes - lastReceivedBytes)
        const downloadSpeedBytesPerSecond =
          bytesDelta > 0 ? Math.round((bytesDelta * 1000) / elapsedMs) : null

        lastReceivedBytes = receivedBytes
        lastProgressUpdateUnixMs = now

        updateGameRecord(request.threadLink, {
          threadTitle: request.threadTitle,
          status: 'downloading',
          archivePath,
          progressPercent: formatDownloadProgress(receivedBytes, totalBytes),
          message: 'Архив скачивается...',
          downloadSpeedBytesPerSecond,
          errorMessage: null,
          lastHostLabel: request.hostLabel ?? null,
          lastDownloadUrl: request.downloadUrl,
        })
      })

      item.once('done', (_doneEvent, state) => {
        if (jobState?.downloadItem === item) {
          jobState.downloadItem = null
        }

        if (state !== 'completed') {
          logAutomationEvent(jobState, 'download_finished', {
            threadLink: request.threadLink,
            hostLabel: request.hostLabel ?? null,
            archivePath,
            state,
          })
          finishReject(
            state === 'cancelled' && jobState?.cancelled
              ? createCancelledDownloadError()
              : new Error(
                  state === 'cancelled'
                    ? 'Скачивание было отменено.'
                    : `Скачивание завершилось со статусом ${state}.`,
                ),
          )
          return
        }

        logAutomationEvent(jobState, 'download_finished', {
          threadLink: request.threadLink,
          hostLabel: request.hostLabel ?? null,
          archivePath,
          state,
        })
        finishResolve(archivePath)
      })
    }

    timeoutId = setTimeout(() => {
      finishReject(
        createDownloadAutomationError(
          'Не удалось дождаться старта скачивания. Хост не отдал архив автоматически.',
          AUTOMATION_REASON_CODES.DOWNLOAD_TIMEOUT,
          {
            automationResult: automationState?.lastHostAutomationResult ?? null,
          },
        ),
      )
    }, timeoutMs)

    targetSession.on('will-download', handleWillDownload)
    if (options.rejectOnWindowClose) {
      browserWindow.once('closed', handleWindowClosed)
    }
  })
}

const normalizeDownloadSourceList = (request) => {
  const normalizedSourceList = []
  const seenSourceKeys = new Set()
  const rawSourceList = Array.isArray(request.downloadSources)
    ? request.downloadSources
    : []

  for (const rawSource of rawSourceList) {
    if (!rawSource || typeof rawSource !== 'object') {
      continue
    }

    const downloadUrl =
      typeof rawSource.downloadUrl === 'string' ? rawSource.downloadUrl.trim() : ''
    if (!downloadUrl) {
      continue
    }

    const hostLabel =
      typeof rawSource.hostLabel === 'string' && rawSource.hostLabel.trim().length > 0
        ? rawSource.hostLabel
        : null
    const sourceKey = `${downloadUrl}::${hostLabel ?? ''}`
    if (seenSourceKeys.has(sourceKey)) {
      continue
    }

    seenSourceKeys.add(sourceKey)
    normalizedSourceList.push({
      downloadUrl,
      hostLabel,
    })
  }

  if (normalizedSourceList.length === 0 && typeof request.downloadUrl === 'string') {
    const fallbackDownloadUrl = request.downloadUrl.trim()
    if (fallbackDownloadUrl) {
      normalizedSourceList.push({
        downloadUrl: fallbackDownloadUrl,
        hostLabel:
          typeof request.hostLabel === 'string' && request.hostLabel.trim().length > 0
            ? request.hostLabel
            : null,
      })
    }
  }

  return normalizedSourceList
}

const createAttemptRequest = (request, downloadSource) => ({
  ...request,
  downloadUrl: downloadSource.downloadUrl,
  hostLabel: downloadSource.hostLabel,
})

const MANUAL_FALLBACK_ERROR_CODE_SET = new Set([
  AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED,
  AUTOMATION_REASON_CODES.MANUAL_ACTION_REQUIRED,
  AUTOMATION_REASON_CODES.DOWNLOAD_TIMEOUT,
])
const AUTOMATION_WAIT_REASON_CODE_SET = new Set([
  AUTOMATION_REASON_CODES.NO_ACTIONABLE_ELEMENT,
  AUTOMATION_REASON_CODES.WAITING_FOR_CONTINUE,
  AUTOMATION_REASON_CODES.WAITING_FOR_DOWNLOAD,
  AUTOMATION_REASON_CODES.WAITING_FOR_ARCHIVE_ROW,
  AUTOMATION_REASON_CODES.COUNTDOWN_PENDING,
])
const AUTOMATION_BLOCKING_REASON_CODE_SET = new Set([
  AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED,
  AUTOMATION_REASON_CODES.DOWNLOAD_LIMIT_REACHED,
  AUTOMATION_REASON_CODES.CONCURRENT_LIMIT_REACHED,
  AUTOMATION_REASON_CODES.MANUAL_ACTION_REQUIRED,
])
const AUTOMATION_MACHINE_STATES = Object.freeze({
  INITIALIZING: 'initializing',
  LOADING_HOST_PAGE: 'loading_host_page',
  INSPECTING_HOST_PAGE: 'inspecting_host_page',
  WAITING_FOR_HOST_ACTION: 'waiting_for_host_action',
  CLICK_DISPATCHED: 'click_dispatched',
  MANUAL_FALLBACK_PENDING: 'manual_fallback_pending',
  MANUAL_WINDOW_OPENED: 'manual_window_opened',
  DOWNLOAD_STARTED: 'download_started',
  BLOCKED: 'blocked',
  FAILED: 'failed',
})

const createDownloadAutomationError = (message, code, metadata = {}) => {
  const error = new Error(message)
  error.code = code
  Object.assign(error, metadata)
  return error
}

const getDownloadAutomationErrorCode = (error) => {
  return Boolean(error && typeof error === 'object' && typeof error.code === 'string')
    ? error.code
    : null
}

const resolveAutomationPollDelayMs = (automationResult) => {
  const retryAfterMs = automationResult?.retryAfterMs
  if (
    typeof retryAfterMs === 'number' &&
    Number.isFinite(retryAfterMs) &&
    retryAfterMs > 0
  ) {
    return Math.max(200, Math.min(5_000, Math.round(retryAfterMs)))
  }

  return DOWNLOAD_POLL_INTERVAL_MS
}

const buildAutomaticDownloadTimeoutError = (automationState) => {
  const lastResult = automationState?.lastHostAutomationResult ?? null
  const detailList = [
    automationState?.machineState,
    lastResult?.scenarioLabel,
    lastResult?.phase,
    lastResult?.note,
  ].filter((item) => typeof item === 'string' && item.trim().length > 0)
  const detailSuffix =
    detailList.length > 0 ? ` Последний шаг: ${detailList.join(' / ')}.` : ''

  return createDownloadAutomationError(
    `Автоматический download не стартовал вовремя.${detailSuffix} Похоже, хост потребовал ручное действие.`,
    AUTOMATION_REASON_CODES.DOWNLOAD_TIMEOUT,
    {
      automationResult: lastResult,
    },
  )
}

const isRecoverableAutomationDriverError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('Execution context was destroyed') ||
    message.includes('Object has been destroyed')
  )
}

const buildAutomationStepLabel = (automationResult) => {
  const detailList = [
    automationResult?.scenarioLabel,
    automationResult?.note,
    automationResult?.label,
    automationResult?.phase,
  ].filter((item) => typeof item === 'string' && item.trim().length > 0)

  if (detailList.length === 0) {
    return 'host'
  }

  return detailList.join(' / ')
}

const buildAutomationProgressMessage = (automationResult, actionLabel) => {
  const stepLabel = buildAutomationStepLabel(automationResult)
  return `${actionLabel}: ${stepLabel}.`
}

const transitionAutomationMachineState = (
  request,
  jobState,
  automationState,
  nextState,
  patch = {},
) => {
  const previousState =
    automationState?.machineState ?? jobState?.debug?.info?.phase ?? null
  const nextUpdatedAtUnixMs = Date.now()

  if (automationState) {
    automationState.machineState = nextState
    automationState.machineStateUpdatedAtUnixMs = nextUpdatedAtUnixMs
  }

  const nextInfo = updateAutomationDebugInfo(request, jobState, {
    ...patch,
    lastUpdatedAtUnixMs: nextUpdatedAtUnixMs,
  })

  if (previousState !== nextState) {
    logAutomationEvent(jobState, 'automation_state_transition', {
      threadLink: request.threadLink,
      hostLabel: request.hostLabel ?? null,
      previousState,
      nextState,
      automationDebug: nextInfo,
    })
  }

  return nextInfo
}

const createAutomationDecisionFromResult = (automationResult) => {
  const reasonCode = automationResult?.reasonCode ?? null
  const pollDelayMs = resolveAutomationPollDelayMs(automationResult)

  if (automationResult?.errorMessage) {
    return {
      kind: 'blocked',
      nextState: AUTOMATION_MACHINE_STATES.BLOCKED,
      pollDelayMs,
      statusText: buildAutomationProgressMessage(
        automationResult,
        'Automation остановлен',
      ),
      error: createDownloadAutomationError(
        automationResult.errorMessage,
        reasonCode ?? AUTOMATION_REASON_CODES.AUTOMATION_ERROR,
        {
          automationResult,
        },
      ),
    }
  }

  if (automationResult?.hasCaptcha) {
    return {
      kind: 'blocked',
      nextState: AUTOMATION_MACHINE_STATES.BLOCKED,
      pollDelayMs,
      statusText: buildAutomationProgressMessage(
        automationResult,
        'Хост потребовал captcha',
      ),
      error: createDownloadAutomationError(
        'Хост запросил captcha или human verification. Автоматический режим остановлен.',
        reasonCode ?? AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED,
        {
          automationResult,
        },
      ),
    }
  }

  if (reasonCode && AUTOMATION_BLOCKING_REASON_CODE_SET.has(reasonCode)) {
    return {
      kind: 'blocked',
      nextState: AUTOMATION_MACHINE_STATES.BLOCKED,
      pollDelayMs,
      statusText: buildAutomationProgressMessage(
        automationResult,
        'Automation остановлен',
      ),
      error: createDownloadAutomationError(
        automationResult?.note ||
          automationResult?.label ||
          `Automation остановлен (${reasonCode}).`,
        reasonCode,
        {
          automationResult,
        },
      ),
    }
  }

  if (automationResult?.clicked) {
    return {
      kind: 'clicked',
      nextState: AUTOMATION_MACHINE_STATES.CLICK_DISPATCHED,
      pollDelayMs,
      statusText: buildAutomationProgressMessage(
        automationResult,
        'Сценарий отправил клик',
      ),
      reasonCode: null,
    }
  }

  if (reasonCode && AUTOMATION_WAIT_REASON_CODE_SET.has(reasonCode)) {
    return {
      kind: 'waiting',
      nextState: AUTOMATION_MACHINE_STATES.WAITING_FOR_HOST_ACTION,
      pollDelayMs,
      statusText: buildAutomationProgressMessage(
        automationResult,
        'Жду следующий шаг на host',
      ),
      reasonCode,
    }
  }

  return {
    kind: 'inspecting',
    nextState: AUTOMATION_MACHINE_STATES.INSPECTING_HOST_PAGE,
    pollDelayMs,
    statusText: buildAutomationProgressMessage(
      automationResult,
      'Повторно анализирую страницу host',
    ),
    reasonCode: reasonCode ?? null,
  }
}

const isManualFallbackError = (error) => {
  const errorCode = getDownloadAutomationErrorCode(error)
  return Boolean(errorCode && MANUAL_FALLBACK_ERROR_CODE_SET.has(errorCode))
}

const runAutomaticDownloadAttempt = async (request, jobState) => {
  const hiddenWindow = getAutomaticDownloadWindow()
  if (jobState) {
    jobState.window = hiddenWindow
  }

  try {
    await applyF95CookiesToSession(hiddenWindow.webContents.session)
    throwIfDownloadCancelled(jobState)

    const automationState = {
      downloadStarted: false,
      machineState: AUTOMATION_MACHINE_STATES.INITIALIZING,
      machineStateUpdatedAtUnixMs: Date.now(),
    }

    const archivePathPromise = waitForArchiveDownload(
      hiddenWindow,
      request,
      automationState,
      jobState,
    )
    const drivePromise = driveBrowserWindowUntilDownloadStarts(
      hiddenWindow,
      request.downloadUrl,
      request,
      automationState,
      jobState,
    )

    const [archivePath] = await Promise.all([archivePathPromise, drivePromise])
    throwIfDownloadCancelled(jobState)
    return archivePath
  } catch (error) {
    if (!isDownloadCancelledError(error) && !jobState?.cancelled) {
      await recordAutomationFailure(
        hiddenWindow,
        request,
        jobState,
        error,
        'automatic_attempt',
      )
    }
    throw error
  } finally {
    if (jobState?.window === hiddenWindow) {
      jobState.window = null
    }
    safeDestroyWindow(hiddenWindow)
  }
}

const runManualDownloadAttempt = async (request, jobState) => {
  const visibleWindow = getVisibleDownloadWindow()
  if (jobState) {
    jobState.window = visibleWindow
  }

  try {
    await applyF95CookiesToSession(visibleWindow.webContents.session)
    throwIfDownloadCancelled(jobState)

    visibleWindow.webContents.setWindowOpenHandler(({ url }) => {
      void visibleWindow.loadURL(url).catch(() => {
        // ignore
      })

      return { action: 'deny' }
    })
    transitionAutomationMachineState(
      request,
      jobState,
      automationState,
      AUTOMATION_MACHINE_STATES.MANUAL_WINDOW_OPENED,
      {
        phase: 'manual_window_opened',
        reasonCode: AUTOMATION_REASON_CODES.MANUAL_ACTION_REQUIRED,
        note: 'Открыто видимое окно для ручного продолжения.',
        lastUrl: request.downloadUrl,
        retryAfterMs: null,
        windowMode: 'visible',
      },
    )
    logAutomationEvent(jobState, 'manual_window_opened', {
      threadLink: request.threadLink,
      hostLabel: request.hostLabel ?? null,
      downloadUrl: request.downloadUrl,
    })

    updateGameRecord(request.threadLink, {
      threadTitle: request.threadTitle,
      status: 'resolving',
      progressPercent: null,
      message: 'Открыл зеркало. Пройди captcha и нажми download вручную.',
      downloadSpeedBytesPerSecond: null,
      errorMessage: null,
      lastHostLabel: request.hostLabel ?? null,
      lastDownloadUrl: request.downloadUrl,
    })

    try {
      await visibleWindow.loadURL(request.downloadUrl)
    } catch (error) {
      if (jobState?.cancelled) {
        throw createCancelledDownloadError()
      }

      throw error
    }
    if (visibleWindow.isMinimized()) {
      visibleWindow.restore()
    }
    visibleWindow.show()
    visibleWindow.focus()

    const automationState = {
      downloadStarted: false,
      machineState: AUTOMATION_MACHINE_STATES.INITIALIZING,
      machineStateUpdatedAtUnixMs: Date.now(),
    }

    return await waitForArchiveDownload(
      visibleWindow,
      request,
      automationState,
      jobState,
      {
        timeoutMs: MANUAL_DOWNLOAD_TIMEOUT_MS,
        rejectOnWindowClose: true,
      },
    )
  } catch (error) {
    if (!isDownloadCancelledError(error) && !jobState?.cancelled) {
      await recordAutomationFailure(
        visibleWindow,
        request,
        jobState,
        error,
        'manual_attempt',
      )
    }
    throw error
  } finally {
    if (jobState?.window === visibleWindow) {
      jobState.window = null
    }
    safeDestroyWindow(visibleWindow)
  }
}

const finalizeDownloadedArchive = async (request, archivePath, jobState) => {
  const gameRoot = buildGameRootPath(request.threadLink, request.threadTitle)
  throwIfDownloadCancelled(jobState)

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'extracting',
    archivePath,
    progressPercent: null,
    message: 'Распаковываю архив...',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })

  const installDir = await extractArchiveToInstallDir(archivePath, gameRoot, jobState)
  throwIfDownloadCancelled(jobState)
  const launchTargetPath = findBestLaunchTarget(installDir, request.threadTitle)
  if (!launchTargetPath) {
    throw new Error(
      'Архив распакован, но не найден launch target. Поддерживаются только архивные PC-сборки.',
    )
  }

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'installed',
    archivePath,
    installDir,
    launchTargetPath,
    launchTargetName: path.basename(launchTargetPath),
    progressPercent: 100,
    message: 'Готово к запуску.',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
    sizeBytes: getDirectorySizeBytes(installDir),
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })
  updateAutomationDebugInfo(request, jobState, {
    phase: 'installed',
    reasonCode: null,
    note: launchTargetPath
      ? `Архив распакован. Launch target: ${path.basename(launchTargetPath)}.`
      : 'Архив распакован.',
    lastUrl: request.downloadUrl,
    retryAfterMs: null,
  })
  logAutomationEvent(jobState, 'install_completed', {
    threadLink: request.threadLink,
    hostLabel: request.hostLabel ?? null,
    archivePath,
    installDir,
    launchTargetPath,
  })
}

const markDownloadError = (request, error, jobState = null) => {
  const errorCode = getDownloadAutomationErrorCode(error)
  if (jobState?.debug) {
    const errorMessage =
      error instanceof Error ? error.message : 'Не удалось скачать игру.'
    updateAutomationDebugInfo(request, jobState, {
      reasonCode: errorCode ?? AUTOMATION_REASON_CODES.AUTOMATION_ERROR,
      note: errorMessage,
      lastUrl: request.downloadUrl,
      retryAfterMs: null,
    })
    logAutomationEvent(jobState, 'download_error_final', {
      threadLink: request.threadLink,
      hostLabel: request.hostLabel ?? null,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    })
  }

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'error',
    progressPercent: null,
    message: null,
    downloadSpeedBytesPerSecond: null,
    errorMessage:
      error instanceof Error ? error.message : 'Не удалось скачать игру.',
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })
}

const formatFinalDownloadFailureMessage = (error) => {
  const detailMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'Не удалось скачать игру.'

  return `Все зеркала выбранного варианта не подошли. ${detailMessage} Попробуй снова или скачай вручную через тред.`
}

const runDownloadJob = async (request, jobState) => {
  const downloadSourceList = normalizeDownloadSourceList(request)
  const fallbackAttemptRequest = createAttemptRequest(
    request,
    downloadSourceList[0] ?? {
      downloadUrl: request.downloadUrl,
      hostLabel: request.hostLabel ?? null,
    },
  )

  const handleCancelledJob = async () => {
    await clearCancelledDownloadArtifacts(request.threadLink, request.threadTitle)
  }

  if (downloadSourceList.length === 0) {
    if (jobState?.cancelled) {
      await handleCancelledJob()
      return
    }

    markDownloadError(
      fallbackAttemptRequest,
      new Error('Не найдено доступных зеркал для скачивания.'),
      jobState,
    )
    return
  }

  if (request.manualOnly) {
    try {
      throwIfDownloadCancelled(jobState)
      const archivePath = await runManualDownloadAttempt(fallbackAttemptRequest, jobState)
      await finalizeDownloadedArchive(fallbackAttemptRequest, archivePath, jobState)
    } catch (error) {
      if (isDownloadCancelledError(error) || jobState?.cancelled) {
        await handleCancelledJob()
        return
      }

      markDownloadError(fallbackAttemptRequest, error, jobState)
    }
    return
  }

  let lastError = null
  let manualFallbackSource = null

  for (const downloadSource of downloadSourceList) {
    if (jobState?.cancelled) {
      await handleCancelledJob()
      return
    }

    const attemptRequest = createAttemptRequest(request, downloadSource)

    try {
      const archivePath = await runAutomaticDownloadAttempt(attemptRequest, jobState)
      await finalizeDownloadedArchive(attemptRequest, archivePath, jobState)
      return
    } catch (error) {
      if (isDownloadCancelledError(error) || jobState?.cancelled) {
        await handleCancelledJob()
        return
      }

      lastError = error
      if (!manualFallbackSource && isManualFallbackError(error)) {
        manualFallbackSource = downloadSource
      }
    }
  }

  if (manualFallbackSource) {
    const manualAttemptRequest = createAttemptRequest(request, manualFallbackSource)

    transitionAutomationMachineState(
      request,
      jobState,
      null,
      AUTOMATION_MACHINE_STATES.MANUAL_FALLBACK_PENDING,
      {
        phase: 'manual_fallback_pending',
        reasonCode: AUTOMATION_REASON_CODES.MANUAL_ACTION_REQUIRED,
        note: 'Автоматика не справилась, переключаюсь на ручное продолжение.',
        lastUrl: manualAttemptRequest.downloadUrl,
        retryAfterMs: null,
        windowMode: 'visible',
      },
    )
    logAutomationEvent(jobState, 'manual_fallback_requested', {
      threadLink: request.threadLink,
      hostLabel: manualAttemptRequest.hostLabel ?? null,
      downloadUrl: manualAttemptRequest.downloadUrl,
    })
    updateGameRecord(request.threadLink, {
      threadTitle: request.threadTitle,
      status: 'resolving',
      progressPercent: null,
      message:
        'Автоматика не сработала. Открываю зеркало для ручного продолжения...',
      downloadSpeedBytesPerSecond: null,
      errorMessage: null,
      lastHostLabel: manualAttemptRequest.hostLabel ?? null,
      lastDownloadUrl: manualAttemptRequest.downloadUrl,
    })

    try {
      throwIfDownloadCancelled(jobState)
      const archivePath = await runManualDownloadAttempt(manualAttemptRequest, jobState)
      await finalizeDownloadedArchive(manualAttemptRequest, archivePath, jobState)
      return
    } catch (error) {
      if (isDownloadCancelledError(error) || jobState?.cancelled) {
        await handleCancelledJob()
        return
      }

      lastError = error
      markDownloadError(
        manualAttemptRequest,
        new Error(formatFinalDownloadFailureMessage(error)),
        jobState,
      )
      return
    }
  }

  markDownloadError(
    createAttemptRequest(request, downloadSourceList[downloadSourceList.length - 1]),
    new Error(formatFinalDownloadFailureMessage(lastError)),
    jobState,
  )
}

const cancelDownloadJob = async (threadLink) => {
  const activeJob = activeDownloadJobs.get(threadLink)
  if (!activeJob) {
    throw new Error('Для этой игры сейчас нет активной загрузки.')
  }

  activeJob.state.cancelled = true

  const currentRecord = libraryState.gamesByThreadLink[threadLink] ?? null
  if (currentRecord) {
    updateGameRecord(threadLink, {
      threadTitle: currentRecord.threadTitle,
      message: 'Отменяю загрузку...',
      downloadSpeedBytesPerSecond: null,
      errorMessage: null,
    })
  }

  try {
    activeJob.state.downloadItem?.cancel()
  } catch {
    // ignore
  }

  try {
    if (activeJob.state.extractProcess && !activeJob.state.extractProcess.killed) {
      activeJob.state.extractProcess.kill()
    }
  } catch {
    // ignore
  }

  safeDestroyWindow(activeJob.state.window)

  try {
    await activeJob.promise
  } catch {
    // ignore
  }

  return toJsonClone(libraryState)
}

const openMirrorForGame = async (threadLink) => {
  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord?.lastDownloadUrl) {
    throw new Error('Для этой игры еще не сохранено зеркало.')
  }

  if (activeDownloadJobs.has(threadLink)) {
    throw new Error('Для этой игры уже выполняется загрузка.')
  }

  queueDownloadJob({
    threadLink,
    threadTitle: gameRecord.threadTitle || threadLink,
    downloadUrl: gameRecord.lastDownloadUrl,
    hostLabel: gameRecord.lastHostLabel ?? null,
    downloadSources: [
      {
        downloadUrl: gameRecord.lastDownloadUrl,
        hostLabel: gameRecord.lastHostLabel ?? null,
      },
    ],
    manualOnly: true,
  })
}

const queueDownloadJob = (request) => {
  if (activeDownloadJobs.has(request.threadLink)) {
    return
  }

  const jobState = {
    cancelled: false,
    window: null,
    downloadItem: null,
    extractProcess: null,
    debug: createDownloadDebugState(request),
  }

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'queued',
    progressPercent: null,
    message: 'Ставлю в очередь...',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl:
      typeof request.downloadUrl === 'string' ? request.downloadUrl : null,
    automationDebug: jobState.debug.info,
  })
  logAutomationEvent(jobState, 'job_queued', {
    threadLink: request.threadLink,
    hostLabel: request.hostLabel ?? null,
    downloadUrl: request.downloadUrl,
    manualOnly: request.manualOnly === true,
    windowMode: jobState.debug.info.windowMode,
    sessionDir: jobState.debug.sessionDir,
    logFilePath: jobState.debug.logFilePath,
  })
  const nextJob = runDownloadJob(request, jobState).finally(() => {
    activeDownloadJobs.delete(request.threadLink)
  })

  activeDownloadJobs.set(request.threadLink, {
    promise: nextJob,
    state: jobState,
  })
}

const revealGame = async (threadLink) => {
  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord) {
    throw new Error('Игра не найдена в локальной библиотеке.')
  }

  const targetPath =
    gameRecord.launchTargetPath || gameRecord.installDir || gameRecord.archivePath

  if (!targetPath || !fs.existsSync(targetPath)) {
    throw new Error('Не удалось открыть папку игры. Файлы уже отсутствуют на диске.')
  }

  shell.showItemInFolder(targetPath)
}

const openLibraryFolder = async () => {
  ensureDirectory(libraryState.libraryRootPath)
  const shellErrorMessage = await shell.openPath(libraryState.libraryRootPath)
  if (shellErrorMessage) {
    throw new Error(shellErrorMessage)
  }
}

const deleteGameFiles = async (threadLink) => {
  if (activeDownloadJobs.has(threadLink)) {
    throw new Error('Нельзя удалять игру, пока идет активная загрузка.')
  }

  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord) {
    throw new Error('Игра не найдена в локальной библиотеке.')
  }

  const gameRoot = path.join(
    libraryState.libraryRootPath,
    buildGameFolderName(threadLink, gameRecord.threadTitle || threadLink),
  )

  try {
    fs.rmSync(gameRoot, { recursive: true, force: true })
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Не удалось удалить файлы игры.',
    )
  }

  const nextGamesByThreadLink = { ...libraryState.gamesByThreadLink }
  delete nextGamesByThreadLink[threadLink]
  libraryState = {
    ...libraryState,
    gamesByThreadLink: nextGamesByThreadLink,
  }
  persistLibraryState()

  return toJsonClone(libraryState)
}

const chooseLaunchTarget = async (threadLink) => {
  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord?.installDir) {
    throw new Error('Для этой игры пока нет распакованной папки.')
  }

  if (!fs.existsSync(gameRecord.installDir)) {
    throw new Error('Папка игры больше не существует. Попробуй скачать игру заново.')
  }

  const dialogWindow =
    BrowserWindow.getFocusedWindow() ||
    (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)
  const dialogResult = await dialog.showOpenDialog(dialogWindow ?? undefined, {
    title: 'Выбери файл запуска игры',
    defaultPath: gameRecord.installDir,
    properties: ['openFile'],
    filters: LAUNCH_TARGET_DIALOG_FILTERS,
  })

  if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
    return null
  }

  const selectedPath = path.resolve(dialogResult.filePaths[0])
  if (!isPathInsideDirectory(gameRecord.installDir, selectedPath)) {
    throw new Error('Выбери launch target внутри папки игры.')
  }

  if (!fs.existsSync(selectedPath)) {
    throw new Error('Выбранный файл больше не существует.')
  }

  if (!isLaunchableFileName(selectedPath)) {
    throw new Error('Поддерживаются только .exe, .bat, .cmd, .lnk, .html, .htm и .url.')
  }

  updateGameRecord(threadLink, {
    status: 'installed',
    launchTargetPath: selectedPath,
    launchTargetName: path.basename(selectedPath),
    progressPercent: 100,
    message: 'Готово к запуску.',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
  })

  return toJsonClone(libraryState)
}

const chooseInstallFolder = async (request) => {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.threadLink !== 'string' ||
    typeof request.threadTitle !== 'string'
  ) {
    throw new Error('Некорректный payload для chooseInstallFolder.')
  }

  if (activeDownloadJobs.has(request.threadLink)) {
    throw new Error('Нельзя менять папку игры, пока идет активная загрузка.')
  }

  const currentRecord = libraryState.gamesByThreadLink[request.threadLink] ?? null
  const defaultPath =
    typeof currentRecord?.installDir === 'string' &&
    currentRecord.installDir &&
    fs.existsSync(currentRecord.installDir)
      ? currentRecord.installDir
      : libraryState.libraryRootPath

  const dialogWindow =
    BrowserWindow.getFocusedWindow() ||
    (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)
  const dialogResult = await dialog.showOpenDialog(dialogWindow ?? undefined, {
    title: 'Выбери папку установленной игры',
    defaultPath,
    properties: ['openDirectory'],
  })

  if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
    return null
  }

  const selectedInstallDir = path.resolve(dialogResult.filePaths[0])
  let selectedInstallDirStat = null
  try {
    selectedInstallDirStat = fs.statSync(selectedInstallDir)
  } catch {
    selectedInstallDirStat = null
  }

  if (!selectedInstallDirStat?.isDirectory()) {
    throw new Error('Выбранная папка игры больше не существует.')
  }

  let launchTargetPath =
    typeof currentRecord?.launchTargetPath === 'string' &&
    currentRecord.launchTargetPath &&
    fs.existsSync(currentRecord.launchTargetPath) &&
    isPathInsideDirectory(selectedInstallDir, currentRecord.launchTargetPath)
      ? currentRecord.launchTargetPath
      : null

  if (!launchTargetPath) {
    launchTargetPath = findBestLaunchTarget(selectedInstallDir, request.threadTitle)
  }

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'installed',
    installDir: selectedInstallDir,
    launchTargetPath,
    launchTargetName: launchTargetPath ? path.basename(launchTargetPath) : null,
    progressPercent: 100,
    message: launchTargetPath
      ? 'Папка игры привязана. Готово к запуску.'
      : 'Папка игры привязана. Выбери запускатор вручную.',
    downloadSpeedBytesPerSecond: null,
    errorMessage: null,
    sizeBytes: getDirectorySizeBytes(selectedInstallDir),
  })

  return toJsonClone(libraryState)
}

const launchGame = async (threadLink) => {
  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord?.launchTargetPath) {
    if (gameRecord?.installDir) {
      throw new Error('Для этой игры не выбран файл запуска. Укажи запускатор вручную.')
    }

    throw new Error('Игра еще не установлена.')
  }

  if (!fs.existsSync(gameRecord.launchTargetPath)) {
    updateGameRecord(threadLink, {
      status: 'error',
      downloadSpeedBytesPerSecond: null,
      errorMessage: 'Файл запуска больше не существует. Попробуй скачать игру заново.',
      message: null,
    })
    throw new Error('Файл запуска больше не существует.')
  }

  const shellErrorMessage = await shell.openPath(gameRecord.launchTargetPath)
  if (shellErrorMessage) {
    throw new Error(shellErrorMessage)
  }
}

const clearLauncherLibrary = async () => {
  if (activeDownloadJobs.size > 0) {
    throw new Error('Нельзя очищать папки игр, пока идет активная загрузка.')
  }

  try {
    fs.rmSync(libraryState.libraryRootPath, { recursive: true, force: true })
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Не удалось очистить папки с играми.',
    )
  }

  ensureDirectory(libraryState.libraryRootPath)
  libraryState = {
    ...libraryState,
    gamesByThreadLink: {},
  }
  persistLibraryState()
  return toJsonClone(libraryState)
}

const resolveRendererUrl = async () => {
  const explicitDevServerUrl =
    typeof process.env.VITE_DEV_SERVER_URL === 'string'
      ? process.env.VITE_DEV_SERVER_URL.trim()
      : ''

  const candidateUrlList = [
    explicitDevServerUrl,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ].filter(Boolean)

  for (const candidateUrl of candidateUrlList) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 900)

    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        return candidateUrl
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  return null
}

const isRendererNavigation = (targetUrl) => {
  return (
    targetUrl.startsWith('file://') ||
    targetUrl.startsWith('http://127.0.0.1:5173') ||
    targetUrl.startsWith('http://localhost:5173')
  )
}

const createMainWindow = async () => {
  const preloadPath = path.join(__dirname, 'preload.cjs')
  mainWindow = new BrowserWindow({
    show: false,
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f16',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isRendererNavigation(targetUrl)) {
      event.preventDefault()
      void shell.openExternal(targetUrl)
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  const devServerUrl = await resolveRendererUrl()
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
    return
  }

  const distIndexPath = path.join(APP_ROOT, 'dist', 'index.html')
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(
      'Не найден dist/index.html. Запусти pnpm dev или сначала собери renderer через pnpm build.',
    )
  }

  await mainWindow.loadFile(distIndexPath)
}

const registerIpcHandlers = () => {
  ipcMain.on('localData:getSnapshotSync', (event) => {
    event.returnValue = buildLocalDataFilesSnapshot()
  })
  ipcMain.on('localData:saveListsSync', (event, value) => {
    event.returnValue = writeLocalDataFileValue('lists', value)
  })
  ipcMain.handle('localData:saveLists', async (_event, value) => {
    writeLocalDataFileValue('lists', value)
    return true
  })
  ipcMain.on('localData:saveSettingsSync', (event, value) => {
    event.returnValue = writeLocalDataFileValue('settings', value)
  })
  ipcMain.handle('localData:saveSettings', async (_event, value) => {
    writeLocalDataFileValue('settings', value)
    return true
  })
  ipcMain.on('localData:saveCatalogSync', (event, value) => {
    event.returnValue = writeLocalDataFileValue('catalog', value)
  })
  ipcMain.handle('localData:saveCatalog', async (_event, value) => {
    writeLocalDataFileValue('catalog', value)
    return true
  })
  ipcMain.on('localData:clearListsSync', (event) => {
    event.returnValue = writeLocalDataFileValue('lists', null)
  })
  ipcMain.handle('localData:clearLists', async () => {
    writeLocalDataFileValue('lists', null)
    return true
  })
  ipcMain.on('localData:clearSettingsSync', (event) => {
    event.returnValue = writeLocalDataFileValue('settings', null)
  })
  ipcMain.handle('localData:clearSettings', async () => {
    writeLocalDataFileValue('settings', null)
    return true
  })
  ipcMain.on('localData:clearCatalogSync', (event) => {
    event.returnValue = writeLocalDataFileValue('catalog', null)
  })
  ipcMain.handle('localData:clearCatalog', async () => {
    writeLocalDataFileValue('catalog', null)
    return true
  })
  ipcMain.handle('localData:openFolder', async () => {
    ensureDirectory(app.getPath('userData'))
    const shellErrorMessage = await shell.openPath(app.getPath('userData'))
    if (shellErrorMessage) {
      throw new Error(shellErrorMessage)
    }
    return true
  })

  ipcMain.handle('app:openExternal', async (event, targetUrl, rawOptions) => {
    const openOptions = normalizeOpenExternalOptions(rawOptions)
    const shellOptions =
      openOptions.background && process.platform === 'darwin'
        ? { activate: false }
        : undefined

    await shell.openExternal(targetUrl, shellOptions)

    if (openOptions.background) {
      refocusWindowAfterExternalOpen(BrowserWindow.fromWebContents(event.sender))
    }

    return true
  })
  ipcMain.handle('app:restart', async () => {
    app.relaunch()
    setImmediate(() => {
      app.exit(0)
    })
    return true
  })

  ipcMain.handle('app:loadBundledTagsMap', async () => {
    return loadBundledTagsMap()
  })
  ipcMain.handle('app:loadBundledPrefixesMap', async () => {
    return loadBundledPrefixesMap()
  })

  ipcMain.handle('f95:getCookieStatus', async () => buildCookieStatus(runtimeCookieState))
  ipcMain.handle('f95:getCookieBackup', async () => buildCookieBackup(runtimeCookieState))
  ipcMain.handle('f95:saveCookieInput', async (_event, text) => saveCookieInput(text))
  ipcMain.handle('f95:clearCookieInput', async () => clearCookieInput())
  ipcMain.handle(
    'f95:fetchLatestGamesPage',
    async (_event, pageNumber, latestGamesSort, filterState) =>
      fetchLatestGamesPage(pageNumber, latestGamesSort, filterState),
  )
  ipcMain.handle('f95:fetchThreadPageHtml', async (_event, threadLink) =>
    fetchThreadPageHtml(threadLink),
  )

  ipcMain.handle('launcher:getLibrarySnapshot', async () => toJsonClone(libraryState))
  ipcMain.handle('launcher:downloadGame', async (_event, request) => {
    if (
      !request ||
      typeof request !== 'object' ||
      typeof request.threadLink !== 'string' ||
      typeof request.threadTitle !== 'string' ||
      typeof request.downloadUrl !== 'string'
    ) {
      throw new Error('Некорректный payload для downloadGame.')
    }

    queueDownloadJob({
      threadLink: request.threadLink,
      threadTitle: request.threadTitle,
      downloadUrl: request.downloadUrl,
      hostLabel: typeof request.hostLabel === 'string' ? request.hostLabel : null,
      downloadSources: Array.isArray(request.downloadSources)
        ? request.downloadSources
        : undefined,
      manualOnly: request.manualOnly === true,
    })

    return libraryState.gamesByThreadLink[request.threadLink] ?? null
  })
  ipcMain.handle('launcher:cancelDownloadGame', async (_event, threadLink) =>
    cancelDownloadJob(threadLink),
  )

  ipcMain.handle('launcher:chooseInstallFolder', async (_event, request) =>
    chooseInstallFolder(request),
  )
  ipcMain.handle('launcher:launchGame', async (_event, threadLink) =>
    launchGame(threadLink),
  )
  ipcMain.handle('launcher:revealGame', async (_event, threadLink) =>
    revealGame(threadLink),
  )
  ipcMain.handle('launcher:deleteGameFiles', async (_event, threadLink) =>
    deleteGameFiles(threadLink),
  )
  ipcMain.handle('launcher:chooseLaunchTarget', async (_event, threadLink) =>
    chooseLaunchTarget(threadLink),
  )
  ipcMain.handle('launcher:openLibraryFolder', async () => openLibraryFolder())
  ipcMain.handle('launcher:openMirrorForGame', async (_event, threadLink) =>
    openMirrorForGame(threadLink),
  )
  ipcMain.handle('launcher:clearLibrary', async () => clearLauncherLibrary())
}

app.whenReady().then(async () => {
  runtimeCookieState = loadRuntimeCookieState(process.env.F95_COOKIE?.trim())
  libraryState = loadLibraryState()
  localDataFilesState = loadLocalDataFilesState()
  ensureDirectory(libraryState.libraryRootPath)

  registerIpcHandlers()
  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
