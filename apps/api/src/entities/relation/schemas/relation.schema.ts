import { REGEX } from "@shared/static/REGEX"
import { ERelationGroup } from "./ERelationGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"

import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

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

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 1,
    validate: isFiniteNumber,
  })
  bonusMultiplier: number
}

type TCreateRelation = TCreateEntity<
  Relation,
  "description" | "group" | "bonusMultiplier"
>

const RelationSchema = SchemaFactory.createForClass(Relation)

RelationSchema.index({ key: 1 }, { name: "relationKeyUnique", unique: true })

export { Relation, RelationSchema }
export type { TCreateRelation }
