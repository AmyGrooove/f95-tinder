import type { PipelineStage } from "mongoose"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"

const createLibraryItemStatsLookup = (): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemStats.name,
      localField: "item",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .project({ _id: 0, ratingAverage: 1 })
        .build(),
      as: "stats",
    },
  }
}

export { createLibraryItemStatsLookup }
