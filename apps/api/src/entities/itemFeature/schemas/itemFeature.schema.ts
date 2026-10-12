import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isBoolean } from "@shared/functions/checks/isBoolean"
import { isDate } from "@shared/functions/checks/isDate"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isString } from "@shared/functions/checks/isString"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import type { Types } from "mongoose"
import { Schema as MongooseSchema } from "mongoose"

@Schema({ collection: "ItemFeature" })
class ItemFeature extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Feature" })
  feature: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    validate: (value: unknown) =>
      isFiniteNumber(value) ||
      isString(value) ||
      isBoolean(value) ||
      isDate(value),
  })
  value: number | string | boolean | Date
}

type TCreateItemFeature = TCreateEntity<ItemFeature>

const ItemFeatureSchema = SchemaFactory.createForClass(ItemFeature)

ItemFeatureSchema.index(
  { "item.type": 1, "item.id": 1, feature: 1 },
  { name: "itemFeatureUnique", unique: true },
)
ItemFeatureSchema.index(
  { feature: 1, "item.type": 1, "item.id": 1 },
  { name: "featureItemLookup" },
)

export { ItemFeature, ItemFeatureSchema }
export type { TCreateItemFeature }
