type TListResponse<TItem> = {
  items: TItem[]
  count: number
  nextCursor: string | null
}

export type { TListResponse }
