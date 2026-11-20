import type { PipelineStage } from "mongoose"
import { ItemBan } from "@entities/itemBan/schemas/itemBan.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import type { IRecommendationEligibilityProps } from "../../types/IRecommendationEligibilityProps"

const createRecommendationActiveBansLookup = (
  country: IRecommendationEligibilityProps["country"],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemBan.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({
          $or: [{ countries: { $size: 0 } }, { countries: country }],
        })
        .project({ _id: 1 })
        .build(),
      as: "activeBans",
    },
  }
}

export { createRecommendationActiveBansLookup }
