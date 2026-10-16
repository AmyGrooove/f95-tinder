import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { MediaSrcSchema } from "@entities/shared/schemas/mediaSrc.schema"
import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

@Schema({ collection: "Movie" })
class Movie extends MongoEntity {
  @Prop({ type: LanguageTextSchema, required: true })
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
}

type TCreateMovie = TCreateEntity<Movie, "aliases" | "description" | "media">

const MovieSchema = SchemaFactory.createForClass(Movie)

export { Movie, MovieSchema }
export type { TCreateMovie }
