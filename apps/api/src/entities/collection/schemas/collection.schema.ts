import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { MediaSrcSchema } from "@entities/shared/schemas/mediaSrc.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { ECollectionType } from "./ECollectionType"
import type {
  CollectionBlock,
  TCreateCollectionBlock,
} from "./collectionBlock.schema"
import { CollectionBlockSchema } from "./collectionBlock.schema"

@Schema({ collection: "Collection" })
class Collection extends MongoEntity {
  @Prop({
    type: Number,
    required: true,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  version: number

  @Prop({
    type: LanguageTextSchema,
    required: true,
    validate: checkIsLanguageTextFilled,
  })
  title: LanguageText

  @Prop({ type: [MediaSrcSchema], required: true, default: [] })
  media: MediaSrc[]

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  author: Types.ObjectId | null

  @Prop({
    type: String,
    enum: Object.values(ECollectionType),
    required: true,
    default: ECollectionType.CUSTOM,
  })
  type: ECollectionType

  @Prop({
    type: [CollectionBlockSchema],
    required: true,
    default: [],
    validate: (value: CollectionBlock[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value.map((entry) => String(entry.id))).size === value.length,
  })
  blocks: CollectionBlock[]

  @Prop({ type: Date, default: null })
  deletedAt: Date | null
}

type TCreateCollection = TCreateEntity<
  Collection,
  "media" | "description" | "author" | "type" | "deletedAt" | "version",
  {
    blocks?: TCreateCollectionBlock[]
  }
>

const CollectionSchema = SchemaFactory.createForClass(Collection)

export { Collection, CollectionSchema }
export type { TCreateCollection }
