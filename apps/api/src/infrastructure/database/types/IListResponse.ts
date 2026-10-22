interface IListResponse<TItem> {
  items: TItem[]
  count: number
  nextCursor: string | null
}

export type { IListResponse }
