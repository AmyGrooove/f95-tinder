import { REGEX } from "@shared/static/REGEX"
import { ERelationGroup } from "./ERelationGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"

@Schema({ collection: "Relation" })
class Relation extends MongoEntity {
  @Prop({ type: String, required: true, match: REGEX.CAMEL_CASE })
  key: string

  @Prop({
    type: String,
    enum: Object.values(ERelationGroup),
    default: null,
  })
  group: ERelationGroup | null

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText
}

type TCreateRelation = TCreateEntity<Relation, "description" | "group">

const RelationSchema = SchemaFactory.createForClass(Relation)

RelationSchema.index({ key: 1 }, { name: "relationKeyUnique", unique: true })

export { Relation, RelationSchema }
export type { TCreateRelation }
