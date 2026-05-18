import { safeJsonParse } from './utils'
import {
  clearLauncherLocalCatalog,
  clearLauncherLocalCatalogCheckpoint,
  clearLauncherLocalLists,
  clearLauncherLocalSettings,
  getLauncherLocalDataSnapshotSync,
  saveLauncherLocalCatalog,
  saveLauncherLocalCatalogCheckpoint,
  saveLauncherLocalLists,
  saveLauncherLocalSettings,
} from '../launcher/runtime'
import type { LauncherLocalDataSnapshot } from '../launcher/types'
import type {
  DashboardViewState,
  DefaultSwipeSettings,
  F95ThreadItem,
  LatestCatalogSnapshot,
  LatestCatalogState,
  LatestGamesSort,
  ListType,
  ProcessedThreadItem,
  SessionState,
} from './types'
import { DEFAULT_FILTER_STATE, normalizeFilterState } from './filtering'
import {
  isPlainObject,
  normalizeDashboardViewState as normalizeDashboardViewStateValue,
  normalizeDefaultSwipeSettings as normalizeDefaultSwipeSettingsValue,
  normalizeFiniteNumber,
  normalizeImportedStringList,
  normalizeLatestGamesSort,
  normalizeNumericIdList,
  normalizePrefixesMap,
  normalizeTagsMap,
  normalizeThreadItemsByIdentifier,
  normalizeSwipeSortMode,
} from './normalizers'

const STORAGE_KEYS = {
  sessionState: 'f95_tinder_session_v1',
  defaultFilterState: 'f95_tinder_default_filter_state_v1',
  dashboardViewState: 'f95_tinder_dashboard_view_state_v1',
  cachedPagesIndexPrefix: 'f95_tinder_cached_pages_index_v2_',
  cachedPagePrefix: 'f95_tinder_cached_page_v2_',
  tagsMap: 'f95_tinder_tags_map_v1',
  prefixesMap: 'f95_tinder_prefixes_map_v1',
  latestCatalog: 'f95_tinder_latest_catalog_v1',
  latestCatalogCheckpoint: 'f95_tinder_latest_catalog_checkpoint_v1',
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

const BUILT_IN_DEFAULT_DASHBOARD_VIEW_STATE: DashboardViewState = {
  activeTab: 'bookmarks',
  searchText: '',
  includeTags: [],
  excludeTags: [],
  onlyUpdatedTracked: false,
  showOnlyDownloadedBookmarks: false,
  showOnlyPlayedFavorites: false,
  sortField: 'addedAt',
  sortDirection: 'asc',
  showInterestBadges: true,
}

const normalizeDefaultSwipeSettings = (value: unknown): DefaultSwipeSettings =>
  normalizeDefaultSwipeSettingsValue(value, BUILT_IN_DEFAULT_SWIPE_SETTINGS)

const normalizeDashboardViewState = (value: unknown): DashboardViewState =>
  normalizeDashboardViewStateValue(value, BUILT_IN_DEFAULT_DASHBOARD_VIEW_STATE)

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

let launcherSnapshotCache: LauncherLocalDataSnapshot | null | undefined
let launcherListsBackupCache:
  | {
      sessionState: SessionState
      tagsMap: Record<string, string>
      prefixesMap: Record<string, string>
    }
  | null
  | undefined
let launcherSettingsBackupCache:
  | {
      defaultSwipeSettings: DefaultSwipeSettings
      dashboardViewState: DashboardViewState
      tagsMap: Record<string, string>
      prefixesMap: Record<string, string>
      cookieProxy: unknown
    }
  | null
  | undefined
let launcherCatalogSnapshotCache: LatestCatalogSnapshot | null | undefined
let launcherCatalogCheckpointSnapshotCache:
  | LatestCatalogSnapshot
  | null
  | undefined

const getLauncherSnapshotCached = () => {
  if (launcherSnapshotCache !== undefined) {
    return launcherSnapshotCache
  }

  launcherSnapshotCache = getLauncherLocalDataSnapshotSync()
  return launcherSnapshotCache
}

const resetLauncherBackupCaches = () => {
  launcherListsBackupCache = undefined
  launcherSettingsBackupCache = undefined
  launcherCatalogSnapshotCache = undefined
  launcherCatalogCheckpointSnapshotCache = undefined
}

const setLauncherSnapshotCached = (value: LauncherLocalDataSnapshot | null) => {
  launcherSnapshotCache = value
  resetLauncherBackupCaches()
}

const updateLauncherSnapshotCached = (
  fileKind: 'lists' | 'settings' | 'catalog' | 'catalogCheckpoint',
  value: unknown,
) => {
  const currentSnapshot = getLauncherSnapshotCached()
  if (!currentSnapshot) {
    return
  }

  const nextUpdatedAtUnixMs =
    value === null || value === undefined ? null : Date.now()
  const nextFileDescriptor = {
    ...(fileKind === 'lists'
      ? currentSnapshot.listsFile
      : fileKind === 'settings'
        ? currentSnapshot.settingsFile
        : fileKind === 'catalog'
          ? currentSnapshot.catalogFile
          : currentSnapshot.catalogCheckpointFile),
    exists: value !== null && value !== undefined,
    updatedAtUnixMs: nextUpdatedAtUnixMs,
  }

  setLauncherSnapshotCached({
    ...currentSnapshot,
    lists: fileKind === 'lists' ? value ?? null : currentSnapshot.lists,
    settings:
      fileKind === 'settings' ? value ?? null : currentSnapshot.settings,
    catalog: fileKind === 'catalog' ? value ?? null : currentSnapshot.catalog,
    catalogCheckpoint:
      fileKind === 'catalogCheckpoint'
        ? value ?? null
        : currentSnapshot.catalogCheckpoint,
    listsFile: fileKind === 'lists' ? nextFileDescriptor : currentSnapshot.listsFile,
    settingsFile:
      fileKind === 'settings'
        ? nextFileDescriptor
        : currentSnapshot.settingsFile,
    catalogFile:
      fileKind === 'catalog' ? nextFileDescriptor : currentSnapshot.catalogFile,
    catalogCheckpointFile:
      fileKind === 'catalogCheckpoint'
        ? nextFileDescriptor
        : currentSnapshot.catalogCheckpointFile,
  })
}

const buildPersistedThreadItemsByIdentifier = (sessionState: SessionState) => {
  const trackedThreadItemsByIdentifier: Record<string, F95ThreadItem> = {}
  const trackedLinkSet = new Set<string>([
    ...sessionState.favoritesLinks,
    ...sessionState.trashLinks,
    ...sessionState.playedLinks,
  ])

  for (const trackedLink of trackedLinkSet) {
    const match = /\/threads\/(\d+)/.exec(trackedLink)
    if (!match) {
      continue
    }

    const threadIdentifier = match[1]
    const threadItem = sessionState.threadItemsByIdentifier[threadIdentifier]
    if (threadItem) {
      trackedThreadItemsByIdentifier[threadIdentifier] = threadItem
    }
  }

  return trackedThreadItemsByIdentifier
}

const serializeSessionStateForStorage = (sessionState: SessionState): SessionState => {
  return {
    ...sessionState,
    remainingThreadIdentifiers: [],
    threadItemsByIdentifier: buildPersistedThreadItemsByIdentifier(sessionState),
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

  if (!Array.isArray(possibleSessionState.favoritesLinks)) {
    return null
  }

  if (!Array.isArray(possibleSessionState.trashLinks)) {
    return null
  }

  if (typeof possibleSessionState.viewedCount !== 'number') {
    return null
  }

  const favoritesLinks = normalizeImportedStringList(possibleSessionState.favoritesLinks)
  const filterState = normalizeFilterState(possibleSessionState.filterState)
  const playedByLinkFallback = normalizePlayedByLink(possibleSessionState.playedByLink)
  const playedLinks = normalizePlayedLinks(
    possibleSessionState.playedLinks,
    playedByLinkFallback,
  )
  const playedDislikedLinks = normalizePlayedDislikedLinks(
    possibleSessionState.playedDislikedLinks,
    playedLinks,
  )
  const bookmarkedDownloadedLinks = normalizeBookmarkedDownloadedLinks(
    possibleSessionState.bookmarkedDownloadedLinks,
    favoritesLinks,
  )
  const playedFavoriteLinks = normalizePlayedFavoriteLinks(
    possibleSessionState.playedFavoriteLinks,
    playedLinks,
  ).filter((threadLink) => !playedDislikedLinks.includes(threadLink))
  const threadItemsByIdentifier = normalizeThreadItemsByIdentifier(
    possibleSessionState.threadItemsByIdentifier,
  )
  const availableThreadIdentifierSet = new Set<number>(
    Object.values(threadItemsByIdentifier).map((threadItem) => threadItem.thread_id),
  )
  const remainingThreadIdentifiers = normalizeNumericIdList(
    possibleSessionState.remainingThreadIdentifiers,
  ).filter((threadIdentifier) => availableThreadIdentifierSet.has(threadIdentifier))
  const playedByLink: Record<string, boolean> = {}
  for (const link of playedLinks) {
    playedByLink[link] = true
  }

  const processedThreadItemsByLink = normalizeProcessedThreadItems(
    possibleSessionState.processedThreadItemsByLink,
  )
  const latestGamesSort: LatestGamesSort =
    possibleSessionState.latestGamesSort === 'views' ? 'views' : 'date'
  const swipeSortMode = normalizeSwipeSortMode(
    possibleSessionState.swipeSortMode ?? latestGamesSort,
  )

  return {
    currentPageNumber: possibleSessionState.currentPageNumber,
    nextPageToFetchNumber: possibleSessionState.nextPageToFetchNumber,
    latestGamesSort,
    swipeSortMode,
    remainingThreadIdentifiers,
    threadItemsByIdentifier,
    favoritesLinks,
    bookmarkedDownloadedLinks,
    trashLinks: normalizeImportedStringList(possibleSessionState.trashLinks),
    playedByLink,
    playedLinks,
    playedFavoriteLinks,
    playedDislikedLinks,
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

const loadDashboardViewStateFromLocalStorage = () => {
  const dashboardViewStateText = readLocalStorageValue(
    STORAGE_KEYS.dashboardViewState,
  )
  if (!dashboardViewStateText) {
    return normalizeDashboardViewState(BUILT_IN_DEFAULT_DASHBOARD_VIEW_STATE)
  }

  const dashboardViewStateValue = safeJsonParse<unknown>(dashboardViewStateText)
  if (!dashboardViewStateValue) {
    return normalizeDashboardViewState(BUILT_IN_DEFAULT_DASHBOARD_VIEW_STATE)
  }

  return normalizeDashboardViewState(dashboardViewStateValue)
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
    swipeSortMode: defaultSwipeSettings.latestGamesSort,
    remainingThreadIdentifiers: [],
    threadItemsByIdentifier: {},
    favoritesLinks: [],
    bookmarkedDownloadedLinks: [],
    trashLinks: [],
    playedByLink: {},
    playedLinks: [],
    playedFavoriteLinks: [],
    playedDislikedLinks: [],
    processedThreadItemsByLink: {},
    viewedCount: 0,
    filterState: normalizeFilterState(defaultSwipeSettings.filterState),
    lastMetadataSyncAtUnixMs: null,
  }
}

const normalizeLatestCatalogState = (
  value: unknown,
): LatestCatalogState | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const rawValue = value as Record<string, unknown>
  const threadItemsByIdentifier = normalizeThreadItemsByIdentifier(
    rawValue.threadItemsByIdentifier,
  )

  const availableThreadIdentifierSet = new Set<number>(
    Object.values(threadItemsByIdentifier).map((threadItem) => threadItem.thread_id),
  )

  const orderedThreadIdentifiers = normalizeNumericIdList(
    rawValue.orderedThreadIdentifiers,
  ).filter((threadIdentifier) => availableThreadIdentifierSet.has(threadIdentifier))

  const pageCount = Math.max(
    0,
    Math.floor(normalizeFiniteNumber(rawValue.pageCount)),
  )
  const totalPagesValue = Math.max(
    0,
    Math.floor(normalizeFiniteNumber(rawValue.totalPages)),
  )
  const hasExplicitCompleteFlag =
    rawValue.isComplete === true || rawValue.isComplete === false
  const isComplete =
    rawValue.isComplete === true ||
    (!hasExplicitCompleteFlag && pageCount > 0)
  const totalPages = isComplete
    ? Math.max(pageCount, totalPagesValue)
    : totalPagesValue
  const updatedTrackedCount = Math.max(
    0,
    Math.floor(normalizeFiniteNumber(rawValue.updatedTrackedCount)),
  )
  const lastError =
    typeof rawValue.lastError === 'string' && rawValue.lastError.trim().length > 0
      ? rawValue.lastError
      : null
  const nextRetryAtUnixMs =
    typeof rawValue.nextRetryAtUnixMs === 'number' &&
    Number.isFinite(rawValue.nextRetryAtUnixMs) &&
    rawValue.nextRetryAtUnixMs > 0
      ? Math.round(rawValue.nextRetryAtUnixMs)
      : null

  return {
    threadItemsByIdentifier,
    orderedThreadIdentifiers,
    pageCount,
    totalPages,
    isComplete,
    updatedTrackedCount,
    lastError,
    nextRetryAtUnixMs,
    sourceLatestGamesSort: normalizeLatestGamesSort(rawValue.sourceLatestGamesSort),
    sourceFilterState: normalizeFilterState(rawValue.sourceFilterState),
  }
}

const normalizeLatestCatalogSnapshot = (
  value: unknown,
): LatestCatalogSnapshot => {
  if (!isPlainObject(value)) {
    return {
      catalog: null,
      updatedAtUnixMs: null,
      path: null,
    }
  }

  const rawValue = value as Record<string, unknown>
  return {
    catalog: normalizeLatestCatalogState(rawValue.catalog),
    updatedAtUnixMs:
      typeof rawValue.updatedAtUnixMs === 'number' &&
      Number.isFinite(rawValue.updatedAtUnixMs)
        ? rawValue.updatedAtUnixMs
        : null,
    path: typeof rawValue.path === 'string' ? rawValue.path : null,
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

const normalizePlayedDislikedLinks = (
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

const normalizeBookmarkedDownloadedLinks = (
  value: unknown,
  favoriteLinks: string[],
): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const favoriteLinkSet = new Set(favoriteLinks)
  const normalized: string[] = []
  for (const item of value) {
    if (
      typeof item === 'string' &&
      item.trim().length > 0 &&
      favoriteLinkSet.has(item)
    ) {
      normalized.push(item)
    }
  }

  return Array.from(new Set(normalized))
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

const isLauncherLocalDataEnabled = () => getLauncherSnapshotCached() !== null

const loadLauncherLocalListsBackup = () => {
  if (launcherListsBackupCache !== undefined) {
    return launcherListsBackupCache
  }

  const launcherSnapshot = getLauncherSnapshotCached()
  if (!launcherSnapshot || !isPlainObject(launcherSnapshot.lists)) {
    launcherListsBackupCache = null
    return launcherListsBackupCache
  }

  const rawLists = launcherSnapshot.lists as Record<string, unknown>

  const sessionState = normalizeSessionState(rawLists.sessionState)
  if (!sessionState) {
    launcherListsBackupCache = null
    return launcherListsBackupCache
  }

  launcherListsBackupCache = {
    sessionState,
    tagsMap: normalizeTagsMap(rawLists.tagsMap),
    prefixesMap: normalizePrefixesMap(rawLists.prefixesMap),
  }

  return launcherListsBackupCache
}

const loadLauncherLocalSettingsBackup = () => {
  if (launcherSettingsBackupCache !== undefined) {
    return launcherSettingsBackupCache
  }

  const launcherSnapshot = getLauncherSnapshotCached()
  if (!launcherSnapshot || !isPlainObject(launcherSnapshot.settings)) {
    launcherSettingsBackupCache = null
    return launcherSettingsBackupCache
  }

  const rawSettings = launcherSnapshot.settings as Record<string, unknown>
  if (!('defaultSwipeSettings' in rawSettings)) {
    launcherSettingsBackupCache = null
    return launcherSettingsBackupCache
  }

  launcherSettingsBackupCache = {
    defaultSwipeSettings: normalizeDefaultSwipeSettings(rawSettings.defaultSwipeSettings),
    dashboardViewState: normalizeDashboardViewState(rawSettings.dashboardViewState),
    tagsMap: normalizeTagsMap(rawSettings.tagsMap),
    prefixesMap: normalizePrefixesMap(rawSettings.prefixesMap),
    cookieProxy: 'cookieProxy' in rawSettings ? rawSettings.cookieProxy : null,
  }

  return launcherSettingsBackupCache
}

const loadLauncherLatestCatalogSnapshot = (): LatestCatalogSnapshot | null => {
  if (launcherCatalogSnapshotCache !== undefined) {
    return launcherCatalogSnapshotCache
  }

  const launcherSnapshot = getLauncherSnapshotCached()
  if (!launcherSnapshot) {
    launcherCatalogSnapshotCache = null
    return launcherCatalogSnapshotCache
  }

  launcherCatalogSnapshotCache = {
    catalog: normalizeLatestCatalogState(launcherSnapshot.catalog),
    updatedAtUnixMs: launcherSnapshot.catalogFile.updatedAtUnixMs,
    path: launcherSnapshot.catalogFile.path,
  }

  return launcherCatalogSnapshotCache
}

const loadLauncherLatestCatalogCheckpointSnapshot = ():
  | LatestCatalogSnapshot
  | null => {
  if (launcherCatalogCheckpointSnapshotCache !== undefined) {
    return launcherCatalogCheckpointSnapshotCache
  }

  const launcherSnapshot = getLauncherSnapshotCached()
  if (!launcherSnapshot) {
    launcherCatalogCheckpointSnapshotCache = null
    return launcherCatalogCheckpointSnapshotCache
  }

  launcherCatalogCheckpointSnapshotCache = {
    catalog: normalizeLatestCatalogState(launcherSnapshot.catalogCheckpoint),
    updatedAtUnixMs: launcherSnapshot.catalogCheckpointFile.updatedAtUnixMs,
    path: launcherSnapshot.catalogCheckpointFile.path,
  }

  return launcherCatalogCheckpointSnapshotCache
}

const buildFallbackLocalListsBackup = () => {
  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  return {
    sessionState: loadSessionStateFromLocalStorage() ?? createDefaultSessionState(),
    tagsMap: launcherSettingsBackup?.tagsMap ?? loadTagsMapFromLocalStorage(),
    prefixesMap:
      launcherSettingsBackup?.prefixesMap ?? loadPrefixesMapFromLocalStorage(),
  }
}

const buildFallbackLocalSettingsBackup = () => {
  const launcherListsBackup = loadLauncherLocalListsBackup()
  return {
    defaultSwipeSettings: loadDefaultSwipeSettingsFromLocalStorage(),
    dashboardViewState: loadDashboardViewStateFromLocalStorage(),
    tagsMap: launcherListsBackup?.tagsMap ?? loadTagsMapFromLocalStorage(),
    prefixesMap:
      launcherListsBackup?.prefixesMap ?? loadPrefixesMapFromLocalStorage(),
    cookieProxy: null,
  }
}

const loadLatestCatalogSnapshotFromLocalStorage = (): LatestCatalogSnapshot => {
  const latestCatalogText = readLocalStorageValue(STORAGE_KEYS.latestCatalog)
  if (!latestCatalogText) {
    return {
      catalog: null,
      updatedAtUnixMs: null,
      path: null,
    }
  }

  return normalizeLatestCatalogSnapshot(safeJsonParse<unknown>(latestCatalogText))
}

const loadLatestCatalogCheckpointSnapshotFromLocalStorage =
  (): LatestCatalogSnapshot => {
    const latestCatalogCheckpointText = readLocalStorageValue(
      STORAGE_KEYS.latestCatalogCheckpoint,
    )
    if (!latestCatalogCheckpointText) {
      return {
        catalog: null,
        updatedAtUnixMs: null,
        path: null,
      }
    }

    return normalizeLatestCatalogSnapshot(
      safeJsonParse<unknown>(latestCatalogCheckpointText),
    )
  }

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

const loadDashboardViewState = () => {
  const launcherBackup = loadLauncherLocalSettingsBackup()
  if (launcherBackup) {
    return launcherBackup.dashboardViewState
  }

  return loadDashboardViewStateFromLocalStorage()
}

const loadLatestCatalogSnapshot = (): LatestCatalogSnapshot => {
  const launcherSnapshot = loadLauncherLatestCatalogSnapshot()
  if (launcherSnapshot) {
    return launcherSnapshot
  }

  return loadLatestCatalogSnapshotFromLocalStorage()
}

const loadLatestCatalogCheckpointSnapshot = (): LatestCatalogSnapshot => {
  const launcherSnapshot = loadLauncherLatestCatalogCheckpointSnapshot()
  if (launcherSnapshot) {
    return launcherSnapshot
  }

  return loadLatestCatalogCheckpointSnapshotFromLocalStorage()
}

const saveDefaultSwipeSettings = (defaultSwipeSettings: unknown) => {
  const normalizedValue = normalizeDefaultSwipeSettings(defaultSwipeSettings)

  if (isLauncherLocalDataEnabled()) {
    const currentSettingsBackup =
      loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
    const nextSettingsBackup = {
      ...currentSettingsBackup,
      defaultSwipeSettings: normalizedValue,
    }
    updateLauncherSnapshotCached('settings', nextSettingsBackup)
    void saveLauncherLocalSettings(nextSettingsBackup)
    return
  }

  writeLocalStorageValue(
    STORAGE_KEYS.defaultFilterState,
    JSON.stringify(normalizedValue),
  )
}

const saveDashboardViewState = (dashboardViewState: unknown) => {
  const normalizedValue = normalizeDashboardViewState(dashboardViewState)

  if (isLauncherLocalDataEnabled()) {
    const currentSettingsBackup =
      loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
    const nextSettingsBackup = {
      ...currentSettingsBackup,
      dashboardViewState: normalizedValue,
    }
    updateLauncherSnapshotCached('settings', nextSettingsBackup)
    void saveLauncherLocalSettings(nextSettingsBackup)
    return
  }

  writeLocalStorageValue(
    STORAGE_KEYS.dashboardViewState,
    JSON.stringify(normalizedValue),
  )
}

const saveLatestCatalogState = (latestCatalogState: LatestCatalogState) => {
  const normalizedValue = normalizeLatestCatalogState(latestCatalogState)
  if (!normalizedValue) {
    return
  }

  const completedValue = {
    ...normalizedValue,
    totalPages: Math.max(normalizedValue.pageCount, normalizedValue.totalPages),
    isComplete: true,
    lastError: null,
    nextRetryAtUnixMs: null,
  }

  if (isLauncherLocalDataEnabled()) {
    updateLauncherSnapshotCached('catalog', completedValue)
    void saveLauncherLocalCatalog(completedValue)
    return
  }

  writeLocalStorageValue(
    STORAGE_KEYS.latestCatalog,
    JSON.stringify({
      catalog: completedValue,
      updatedAtUnixMs: Date.now(),
      path: null,
    }),
  )
}

const saveLatestCatalogCheckpointState = (latestCatalogState: LatestCatalogState) => {
  const normalizedValue = normalizeLatestCatalogState(latestCatalogState)
  if (!normalizedValue) {
    return
  }

  const checkpointValue = {
    ...normalizedValue,
    isComplete: false,
  }

  if (isLauncherLocalDataEnabled()) {
    updateLauncherSnapshotCached('catalogCheckpoint', checkpointValue)
    void saveLauncherLocalCatalogCheckpoint(checkpointValue)
    return
  }

  writeLocalStorageValue(
    STORAGE_KEYS.latestCatalogCheckpoint,
    JSON.stringify({
      catalog: checkpointValue,
      updatedAtUnixMs: Date.now(),
      path: null,
    }),
  )
}

const clearLatestCatalogState = () => {
  if (isLauncherLocalDataEnabled()) {
    updateLauncherSnapshotCached('catalog', null)
    void clearLauncherLocalCatalog()
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.latestCatalog)
}

const clearLatestCatalogCheckpointState = () => {
  if (isLauncherLocalDataEnabled()) {
    updateLauncherSnapshotCached('catalogCheckpoint', null)
    void clearLauncherLocalCatalogCheckpoint()
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.latestCatalogCheckpoint)
}

const saveSessionState = (sessionState: SessionState) => {
  if (isLauncherLocalDataEnabled()) {
    const currentListsBackup =
      loadLauncherLocalListsBackup() ?? buildFallbackLocalListsBackup()
    const nextListsBackup = {
      ...currentListsBackup,
      sessionState: serializeSessionStateForStorage(sessionState),
    }
    updateLauncherSnapshotCached('lists', nextListsBackup)
    void saveLauncherLocalLists(nextListsBackup)
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
    updateLauncherSnapshotCached('lists', null)
    updateLauncherSnapshotCached('settings', null)
    updateLauncherSnapshotCached('catalog', null)
    updateLauncherSnapshotCached('catalogCheckpoint', null)
    void clearLauncherLocalLists()
    void clearLauncherLocalSettings()
    void clearLauncherLocalCatalog()
    void clearLauncherLocalCatalogCheckpoint()
    return
  }

  removeLocalStorageValue(STORAGE_KEYS.sessionState)
  removeLocalStorageValue(STORAGE_KEYS.defaultFilterState)
  removeLocalStorageValue(STORAGE_KEYS.dashboardViewState)
  removeLocalStorageValue(STORAGE_KEYS.latestCatalog)
  removeLocalStorageValue(STORAGE_KEYS.latestCatalogCheckpoint)
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
    const nextListsBackup = {
      ...currentListsBackup,
      tagsMap: cleanedMap,
    }
    const nextSettingsBackup = {
      ...currentSettingsBackup,
      tagsMap: cleanedMap,
    }
    updateLauncherSnapshotCached('lists', nextListsBackup)
    updateLauncherSnapshotCached('settings', nextSettingsBackup)
    void saveLauncherLocalLists(nextListsBackup)
    void saveLauncherLocalSettings(nextSettingsBackup)
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
    const nextListsBackup = {
      ...currentListsBackup,
      prefixesMap: cleanedMap,
    }
    const nextSettingsBackup = {
      ...currentSettingsBackup,
      prefixesMap: cleanedMap,
    }
    updateLauncherSnapshotCached('lists', nextListsBackup)
    updateLauncherSnapshotCached('settings', nextSettingsBackup)
    void saveLauncherLocalLists(nextListsBackup)
    void saveLauncherLocalSettings(nextSettingsBackup)
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
  loadDashboardViewState,
  loadLatestCatalogSnapshot,
  loadLatestCatalogCheckpointSnapshot,
  saveDefaultSwipeSettings,
  saveDashboardViewState,
  saveLatestCatalogState,
  saveLatestCatalogCheckpointState,
  normalizeDefaultSwipeSettings,
  normalizeDashboardViewState,
  clearAllStoredData,
  clearLatestCatalogState,
  clearLatestCatalogCheckpointState,
  loadTagsMap,
  loadPrefixesMap,
  saveTagsMap,
  savePrefixesMap,
  normalizeSessionState,
  normalizeTagsMap,
  normalizePrefixesMap,
}
