import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { Embedding } from "@entities/shared/schemas/embedding.schema"
import { EmbeddingSchema } from "@entities/shared/schemas/embedding.schema"
import type {
  TasteTagPreference,
  TCreateTasteTagPreference,
} from "./tasteTagPreference.schema"
import { TasteTagPreferenceSchema } from "./tasteTagPreference.schema"
import { MAX_TAG_PREFERENCES } from "../static/MAX_TAG_PREFERENCES"

@Schema({ _id: false, id: false, timestamps: false })
class TasteItemTypeProfile {
  @Prop({ type: String, enum: Object.values(EItemType), required: true })
  type: EItemType

  @Prop({ type: EmbeddingSchema, default: null })
  positiveEmbedding: Embedding | null

  @Prop({ type: EmbeddingSchema, default: null })
  negativeEmbedding: Embedding | null

  @Prop({
    type: [TasteTagPreferenceSchema],
    required: true,
    default: [],
    validate: (value: TasteTagPreference[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      value.length <= MAX_TAG_PREFERENCES &&
      new Set(value.map((entry) => String(entry.tag))).size === value.length,
  })
  tagPreferences: TasteTagPreference[]

  @Prop({
    type: Number,
    required: true,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  interactionsCount: number
}

type TCreateTasteItemTypeProfile = TCreateEntity<
  TasteItemTypeProfile,
  "positiveEmbedding" | "negativeEmbedding" | "interactionsCount",
  { tagPreferences?: TCreateTasteTagPreference[] }
>

const TasteItemTypeProfileSchema =
  SchemaFactory.createForClass(TasteItemTypeProfile)

export { TasteItemTypeProfile, TasteItemTypeProfileSchema }
export type { TCreateTasteItemTypeProfile }
