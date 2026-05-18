import { DEFAULT_FILTER_STATE, normalizeFilterState } from './filtering'
import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardTabId,
  DashboardViewState,
  DefaultSwipeSettings,
  F95ThreadItem,
  LatestGamesSort,
  SwipeSortMode,
} from './types'

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizeFiniteNumber = (value: unknown, fallbackValue = 0) => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallbackValue
}

const normalizeBoolean = (value: unknown) => value === true

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeNumericIdList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: number[] = []
  const seenValues = new Set<number>()

  for (const item of value) {
    if (
      typeof item !== 'number' ||
      !Number.isFinite(item) ||
      !Number.isInteger(item) ||
      seenValues.has(item)
    ) {
      continue
    }

    seenValues.add(item)
    normalized.push(item)
  }

  return normalized
}

const normalizeThreadItem = (value: unknown): F95ThreadItem | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const threadItem = value as Partial<F95ThreadItem>
  if (
    typeof threadItem.thread_id !== 'number' ||
    !Number.isFinite(threadItem.thread_id) ||
    !Number.isInteger(threadItem.thread_id) ||
    typeof threadItem.title !== 'string'
  ) {
    return null
  }

  return {
    thread_id: threadItem.thread_id,
    title: threadItem.title,
    creator: typeof threadItem.creator === 'string' ? threadItem.creator : '',
    version: typeof threadItem.version === 'string' ? threadItem.version : '',
    views: normalizeFiniteNumber(threadItem.views),
    likes: normalizeFiniteNumber(threadItem.likes),
    prefixes: normalizeNumericIdList(threadItem.prefixes),
    tags: normalizeNumericIdList(threadItem.tags),
    rating: normalizeFiniteNumber(threadItem.rating),
    cover: typeof threadItem.cover === 'string' ? threadItem.cover : '',
    screens: normalizeStringArray(threadItem.screens),
    date: typeof threadItem.date === 'string' ? threadItem.date : '',
    watched: normalizeBoolean(threadItem.watched),
    ignored: normalizeBoolean(threadItem.ignored),
    new: normalizeBoolean(threadItem.new),
    ts: normalizeFiniteNumber(threadItem.ts),
  }
}

const normalizeThreadItemList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<F95ThreadItem[]>((normalized, entry) => {
    const threadItem = normalizeThreadItem(entry)
    if (threadItem) {
      normalized.push(threadItem)
    }
    return normalized
  }, [])
}

const normalizeThreadItemsByIdentifier = (value: unknown) => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalized: Record<string, F95ThreadItem> = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const threadItem = normalizeThreadItem(entryValue)
    if (threadItem) {
      normalized[entryKey] = threadItem
    }
  }

  return normalized
}

const normalizeImportedStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeLatestGamesSort = (value: unknown): LatestGamesSort =>
  value === 'date' ? 'date' : 'views'

const normalizeSwipeSortMode = (value: unknown): SwipeSortMode => {
  if (value === 'views' || value === 'interest') {
    return value
  }

  return 'date'
}

const normalizeDashboardTabId = (value: unknown): DashboardTabId => {
  if (value === 'trash' || value === 'played') {
    return value
  }

  return 'bookmarks'
}

const normalizeDashboardSortField = (value: unknown): DashboardSortField => {
  if (value === 'rating' || value === 'title' || value === 'interest') {
    return value
  }

  return 'addedAt'
}

const normalizeDashboardSortDirection = (
  value: unknown,
): DashboardSortDirection => {
  return value === 'desc' ? 'desc' : 'asc'
}

const normalizeDefaultSwipeSettings = (
  value: unknown,
  fallbackValue: DefaultSwipeSettings = {
    latestGamesSort: 'views',
    filterState: normalizeFilterState(DEFAULT_FILTER_STATE),
  },
): DefaultSwipeSettings => {
  if (!isPlainObject(value)) {
    return {
      latestGamesSort: fallbackValue.latestGamesSort,
      filterState: normalizeFilterState(fallbackValue.filterState),
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

const normalizeDashboardViewState = (
  value: unknown,
  fallbackValue: DashboardViewState = {
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
  },
): DashboardViewState => {
  if (!isPlainObject(value)) {
    return { ...fallbackValue }
  }

  return {
    activeTab: normalizeDashboardTabId(value.activeTab),
    searchText: typeof value.searchText === 'string' ? value.searchText : '',
    includeTags: normalizeImportedStringList(value.includeTags),
    excludeTags: normalizeImportedStringList(value.excludeTags),
    onlyUpdatedTracked: value.onlyUpdatedTracked === true,
    showOnlyDownloadedBookmarks: value.showOnlyDownloadedBookmarks === true,
    showOnlyPlayedFavorites: value.showOnlyPlayedFavorites === true,
    sortField: normalizeDashboardSortField(value.sortField),
    sortDirection: normalizeDashboardSortDirection(value.sortDirection),
    showInterestBadges:
      typeof value.showInterestBadges === 'boolean'
        ? value.showInterestBadges
        : true,
  }
}

const normalizeLookupMap = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  for (const key of Object.keys(value)) {
    const rawValue = value[key]
    if (typeof rawValue === 'string') {
      normalized[key] = rawValue
    }
  }

  return normalized
}

const normalizeTagsMap = (value: unknown): Record<string, string> => {
  return normalizeLookupMap(value)
}

const PREFIXES_LOOKUP_GROUP_KEYS = ['prefixes', 'engines'] as const

const normalizePrefixesMap = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const groupedMapList = PREFIXES_LOOKUP_GROUP_KEYS.map((groupKey) =>
    normalizeLookupMap(value[groupKey]),
  ).filter((lookupMap) => Object.keys(lookupMap).length > 0)

  if (groupedMapList.length === 0) {
    return normalizeLookupMap(value)
  }

  return Object.assign({}, ...groupedMapList)
}

export {
  isPlainObject,
  normalizeDashboardViewState,
  normalizeDefaultSwipeSettings,
  normalizeFiniteNumber,
  normalizeImportedStringList,
  normalizeLatestGamesSort,
  normalizeNumericIdList,
  normalizePrefixesMap,
  normalizeStringArray,
  normalizeTagsMap,
  normalizeThreadItem,
  normalizeThreadItemList,
  normalizeThreadItemsByIdentifier,
  normalizeSwipeSortMode,
}
