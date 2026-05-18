const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, ipcMain, shell } = require('electron')

const APP_ROOT = path.resolve(__dirname, '..')
const APP_ICON_PATH = path.join(
  __dirname,
  'assets',
  process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png',
)
const F95_ORIGIN = 'https://f95zone.to'
const RECOMMENDED_COOKIE_NAMES = ['xf_user', 'xf_session', 'xf_csrf']

let mainWindow = null
let runtimeCookieState = null
let localDataFilesState = null

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true })
}

const toJsonClone = (value) => JSON.parse(JSON.stringify(value))

const parseHttpUrlString = (value, fieldName = 'url') => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Некорректный payload: ${fieldName} должен быть URL.`)
  }

  let parsedUrl = null
  try {
    parsedUrl = new URL(value.trim())
  } catch {
    throw new Error(`Некорректный payload: ${fieldName} должен быть URL.`)
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Разрешены только http/https ссылки.')
  }

  return parsedUrl.toString()
}

const normalizeOpenExternalOptions = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { background: false }
  }

  return { background: value.background === true }
}

const parseOpenExternalRequest = (targetUrl, rawOptions) => ({
  targetUrl: parseHttpUrlString(targetUrl, 'targetUrl'),
  options: normalizeOpenExternalOptions(rawOptions),
})

const getCookieStorePath = () => path.resolve(process.cwd(), '.f95-cookie.local')

const getLocalListsStatePath = () =>
  path.join(app.getPath('userData'), 'local-lists.json')

const getLocalSettingsStatePath = () =>
  path.join(app.getPath('userData'), 'local-settings.json')

const getLatestCatalogStatePath = () =>
  path.join(app.getPath('userData'), 'latest-catalog.json')

const getLatestCatalogCheckpointStatePath = () =>
  path.join(app.getPath('userData'), 'latest-catalog-checkpoint.json')

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
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temporaryPath, targetPath)
}

const loadLocalDataFilesState = () => ({
  lists: readJsonFileWithMetadata(getLocalListsStatePath()),
  settings: readJsonFileWithMetadata(getLocalSettingsStatePath()),
  catalog: readJsonFileWithMetadata(getLatestCatalogStatePath()),
  catalogCheckpoint: readJsonFileWithMetadata(
    getLatestCatalogCheckpointStatePath(),
  ),
})

const buildLocalDataFileDescriptor = (targetPath, entry) => ({
  path: targetPath,
  exists: Boolean(entry?.exists),
  updatedAtUnixMs:
    typeof entry?.updatedAtUnixMs === 'number' ? entry.updatedAtUnixMs : null,
})

const buildLocalDataFilesSnapshot = () => ({
  listsFile: buildLocalDataFileDescriptor(
    getLocalListsStatePath(),
    localDataFilesState?.lists,
  ),
  settingsFile: buildLocalDataFileDescriptor(
    getLocalSettingsStatePath(),
    localDataFilesState?.settings,
  ),
  catalogFile: buildLocalDataFileDescriptor(
    getLatestCatalogStatePath(),
    localDataFilesState?.catalog,
  ),
  catalogCheckpointFile: buildLocalDataFileDescriptor(
    getLatestCatalogCheckpointStatePath(),
    localDataFilesState?.catalogCheckpoint,
  ),
  lists: localDataFilesState?.lists?.value
    ? toJsonClone(localDataFilesState.lists.value)
    : null,
  settings: localDataFilesState?.settings?.value
    ? toJsonClone(localDataFilesState.settings.value)
    : null,
  catalog: localDataFilesState?.catalog?.value
    ? toJsonClone(localDataFilesState.catalog.value)
    : null,
  catalogCheckpoint: localDataFilesState?.catalogCheckpoint?.value
    ? toJsonClone(localDataFilesState.catalogCheckpoint.value)
    : null,
})

const writeLocalDataFileValue = (fileKind, value) => {
  const targetPath =
    fileKind === 'lists'
      ? getLocalListsStatePath()
      : fileKind === 'catalog'
        ? getLatestCatalogStatePath()
        : fileKind === 'catalogCheckpoint'
          ? getLatestCatalogCheckpointStatePath()
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

const createEmptyCookieState = () => ({
  header: '',
  source: 'none',
  updatedAtUnixMs: null,
})

const extractCookiePairsFromHeader = (value) => {
  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf('=')
      if (separatorIndex <= 0) {
        return null
      }

      const name = entry.slice(0, separatorIndex).trim()
      const cookieValue = entry.slice(separatorIndex + 1).trim()
      return name ? [name, cookieValue] : null
    })
    .filter(Boolean)
}

const extractCookiePairsFromJson = (value) => {
  try {
    const parsedValue = JSON.parse(value)
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null
        }

        return typeof entry.name === 'string' && typeof entry.value === 'string'
          ? [entry.name, entry.value]
          : null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

const extractCookiePairsFromTable = (value) => {
  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(/\t+/)
      if (columns.length < 2) {
        return null
      }

      const name = columns[0]?.trim()
      const cookieValue = columns[1]?.trim()
      return name && cookieValue ? [name, cookieValue] : null
    })
    .filter(Boolean)
}

const extractCookiePairsFromInput = (value) => {
  if (typeof value !== 'string') {
    return []
  }

  const normalizedValue = value.trim().replace(/^F95_COOKIE=/, '').trim()
  const unquotedValue = normalizedValue.replace(/^"|"$/g, '')

  return (
    extractCookiePairsFromJson(unquotedValue).length > 0
      ? extractCookiePairsFromJson(unquotedValue)
      : extractCookiePairsFromTable(unquotedValue).length > 0
        ? extractCookiePairsFromTable(unquotedValue)
        : extractCookiePairsFromHeader(unquotedValue)
  )
}

const formatCookieHeader = (cookiePairs) =>
  cookiePairs.map(([name, value]) => `${name}=${value}`).join('; ')

const extractCookieNames = (headerValue) =>
  extractCookiePairsFromHeader(headerValue).map(([name]) => name)

const persistCookieState = (cookieState, backupText = null) => {
  runtimeCookieState = cookieState
  if (cookieState.source !== 'settings') {
    return
  }

  writeLocalDataFileValue('settings', {
    ...(localDataFilesState?.settings?.value &&
    typeof localDataFilesState.settings.value === 'object' &&
    !Array.isArray(localDataFilesState.settings.value)
      ? localDataFilesState.settings.value
      : {}),
    cookieProxy: {
      source: 'settings',
      text: backupText ?? cookieState.header,
      updatedAtUnixMs: cookieState.updatedAtUnixMs,
    },
  })
}

const loadRuntimeCookieState = (envCookieHeader) => {
  if (envCookieHeader) {
    return {
      header: envCookieHeader,
      source: 'env',
      updatedAtUnixMs: Date.now(),
    }
  }

  const settingsCookieProxy = localDataFilesState?.settings?.value?.cookieProxy
  if (
    settingsCookieProxy &&
    typeof settingsCookieProxy === 'object' &&
    !Array.isArray(settingsCookieProxy) &&
    typeof settingsCookieProxy.text === 'string'
  ) {
    const cookiePairs = extractCookiePairsFromInput(settingsCookieProxy.text)
    if (cookiePairs.length > 0) {
      return {
        header: formatCookieHeader(cookiePairs),
        source: 'settings',
        updatedAtUnixMs:
          typeof settingsCookieProxy.updatedAtUnixMs === 'number'
            ? settingsCookieProxy.updatedAtUnixMs
            : Date.now(),
      }
    }
  }

  try {
    const storedText = fs.existsSync(getCookieStorePath())
      ? fs.readFileSync(getCookieStorePath(), 'utf8')
      : ''
    const cookiePairs = extractCookiePairsFromInput(storedText)
    if (cookiePairs.length > 0) {
      return {
        header: formatCookieHeader(cookiePairs),
        source: 'settings',
        updatedAtUnixMs: Date.now(),
      }
    }
  } catch {
    // ignore
  }

  return createEmptyCookieState()
}

const buildCookieStatus = (cookieState) => {
  const cookieNameList = extractCookieNames(cookieState.header)
  return {
    configured: cookieNameList.length > 0,
    source: cookieState.source,
    cookieNames: cookieNameList,
    missingRecommendedCookieNames: RECOMMENDED_COOKIE_NAMES.filter(
      (cookieName) => !cookieNameList.includes(cookieName),
    ),
    updatedAtUnixMs: cookieState.updatedAtUnixMs,
  }
}

const buildCookieBackup = (cookieState) => {
  const settingsCookieProxy = localDataFilesState?.settings?.value?.cookieProxy
  return {
    source: cookieState.source,
    text:
      settingsCookieProxy &&
      typeof settingsCookieProxy === 'object' &&
      !Array.isArray(settingsCookieProxy) &&
      typeof settingsCookieProxy.text === 'string'
        ? settingsCookieProxy.text
        : cookieState.header || null,
    updatedAtUnixMs: cookieState.updatedAtUnixMs,
  }
}

const saveCookieInput = (text) => {
  const cookiePairs = extractCookiePairsFromInput(text)
  if (cookiePairs.length === 0) {
    throw new Error('Не удалось распознать куки F95.')
  }

  const nextState = {
    header: formatCookieHeader(cookiePairs),
    source: 'settings',
    updatedAtUnixMs: Date.now(),
  }
  persistCookieState(nextState, text)
  return buildCookieStatus(nextState)
}

const clearCookieInput = () => {
  const nextState = createEmptyCookieState()
  persistCookieState(nextState, null)
  return buildCookieStatus(nextState)
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
      (filterState.searchText.length > 0 ||
        filterState.includeTagIds.length > 0 ||
        filterState.excludeTagIds.length > 0 ||
        filterState.includePrefixIds.length > 0 ||
        filterState.excludePrefixIds.length > 0),
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

const parseRetryAfterHeaderToMs = (headerValue) => {
  if (typeof headerValue !== 'string') {
    return null
  }

  const trimmedValue = headerValue.trim()
  if (!trimmedValue) {
    return null
  }

  const secondsValue = Number(trimmedValue)
  if (Number.isFinite(secondsValue) && secondsValue >= 0) {
    return Math.round(secondsValue * 1000)
  }

  const absoluteUnixMs = Date.parse(trimmedValue)
  if (Number.isNaN(absoluteUnixMs)) {
    return null
  }

  return Math.max(0, absoluteUnixMs - Date.now())
}

const buildNetworkErrorMessage = (statusCode, retryAfterMs) => {
  if (
    typeof retryAfterMs === 'number' &&
    Number.isFinite(retryAfterMs) &&
    retryAfterMs > 0
  ) {
    return `Network error: ${statusCode} (retry-after-ms:${Math.round(retryAfterMs)})`
  }

  return `Network error: ${statusCode}`
}

const parseLatestGamesPageRequest = (pageNumber, latestGamesSort, filterState) => {
  const normalizedPageNumber = Number(pageNumber)
  if (
    !Number.isInteger(normalizedPageNumber) ||
    normalizedPageNumber < 1 ||
    normalizedPageNumber > 10_000
  ) {
    throw new Error('Некорректный payload: pageNumber должен быть положительным числом.')
  }

  return {
    pageNumber: normalizedPageNumber,
    latestGamesSort: normalizeLatestGamesSort(latestGamesSort),
    filterState: normalizeLatestGamesFilterState(filterState),
  }
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

    throw new Error(
      buildNetworkErrorMessage(
        response.status,
        parseRetryAfterHeaderToMs(response.headers.get('retry-after')),
      ),
    )
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

const openExternalSafely = async (targetUrl, options) => {
  const safeUrl = parseHttpUrlString(targetUrl, 'targetUrl')
  return shell.openExternal(safeUrl, options)
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
    icon: APP_ICON_PATH,
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f16',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isRendererNavigation(targetUrl)) {
      event.preventDefault()
      void openExternalSafely(targetUrl)
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
  ipcMain.handle('localData:saveLists', async (_event, value) => {
    writeLocalDataFileValue('lists', value)
    return true
  })
  ipcMain.handle('localData:saveSettings', async (_event, value) => {
    writeLocalDataFileValue('settings', value)
    return true
  })
  ipcMain.handle('localData:saveCatalog', async (_event, value) => {
    writeLocalDataFileValue('catalog', value)
    return true
  })
  ipcMain.handle('localData:saveCatalogCheckpoint', async (_event, value) => {
    writeLocalDataFileValue('catalogCheckpoint', value)
    return true
  })
  ipcMain.handle('localData:clearLists', async () => {
    writeLocalDataFileValue('lists', null)
    return true
  })
  ipcMain.handle('localData:clearSettings', async () => {
    writeLocalDataFileValue('settings', null)
    return true
  })
  ipcMain.handle('localData:clearCatalog', async () => {
    writeLocalDataFileValue('catalog', null)
    return true
  })
  ipcMain.handle('localData:clearCatalogCheckpoint', async () => {
    writeLocalDataFileValue('catalogCheckpoint', null)
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
    const { targetUrl: safeUrl, options: openOptions } = parseOpenExternalRequest(
      targetUrl,
      rawOptions,
    )
    const shellOptions =
      openOptions.background && process.platform === 'darwin'
        ? { activate: false }
        : undefined

    await openExternalSafely(safeUrl, shellOptions)

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
  ipcMain.handle('app:loadBundledTagsMap', async () => loadBundledTagsMap())
  ipcMain.handle('app:loadBundledPrefixesMap', async () => loadBundledPrefixesMap())

  ipcMain.handle('f95:getCookieStatus', async () => buildCookieStatus(runtimeCookieState))
  ipcMain.handle('f95:getCookieBackup', async () => buildCookieBackup(runtimeCookieState))
  ipcMain.handle('f95:saveCookieInput', async (_event, text) => saveCookieInput(text))
  ipcMain.handle('f95:clearCookieInput', async () => clearCookieInput())
  ipcMain.handle(
    'f95:fetchLatestGamesPage',
    async (_event, pageNumber, latestGamesSort, filterState) => {
      const request = parseLatestGamesPageRequest(
        pageNumber,
        latestGamesSort,
        filterState,
      )
      return fetchLatestGamesPage(
        request.pageNumber,
        request.latestGamesSort,
        request.filterState,
      )
    },
  )
}

app.whenReady().then(async () => {
  localDataFilesState = loadLocalDataFilesState()
  runtimeCookieState = loadRuntimeCookieState(process.env.F95_COOKIE?.trim())

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
