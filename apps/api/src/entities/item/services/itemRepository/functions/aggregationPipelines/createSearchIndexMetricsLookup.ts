import type { PipelineStage } from "mongoose"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"

const createSearchIndexMetricsLookup = (): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemStats.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .project({ ratingAverage: 1, ratingsCount: 1 })
        .build(),
      as: "searchMetrics",
    },
  }
}

export { createSearchIndexMetricsLookup }
