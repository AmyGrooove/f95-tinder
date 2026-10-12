import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { EItemType } from "./EItemType"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class ItemId {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  id: Types.ObjectId

  @Prop({ type: String, enum: Object.values(EItemType), required: true })
  type: EItemType
}

const ItemIdSchema = SchemaFactory.createForClass(ItemId)

export { ItemId, ItemIdSchema }
