import type { TPageSize } from "@infrastructure/database/types/TPageSize"

interface ISearchGroupProps {
  index: string
  search: string
  filter: string[]
  page: number
  limit: TPageSize
  isAscendingRelevance: boolean

  sort?: string[]
}

export type { ISearchGroupProps }
