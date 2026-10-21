import { checkIsNonEmptyStringArray } from "@entities/shared/functions/checks/checkIsNonEmptyStringArray"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { EItemType } from "./EItemType"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { MediaSrcSchema } from "@entities/shared/schemas/mediaSrc.schema"

@Schema({ collection: "Item" })
class Item extends MongoEntity {
  @Prop({ type: String, enum: Object.values(EItemType), required: true })
  type: EItemType

  @Prop({
    type: LanguageTextSchema,
    required: true,
    validate: checkIsLanguageTextFilled,
  })
  title: LanguageText

  @Prop({
    type: [String],
    required: true,
    default: [],
    validate: checkIsNonEmptyStringArray,
  })
  aliases: string[]

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({ type: [MediaSrcSchema], required: true, default: [] })
  media: MediaSrc[]

  @Prop({ type: Date, default: null })
  deletedAt: Date | null
}

type TCreateItem = TCreateEntity<
  Item,
  "aliases" | "description" | "media" | "deletedAt"
>

const ItemSchema = SchemaFactory.createForClass(Item)

export { Item, ItemSchema }
export type { TCreateItem }
