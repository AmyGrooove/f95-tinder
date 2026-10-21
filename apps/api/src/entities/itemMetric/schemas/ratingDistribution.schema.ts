import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

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
    validate: checkIsNonNegativeSafeInteger,
  })
  one: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  two: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  three: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  four: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  five: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  six: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  seven: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  eight: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  nine: number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: checkIsNonNegativeSafeInteger,
  })
  ten: number
}

type TCreateRatingDistribution = Partial<RatingDistribution>

const RatingDistributionSchema =
  SchemaFactory.createForClass(RatingDistribution)

export { RatingDistribution, RatingDistributionSchema }
export type { TCreateRatingDistribution }
