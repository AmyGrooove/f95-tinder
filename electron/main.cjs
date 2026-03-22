const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
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

let mainWindow = null
let runtimeCookieState = null
let libraryState = null
let localDataFilesState = null
const activeDownloadJobs = new Map()

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true })
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
  errorMessage: null,
  sizeBytes: null,
  updatedAtUnixMs: Date.now(),
})

const createDefaultLibraryState = () => ({
  libraryRootPath: getDefaultLibraryRoot(),
  gamesByThreadLink: {},
})

const loadLocalDataFilesState = () => ({
  lists: readJsonFileWithMetadata(getLocalListsStatePath()),
  settings: readJsonFileWithMetadata(getLocalSettingsStatePath()),
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
  lists: localDataFilesState?.lists?.value ? toJsonClone(localDataFilesState.lists.value) : null,
  settings: localDataFilesState?.settings?.value
    ? toJsonClone(localDataFilesState.settings.value)
    : null,
})

const writeLocalDataFileValue = (fileKind, value) => {
  const targetPath =
    fileKind === 'lists' ? getLocalListsStatePath() : getLocalSettingsStatePath()

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

const extractArchiveToInstallDir = async (archivePath, gameRoot) => {
  if (!path7za) {
    throw new Error('Не найден 7zip-bin. Распаковка недоступна.')
  }

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

    let stderrText = ''
    childProcess.stderr.on('data', (chunk) => {
      stderrText += chunk.toString('utf8')
    })

    childProcess.once('error', (error) => {
      reject(error)
    })

    childProcess.once('close', (exitCode) => {
      if (exitCode === 0 || exitCode === 1) {
        resolve()
        return
      }

      reject(
        new Error(stderrText.trim() || `7z завершился с кодом ${String(exitCode)}`),
      )
    })
  })

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

const buildAutoClickScript = () => `
(() => {
  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\\s+/g, ' ');

  const pageText = normalize(document.body?.innerText ?? '');
  const hasCaptcha =
    pageText.includes('captcha') ||
    pageText.includes('i am human') ||
    pageText.includes('verify you are human') ||
    document.querySelector('.g-recaptcha, .h-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') !== null;

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const candidateList = Array.from(
    document.querySelectorAll('a[href], button, input[type="button"], input[type="submit"], [role="button"]'),
  );

  let bestCandidate = null;

  for (const element of candidateList) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      continue;
    }

    if (
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true'
    ) {
      continue;
    }

    const text = normalize(
      [
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('value'),
        element.getAttribute('href'),
        element.getAttribute('id'),
        element.className,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = 0;

    if (text.includes('download')) score += 120;
    if (text.includes('continue')) score += 60;
    if (text.includes('click here')) score += 55;
    if (text.includes('get link')) score += 50;
    if (text.includes('slow')) score += 25;
    if (text.includes('free')) score += 20;
    if (text.includes('direct')) score += 35;
    if (text.includes('mirror')) score += 20;
    if (text.includes('.zip') || text.includes('.rar') || text.includes('.7z')) score += 100;
    if (text.includes('premium') || text.includes('login') || text.includes('sign in') || text.includes('register') || text.includes('advert')) score -= 120;

    if (element.tagName === 'A') {
      const href = normalize(element.getAttribute('href'));
      if (/\\.(zip|rar|7z)(\\?|$)/i.test(href)) {
        score += 160;
      }
    }

    if (score <= 0) {
      continue;
    }

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = {
        element,
        score,
        text,
      };
    }
  }

  if (!bestCandidate) {
    return {
      clicked: false,
      label: null,
      hasCaptcha,
      location: window.location.href,
    };
  }

  bestCandidate.element.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );

  return {
    clicked: true,
    label: bestCandidate.text,
    hasCaptcha,
    location: window.location.href,
  };
})();
`

const driveBrowserWindowUntilDownloadStarts = async (
  browserWindow,
  downloadUrl,
  request,
  automationState,
) => {
  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'resolving',
    progressPercent: null,
    message: 'Открываю зеркало и жду архив...',
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    void browserWindow.loadURL(url).catch(() => {
      // ignore
    })

    return { action: 'deny' }
  })

  await browserWindow.loadURL(downloadUrl)

  const startedAtUnixMs = Date.now()

  while (!automationState.downloadStarted) {
    if (Date.now() - startedAtUnixMs > DOWNLOAD_TIMEOUT_MS) {
      throw new Error(
        'Автоматический download не стартовал вовремя. Похоже, хост потребовал ручное действие.',
      )
    }

    try {
      const clickResult = await browserWindow.webContents.executeJavaScript(
        buildAutoClickScript(),
        true,
      )

      if (clickResult?.hasCaptcha) {
        throw new Error(
          'Хост запросил captcha или human verification. Автоматический режим остановлен.',
        )
      }

      if (clickResult?.clicked) {
        updateGameRecord(request.threadLink, {
          threadTitle: request.threadTitle,
          status: 'resolving',
          message: 'Пытаюсь нажать кнопку download на host...',
          lastHostLabel: request.hostLabel ?? null,
          lastDownloadUrl: request.downloadUrl,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (
        message &&
        !message.includes('Execution context was destroyed') &&
        !message.includes('Object has been destroyed')
      ) {
        throw error
      }
    }

    await delay(DOWNLOAD_POLL_INTERVAL_MS)
  }
}

const waitForArchiveDownload = async (
  browserWindow,
  request,
  automationState,
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
    let settled = false
    let timeoutId = null
    const handleWindowClosed = () => {
      finishReject(new Error('Окно зеркала закрыто до старта скачивания.'))
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
      const archivePath = path.join(downloadsDir, sanitizeFileName(originalFileName))
      item.setSavePath(archivePath)

      updateGameRecord(request.threadLink, {
        threadTitle: request.threadTitle,
        status: 'downloading',
        archivePath,
        installDir: null,
        launchTargetPath: null,
        launchTargetName: null,
        progressPercent: 0,
        message: 'Архив скачивается...',
        errorMessage: null,
        lastHostLabel: request.hostLabel ?? null,
        lastDownloadUrl: request.downloadUrl,
      })

      item.on('updated', () => {
        updateGameRecord(request.threadLink, {
          threadTitle: request.threadTitle,
          status: 'downloading',
          archivePath,
          progressPercent: formatDownloadProgress(
            item.getReceivedBytes(),
            item.getTotalBytes(),
          ),
          message: 'Архив скачивается...',
          errorMessage: null,
          lastHostLabel: request.hostLabel ?? null,
          lastDownloadUrl: request.downloadUrl,
        })
      })

      item.once('done', (_doneEvent, state) => {
        if (state !== 'completed') {
          finishReject(
            new Error(
              state === 'cancelled'
                ? 'Скачивание было отменено.'
                : `Скачивание завершилось со статусом ${state}.`,
            ),
          )
          return
        }

        finishResolve(archivePath)
      })
    }

    timeoutId = setTimeout(() => {
      finishReject(
        new Error(
          'Не удалось дождаться старта скачивания. Хост не отдал архив автоматически.',
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

const isManualFallbackError = (error) => {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('captcha') ||
    message.includes('human verification') ||
    message.includes('ручное действие') ||
    message.includes('автоматический download не стартовал') ||
    message.includes('не удалось дождаться старта скачивания') ||
    message.includes('не отдал архив автоматически')
  )
}

const runAutomaticDownloadAttempt = async (request) => {
  const hiddenWindow = getHiddenDownloadWindow()

  try {
    await applyF95CookiesToSession(hiddenWindow.webContents.session)

    const automationState = {
      downloadStarted: false,
    }

    const archivePathPromise = waitForArchiveDownload(
      hiddenWindow,
      request,
      automationState,
    )
    const drivePromise = driveBrowserWindowUntilDownloadStarts(
      hiddenWindow,
      request.downloadUrl,
      request,
      automationState,
    )

    const [archivePath] = await Promise.all([archivePathPromise, drivePromise])
    return archivePath
  } finally {
    safeDestroyWindow(hiddenWindow)
  }
}

const runManualDownloadAttempt = async (request) => {
  const visibleWindow = getVisibleDownloadWindow()

  try {
    await applyF95CookiesToSession(visibleWindow.webContents.session)

    visibleWindow.webContents.setWindowOpenHandler(({ url }) => {
      void visibleWindow.loadURL(url).catch(() => {
        // ignore
      })

      return { action: 'deny' }
    })

    updateGameRecord(request.threadLink, {
      threadTitle: request.threadTitle,
      status: 'resolving',
      progressPercent: null,
      message: 'Открыл зеркало. Пройди captcha и нажми download вручную.',
      errorMessage: null,
      lastHostLabel: request.hostLabel ?? null,
      lastDownloadUrl: request.downloadUrl,
    })

    await visibleWindow.loadURL(request.downloadUrl)
    if (visibleWindow.isMinimized()) {
      visibleWindow.restore()
    }
    visibleWindow.show()
    visibleWindow.focus()

    const automationState = {
      downloadStarted: false,
    }

    return await waitForArchiveDownload(visibleWindow, request, automationState, {
      timeoutMs: MANUAL_DOWNLOAD_TIMEOUT_MS,
      rejectOnWindowClose: true,
    })
  } finally {
    safeDestroyWindow(visibleWindow)
  }
}

const finalizeDownloadedArchive = async (request, archivePath) => {
  const gameRoot = path.join(
    libraryState.libraryRootPath,
    buildGameFolderName(request.threadLink, request.threadTitle),
  )

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'extracting',
    archivePath,
    progressPercent: null,
    message: 'Распаковываю архив...',
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })

  const installDir = await extractArchiveToInstallDir(archivePath, gameRoot)
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
    errorMessage: null,
    sizeBytes: getDirectorySizeBytes(installDir),
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })
}

const markDownloadError = (request, error) => {
  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'error',
    progressPercent: null,
    message: null,
    errorMessage:
      error instanceof Error ? error.message : 'Не удалось скачать игру.',
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl: request.downloadUrl,
  })
}

const runDownloadJob = async (request) => {
  const downloadSourceList = normalizeDownloadSourceList(request)
  const fallbackAttemptRequest = createAttemptRequest(
    request,
    downloadSourceList[0] ?? {
      downloadUrl: request.downloadUrl,
      hostLabel: request.hostLabel ?? null,
    },
  )

  if (downloadSourceList.length === 0) {
    markDownloadError(
      fallbackAttemptRequest,
      new Error('Не найдено доступных зеркал для скачивания.'),
    )
    return
  }

  if (request.manualOnly) {
    try {
      const archivePath = await runManualDownloadAttempt(fallbackAttemptRequest)
      await finalizeDownloadedArchive(fallbackAttemptRequest, archivePath)
    } catch (error) {
      markDownloadError(fallbackAttemptRequest, error)
    }
    return
  }

  let lastError = null
  let manualFallbackSource = null

  for (const downloadSource of downloadSourceList) {
    const attemptRequest = createAttemptRequest(request, downloadSource)

    try {
      const archivePath = await runAutomaticDownloadAttempt(attemptRequest)
      await finalizeDownloadedArchive(attemptRequest, archivePath)
      return
    } catch (error) {
      lastError = error
      if (!manualFallbackSource && isManualFallbackError(error)) {
        manualFallbackSource = downloadSource
      }
    }
  }

  if (manualFallbackSource) {
    const manualAttemptRequest = createAttemptRequest(request, manualFallbackSource)

    updateGameRecord(request.threadLink, {
      threadTitle: request.threadTitle,
      status: 'resolving',
      progressPercent: null,
      message:
        'Автоматика не сработала. Открываю зеркало для ручного продолжения...',
      errorMessage: null,
      lastHostLabel: manualAttemptRequest.hostLabel ?? null,
      lastDownloadUrl: manualAttemptRequest.downloadUrl,
    })

    try {
      const archivePath = await runManualDownloadAttempt(manualAttemptRequest)
      await finalizeDownloadedArchive(manualAttemptRequest, archivePath)
      return
    } catch (error) {
      lastError = error
      markDownloadError(manualAttemptRequest, error)
      return
    }
  }

  markDownloadError(
    createAttemptRequest(request, downloadSourceList[downloadSourceList.length - 1]),
    lastError ?? new Error('Не удалось скачать игру.'),
  )
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

  updateGameRecord(request.threadLink, {
    threadTitle: request.threadTitle,
    status: 'queued',
    progressPercent: null,
    message: 'Ставлю в очередь...',
    errorMessage: null,
    lastHostLabel: request.hostLabel ?? null,
    lastDownloadUrl:
      typeof request.downloadUrl === 'string' ? request.downloadUrl : null,
  })

  const nextJob = runDownloadJob(request).finally(() => {
    activeDownloadJobs.delete(request.threadLink)
  })

  activeDownloadJobs.set(request.threadLink, nextJob)
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
  const relativeToInstallDir = path.relative(gameRecord.installDir, selectedPath)
  const isInsideInstallDir =
    relativeToInstallDir === '' ||
    (!relativeToInstallDir.startsWith('..') && !path.isAbsolute(relativeToInstallDir))

  if (!isInsideInstallDir) {
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
    errorMessage: null,
  })

  return toJsonClone(libraryState)
}

const launchGame = async (threadLink) => {
  const gameRecord = libraryState.gamesByThreadLink[threadLink]
  if (!gameRecord?.launchTargetPath) {
    throw new Error('Игра еще не установлена.')
  }

  if (!fs.existsSync(gameRecord.launchTargetPath)) {
    updateGameRecord(threadLink, {
      status: 'error',
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
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    autoHideMenuBar: true,
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

  const devServerUrl = await resolveRendererUrl()
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
    return
  }

  const distIndexPath = path.join(APP_ROOT, 'dist', 'index.html')
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(
      'Не найден dist/index.html. Запусти Vite dev server или собери renderer через npm run build.',
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
  ipcMain.on('localData:saveSettingsSync', (event, value) => {
    event.returnValue = writeLocalDataFileValue('settings', value)
  })
  ipcMain.on('localData:clearListsSync', (event) => {
    event.returnValue = writeLocalDataFileValue('lists', null)
  })
  ipcMain.on('localData:clearSettingsSync', (event) => {
    event.returnValue = writeLocalDataFileValue('settings', null)
  })
  ipcMain.handle('localData:openFolder', async () => {
    ensureDirectory(app.getPath('userData'))
    const shellErrorMessage = await shell.openPath(app.getPath('userData'))
    if (shellErrorMessage) {
      throw new Error(shellErrorMessage)
    }
    return true
  })

  ipcMain.handle('app:openExternal', async (_event, targetUrl) => {
    await shell.openExternal(targetUrl)
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
