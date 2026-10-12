import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class RatingDistribution {
  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  one: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  two: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  three: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  four: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  five: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  six: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  seven: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  eight: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  nine: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  ten: number
}

type TCreateRatingDistribution = Partial<RatingDistribution>

const RatingDistributionSchema =
  SchemaFactory.createForClass(RatingDistribution)

export { RatingDistribution, RatingDistributionSchema }
export type { TCreateRatingDistribution }
