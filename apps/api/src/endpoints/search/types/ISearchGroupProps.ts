interface ISearchGroupProps {
  index: string
  search: string
  filter: string[]
  page: number
  limit: number
  isAscendingRelevance: boolean

  sort?: string[]
}

export type { ISearchGroupProps }
