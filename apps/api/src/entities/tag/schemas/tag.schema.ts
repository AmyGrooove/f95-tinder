import { checkIsNonEmptyStringArray } from "@entities/shared/functions/checks/checkIsNonEmptyStringArray"
import { ETagGroup } from "./ETagGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { CAMEL_CASE_REGEX } from "@shared/static/CAMEL_CASE_REGEX"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { Embedding } from "@entities/shared/schemas/embedding.schema"
import { EmbeddingSchema } from "@entities/shared/schemas/embedding.schema"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({ collection: "Tag" })
class Tag extends MongoEntity {
  @Prop({ type: String, required: true, match: CAMEL_CASE_REGEX })
  key: string

  @Prop({ type: String, enum: Object.values(ETagGroup), default: null })
  group: ETagGroup | null

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({
    required: true,
    type: [String],
    default: [],
    validate: checkIsNonEmptyStringArray,
  })
  aliases: string[]

  @Prop({ type: EmbeddingSchema, default: null })
  embedding: Embedding | null

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 0,
    validate: isFiniteNumber,
  })
  weightModifier: number
}

type TCreateTag = TCreateEntity<
  Tag,
  "group" | "description" | "aliases" | "embedding" | "weightModifier"
>

const TagSchema = SchemaFactory.createForClass(Tag)

TagSchema.index({ key: 1 }, { name: "tagKeyUnique", unique: true })

export { Tag, TagSchema }
export type { TCreateTag }
