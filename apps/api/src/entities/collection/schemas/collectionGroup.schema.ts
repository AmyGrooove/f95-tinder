import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema, Types } from "mongoose"

import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionGroup {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId

  @Prop({
    type: LanguageTextSchema,
    required: true,
    validate: checkIsLanguageTextFilled,
  })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText
}

type TCreateCollectionGroup = TCreateEntity<
  CollectionGroup,
  "id" | "description"
>

const CollectionGroupSchema = SchemaFactory.createForClass(CollectionGroup)

export { CollectionGroup, CollectionGroupSchema }
export type { TCreateCollectionGroup }
