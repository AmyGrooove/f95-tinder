import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateItemAttempt } from "./itemAttempt.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isInt } from "@shared/functions/checks/isInt"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import { EUserItemStatus } from "./EUserItemStatus"
import type { ItemAttempt } from "./itemAttempt.schema"
import { ItemAttemptSchema } from "./itemAttempt.schema"

@Schema({
  collection: "UserItem",
})
class UserItem extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({ type: String, enum: Object.values(EUserItemStatus), default: null })
  status: EUserItemStatus | null

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isInt(value) && value >= 1 && value <= 10),
  })
  rating: number | null

  @Prop({ required: true, type: Boolean, default: false })
  isFavorite: boolean

  @Prop({
    required: true,
    type: [ItemAttemptSchema],
    default: [],
    validate: (value: unknown) =>
      isArray(value) && value.every((entry) => !isNil(entry)),
  })
  attempts: ItemAttempt[]

  @Prop({ type: String, default: null })
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
  { user: 1, "item.type": 1, "item.id": 1 },
  { name: "userItemUserItem", unique: true },
)
UserItemSchema.index(
  { "item.type": 1, "item.id": 1, user: 1 },
  { name: "userItemItemUser" },
)

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
