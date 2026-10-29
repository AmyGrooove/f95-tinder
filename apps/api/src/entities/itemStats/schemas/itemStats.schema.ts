import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateUserItemStatusCounts } from "./userItemStatusCounts.schema"
import type { TCreateRatingDistribution } from "./ratingDistribution.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import type { RatingDistribution } from "./ratingDistribution.schema"
import { RatingDistributionSchema } from "./ratingDistribution.schema"
import type { UserItemStatusCounts } from "./userItemStatusCounts.schema"
import { UserItemStatusCountsSchema } from "./userItemStatusCounts.schema"
import { isNil } from "@shared/functions/checks/isNil"

@Schema({ collection: "ItemStats" })
class ItemStats extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    min: 0,
    validate: checkIsNonNegativeSafeInteger,
    default: 0,
  })
  completedAttemptsCount: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  ratingsCount: number

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isFiniteNumber(value) && value >= 1 && value <= 10),
  })
  ratingAverage: number | null

  @Prop({ required: true, type: RatingDistributionSchema, default: () => ({}) })
  ratingDistribution: RatingDistribution

  @Prop({
    required: true,
    type: UserItemStatusCountsSchema,
    default: () => ({}),
  })
  statusCounts: UserItemStatusCounts

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  favoritesCount: number
}

type TCreateItemStats = TCreateEntity<
  ItemStats,
  | "ratingsCount"
  | "ratingAverage"
  | "favoritesCount"
  | "completedAttemptsCount",
  {
    ratingDistribution?: TCreateRatingDistribution
    statusCounts?: TCreateUserItemStatusCounts
  }
>

const ItemStatsSchema = SchemaFactory.createForClass(ItemStats)

ItemStatsSchema.index({ item: 1 }, { name: "itemStatsUnique", unique: true })

export { ItemStats, ItemStatsSchema }
export type { TCreateItemStats }
