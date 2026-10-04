import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isNumber } from "@shared/functions/checks/isNumber"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "itemTags",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class ItemTag extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  tag: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    validate: (value: unknown) => isNumber(value) && Number.isFinite(value),
  })
  relevanceScore: number
}

type TCreateItemTag = TCreateEntity<ItemTag>

const ItemTagSchema = SchemaFactory.createForClass(ItemTag)

ItemTagSchema.index(
  { "item.type": 1, "item.id": 1, tag: 1 },
  { name: "item_tag", unique: true },
)
ItemTagSchema.index(
  { tag: 1, "item.type": 1, "item.id": 1 },
  { name: "tag_item" },
)

export { ItemTag, ItemTagSchema }
export type { TCreateItemTag }
