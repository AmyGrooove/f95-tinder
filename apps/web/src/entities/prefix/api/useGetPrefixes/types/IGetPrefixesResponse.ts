interface IGetPrefixesResponse {
  count: number
  items: {
    f95PrefixId: number
    group: string
    id: string
    name: string
    slug: string
  }[]
  nextCursor: string | null
}

export type { IGetPrefixesResponse }
