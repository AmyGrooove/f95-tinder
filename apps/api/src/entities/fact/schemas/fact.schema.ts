import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"

@Schema({ collection: "Fact" })
class Fact extends MongoEntity {
  @Prop({
    type: LanguageTextSchema,
    required: true,
    validate: checkIsLanguageTextFilled,
  })
  text: LanguageText

  @Prop({ type: String, trim: true, default: null })
  sourceUrl: string | null
}

type TCreateFact = TCreateEntity<Fact, "sourceUrl">

const FactSchema = SchemaFactory.createForClass(Fact)

export { Fact, FactSchema }
export type { TCreateFact }
