import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { ItemId } from "@entities/shared/schemas/itemId.schema"
import { ItemIdSchema } from "@entities/shared/schemas/itemId.schema"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class RelationSide {
  @Prop({ type: ItemIdSchema, required: true })
  item: ItemId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "ItemRelationRole",
  })
  role: Types.ObjectId

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  roleNameOverride: LanguageText
}

type TCreateRelationSide = TCreateEntity<RelationSide, "roleNameOverride">

const RelationSideSchema = SchemaFactory.createForClass(RelationSide)

export { RelationSide, RelationSideSchema }
export type { TCreateRelationSide }
