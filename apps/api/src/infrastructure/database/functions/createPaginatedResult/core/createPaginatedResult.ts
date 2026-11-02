import type { IPagePaginationResult } from "../../../types/IPaginationResult"
import type { TPageSize } from "../../../types/TPageSize"

const createPaginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  limit: TPageSize,
): IPagePaginationResult<T> => {
  const pages = Math.ceil(total / limit)

  return {
    items,
    page,
    total,
    pages,
    isNextPage: page < pages,
    isPreviousPage: page > 1,
  }
}

export { createPaginatedResult }
