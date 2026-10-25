import { checkIsFeatureValue } from "@entities/shared/functions/checks/checkIsFeatureValue"
import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isNil } from "@shared/functions/checks/isNil"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import type { TasteFeatureRange } from "./tasteFeatureRange.schema"
import { TasteFeatureRangeSchema } from "./tasteFeatureRange.schema"

@Schema({ _id: false, id: false, timestamps: false })
class TasteFeaturePreference {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Feature" })
  feature: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: null,
    validate: (value: unknown) => isNil(value) || checkIsFeatureValue(value),
  })
  value: number | string | boolean | Date | null

  @Prop({ type: TasteFeatureRangeSchema, default: null })
  range: TasteFeatureRange | null

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: -1,
    max: 1,
    validate: isFiniteNumber,
  })
  weight: number

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  count: number

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: -1,
    max: 1,
    validate: isFiniteNumber,
  })
  explicitWeight: number
}

type TCreateTasteFeaturePreference = TCreateEntity<
  TasteFeaturePreference,
  "value" | "range" | "weight" | "count" | "explicitWeight"
> &
  (
    | { value: NonNullable<TasteFeaturePreference["value"]>; range?: null }
    | { value?: null; range: TasteFeatureRange }
  )

const TasteFeaturePreferenceSchema = SchemaFactory.createForClass(
  TasteFeaturePreference,
)

export { TasteFeaturePreference, TasteFeaturePreferenceSchema }
export type { TCreateTasteFeaturePreference }
