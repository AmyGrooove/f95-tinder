import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema, Types } from "mongoose"

import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { ECollectionBlockType } from "./ECollectionBlockType"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionBlock {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId

  @Prop({
    type: String,
    enum: Object.values(ECollectionBlockType),
    required: true,
  })
  type: ECollectionBlockType

  @Prop({
    type: LanguageTextSchema,
    default: null,
    validate: (value: LanguageText | null) =>
      isNil(value) || checkIsLanguageTextFilled(value),
  })
  title: LanguageText | null

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null

  @Prop({ type: LanguageTextSchema, default: null })
  content: LanguageText | null
}

type TCreateCollectionBlock = { id?: Types.ObjectId } & (
  | {
      type: ECollectionBlockType.GROUP
      title?: LanguageText | null
      description?: LanguageText | null
      content?: never
    }
  | {
      type: ECollectionBlockType.TEXT
      content: LanguageText
      title?: never
      description?: never
    }
)

const CollectionBlockSchema = SchemaFactory.createForClass(CollectionBlock)

CollectionBlockSchema.pre("validate", function () {
  if (this.type === ECollectionBlockType.GROUP && !isNil(this.content)) {
    this.invalidate("content", DICTIONARY.collection.groupContent)
  }

  if (this.type === ECollectionBlockType.TEXT) {
    if (!checkIsLanguageTextFilled(this.content)) {
      this.invalidate("content", DICTIONARY.collection.textContentRequired)
    }

    if (!isNil(this.title) || !isNil(this.description)) {
      this.invalidate("type", DICTIONARY.collection.textGroupFields)
    }
  }
})

export { CollectionBlock, CollectionBlockSchema }
export type { TCreateCollectionBlock }
