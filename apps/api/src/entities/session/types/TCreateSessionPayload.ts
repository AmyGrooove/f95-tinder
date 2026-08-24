import { Types } from "mongoose"

type TCreateSessionPayload = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  refreshTokenHash: string
  expiresAt: Date
}

export type { TCreateSessionPayload }
