import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"

@Schema({
  collection: "userRecommendationStates",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class UserRecommendationState extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  shownCount: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  skippedCount: number

  @Prop({ type: Date, required: true })
  firstShownAt: Date

  @Prop({ type: Date, required: true })
  lastShownAt: Date

  @Prop({ type: Date, default: null })
  nextEligibleAt: Date | null

  @Prop({ required: true, type: Boolean, default: false })
  isExcluded: boolean

  @Prop({ type: Date, default: null })
  expiresAt: Date | null
}

type TCreateUserRecommendationState = TCreateEntity<
  UserRecommendationState,
  "shownCount" | "skippedCount" | "nextEligibleAt" | "isExcluded" | "expiresAt"
>

const UserRecommendationStateSchema = SchemaFactory.createForClass(
  UserRecommendationState,
)

UserRecommendationStateSchema.index(
  { user: 1, "item.type": 1, "item.id": 1 },
  { name: "recommendation_user_item", unique: true },
)

export { UserRecommendationState, UserRecommendationStateSchema }
export type { TCreateUserRecommendationState }
