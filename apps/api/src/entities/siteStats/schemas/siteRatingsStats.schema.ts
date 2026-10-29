import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isNil } from "@shared/functions/checks/isNil"

import type { ESiteStatsKey } from "./ESiteStatsKey"

@Schema()
class SiteRatingsStats extends MongoEntity {
  declare key: ESiteStatsKey.RATINGS

  @Prop({ type: Number, required: true, min: 0, validate: isFiniteNumber })
  sum: number

  @Prop({
    type: Number,
    required: true,
    validate: checkIsNonNegativeSafeInteger,
  })
  count: number

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isFiniteNumber(value) && value >= 1 && value <= 10),
  })
  average: number | null
}

const SiteRatingsStatsSchema = SchemaFactory.createForClass(SiteRatingsStats)

export { SiteRatingsStats, SiteRatingsStatsSchema }
