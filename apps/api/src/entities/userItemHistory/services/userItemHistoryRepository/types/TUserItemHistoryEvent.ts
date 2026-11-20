import type { Types } from "mongoose"

import type { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

import type { EUserItemHistoryEvent } from "../../../schemas/EUserItemHistoryEvent"

type TUserItemHistoryEvent = {
  user: Types.ObjectId
  item: Types.ObjectId
} & (
  | {
      type: EUserItemHistoryEvent.ADDED | EUserItemHistoryEvent.STATUS_CHANGED
      status: EUserItemStatus
    }
  | { type: EUserItemHistoryEvent.RATING_CHANGED; rating: number | null }
  | { type: EUserItemHistoryEvent.FAVORITE_CHANGED; isFavorite: boolean }
)

export type { TUserItemHistoryEvent }
