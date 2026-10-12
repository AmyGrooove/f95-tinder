import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { EProgressUnit } from "@entities/shared/schemas/EProgressUnit"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isNil } from "@shared/functions/checks/isNil"
import { EUserItemStatus } from "./EUserItemStatus"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class ItemAttempt {
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
    enum: Object.values(EProgressUnit),
    default: EProgressUnit.MINUTE,
  })
  unit: EProgressUnit

  @Prop({ type: Date, default: null })
  startedAt: Date | null

  @Prop({ type: Date, default: null })
  completedAt: Date | null

  @Prop({
    type: String,
    required: true,
    enum: [
      EUserItemStatus.IN_PROGRESS,
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.COMPLETED,
      EUserItemStatus.DROPPED,
    ],
  })
  status: Exclude<EUserItemStatus, EUserItemStatus.PLANNED>
}

const ItemAttemptSchema = SchemaFactory.createForClass(ItemAttempt)

type TCreateItemAttempt = TCreateEntity<
  ItemAttempt,
  "progress" | "unit" | "startedAt" | "completedAt"
>

export { ItemAttempt, ItemAttemptSchema }
export type { TCreateItemAttempt }
