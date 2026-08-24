interface ISearchQueryOptions {
  attributesToCrop?: string[]
  attributesToRetrieve?: string[]
  cropLength?: number
  filter?: string | string[]
  limit?: number
  offset?: number
  sort?: string[]
}

export type { ISearchQueryOptions }
