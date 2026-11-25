import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema, Types } from "mongoose"

import { checkIsNullableRating } from "@entities/shared/functions/checks/checkIsNullableRating"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"

import { EUserActivityType } from "./EUserActivityType"

type TUserActivityEvent =
  | {
      type:
        | EUserActivityType.LIBRARY_ITEM_ADDED
        | EUserActivityType.LIBRARY_STATUS_CHANGED
      payload: { item: Types.ObjectId; status: EUserItemStatus }
    }
  | {
      type: EUserActivityType.LIBRARY_RATING_CHANGED
      payload: { item: Types.ObjectId; rating: number | null }
    }
  | {
      type: EUserActivityType.LIBRARY_FAVORITE_CHANGED
      payload: { item: Types.ObjectId; isFavorite: boolean }
    }

@Schema({ collection: "UserActivity" })
class UserActivity extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: String, required: true, enum: EUserActivityType })
  type: EUserActivityType

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: TUserActivityEvent["payload"]
}

type TCreateUserActivity = Pick<
  UserActivity,
  "_id" | "user" | "createdAt" | "updatedAt"
> &
  TUserActivityEvent

const UserActivitySchema = SchemaFactory.createForClass(UserActivity)

UserActivitySchema.path("payload").validate(function (
  this: UserActivity,
  value: TUserActivityEvent["payload"],
) {
  const isLibraryPayload =
    value?.item instanceof Types.ObjectId && Object.keys(value).length === 2

  switch (this.type) {
    case EUserActivityType.LIBRARY_ITEM_ADDED:
      return (
        isLibraryPayload &&
        "status" in value &&
        USER_ITEM_LIBRARY_STATUSES.some((status) => status === value.status)
      )
    case EUserActivityType.LIBRARY_STATUS_CHANGED:
      return (
        isLibraryPayload &&
        "status" in value &&
        Object.values(EUserItemStatus).includes(value.status)
      )
    case EUserActivityType.LIBRARY_RATING_CHANGED:
      return (
        isLibraryPayload &&
        "rating" in value &&
        value.rating !== undefined &&
        checkIsNullableRating(value.rating)
      )
    case EUserActivityType.LIBRARY_FAVORITE_CHANGED:
      return (
        isLibraryPayload &&
        "isFavorite" in value &&
        typeof value.isFavorite === "boolean"
      )
    default:
      return false
  }
})

UserActivitySchema.index(
  { user: 1, createdAt: -1, _id: -1 },
  { name: "userActivityOrder" },
)

export { UserActivity, UserActivitySchema }
export type { TCreateUserActivity, TUserActivityEvent }
