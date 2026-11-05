import type { SearchParams } from "meilisearch"

interface ISearchQueryOptions extends Pick<SearchParams, "showRankingScore"> {
  attributesToCrop?: string[]
  attributesToRetrieve?: string[]
  cropLength?: number
  filter?: string | string[]
  limit?: number
  offset?: number
  sort?: string[]
  matchingStrategy?: "all" | "last"
}

export type { ISearchQueryOptions }
