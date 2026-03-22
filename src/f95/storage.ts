import { safeJsonParse } from './utils'
import {
  clearLauncherLocalListsSync,
  clearLauncherLocalSettingsSync,
  getLauncherLocalDataSnapshotSync,
  saveLauncherLocalListsSync,
  saveLauncherLocalSettingsSync,
} from '../launcher/runtime'
import type {
  DefaultSwipeSettings,
  F95ThreadItem,
  LatestGamesSort,
  ListType,
  ProcessedThreadItem,
  SessionState,
} from './types'
import { DEFAULT_FILTER_STATE, normalizeFilterState } from './filtering'

const STORAGE_KEYS = {
  sessionState: 'f95_tinder_session_v1',
  defaultFilterState: 'f95_tinder_default_filter_state_v1',
  cachedPagesIndexPrefix: 'f95_tinder_cached_pages_index_v2_',
  cachedPagePrefix: 'f95_tinder_cached_page_v2_',
  tagsMap: 'f95_tinder_tags_map_v1',
  prefixesMap: 'f95_tinder_prefixes_map_v1',
}

const LATEST_GAMES_SORTS: LatestGamesSort[] = ['date', 'views']

const BUILT_IN_DEFAULT_SWIPE_SETTINGS: DefaultSwipeSettings = {
  latestGamesSort: 'views',
  filterState: normalizeFilterState({
    ...DEFAULT_FILTER_STATE,
    excludePrefixIds: [4, 1, 7, 47],
    excludeTagIds: [916],
  }),
}

const getCachedPagesIndexKey = (latestGamesSort: LatestGamesSort) =>
  `${STORAGE_KEYS.cachedPagesIndexPrefix}${latestGamesSort}`

const getCachedPageKey = (latestGamesSort: LatestGamesSort, pageNumber: number) =>
  `${STORAGE_KEYS.cachedPagePrefix}${latestGamesSort}_${pageNumber}`

const readLocalStorageValue = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeLocalStorageValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

const removeLocalStorageValue = (key: string) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const loadCachedPagesIndex = (latestGamesSort: LatestGamesSort) => {
  const cachedIndexText = readLocalStorageValue(
    getCachedPagesIndexKey(latestGamesSort),
  )
  if (!cachedIndexText) {
    return []
  }

  const cachedIndexValue = safeJsonParse<unknown>(cachedIndexText)
  if (!Array.isArray(cachedIndexValue)) {
    return []
  }

  const pageNumberList: number[] = []
  for (const item of cachedIndexValue) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      pageNumberList.push(item)
    }
  }

  return pageNumberList
}

const saveCachedPagesIndex = (
  latestGamesSort: LatestGamesSort,
  pageNumberList: number[],
) => {
  writeLocalStorageValue(
    getCachedPagesIndexKey(latestGamesSort),
    JSON.stringify(pageNumberList),
  )
}

const loadCachedPage = (latestGamesSort: LatestGamesSort, pageNumber: number) => {
  const cachedPageText = readLocalStorageValue(
    getCachedPageKey(latestGamesSort, pageNumber),
  )
  if (!cachedPageText) {
    return null
  }

  const cachedPageValue = safeJsonParse<unknown>(cachedPageText)
  if (!Array.isArray(cachedPageValue)) {
    return null
  }

  const threadItemList: F95ThreadItem[] = []
  for (const item of cachedPageValue) {
    const threadItem = item as Partial<F95ThreadItem>
    if (typeof threadItem.thread_id === 'number' && typeof threadItem.title === 'string') {
      threadItemList.push(item as F95ThreadItem)
    }
  }

  return threadItemList
}

const saveCachedPage = (
  latestGamesSort: LatestGamesSort,
  pageNumber: number,
  threadItemList: F95ThreadItem[],
) => {
  writeLocalStorageValue(
    getCachedPageKey(latestGamesSort, pageNumber),
    JSON.stringify(threadItemList),
  )
}

const pruneCachedPages = (
  latestGamesSort: LatestGamesSort,
  maxCachedPagesCount: number,
) => {
  const cachedPageNumberList = loadCachedPagesIndex(latestGamesSort)

  if (cachedPageNumberList.length <= maxCachedPagesCount) {
    return
  }

  const pageNumberListToRemove = cachedPageNumberList.slice(0, cachedPageNumberList.length - maxCachedPagesCount)
  const pageNumberListToKeep = cachedPageNumberList.slice(cachedPageNumberList.length - maxCachedPagesCount)

  for (const pageNumber of pageNumberListToRemove) {
    removeLocalStorageValue(getCachedPageKey(latestGamesSort, pageNumber))
  }

  saveCachedPagesIndex(latestGamesSort, pageNumberListToKeep)
}

const markPageAsCached = (latestGamesSort: LatestGamesSort, pageNumber: number) => {
  const cachedPageNumberList = loadCachedPagesIndex(latestGamesSort)
  const isAlreadyCached = cachedPageNumberList.includes(pageNumber)

  if (isAlreadyCached) {
    return
  }

  const updatedCachedPageNumberList = [...cachedPageNumberList, pageNumber]
  saveCachedPagesIndex(latestGamesSort, updatedCachedPageNumberList)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizeLatestGamesSort = (value: unknown): LatestGamesSort =>
  value === 'date' ? 'date' : 'views'

const normalizeImportedStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeImportedDisabledDownloadHosts = (value: unknown) => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalizedMap: Record<string, number> = {}
  for (const [hostLabel, expiresAtUnixMs] of Object.entries(value)) {
    if (
      typeof hostLabel === 'string' &&
      typeof expiresAtUnixMs === 'number' &&
      Number.isFinite(expiresAtUnixMs)
    ) {
      normalizedMap[hostLabel] = expiresAtUnixMs
    }
  }

  return normalizedMap
}

const normalizeDefaultSwipeSettings = (
  value: unknown,
): DefaultSwipeSettings => {
  if (!isPlainObject(value)) {
    return {
      latestGamesSort: BUILT_IN_DEFAULT_SWIPE_SETTINGS.latestGamesSort,
      filterState: normalizeFilterState(
        BUILT_IN_DEFAULT_SWIPE_SETTINGS.filterState,
      ),
    }
  }

  const rawValue = value as Record<string, unknown>
  const rawFilterState = isPlainObject(rawValue.filterState)
    ? rawValue.filterState
    : value

  return {
    latestGamesSort: normalizeLatestGamesSort(rawValue.latestGamesSort),
    filterState: normalizeFilterState(rawFilterState),
  }
}

const normalizeSessionState = (value: unknown): SessionState | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const possibleSessionState = value as Partial<SessionState>

  if (typeof possibleSessionState.currentPageNumber !== 'number') {
    return null
  }

  if (typeof possibleSessionState.nextPageToFetchNumber !== 'number') {
    return null
  }

  if (!Array.isArray(possibleSessionState.remainingThreadIdentifiers)) {
    return null
  }

  if (!isPlainObject(possibleSessionState.threadItemsByIdentifier)) {
    return null
  }

  if (!Array.isArray(possibleSessionState.favoritesLinks)) {
    return null
  }

  if (!Array.isArray(possibleSessionState.trashLinks)) {
    return null
  }

  if (typeof possibleSessionState.viewedCount !== 'number') {
    return null
  }

  const filterState = normalizeFilterState(possibleSessionState.filterState)
  const playedByLinkFallback = normalizePlayedByLink(possibleSessionState.playedByLink)
  const playedLinks = normalizePlayedLinks(
    possibleSessionState.playedLinks,
    playedByLinkFallback,
  )
  const playedFavoriteLinks = normalizePlayedFavoriteLinks(
    possibleSessionState.playedFavoriteLinks,
    playedLinks,
  )
  const playedByLink: Record<string, boolean> = {}
  for (const link of playedLinks) {
    playedByLink[link] = true
  }

  const processedThreadItemsByLink = normalizeProcessedThreadItems(
    possibleSessionState.processedThreadItemsByLink,
  )
  const latestGamesSort: LatestGamesSort =
    possibleSessionState.latestGamesSort === 'views' ? 'views' : 'date'

  return {
    currentPageNumber: possibleSessionState.currentPageNumber,
    nextPageToFetchNumber: possibleSessionState.nextPageToFetchNumber,
    latestGamesSort,
    remainingThreadIdentifiers: possibleSessionState.remainingThreadIdentifiers as number[],
    threadItemsByIdentifier: possibleSessionState.threadItemsByIdentifier as Record<string, F95ThreadItem>,
    favoritesLinks: possibleSessionState.favoritesLinks as string[],
    trashLinks: possibleSessionState.trashLinks as string[],
    playedByLink,
    playedLinks,
    playedFavoriteLinks,
    processedThreadItemsByLink,
    viewedCount: possibleSessionState.viewedCount,
    filterState,
    lastMetadataSyncAtUnixMs:
      typeof possibleSessionState.lastMetadataSyncAtUnixMs === 'number'
        ? possibleSessionState.lastMetadataSyncAtUnixMs
        : null,
  }
}

const loadSessionStateFromLocalStorage = (): SessionState | null => {
  const sessionText = readLocalStorageValue(STORAGE_KEYS.sessionState)
  if (!sessionText) {
    return null
  }

  const sessionValue = safeJsonParse<unknown>(sessionText)
  if (!sessionValue) {
    return null
  }

  return normalizeSessionState(sessionValue)
}

const loadDefaultSwipeSettingsFromLocalStorage = () => {
  const defaultFilterStateText = readLocalStorageValue(STORAGE_KEYS.defaultFilterState)
  if (!defaultFilterStateText) {
    return normalizeDefaultSwipeSettings(BUILT_IN_DEFAULT_SWIPE_SETTINGS)
  }

  const defaultFilterStateValue = safeJsonParse<unknown>(defaultFilterStateText)
  if (!defaultFilterStateValue) {
    return normalizeDefaultSwipeSettings(BUILT_IN_DEFAULT_SWIPE_SETTINGS)
  }

  return normalizeDefaultSwipeSettings(defaultFilterStateValue)
}

const createDefaultSessionState = (
  defaultSwipeSettings: DefaultSwipeSettings = normalizeDefaultSwipeSettings(
    BUILT_IN_DEFAULT_SWIPE_SETTINGS,
  ),
): SessionState => {
  return {
    currentPageNumber: 1,
    nextPageToFetchNumber: 1,
    latestGamesSort: defaultSwipeSettings.latestGamesSort,
    remainingThreadIdentifiers: [],
    threadItemsByIdentifier: {},
    favoritesLinks: [],
    trashLinks: [],
    playedByLink: {},
    playedLinks: [],
    playedFavoriteLinks: [],
    processedThreadItemsByLink: {},
    viewedCount: 0,
    filterState: normalizeFilterState(defaultSwipeSettings.filterState),
    lastMetadataSyncAtUnixMs: null,
  }
}

const normalizePlayedByLink = (value: unknown): Record<string, boolean> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalized: Record<string, boolean> = {}
  for (const key of Object.keys(value)) {
    const rawValue = (value as Record<string, unknown>)[key]
    if (typeof rawValue === 'boolean') {
      normalized[key] = rawValue
      continue
    }

    if (typeof rawValue === 'string') {
      const cleanedValue = rawValue.trim().toLowerCase()
      if (cleanedValue === 'true') {
        normalized[key] = true
      } else if (cleanedValue === 'false') {
        normalized[key] = false
      }
    }
  }

  return normalized
}

const normalizeListType = (value: unknown): ListType | null => {
  if (value === 'favorite' || value === 'trash' || value === 'played') {
    return value
  }
  return null
}

const normalizeProcessedThreadItems = (
  value: unknown,
): Record<string, ProcessedThreadItem> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalized: Record<string, ProcessedThreadItem> = {}
  const entries = value as Record<string, unknown>

  for (const entryKey of Object.keys(entries)) {
    const rawItem = entries[entryKey]
    if (!isPlainObject(rawItem)) {
      continue
    }

    const threadIdentifier =
      typeof rawItem.threadIdentifier === 'number'
        ? rawItem.threadIdentifier
        : null

    if (threadIdentifier === null) {
      continue
    }

    const threadLink =
      typeof rawItem.threadLink === 'string'
        ? rawItem.threadLink
        : entryKey

    if (threadLink.trim().length === 0) {
      continue
    }

    const tags =
      Array.isArray(rawItem.tags) && rawItem.tags.length > 0
        ? rawItem.tags.filter((tag) => typeof tag === 'number')
        : []
    const prefixes =
      Array.isArray(rawItem.prefixes) && rawItem.prefixes.length > 0
        ? rawItem.prefixes.filter((prefixId) => typeof prefixId === 'number')
        : []

    normalized[threadLink] = {
      threadIdentifier,
      threadLink,
      title:
        typeof rawItem.title === 'string'
          ? rawItem.title
          : `Thread ${threadIdentifier}`,
      creator:
        typeof rawItem.creator === 'string' ? rawItem.creator : 'Unknown',
      cover: typeof rawItem.cover === 'string' ? rawItem.cover : '',
      rating: typeof rawItem.rating === 'number' ? rawItem.rating : 0,
      trackedVersion:
        typeof rawItem.trackedVersion === 'string'
          ? rawItem.trackedVersion
          : typeof rawItem.version === 'string'
          ? rawItem.version
          : '',
      version: typeof rawItem.version === 'string' ? rawItem.version : '',
      prefixes,
      tags,
      trackedTs:
        typeof rawItem.trackedTs === 'number'
          ? rawItem.trackedTs
          : typeof rawItem.ts === 'number'
          ? rawItem.ts
          : undefined,
      ts: typeof rawItem.ts === 'number' ? rawItem.ts : undefined,
      addedAtUnixSeconds:
        typeof rawItem.addedAtUnixSeconds === 'number'
          ? rawItem.addedAtUnixSeconds
          : 0,
      listType: normalizeListType(rawItem.listType),
    }
  }

  return normalized
}

const normalizePlayedLinks = (
  value: unknown,
  playedByLinkFallback: Record<string, boolean>,
): string[] => {
  if (Array.isArray(value)) {
    const normalized: string[] = []
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) {
        normalized.push(item)
      }
    }
    return Array.from(new Set(normalized))
  }

  const fallbackLinks: string[] = []
  for (const link of Object.keys(playedByLinkFallback)) {
    if (playedByLinkFallback[link]) {
      fallbackLinks.push(link)
    }
  }

  return fallbackLinks
}

const normalizePlayedFavoriteLinks = (
  value: unknown,
  playedLinks: string[],
): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const playedLinkSet = new Set(playedLinks)
  const normalized: string[] = []
  for (const item of value) {
    if (
      typeof item === 'string' &&
      item.trim().length > 0 &&
      playedLinkSet.has(item)
    ) {
      normalized.push(item)
    }
  }

  return Array.from(new Set(normalized))
}

const normalizeLookupMap = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  for (const key of Object.keys(value)) {
    const rawValue = (value as Record<string, unknown>)[key]
    if (typeof rawValue !== 'string') {
      continue
    }
    normalized[key] = rawValue
  }

  return normalized
}

const normalizeTagsMap = (value: unknown): Record<string, string> => {
  return normalizeLookupMap(value)
}

const normalizePrefixesMap = (value: unknown): Record<string, string> => {
  return normalizeLookupMap(value)
}

const loadTagsMapFromLocalStorage = (): Record<string, string> => {
  const tagsMapText = readLocalStorageValue(STORAGE_KEYS.tagsMap)
  if (!tagsMapText) {
    return {}
  }

  const parsedMap = safeJsonParse<unknown>(tagsMapText)
  return normalizeTagsMap(parsedMap)
}

const loadPrefixesMapFromLocalStorage = (): Record<string, string> => {
  const prefixesMapText = readLocalStorageValue(STORAGE_KEYS.prefixesMap)
  if (!prefixesMapText) {
    return {}
  }

  const parsedMap = safeJsonParse<unknown>(prefixesMapText)
  return normalizePrefixesMap(parsedMap)
}

const cleanLookupMap = (lookupMap: Record<string, string>) => {
  const cleanedMap: Record<string, string> = {}
  for (const key of Object.keys(lookupMap)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      continue
    }
    const value = lookupMap[key]
    if (typeof value === 'string') {
      cleanedMap[key] = value
    }
  }

  return cleanedMap
}

const isLauncherLocalDataEnabled = () => getLauncherLocalDataSnapshotSync() !== null

const loadLauncherLocalListsBackup = () => {
  const launcherSnapshot = getLauncherLocalDataSnapshotSync()
  if (!launcherSnapshot || !isPlainObject(launcherSnapshot.lists)) {
    return null
  }

  const rawLists = launcherSnapshot.lists as Record<string, unknown>

  const sessionState = normalizeSessionState(rawLists.sessionState)
  if (!sessionState) {
    return null
  }

  return {
    sessionState,
    tagsMap: normalizeTagsMap(rawLists.tagsMap),
    prefixesMap: normalizePrefixesMap(rawLists.prefixesMap),
  }
}

const loadLauncherLocalSettingsBackup = () => {
  const launcherSnapshot = getLauncherLocalDataSnapshotSync()
  if (!launcherSnapshot || !isPlainObject(launcherSnapshot.settings)) {
    return null
  }

  const rawSettings = launcherSnapshot.settings as Record<string, unknown>
  if (!('defaultSwipeSettings' in rawSettings)) {
    return null
  }

  return {
    defaultSwipeSettings: normalizeDefaultSwipeSettings(rawSettings.defaultSwipeSettings),
    tagsMap: normalizeTagsMap(rawSettings.tagsMap),
    prefixesMap: normalizePrefixesMap(rawSettings.prefixesMap),
    preferredDownloadHosts: normalizeImportedStringList(
      rawSettings.preferredDownloadHosts,
    ),
    disabledDownloadHosts: normalizeImportedDisabledDownloadHosts(
      rawSettings.disabledDownloadHosts,
    ),
    hiddenDownloadHosts: normalizeImportedStringList(rawSettings.hiddenDownloadHosts),
    cookieProxy: 'cookieProxy' in rawSettings ? rawSettings.cookieProxy : null,
  }
}

const buildFallbackLocalListsBackup = () => ({
  sessionState: loadSessionStateFromLocalStorage() ?? createDefaultSessionState(),
  tagsMap:
    loadLauncherLocalSettingsBackup()?.tagsMap ?? loadTagsMapFromLocalStorage(),
  prefixesMap:
    loadLauncherLocalSettingsBackup()?.prefixesMap ??
    loadPrefixesMapFromLocalStorage(),
})

const buildFallbackLocalSettingsBackup = () => ({
  defaultSwipeSettings: loadDefaultSwipeSettingsFromLocalStorage(),
  tagsMap: loadLauncherLocalListsBackup()?.tagsMap ?? loadTagsMapFromLocalStorage(),
  prefixesMap:
    loadLauncherLocalListsBackup()?.prefixesMap ??
    loadPrefixesMapFromLocalStorage(),
  preferredDownloadHosts: [],
  disabledDownloadHosts: {},
  hiddenDownloadHosts: [],
  cookieProxy: null,
})

const loadSessionState = (): SessionState | null => {
  const launcherBackup = loadLauncherLocalListsBackup()
  if (launcherBackup) {
    return launcherBackup.sessionState
  }

  return loadSessionStateFromLocalStorage()
}

const loadDefaultSwipeSettings = () => {
  const launcherBackup = loadLauncherLocalSettingsBackup()
  if (launcherBackup) {
    return launcherBackup.defaultSwipeSettings
  }

  return loadDefaultSwipeSettingsFromLocalStorage()
}

const saveDefaultSwipeSettings = (defaultSwipeSettings: unknown) => {
  const normalizedValue = normalizeDefaultSwipeSettings(defaultSwipeSettings)

  if (isLauncherLocalDataEnabled()) {
    const currentSettingsBackup =
      loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
    saveLauncherLocalSettingsSync({
      ...currentSettingsBackup,
      defaultSwipeSettings: normalizedValue,
    })
    return
  }

  writeLocalStorageValue(
    STORAGE_KEYS.defaultFilterState,
    JSON.stringify(normalizedValue),
  )
}

const saveSessionState = (sessionState: SessionState) => {
  if (isLauncherLocalDataEnabled()) {
    const currentListsBackup =
      loadLauncherLocalListsBackup() ?? buildFallbackLocalListsBackup()
    saveLauncherLocalListsSync({
      ...currentListsBackup,
      sessionState,
    })
    return
  }

  writeLocalStorageValue(STORAGE_KEYS.sessionState, JSON.stringify(sessionState))
}

const clearAllStoredData = () => {
  for (const latestGamesSort of LATEST_GAMES_SORTS) {
    const cachedPageNumberList = loadCachedPagesIndex(latestGamesSort)
    for (const pageNumber of cachedPageNumberList) {
      removeLocalStorageValue(getCachedPageKey(latestGamesSort, pageNumber))
    }

    removeLocalStorageValue(getCachedPagesIndexKey(latestGamesSort))
  }

  if (isLauncherLocalDataEnabled()) {
    clearLauncherLocalListsSync()
    clearLauncherLocalSettingsSync()
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.sessionState)
  removeLocalStorageValue(STORAGE_KEYS.defaultFilterState)
  clearTagsMap()
  clearPrefixesMap()
}

const loadTagsMap = (): Record<string, string> => {
  const launcherListsBackup = loadLauncherLocalListsBackup()
  if (launcherListsBackup) {
    return launcherListsBackup.tagsMap
  }

  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  if (launcherSettingsBackup) {
    return launcherSettingsBackup.tagsMap
  }

  return loadTagsMapFromLocalStorage()
}

const loadPrefixesMap = (): Record<string, string> => {
  const launcherListsBackup = loadLauncherLocalListsBackup()
  if (launcherListsBackup) {
    return launcherListsBackup.prefixesMap
  }

  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  if (launcherSettingsBackup) {
    return launcherSettingsBackup.prefixesMap
  }

  return loadPrefixesMapFromLocalStorage()
}

const saveTagsMap = (tagsMap: Record<string, string>) => {
  const cleanedMap = cleanLookupMap(tagsMap)

  if (isLauncherLocalDataEnabled()) {
    const currentListsBackup =
      loadLauncherLocalListsBackup() ?? buildFallbackLocalListsBackup()
    const currentSettingsBackup =
      loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
    saveLauncherLocalListsSync({
      ...currentListsBackup,
      tagsMap: cleanedMap,
    })
    saveLauncherLocalSettingsSync({
      ...currentSettingsBackup,
      tagsMap: cleanedMap,
    })
    return
  }

  writeLocalStorageValue(STORAGE_KEYS.tagsMap, JSON.stringify(cleanedMap))
}

const savePrefixesMap = (prefixesMap: Record<string, string>) => {
  const cleanedMap = cleanLookupMap(prefixesMap)

  if (isLauncherLocalDataEnabled()) {
    const currentListsBackup =
      loadLauncherLocalListsBackup() ?? buildFallbackLocalListsBackup()
    const currentSettingsBackup =
      loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
    saveLauncherLocalListsSync({
      ...currentListsBackup,
      prefixesMap: cleanedMap,
    })
    saveLauncherLocalSettingsSync({
      ...currentSettingsBackup,
      prefixesMap: cleanedMap,
    })
    return
  }

  writeLocalStorageValue(STORAGE_KEYS.prefixesMap, JSON.stringify(cleanedMap))
}

function clearTagsMap() {
  if (isLauncherLocalDataEnabled()) {
    saveTagsMap({})
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.tagsMap)
}

function clearPrefixesMap() {
  if (isLauncherLocalDataEnabled()) {
    savePrefixesMap({})
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.prefixesMap)
}


export {
  DEFAULT_FILTER_STATE,
  loadCachedPage,
  saveCachedPage,
  markPageAsCached,
  pruneCachedPages,
  loadSessionState,
  saveSessionState,
  createDefaultSessionState,
  loadDefaultSwipeSettings,
  saveDefaultSwipeSettings,
  normalizeDefaultSwipeSettings,
  clearAllStoredData,
  loadTagsMap,
  loadPrefixesMap,
  saveTagsMap,
  savePrefixesMap,
  normalizeSessionState,
  normalizeTagsMap,
  normalizePrefixesMap,
}
