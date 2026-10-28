import { checkIsNonEmptyStringArray } from "@entities/shared/functions/checks/checkIsNonEmptyStringArray"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { EItemType } from "./EItemType"
import { EAgeRestriction } from "./EAgeRestriction"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { MediaSrcSchema } from "@entities/shared/schemas/mediaSrc.schema"
import type { ItemMovie } from "./itemMovie.schema"
import { ItemMovieSchema } from "./itemMovie.schema"
import type { ItemSeries } from "./itemSeries.schema"
import { ItemSeriesSchema } from "./itemSeries.schema"
import type { ItemGame } from "./itemGame.schema"
import { ItemGameSchema } from "./itemGame.schema"
import { isNil } from "@shared/functions/checks/isNil"

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
  releaseDate: Date | null

  @Prop({
    type: String,
    enum: Object.values(EAgeRestriction),
    default: null,
  })
  ageRestriction: EAgeRestriction | null

  @Prop({ type: ItemMovieSchema })
  movie?: ItemMovie | null

  @Prop({ type: ItemSeriesSchema })
  series?: ItemSeries | null

  @Prop({ type: ItemGameSchema })
  game?: ItemGame | null

  @Prop({ type: Date, default: null })
  deletedAt: Date | null
}

type TCreateItem = TCreateEntity<
  Item,
  | "aliases"
  | "description"
  | "media"
  | "releaseDate"
  | "ageRestriction"
  | "deletedAt"
>

const ItemSchema = SchemaFactory.createForClass(Item)

ItemSchema.pre("validate", function () {
  if (
    this.ageRestriction === EAgeRestriction.AGE_18_PLUS_PLUS &&
    this.type !== EItemType.GAME
  ) {
    this.invalidate("ageRestriction", "18++ requires a game Item type")
  }

  if (
    !isNil(this.movie) &&
    this.type !== EItemType.MOVIE &&
    this.type !== EItemType.ANIMATED_MOVIE &&
    this.type !== EItemType.ANIME_MOVIE
  ) {
    this.invalidate("movie", "Movie details require a movie Item type")
  }

  if (
    !isNil(this.series) &&
    this.type !== EItemType.SERIES &&
    this.type !== EItemType.ANIMATED_SERIES &&
    this.type !== EItemType.ANIME_SERIES
  ) {
    this.invalidate("series", "Series details require a series Item type")
  }

  if (!isNil(this.game) && this.type !== EItemType.GAME) {
    this.invalidate("game", "Game details require a game Item type")
  }
})

export { Item, ItemSchema }
export type { TCreateItem }
