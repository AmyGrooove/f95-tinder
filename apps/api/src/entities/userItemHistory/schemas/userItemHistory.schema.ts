import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { checkIsNullableRating } from "@entities/shared/functions/checks/checkIsNullableRating"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"

import { EUserItemHistoryEvent } from "./EUserItemHistoryEvent"

@Schema({ collection: "UserItemHistory" })
class UserItemHistory extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({
    type: String,
    enum: Object.values(EUserItemHistoryEvent),
    required: true,
  })
  type: EUserItemHistoryEvent

  @Prop({ type: String, enum: Object.values(EUserItemStatus) })
  status?: EUserItemStatus

  @Prop({ type: Number, validate: checkIsNullableRating })
  rating?: number | null

  @Prop({ type: Boolean })
  isFavorite?: boolean
}

type TCreateUserItemHistory = TCreateEntity<UserItemHistory> &
  (
    | {
        type: EUserItemHistoryEvent.ADDED | EUserItemHistoryEvent.STATUS_CHANGED
        status: EUserItemStatus
      }
    | { type: EUserItemHistoryEvent.RATING_CHANGED; rating: number | null }
    | { type: EUserItemHistoryEvent.FAVORITE_CHANGED; isFavorite: boolean }
  )

const UserItemHistorySchema = SchemaFactory.createForClass(UserItemHistory)

UserItemHistorySchema.index(
  { user: 1, createdAt: -1, _id: -1 },
  { name: "userItemHistoryOrder" },
)

export { UserItemHistory, UserItemHistorySchema }
export type { TCreateUserItemHistory }
