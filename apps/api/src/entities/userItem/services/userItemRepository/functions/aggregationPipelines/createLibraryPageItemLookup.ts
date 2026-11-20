import type { PipelineStage } from "mongoose"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { Item } from "@entities/item/schemas/item.schema"

const createLibraryPageItemLookup = (
  itemFilter: PipelineStage.Match["$match"],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: Item.name,
      localField: "item",
      foreignField: "_id",
      pipeline: AggregationBuilder.forLookup()
        .match(itemFilter)
        .project({ type: 1, title: 1, media: 1 })
        .build(),
      as: "visibleItem",
    },
  }
}

export { createLibraryPageItemLookup }
