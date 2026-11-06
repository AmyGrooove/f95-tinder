interface ISearchGroupProps {
  filter: string[]
  isAscendingRelevance: boolean

  isImpossible?: boolean
  sort?: string[]
}

export type { ISearchGroupProps }
