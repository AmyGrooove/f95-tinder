import type { PipelineStage } from "mongoose"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createCollectionCardMetricsLookup = (): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemStats.name,
      localField: "item._id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .project({ _id: 0, ratingAverage: 1 })
        .build(),
      as: "metrics",
    },
  }
}

export { createCollectionCardMetricsLookup }
