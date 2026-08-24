interface IGetGameResponse {
  coverUrl: string | null
  createdAt: string
  creatorId: string
  f95ThreadId: number
  f95UpdatedAt: string | null
  id: string
  prefixIds: string[]
  screenshotUrls: string[]
  tagIds: string[]
  threadUrl: string
  title: string
  updatedAt: string
  version: string
}

export type { IGetGameResponse }
