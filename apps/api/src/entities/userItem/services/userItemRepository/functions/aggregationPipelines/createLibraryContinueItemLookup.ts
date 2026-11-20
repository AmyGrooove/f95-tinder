import type { PipelineStage } from "mongoose"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import type { EItemType } from "@entities/item/schemas/EItemType"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const createLibraryContinueItemLookup = (
  types?: readonly EItemType[],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: "Item",
      localField: "item",
      foreignField: "_id",
      pipeline: AggregationBuilder.forLookup()
        .match({
          deletedAt: null,
          ...(!isUndefined(types) && { type: { $in: types } }),
        })
        .project({ _id: 1 })
        .build(),
      as: "visibleItem",
    },
  }
}

export { createLibraryContinueItemLookup }
