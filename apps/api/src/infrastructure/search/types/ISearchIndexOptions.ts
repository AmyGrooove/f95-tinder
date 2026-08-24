interface ISearchIndexOptions {
  primaryKey: string

  displayedAttributes?: string[]
  filterableAttributes?: string[]
  rankingRules?: string[]
  searchableAttributes?: string[]
  sortableAttributes?: string[]
}

export type { ISearchIndexOptions }
