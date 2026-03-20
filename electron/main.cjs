const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
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
const NEGATIVE_LAUNCH_NAME_PATTERN =
  /(unins|uninstall|vc_redist|redist|directx|dxsetup|crashpad|updater|notification_helper|elevate|cleanup|launcherupdater)/i
const NEGATIVE_LAUNCH_PATH_PATTERN =
  /(__macosx|_commonredist|redist|redistributable|directx|support|crashpad)/i

let mainWindow = null
let runtimeCookieState = null
let libraryState = null
const activeDownloadJobs = new Map()

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true })
}

const delay = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })

const toJsonClone = (value) => JSON.parse(JSON.stringify(value))

const getCookieStorePath = () => path.resolve(process.cwd(), '.f95-cookie.local')

const getLibraryStatePath = () =>
  path.join(app.getPath('userData'), 'launcher-library.json')

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
  errorMessage: null,
  updatedAtUnixMs: Date.now(),
})

const createDefaultLibraryState = () => ({
  libraryRootPath: getDefaultLibraryRoot(),
  gamesByThreadLink: {},
})

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
    errorMessage:
      typeof record.errorMessage === 'string' ? record.errorMessage : null,
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

const buildLatestGamesEndpointUrl = (pageNumber) => {
  const searchParameters = new URLSearchParams()

  searchParameters.set('cmd', 'list')
  searchParameters.set('cat', 'games')
  searchParameters.set('page', String(pageNumber))

  searchParameters.append('noprefixes[]', '1')
  searchParameters.append('noprefixes[]', '4')
  searchParameters.append('noprefixes[]', '7')

  searchParameters.append('notags[]', '2265')
  searchParameters.set('sort', 'date')
  searchParameters.set('_', String(Date.now()))

  return `/sam/latest_alpha/latest_data.php?${searchParameters.toString()}`
}

const fetchLatestGamesPage = async (pageNumber) => {
  const response = await fetch(new URL(buildLatestGamesEndpointUrl(pageNumber), F95_ORIGIN), {
    method: 'GET',
    headers: createF95Headers('application/json'),
  })

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

const resolveBundledTagsPath = () => {
  const candidatePathList = [
    path.join(APP_ROOT, 'public', 'tags.json'),
    path.join(APP_ROOT, 'dist', 'tags.json'),
    path.join(app.getAppPath(), 'dist', 'tags.json'),
    path.join(app.getAppPath(), 'public', 'tags.json'),
  ]

  return candidatePathList.find((candidatePath) => fs.existsSync(candidatePath)) ?? null
}

const loadBundledTagsMap = () => {
  const bundledTagsPath = resolveBundledTagsPath()
  if (!bundledTagsPath) {
    throw new Error('Не удалось найти tags.json')
  }

  const parsedValue = JSON.parse(fs.readFileSync(bundledTagsPath, 'utf8'))
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('tags.json имеет неверный формат')
  }

  return parsedValue
}

const safeDestroyWindow = (targetWindow) => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return
  }

  targetWindow.destroy()
}

const getHiddenDownloadWindow = () =>
  new BrowserWindow({
    show: false,
    width: 1320,
    height: 900,
    webPreferences: {
      partition: DOWNLOAD_SESSION_PARTITION,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

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

const waitForArchiveDownload = async (browserWindow, request, automationState) => {
  const targetSession = browserWindow.webContents.session
  const gameRoot = path.join(
    libraryState.libraryRootPath,
    buildGameFolderName(request.threadLink, request.threadTitle),
  )
  const downloadsDir = path.join(gameRoot, 'downloads')
  ensureDirectory(downloadsDir)

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId = null

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      targetSession.removeListener('will-download', handleWillDownload)
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
    }, DOWNLOAD_TIMEOUT_MS)

    targetSession.on('will-download', handleWillDownload)
  })
}

const runDownloadJob = async (request) => {
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
      lastHostLabel: request.hostLabel ?? null,
    })
  } catch (error) {
    updateGameRecord(request.threadLink, {
      threadTitle: request.threadTitle,
      status: 'error',
      progressPercent: null,
      message: null,
      errorMessage:
        error instanceof Error ? error.message : 'Не удалось скачать игру.',
      lastHostLabel: request.hostLabel ?? null,
    })
  } finally {
    safeDestroyWindow(hiddenWindow)
  }
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
  ipcMain.handle('app:openExternal', async (_event, targetUrl) => {
    await shell.openExternal(targetUrl)
    return true
  })

  ipcMain.handle('app:loadBundledTagsMap', async () => {
    return loadBundledTagsMap()
  })

  ipcMain.handle('f95:getCookieStatus', async () => buildCookieStatus(runtimeCookieState))
  ipcMain.handle('f95:saveCookieInput', async (_event, text) => saveCookieInput(text))
  ipcMain.handle('f95:clearCookieInput', async () => clearCookieInput())
  ipcMain.handle('f95:fetchLatestGamesPage', async (_event, pageNumber) =>
    fetchLatestGamesPage(pageNumber),
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
    })

    return libraryState.gamesByThreadLink[request.threadLink] ?? null
  })

  ipcMain.handle('launcher:launchGame', async (_event, threadLink) =>
    launchGame(threadLink),
  )
  ipcMain.handle('launcher:revealGame', async (_event, threadLink) =>
    revealGame(threadLink),
  )
}

app.whenReady().then(async () => {
  runtimeCookieState = loadRuntimeCookieState(process.env.F95_COOKIE?.trim())
  libraryState = loadLibraryState()
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
