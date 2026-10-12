import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "SourceItem",
})
class SourceItem extends MongoEntity {
  @Prop({ type: ItemIdSchema, default: null })
  item: ItemId | null

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Source" })
  source: Types.ObjectId

  @Prop({ type: String, required: true })
  externalId: string

  @Prop({ type: String, default: null })
  externalUrl: string | null
}

type TCreateSourceItem = TCreateEntity<SourceItem, "externalUrl" | "item">

const SourceItemSchema = SchemaFactory.createForClass(SourceItem)

SourceItemSchema.index(
  { source: 1, externalId: 1 },
  { name: "sourceItemSourceExternalId", unique: true },
)
SourceItemSchema.index(
  { "item.type": 1, "item.id": 1, source: 1 },
  { name: "sourceItemItemSource" },
)

export { SourceItem, SourceItemSchema }
export type { TCreateSourceItem }
