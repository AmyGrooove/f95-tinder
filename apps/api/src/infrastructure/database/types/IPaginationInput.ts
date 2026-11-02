import type { TPageSize } from "./TPageSize"

interface IPagination {
  limit?: TPageSize
}

interface IPagePagination extends IPagination {
  page?: number
}

interface ICursorPagination extends IPagination {
  cursor?: string
}

export type { IPagination, IPagePagination, ICursorPagination }
