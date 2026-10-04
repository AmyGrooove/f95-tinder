import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import type { TCreateTasteTagPreference } from "./tasteTagPreference.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { EItemType } from "@entities/shared/schemas/EItemType"
import type { Embedding } from "@entities/shared/schemas/embedding.schema"
import { EmbeddingSchema } from "@entities/shared/schemas/embedding.schema"
import type { TasteTagPreference } from "./tasteTagPreference.schema"
import { TasteTagPreferenceSchema } from "./tasteTagPreference.schema"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class TasteItemTypeProfile {
  @Prop({ type: String, enum: Object.values(EItemType), required: true })
  type: EItemType

  @Prop({ type: EmbeddingSchema, default: null })
  positiveEmbedding: Embedding | null

  @Prop({ type: EmbeddingSchema, default: null })
  negativeEmbedding: Embedding | null

  @Prop({
    required: true,
    type: [TasteTagPreferenceSchema],
    default: [],
    validate: (value: unknown) =>
      isArray(value) && value.every((entry) => !isNil(entry)),
  })
  tagPreferences: TasteTagPreference[]

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  interactionsCount: number
}

type TCreateTasteItemTypeProfile = TCreateEntity<
  TasteItemTypeProfile,
  "positiveEmbedding" | "negativeEmbedding" | "interactionsCount",
  {
    tagPreferences?: TCreateTasteTagPreference[]
  }
>

const TasteItemTypeProfileSchema =
  SchemaFactory.createForClass(TasteItemTypeProfile)

export { TasteItemTypeProfile, TasteItemTypeProfileSchema }
export type { TCreateTasteItemTypeProfile }
