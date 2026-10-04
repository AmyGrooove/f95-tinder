import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "sourceItems",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class SourceItem extends MongoEntity {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Source" })
  source: Types.ObjectId

  @Prop({ type: String, required: true })
  externalId: string

  @Prop({ type: String, default: null })
  externalUrl: string | null
}

type TCreateSourceItem = TCreateEntity<SourceItem, "externalUrl">

const SourceItemSchema = SchemaFactory.createForClass(SourceItem)

SourceItemSchema.index(
  { source: 1, externalId: 1 },
  { name: "source_external_item", unique: true },
)
SourceItemSchema.index(
  { "item.type": 1, "item.id": 1, source: 1 },
  { name: "item_source", unique: true },
)

export { SourceItem, SourceItemSchema }
export type { TCreateSourceItem }
