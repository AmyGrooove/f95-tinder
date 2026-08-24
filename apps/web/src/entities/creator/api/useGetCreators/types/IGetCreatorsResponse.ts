interface IGetCreatorsResponse {
  count: number
  items: Array<{ id: string; name: string; slug: string }>
  nextCursor: string | null
}

export type { IGetCreatorsResponse }
