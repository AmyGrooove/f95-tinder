import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { EMediaType } from "./EMediaType"

@Schema({ _id: false, id: false, timestamps: false })
class MediaSrc {
  @Prop({ type: String, required: true })
  src: string

  @Prop({ type: String, default: null })
  language: string | null

  @Prop({ type: String, enum: Object.values(EMediaType), required: true })
  type: EMediaType
}

const MediaSrcSchema = SchemaFactory.createForClass(MediaSrc)

export { MediaSrc, MediaSrcSchema }
