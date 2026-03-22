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
  remainingThreadIdentifiers: number[]
  threadItemsByIdentifier: Record<string, F95ThreadItem>

  favoritesLinks: string[]
  trashLinks: string[]
  playedByLink: Record<string, boolean>
  playedLinks: string[]

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
  currentPage: number
  pageLimit: number
  syncedCount: number
  trackedCount: number
  error: string | null
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
  FilterState,
  DefaultSwipeSettings,
  ListType,
  ProcessedThreadItem,
  SessionState,
  UndoSnapshot,
  MetadataSyncState,
  DownloadLink,
  DownloadGroup,
  ThreadDownloadsStatus,
  ThreadDownloadsData,
}
