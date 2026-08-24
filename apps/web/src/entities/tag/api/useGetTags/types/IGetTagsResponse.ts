interface IGetTagsResponse {
  count: number
  items: { f95TagId: number; id: string; name: string; slug: string }[]
  nextCursor: string | null
}

export type { IGetTagsResponse }
