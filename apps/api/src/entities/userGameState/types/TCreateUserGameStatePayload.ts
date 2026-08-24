import type { Types } from "mongoose"
import type { TUserGameListType } from "./TUserGameListType"

type TCreateUserGameStatePayload = {
  userId: Types.ObjectId
  gameId: Types.ObjectId
  listType: TUserGameListType
}

export type { TCreateUserGameStatePayload }
