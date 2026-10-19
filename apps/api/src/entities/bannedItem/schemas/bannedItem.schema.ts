import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "BannedItem" })
class BannedItem extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Source" })
  source: Types.ObjectId

  @Prop({ type: String, required: true })
  externalId: string

  @Prop({ type: String, default: null })
  reason: string | null
}

type TCreateBannedItem = TCreateEntity<BannedItem, "reason">

const BannedItemSchema = SchemaFactory.createForClass(BannedItem)

BannedItemSchema.index(
  { source: 1, externalId: 1 },
  { name: "bannedItemSourceExternalIdUnique", unique: true },
)

export { BannedItem, BannedItemSchema }
export type { TCreateBannedItem }
