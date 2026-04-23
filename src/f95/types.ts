type F95ThreadItem = {
  thread_id: number
  title: string
  creator: string
  version: string
  views: number
  likes: number
  prefixes: number[]
  tags: number[]
  rating: number
  cover: string
  screens: string[]
  date: string
  watched: boolean
  ignored: boolean
  new: boolean
  ts: number
}

type F95ApiPagination = {
  page: number
  total: number
}

type F95ApiMessage = {
  data: F95ThreadItem[]
  pagination: F95ApiPagination
  count: number
}

type F95ApiResponse = {
  status: 'ok' | 'error'
  msg: F95ApiMessage
}

type LatestGamesSort = 'date' | 'views'
type SwipeSortMode = LatestGamesSort | 'interest'
type DashboardSortField = 'addedAt' | 'rating' | 'title' | 'interest'
type DashboardSortDirection = 'desc' | 'asc'
type DashboardTabId = 'bookmarks' | 'trash' | 'played'

type DashboardViewState = {
  activeTab: DashboardTabId
  searchText: string
  includeTags: string[]
  excludeTags: string[]
  onlyUpdatedTracked: boolean
  showOnlyDownloadedBookmarks: boolean
  showOnlyPlayedFavorites: boolean
  sortField: DashboardSortField
  sortDirection: DashboardSortDirection
  showInterestBadges: boolean
}

type FilterState = {
  searchText: string
  minimumRating: number
  onlyNew: boolean
  hideWatched: boolean
  hideIgnored: boolean
  includeTagIds: number[]
  excludeTagIds: number[]
  includePrefixIds: number[]
  excludePrefixIds: number[]
}

type DefaultSwipeSettings = {
  latestGamesSort: LatestGamesSort
  filterState: FilterState
}

type ListType = 'favorite' | 'trash' | 'played'

type ProcessedThreadItem = {
  threadIdentifier: number
  threadLink: string
  title: string
  creator: string
  cover: string
  rating: number
  trackedVersion: string
  version: string
  prefixes: number[]
  tags: number[]
  trackedTs?: number
  ts?: number
  addedAtUnixSeconds: number
  listType: ListType | null
}

type SessionState = {
  currentPageNumber: number
  nextPageToFetchNumber: number
  latestGamesSort: LatestGamesSort
  swipeSortMode: SwipeSortMode
  remainingThreadIdentifiers: number[]
  threadItemsByIdentifier: Record<string, F95ThreadItem>

  favoritesLinks: string[]
  bookmarkedDownloadedLinks: string[]
  trashLinks: string[]
  playedByLink: Record<string, boolean>
  playedLinks: string[]
  playedFavoriteLinks: string[]
  playedDislikedLinks: string[]

  processedThreadItemsByLink: Record<string, ProcessedThreadItem>

  viewedCount: number
  filterState: FilterState
  lastMetadataSyncAtUnixMs: number | null
}

type UndoSnapshot = {
  sessionStateBefore: SessionState
}

type MetadataSyncState = {
  isRunning: boolean
  isPaused: boolean
  isStopping: boolean
  isComplete: boolean
  nextRetryAtUnixMs: number | null
  currentPage: number
  pageLimit: number
  syncedCount: number
  updatedTrackedCount: number
  lastOutcome: 'completed' | 'stopped' | null
  error: string | null
}

type LatestCatalogState = {
  threadItemsByIdentifier: Record<string, F95ThreadItem>
  orderedThreadIdentifiers: number[]
  pageCount: number
  totalPages: number
  isComplete: boolean
  updatedTrackedCount: number
  lastError: string | null
  nextRetryAtUnixMs: number | null
  sourceLatestGamesSort: LatestGamesSort
  sourceFilterState: FilterState
}

type LatestCatalogSnapshot = {
  catalog: LatestCatalogState | null
  updatedAtUnixMs: number | null
  path: string | null
}

type DownloadLink = {
  label: string
  url: string | null
  isMasked: boolean
}

type DownloadGroup = {
  label: string
  links: DownloadLink[]
}

type DownloadChoice = {
  key: string
  label: string
  contextLabel: string | null
  links: DownloadLink[]
}

type ThreadDownloadsStatus = 'available' | 'login_required' | 'not_found'

type ThreadDownloadsData = {
  status: ThreadDownloadsStatus
  groups: DownloadGroup[]
  requiresAuth: boolean
  threadLink: string
  fetchedAtUnixMs: number
}

export type {
  F95ThreadItem,
  F95ApiResponse,
  LatestGamesSort,
  SwipeSortMode,
  DashboardSortField,
  DashboardSortDirection,
  DashboardTabId,
  DashboardViewState,
  FilterState,
  DefaultSwipeSettings,
  ListType,
  ProcessedThreadItem,
  SessionState,
  UndoSnapshot,
  MetadataSyncState,
  LatestCatalogState,
  LatestCatalogSnapshot,
  DownloadLink,
  DownloadGroup,
  DownloadChoice,
  ThreadDownloadsStatus,
  ThreadDownloadsData,
}
