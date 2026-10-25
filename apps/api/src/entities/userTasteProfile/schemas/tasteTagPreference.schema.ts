import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"

@Schema({ _id: false, id: false, timestamps: false })
class TasteTagPreference {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  tag: Types.ObjectId

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

const TasteTagPreferenceSchema =
  SchemaFactory.createForClass(TasteTagPreference)

type TCreateTasteTagPreference = TCreateEntity<
  TasteTagPreference,
  "weight" | "count" | "explicitWeight"
>

export { TasteTagPreference, TasteTagPreferenceSchema }
export type { TCreateTasteTagPreference }
