import type { Types } from "mongoose"

type TCreateGamePayload = {
  f95ThreadId: number
  threadUrl: string
  title: string
  creatorId: Types.ObjectId
  version: string
  coverUrl: string | null
  screenshotUrls: string[]
  f95UpdatedAt: Date | null
  tagIds: Types.ObjectId[]
  prefixIds: Types.ObjectId[]
}

export type { TCreateGamePayload }
