import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "ItemTag" })
class ItemTag extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  tag: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    validate: (value: unknown) =>
      isFiniteNumber(value) && value > 0 && value <= 1,
  })
  relevanceScore: number
}

type TCreateItemTag = TCreateEntity<ItemTag>

const ItemTagSchema = SchemaFactory.createForClass(ItemTag)

ItemTagSchema.index(
  { item: 1, tag: 1 },
  { name: "itemTagUnique", unique: true },
)
ItemTagSchema.index({ tag: 1, item: 1 }, { name: "tagItemLookup" })

export { ItemTag, ItemTagSchema }
export type { TCreateItemTag }
