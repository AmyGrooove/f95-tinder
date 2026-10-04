import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import type { TCreateUserItemStatusCounts } from "./userItemStatusCounts.schema"
import type { TCreateRatingDistribution } from "./ratingDistribution.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { isNumber } from "@shared/functions/checks/isNumber"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import type { RatingDistribution } from "./ratingDistribution.schema"
import { RatingDistributionSchema } from "./ratingDistribution.schema"
import type { UserItemStatusCounts } from "./userItemStatusCounts.schema"
import { UserItemStatusCountsSchema } from "./userItemStatusCounts.schema"

@Schema({
  collection: "itemMetrics",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class ItemMetric extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  views: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  ratingsCount: number

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      value === null || (isNumber(value) && Number.isFinite(value)),
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
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  favoritesCount: number
}

type TCreateItemMetric = TCreateEntity<
  ItemMetric,
  "views" | "ratingsCount" | "ratingAverage" | "favoritesCount",
  {
    ratingDistribution?: TCreateRatingDistribution
    statusCounts?: TCreateUserItemStatusCounts
  }
>

const ItemMetricSchema = SchemaFactory.createForClass(ItemMetric)

ItemMetricSchema.index(
  { "item.type": 1, "item.id": 1 },
  { name: "metric_item", unique: true },
)

export { ItemMetric, ItemMetricSchema }
export type { TCreateItemMetric }
