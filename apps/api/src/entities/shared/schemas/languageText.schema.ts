import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema({ _id: false, id: false, timestamps: false })
class LanguageText {
  @Prop({ type: String, default: null })
  ru: string | null

  @Prop({ type: String, default: null })
  en: string | null
}

const LanguageTextSchema = SchemaFactory.createForClass(LanguageText)

export { LanguageText, LanguageTextSchema }
