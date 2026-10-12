import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateUserItemStatusCounts } from "./userItemStatusCounts.schema"
import type { TCreateRatingDistribution } from "./ratingDistribution.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import type { RatingDistribution } from "./ratingDistribution.schema"
import { RatingDistributionSchema } from "./ratingDistribution.schema"
import type { UserItemStatusCounts } from "./userItemStatusCounts.schema"
import { UserItemStatusCountsSchema } from "./userItemStatusCounts.schema"
import { isNil } from "@shared/functions/checks/isNil"

@Schema({ collection: "ItemMetric" })
class ItemMetric extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({
    type: Number,
    required: true,
    min: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
    default: 0,
  })
  completedAttemptsCount: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  recommendationsCount: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
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
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  favoritesCount: number
}

type TCreateItemMetric = TCreateEntity<
  ItemMetric,
  | "recommendationsCount"
  | "ratingsCount"
  | "ratingAverage"
  | "favoritesCount"
  | "completedAttemptsCount",
  {
    ratingDistribution?: TCreateRatingDistribution
    statusCounts?: TCreateUserItemStatusCounts
  }
>

const ItemMetricSchema = SchemaFactory.createForClass(ItemMetric)

ItemMetricSchema.index(
  { "item.type": 1, "item.id": 1 },
  { name: "itemMetricUnique", unique: true },
)

export { ItemMetric, ItemMetricSchema }
export type { TCreateItemMetric }
