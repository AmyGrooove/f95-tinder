import type { PipelineStage } from "mongoose"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import type { IRecommendationEligibilityProps } from "../../types/IRecommendationEligibilityProps"

const createRecommendationLibraryEntryLookup = (
  userId: IRecommendationEligibilityProps["userId"],
  isUserRatingIncluded: boolean,
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: UserItem.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({
          user: userId,
          $or: [
            { status: { $ne: EUserItemStatus.SKIPPED } },
            { expiresAt: { $gt: new Date() } },
          ],
        })
        .project({
          _id: 0,
          status: 1,
          ...(isUserRatingIncluded ? { rating: 1 } : {}),
        })
        .build(),
      as: "libraryEntry",
    },
  }
}

export { createRecommendationLibraryEntryLookup }
