import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { EItemType } from "./EItemType"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { MediaSrcSchema } from "@entities/shared/schemas/mediaSrc.schema"
import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

@Schema({ collection: "Item" })
class Item extends MongoEntity {
  @Prop({ type: String, enum: Object.values(EItemType), required: true })
  type: EItemType

  @Prop({
    type: LanguageTextSchema,
    required: true,
    validate: (value: LanguageText | null | undefined) =>
      [value?.ru, value?.en].some(
        (translation) => isString(translation) && translation.trim().length > 0,
      ),
  })
  title: LanguageText

  @Prop({
    type: [String],
    required: true,
    default: [],
    validate: (value: unknown) =>
      isArray(value) &&
      value.every((entry) => isString(entry) && entry.trim().length > 0),
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
