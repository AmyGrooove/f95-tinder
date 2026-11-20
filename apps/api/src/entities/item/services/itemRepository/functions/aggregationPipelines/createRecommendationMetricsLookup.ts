import type { PipelineStage } from "mongoose"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const createRecommendationMetricsLookup = (
  min: number | undefined,
  max: number | undefined,
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemStats.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({
          ratingsCount: { $gt: 0 },
          ratingAverage: {
            $type: "number",
            ...(!isUndefined(min) ? { $gte: min } : {}),
            ...(!isUndefined(max) ? { $lte: max } : {}),
          },
        })
        .project({ _id: 0, ratingsCount: 1, ratingAverage: 1 })
        .build(),
      as: "metrics",
    },
  }
}

export { createRecommendationMetricsLookup }
