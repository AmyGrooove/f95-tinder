import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
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
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

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
