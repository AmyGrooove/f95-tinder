interface ISearchResult<TDocument> {
  estimatedTotalHits: number
  hits: TDocument[]
  limit: number
  offset: number
  processingTimeMs: number
  query: string
}

export type { ISearchResult }
