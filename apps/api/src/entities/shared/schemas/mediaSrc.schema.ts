import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { checkIsArrayWithoutNil } from "../functions/checks/checkIsArrayWithoutNil"
import { EMediaSource } from "./EMediaSource"
import { CATALOG_MEDIA_TYPES, EMediaType } from "./EMediaType"

@Schema({ _id: false, id: false, timestamps: false })
class MediaSrc {
  @Prop({
    type: String,
    required: true,
    validate: (value: string) => value.trim().length > 0,
  })
  src: string

  @Prop({
    type: String,
    enum: EMediaSource,
    default: EMediaSource.URL,
  })
  source: EMediaSource | null

  @Prop({ type: String, default: null })
  language: string | null

  @Prop({ type: String, enum: Object.values(EMediaType), required: true })
  type: EMediaType
}

const MediaSrcSchema = SchemaFactory.createForClass(MediaSrc)

const checkIsCatalogMedia = (value: MediaSrc[]) => {
  return (
    checkIsArrayWithoutNil(value) &&
    value.every(({ type }) => CATALOG_MEDIA_TYPES.includes(type))
  )
}

export { checkIsCatalogMedia, MediaSrc, MediaSrcSchema }
