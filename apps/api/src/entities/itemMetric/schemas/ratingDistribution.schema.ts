import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isInt } from "@shared/functions/checks/isInt"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class RatingDistribution {
  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "1": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "2": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "3": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "4": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "5": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "6": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "7": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "8": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "9": number

  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: (value: unknown) => isInt(value) && value >= 0,
  })
  "10": number
}

type TCreateRatingDistribution = Partial<RatingDistribution>

const RatingDistributionSchema =
  SchemaFactory.createForClass(RatingDistribution)

export { RatingDistribution, RatingDistributionSchema }
export type { TCreateRatingDistribution }
