import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

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
    validate: checkIsNonNegativeSafeInteger,
  })
  planned: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  inProgress: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  onHold: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  completed: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  dropped: number
}

type TCreateUserItemStatusCounts = Partial<UserItemStatusCounts>

const UserItemStatusCountsSchema =
  SchemaFactory.createForClass(UserItemStatusCounts)

export { UserItemStatusCounts, UserItemStatusCountsSchema }
export type { TCreateUserItemStatusCounts }
