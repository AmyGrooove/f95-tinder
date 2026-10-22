interface IPaginatedResult<T> {
  items: T[]
  page: number
  limit: number
  total: number
  pages: number
  isNextPage: boolean
  isPreviousPage: boolean
}

export type { IPaginatedResult }
