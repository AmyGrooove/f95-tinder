interface IGetLatestGamesQuery {
  cursor?: string
  excludePrefixIds?: string[]
  excludeTagIds?: string[]
  limit?: number
  prefixIds?: string[]
  search?: string
  tagIds?: string[]
}

export type { IGetLatestGamesQuery }
