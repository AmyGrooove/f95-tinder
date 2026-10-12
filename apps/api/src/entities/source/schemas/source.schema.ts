import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { CAMEL_CASE_REGEX } from "@shared/static/CAMEL_CASE_REGEX"

@Schema({ collection: "Source" })
class Source extends MongoEntity {
  @Prop({ type: String, required: true, match: CAMEL_CASE_REGEX })
  key: string

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({ type: String, default: null })
  logoUrl: string | null

  @Prop({ type: String, default: null })
  baseUrl: string | null

  @Prop({ type: String, default: null })
  apiUrl: string | null
}

type TCreateSource = TCreateEntity<
  Source,
  "description" | "logoUrl" | "baseUrl" | "apiUrl"
>

const SourceSchema = SchemaFactory.createForClass(Source)

SourceSchema.index({ key: 1 }, { name: "sourceKeyUnique", unique: true })

export { Source, SourceSchema }
export type { TCreateSource }
