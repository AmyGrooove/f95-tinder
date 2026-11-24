import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

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

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  author: Types.ObjectId | null
}

type TCreateFact = TCreateEntity<Fact, "author">

const FactSchema = SchemaFactory.createForClass(Fact)

export { Fact, FactSchema }
export type { TCreateFact }
