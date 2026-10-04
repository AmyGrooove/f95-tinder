import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { isNumber } from "@shared/functions/checks/isNumber"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class TasteTagPreference {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  tag: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    validate: (value: unknown) => isNumber(value) && Number.isFinite(value),
  })
  score: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  samples: number
}

type TCreateTasteTagPreference = TCreateEntity<TasteTagPreference, "samples">

const TasteTagPreferenceSchema =
  SchemaFactory.createForClass(TasteTagPreference)

export { TasteTagPreference, TasteTagPreferenceSchema }
export type { TCreateTasteTagPreference }
