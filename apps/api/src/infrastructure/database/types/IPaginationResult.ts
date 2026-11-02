interface IPagePaginationResult<T> {
  items: T[]
  page: number
  total: number
  pages: number
  isNextPage: boolean
  isPreviousPage: boolean
}

interface ICursorPaginationResult<TItem> {
  items: TItem[]
  count: number
  nextCursor: string | null
}

export type { IPagePaginationResult, ICursorPaginationResult }
