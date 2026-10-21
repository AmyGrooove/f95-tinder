import { checkIsFeatureValue } from "@entities/shared/functions/checks/checkIsFeatureValue"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { Types } from "mongoose"
import { Schema as MongooseSchema } from "mongoose"

@Schema({ collection: "ItemFeature" })
class ItemFeature extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Feature" })
  feature: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    validate: checkIsFeatureValue,
  })
  value: number | string | boolean | Date
}

type TCreateItemFeature = TCreateEntity<ItemFeature>

const ItemFeatureSchema = SchemaFactory.createForClass(ItemFeature)

ItemFeatureSchema.index(
  { item: 1, feature: 1 },
  { name: "itemFeatureUnique", unique: true },
)
ItemFeatureSchema.index({ feature: 1, item: 1 }, { name: "featureItemLookup" })

export { ItemFeature, ItemFeatureSchema }
export type { TCreateItemFeature }
