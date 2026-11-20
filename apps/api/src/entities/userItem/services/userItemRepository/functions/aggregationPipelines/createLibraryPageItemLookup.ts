import type { PipelineStage } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { Item } from "@entities/item/schemas/item.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createLibraryPageItemLookup = (
  itemFilter: PipelineStage.Match["$match"],
  projection: PipelineStage.Project["$project"] = {
    type: 1,
    title: 1,
    media: 1,
    "movie.duration": 1,
  },
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: Item.name,
      localField: "item",
      foreignField: "_id",
      pipeline: AggregationBuilder.forLookup()
        .match({
          type: { $in: Object.values(EItemType) },
          ...itemFilter,
          deletedAt: null,
        })
        .project(projection)
        .build(),
      as: "visibleItem",
    },
  }
}

export { createLibraryPageItemLookup }
