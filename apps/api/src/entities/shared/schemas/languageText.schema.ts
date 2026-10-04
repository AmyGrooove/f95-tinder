import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class LanguageText {
  @Prop({ type: String, required: true })
  en: string

  @Prop({ type: String, required: true })
  ru: string
}

const LanguageTextSchema = SchemaFactory.createForClass(LanguageText)

export { LanguageText, LanguageTextSchema }
