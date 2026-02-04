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

type FilterState = {
  searchText: string
  minimumRating: number
  onlyNew: boolean
  hideWatched: boolean
  hideIgnored: boolean
}

type ListType = 'favorite' | 'trash'

type ProcessedThreadItem = {
  threadIdentifier: number
  threadLink: string
  title: string
  creator: string
  cover: string
  rating: number
  version: string
  tags: number[]
  ts?: number
  addedAtUnixSeconds: number
  listType: ListType | null
}

type SessionState = {
  currentPageNumber: number
  nextPageToFetchNumber: number
  remainingThreadIdentifiers: number[]
  threadItemsByIdentifier: Record<string, F95ThreadItem>

  favoritesLinks: string[]
  trashLinks: string[]
  playedByLink: Record<string, boolean>
  playedLinks: string[]

  processedThreadItemsByLink: Record<string, ProcessedThreadItem>

  viewedCount: number
  filterState: FilterState
}

type UndoSnapshot = {
  sessionStateBefore: SessionState
}

type MetadataSyncState = {
  isRunning: boolean
  currentPage: number
  pageLimit: number
  error: string | null
}

export type {
  F95ThreadItem,
  F95ApiResponse,
  FilterState,
  ListType,
  ProcessedThreadItem,
  SessionState,
  UndoSnapshot,
  MetadataSyncState,
}
