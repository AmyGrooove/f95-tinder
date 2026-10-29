import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { ECountry } from "@entities/shared/schemas/ECountry"

@Schema({ collection: "ItemBan" })
class ItemBan extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({ type: [String], enum: ECountry, required: true, default: [] })
  countries: ECountry[]

  @Prop({ type: String, default: null })
  reason: string | null
}

type TCreateItemBan = TCreateEntity<ItemBan, "reason" | "countries">

const ItemBanSchema = SchemaFactory.createForClass(ItemBan)

ItemBanSchema.index({ item: 1 }, { name: "itemBanUnique", unique: true })

export { ItemBan, ItemBanSchema }
export type { TCreateItemBan }
