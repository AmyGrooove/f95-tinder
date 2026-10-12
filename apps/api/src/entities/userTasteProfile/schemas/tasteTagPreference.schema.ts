import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"

@Schema({ _id: false, id: false, timestamps: false })
class TasteTagPreference {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  tag: Types.ObjectId

  @Prop({ type: Number, required: true, validate: isFiniteNumber })
  score: number

  @Prop({
    type: Number,
    required: true,
    min: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  samples: number
}

const TasteTagPreferenceSchema =
  SchemaFactory.createForClass(TasteTagPreference)

type TCreateTasteTagPreference = TasteTagPreference

export { TasteTagPreference, TasteTagPreferenceSchema }
export type { TCreateTasteTagPreference }
