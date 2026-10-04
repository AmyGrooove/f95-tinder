import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { ESourceType } from "./ESourceType"

@Schema({
  collection: "sources",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class Source extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null

  @Prop({ type: String, enum: Object.values(ESourceType), required: true })
  type: ESourceType

  @Prop({ type: String, default: null })
  baseUrl: string | null

  @Prop({ type: String, default: null })
  apiUrl: string | null
}

type TCreateSource = TCreateEntity<Source, "description" | "baseUrl" | "apiUrl">

const SourceSchema = SchemaFactory.createForClass(Source)

SourceSchema.index({ key: 1 }, { name: "source_key", unique: true })

export { Source, SourceSchema }
export type { TCreateSource }
