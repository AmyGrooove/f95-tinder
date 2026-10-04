import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isNumber } from "@shared/functions/checks/isNumber"
import { EUserItemStatus } from "./EUserItemStatus"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class ItemAttempt {
  @Prop({
    type: Number,
    required: true,
    validate: (value: unknown) => isNumber(value) && Number.isFinite(value),
  })
  progress: number

  @Prop({ type: String, required: true })
  unit: string

  @Prop({ type: Date, default: null })
  startedAt: Date | null

  @Prop({ type: Date, default: null })
  completedAt: Date | null

  @Prop({ type: String, enum: Object.values(EUserItemStatus), required: true })
  status: EUserItemStatus
}

type TCreateItemAttempt = TCreateEntity<
  ItemAttempt,
  "startedAt" | "completedAt"
>

const ItemAttemptSchema = SchemaFactory.createForClass(ItemAttempt)

export { ItemAttempt, ItemAttemptSchema }
export type { TCreateItemAttempt }
