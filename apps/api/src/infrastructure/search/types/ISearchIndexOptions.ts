import type { Settings } from "meilisearch"

interface ISearchIndexOptions {
  typoTolerance?: Settings["typoTolerance"]
  displayedAttributes?: string[]
  filterableAttributes?: string[]
  rankingRules?: string[]
  searchableAttributes?: string[]
  sortableAttributes?: string[]
  pagination?: { maxTotalHits: number }
}

export type { ISearchIndexOptions }
