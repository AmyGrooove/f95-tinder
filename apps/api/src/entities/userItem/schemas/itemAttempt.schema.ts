import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Types } from "mongoose"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isNil } from "@shared/functions/checks/isNil"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class ItemAttempt {
  @Prop({
    type: Types.ObjectId,
    required: true,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId

  @Prop({
    type: Number,
    default: null,
    min: 0,
    validate: (value: unknown) =>
      isNil(value) || (isInt(value) && isNonNegativeSafe(value)),
  })
  progress: number | null

  @Prop({
    type: String,
    required: true,
    enum: [EUnit.MINUTE, EUnit.PERCENT],
    default: EUnit.MINUTE,
  })
  unit: EUnit

  @Prop({ type: Date, default: null })
  startedAt: Date | null

  @Prop({ type: Date, default: null })
  completedAt: Date | null

  @Prop({ type: Boolean, required: true, default: false })
  isCompleted: boolean
}

const ItemAttemptSchema = SchemaFactory.createForClass(ItemAttempt)

ItemAttemptSchema.path("progress").validate(function (
  this: ItemAttempt,
  value: number | null,
) {
  return isNil(value) || this.unit !== EUnit.PERCENT || value <= 100
})

type TCreateItemAttempt = TCreateEntity<
  ItemAttempt,
  "id" | "progress" | "unit" | "startedAt" | "completedAt" | "isCompleted"
>

export { ItemAttempt, ItemAttemptSchema }
export type { TCreateItemAttempt }
