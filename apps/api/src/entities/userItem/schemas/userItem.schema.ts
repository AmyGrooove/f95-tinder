import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { checkIsNullableRating } from "@entities/shared/functions/checks/checkIsNullableRating"
import { checkIsArrayWithoutNil } from "@entities/shared/functions/checks/checkIsArrayWithoutNil"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateItemAttempt } from "./itemAttempt.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { EUserItemStatus } from "./EUserItemStatus"
import type { ItemAttempt } from "./itemAttempt.schema"
import { ItemAttemptSchema } from "./itemAttempt.schema"

@Schema({ collection: "UserItem" })
class UserItem extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({ type: String, enum: Object.values(EUserItemStatus), default: null })
  status: EUserItemStatus | null

  @Prop({
    type: Number,
    default: null,
    validate: checkIsNullableRating,
  })
  rating: number | null

  @Prop({ required: true, type: Boolean, default: false })
  isFavorite: boolean

  @Prop({
    required: true,
    type: [ItemAttemptSchema],
    default: [],
    validate: checkIsArrayWithoutNil,
  })
  attempts: ItemAttempt[]

  @Prop({
    type: String,
    default: null,
    trim: true,
    set: normalizeEmptyStringToNull,
  })
  note: string | null
}

type TCreateUserItem = TCreateEntity<
  UserItem,
  "status" | "rating" | "isFavorite" | "note",
  {
    attempts?: TCreateItemAttempt[]
  }
>

const UserItemSchema = SchemaFactory.createForClass(UserItem)

UserItemSchema.index(
  { user: 1, item: 1 },
  { name: "userItemUnique", unique: true },
)
UserItemSchema.index({ item: 1, user: 1 }, { name: "itemUsersLookup" })

UserItemSchema.path("attempts").validate(
  (value: ItemAttempt[]) =>
    value.filter(
      (entry) =>
        entry.status === EUserItemStatus.IN_PROGRESS ||
        entry.status === EUserItemStatus.ON_HOLD,
    ).length <= 1,
)

export { UserItem, UserItemSchema }
export type { TCreateUserItem }
