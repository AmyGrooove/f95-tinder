import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "UserRecommendationState" })
class UserRecommendationState extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  shownCount: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  skippedCount: number

  @Prop({ type: Date, default: null })
  firstShownAt: Date | null

  @Prop({ type: Date, default: null })
  lastShownAt: Date | null

  @Prop({ type: Date, default: null })
  nextEligibleAt: Date | null

  @Prop({ required: true, type: Boolean, default: false })
  isExcluded: boolean

  @Prop({ type: Date, default: null })
  expiresAt: Date | null
}

type TCreateUserRecommendationState = TCreateEntity<
  UserRecommendationState,
  | "shownCount"
  | "skippedCount"
  | "nextEligibleAt"
  | "isExcluded"
  | "expiresAt"
  | "firstShownAt"
  | "lastShownAt"
>

const UserRecommendationStateSchema = SchemaFactory.createForClass(
  UserRecommendationState,
)

UserRecommendationStateSchema.index(
  { user: 1, item: 1 },
  { name: "userRecommendationStateUnique", unique: true },
)

export { UserRecommendationState, UserRecommendationStateSchema }
export type { TCreateUserRecommendationState }
