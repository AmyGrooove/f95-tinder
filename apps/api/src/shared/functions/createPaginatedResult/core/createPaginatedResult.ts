import type { IPaginatedResult } from "@shared/types/IPaginatedResult"

const createPaginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): IPaginatedResult<T> => {
  const pages = Math.ceil(total / limit)

  return {
    items,
    page,
    limit,
    total,
    pages,
    isNextPage: page < pages,
    isPreviousPage: page > 1,
  }
}

export { createPaginatedResult }
