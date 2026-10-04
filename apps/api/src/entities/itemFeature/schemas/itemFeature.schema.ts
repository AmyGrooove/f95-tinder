import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isNumber } from "@shared/functions/checks/isNumber"
import { isString } from "@shared/functions/checks/isString"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import type { Types } from "mongoose"
import { Schema as MongooseSchema } from "mongoose"

@Schema({
  collection: "itemFeatures",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class ItemFeature extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Feature" })
  feature: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    validate: (value: unknown) =>
      (isNumber(value) && Number.isFinite(value)) ||
      isString(value) ||
      typeof value === "boolean" ||
      (value instanceof Date && Number.isFinite(value.getTime())),
  })
  value: number | string | boolean | Date
}

type TCreateItemFeature = TCreateEntity<ItemFeature>

const ItemFeatureSchema = SchemaFactory.createForClass(ItemFeature)

ItemFeatureSchema.index(
  { "item.type": 1, "item.id": 1, feature: 1 },
  { name: "item_feature", unique: true },
)
ItemFeatureSchema.index(
  { feature: 1, "item.type": 1, "item.id": 1 },
  { name: "feature_item" },
)

export { ItemFeature, ItemFeatureSchema }
export type { TCreateItemFeature }
