import type { TF95LatestThreadItem } from "./TF95LatestThreadItem"

type TF95LatestClientResult =
  | {
      status: "ok"
      threadItems: TF95LatestThreadItem[]
      page: number
      totalPages: number
    }
  | {
      status: "rateLimited"
      retryAfterMs: number
    }

export type { TF95LatestClientResult }
