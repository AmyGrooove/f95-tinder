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
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { ECollectionVisibility } from "./ECollectionVisibility"
import { ECollectionOwnership } from "./ECollectionOwnership"
import { ECollectionType } from "./ECollectionType"
import type {
  CollectionBlock,
  TCreateCollectionBlock,
} from "./collectionBlock.schema"
import { CollectionBlockSchema } from "./collectionBlock.schema"
import type {
  CollectionRules,
  TCreateCollectionRules,
} from "./collectionRules.schema"
import { CollectionRulesSchema } from "./collectionRules.schema"

@Schema({ collection: "Collection" })
class Collection extends MongoEntity {
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

  @Prop({
    type: String,
    enum: Object.values(ECollectionVisibility),
    required: true,
    default: ECollectionVisibility.PRIVATE,
  })
  visibility: ECollectionVisibility

  @Prop({
    type: String,
    enum: Object.values(ECollectionOwnership),
    required: true,
  })
  ownership: ECollectionOwnership

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  author: Types.ObjectId | null

  @Prop({
    type: String,
    enum: Object.values(ECollectionType),
    required: true,
    default: ECollectionType.CUSTOM,
  })
  type: ECollectionType

  @Prop({ type: CollectionRulesSchema, default: null })
  rules: CollectionRules | null

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
  "media" | "description" | "visibility" | "author" | "type" | "deletedAt",
  {
    blocks?: TCreateCollectionBlock[]
    rules?: TCreateCollectionRules | null
  }
>

const CollectionSchema = SchemaFactory.createForClass(Collection)

CollectionSchema.pre("validate", function () {
  if (
    (this.ownership === ECollectionOwnership.USER && isNil(this.author)) ||
    (this.ownership === ECollectionOwnership.SITE && !isNil(this.author))
  ) {
    this.invalidate("author", DICTIONARY.collection.invalidAuthor)
  }

  if (this.type === ECollectionType.AUTO) {
    if (this.ownership !== ECollectionOwnership.SITE) {
      this.invalidate("type", DICTIONARY.collection.automaticSiteOnly)
    }

    if (isNil(this.rules)) {
      this.invalidate("rules", DICTIONARY.collection.rulesRequired)
    }

    if (!isNil(this.blocks) && this.blocks.length > 0) {
      this.invalidate("blocks", DICTIONARY.collection.automaticBlocks)
    }
  } else if (!isNil(this.rules)) {
    this.invalidate("rules", DICTIONARY.collection.manualRules)
  }
})

export { Collection, CollectionSchema }
export type { TCreateCollection }
