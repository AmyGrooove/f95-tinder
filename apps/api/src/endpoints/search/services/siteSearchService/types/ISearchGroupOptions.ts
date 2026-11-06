interface ISearchGroupOptions {
  filter: string[]
  isAscendingRelevance: boolean

  isImpossible?: boolean
  sort?: string[]
}

export type { ISearchGroupOptions }
