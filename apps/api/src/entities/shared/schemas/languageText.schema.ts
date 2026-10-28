import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema({ _id: false, id: false, timestamps: false })
class LanguageText {
  @Prop({ type: String, default: null })
  [ELanguage.RUSSIAN]: string | null;

  @Prop({ type: String, default: null })
  [ELanguage.ENGLISH]: string | null
}

const LanguageTextSchema = SchemaFactory.createForClass(LanguageText)

export { LanguageText, LanguageTextSchema }
