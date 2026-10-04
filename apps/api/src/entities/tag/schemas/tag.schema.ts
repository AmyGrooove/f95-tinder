import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { Embedding } from "@entities/shared/schemas/embedding.schema"
import { EmbeddingSchema } from "@entities/shared/schemas/embedding.schema"

@Schema({
  collection: "tags",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class Tag extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, required: true })
  group: string

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null

  @Prop({
    required: true,
    type: [LanguageTextSchema],
    default: [],
    validate: (value: unknown) =>
      isArray(value) && value.every((entry) => !isNil(entry)),
  })
  aliases: LanguageText[]

  @Prop({ type: EmbeddingSchema, default: null })
  embedding: Embedding | null
}

type TCreateTag = TCreateEntity<Tag, "description" | "aliases" | "embedding">

const TagSchema = SchemaFactory.createForClass(Tag)

TagSchema.index({ key: 1 }, { name: "tag_key", unique: true })

export { Tag, TagSchema }
export type { TCreateTag }
