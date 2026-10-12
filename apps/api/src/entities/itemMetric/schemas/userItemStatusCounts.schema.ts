import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class UserItemStatusCounts {
  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  planned: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  inProgress: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  onHold: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  completed: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  dropped: number
}

type TCreateUserItemStatusCounts = Partial<UserItemStatusCounts>

const UserItemStatusCountsSchema =
  SchemaFactory.createForClass(UserItemStatusCounts)

export { UserItemStatusCounts, UserItemStatusCountsSchema }
export type { TCreateUserItemStatusCounts }
