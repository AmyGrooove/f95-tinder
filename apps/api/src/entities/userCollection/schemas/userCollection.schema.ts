import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"

@Schema({ collection: "UserCollection" })
class UserCollection extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "Collection",
  })
  collection: Types.ObjectId

  @Prop({ type: Boolean, required: true, default: false })
  isFavorite: boolean

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isInt(value) && value >= 1 && value <= 10),
  })
  rating: number | null

  @Prop({ type: Boolean, required: true, default: false })
  isHidden: boolean
}

type TCreateUserCollection = TCreateEntity<
  UserCollection,
  "isFavorite" | "rating" | "isHidden"
>

const UserCollectionSchema = SchemaFactory.createForClass(UserCollection)

UserCollectionSchema.index(
  { user: 1, collection: 1 },
  { name: "userCollectionUnique", unique: true },
)
UserCollectionSchema.index(
  { collection: 1, user: 1 },
  { name: "collectionUsersLookup" },
)

export { UserCollection, UserCollectionSchema }
export type { TCreateUserCollection }
