import { safeJsonParse } from './utils'
import type { F95ThreadItem, ListType, ProcessedThreadItem, SessionState } from './types'

const STORAGE_KEYS = {
  sessionState: 'f95_tinder_session_v1',
  cachedPagesIndex: 'f95_tinder_cached_pages_index_v1',
  cachedPagePrefix: 'f95_tinder_cached_page_v1_',
  tagsMap: 'f95_tinder_tags_map_v1',
}

const DEFAULT_FILTER_STATE = {
  searchText: '',
  minimumRating: 0,
  onlyNew: false,
  hideWatched: false,
  hideIgnored: false,
}

const getCachedPageKey = (pageNumber: number) => `${STORAGE_KEYS.cachedPagePrefix}${pageNumber}`

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

const loadCachedPagesIndex = () => {
  const cachedIndexText = readLocalStorageValue(STORAGE_KEYS.cachedPagesIndex)
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

const saveCachedPagesIndex = (pageNumberList: number[]) => {
  writeLocalStorageValue(STORAGE_KEYS.cachedPagesIndex, JSON.stringify(pageNumberList))
}

const loadCachedPage = (pageNumber: number) => {
  const cachedPageText = readLocalStorageValue(getCachedPageKey(pageNumber))
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

const saveCachedPage = (pageNumber: number, threadItemList: F95ThreadItem[]) => {
  writeLocalStorageValue(getCachedPageKey(pageNumber), JSON.stringify(threadItemList))
}

const pruneCachedPages = (maxCachedPagesCount: number) => {
  const cachedPageNumberList = loadCachedPagesIndex()

  if (cachedPageNumberList.length <= maxCachedPagesCount) {
    return
  }

  const pageNumberListToRemove = cachedPageNumberList.slice(0, cachedPageNumberList.length - maxCachedPagesCount)
  const pageNumberListToKeep = cachedPageNumberList.slice(cachedPageNumberList.length - maxCachedPagesCount)

  for (const pageNumber of pageNumberListToRemove) {
    removeLocalStorageValue(getCachedPageKey(pageNumber))
  }

  saveCachedPagesIndex(pageNumberListToKeep)
}

const markPageAsCached = (pageNumber: number) => {
  const cachedPageNumberList = loadCachedPagesIndex()
  const isAlreadyCached = cachedPageNumberList.includes(pageNumber)

  if (isAlreadyCached) {
    return
  }

  const updatedCachedPageNumberList = [...cachedPageNumberList, pageNumber]
  saveCachedPagesIndex(updatedCachedPageNumberList)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

  const filterState = possibleSessionState.filterState ?? DEFAULT_FILTER_STATE
  const playedByLinkFallback = normalizePlayedByLink(possibleSessionState.playedByLink)
  const playedLinks = normalizePlayedLinks(
    possibleSessionState.playedLinks,
    playedByLinkFallback,
  )
  const playedByLink: Record<string, boolean> = {}
  for (const link of playedLinks) {
    playedByLink[link] = true
  }

  const processedThreadItemsByLink = normalizeProcessedThreadItems(
    possibleSessionState.processedThreadItemsByLink,
  )

  return {
    currentPageNumber: possibleSessionState.currentPageNumber,
    nextPageToFetchNumber: possibleSessionState.nextPageToFetchNumber,
    remainingThreadIdentifiers: possibleSessionState.remainingThreadIdentifiers as number[],
    threadItemsByIdentifier: possibleSessionState.threadItemsByIdentifier as Record<string, F95ThreadItem>,
    favoritesLinks: possibleSessionState.favoritesLinks as string[],
    trashLinks: possibleSessionState.trashLinks as string[],
    playedByLink,
    playedLinks,
    processedThreadItemsByLink,
    viewedCount: possibleSessionState.viewedCount,
    filterState,
  }
}

const loadSessionState = (): SessionState | null => {
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

const createDefaultSessionState = (): SessionState => {
  return {
    currentPageNumber: 1,
    nextPageToFetchNumber: 1,
    remainingThreadIdentifiers: [],
    threadItemsByIdentifier: {},
    favoritesLinks: [],
    trashLinks: [],
    playedByLink: {},
    playedLinks: [],
    processedThreadItemsByLink: {},
    viewedCount: 0,
    filterState: { ...DEFAULT_FILTER_STATE },
  }
}

const saveSessionState = (sessionState: SessionState) => {
  writeLocalStorageValue(STORAGE_KEYS.sessionState, JSON.stringify(sessionState))
}

const clearAllStoredData = () => {
  const cachedPageNumberList = loadCachedPagesIndex()
  for (const pageNumber of cachedPageNumberList) {
    removeLocalStorageValue(getCachedPageKey(pageNumber))
  }

  removeLocalStorageValue(STORAGE_KEYS.cachedPagesIndex)
  removeLocalStorageValue(STORAGE_KEYS.sessionState)
  clearTagsMap()
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
      version: typeof rawItem.version === 'string' ? rawItem.version : '',
      tags,
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

const normalizeTagsMap = (value: unknown): Record<string, string> => {
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

const loadTagsMap = (): Record<string, string> => {
  const tagsMapText = readLocalStorageValue(STORAGE_KEYS.tagsMap)
  if (!tagsMapText) {
    return {}
  }

  const parsedMap = safeJsonParse<unknown>(tagsMapText)
  return normalizeTagsMap(parsedMap)
}

const saveTagsMap = (tagsMap: Record<string, string>) => {
  const cleanedMap: Record<string, string> = {}
  for (const key of Object.keys(tagsMap)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      continue
    }
    const value = tagsMap[key]
    if (typeof value === 'string') {
      cleanedMap[key] = value
    }
  }

  writeLocalStorageValue(STORAGE_KEYS.tagsMap, JSON.stringify(cleanedMap))
}

function clearTagsMap() {
  removeLocalStorageValue(STORAGE_KEYS.tagsMap)
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
  clearAllStoredData,
  loadTagsMap,
  saveTagsMap,
  normalizeSessionState,
  normalizeTagsMap,
}
