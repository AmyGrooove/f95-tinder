import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IRecommendationEligibilityProps } from "../../types/IRecommendationEligibilityProps"
import { createItemTagFilterPipeline } from "./createItemTagFilterPipeline"
import { resolveRecommendationLibraryStatuses } from "../resolveRecommendationLibraryStatuses"
import { createRecommendationMetricsLookup } from "./createRecommendationMetricsLookup"
import { createRecommendationLibraryEntryLookup } from "./createRecommendationLibraryEntryLookup"
import { createRecommendationActiveBansLookup } from "./createRecommendationActiveBansLookup"

const createRecommendationEligibilityPipeline = (
  props: IRecommendationEligibilityProps,
  options: {
    ratingMode?: "required" | "optional"
    isUserRatingIncluded?: boolean
  } = {},
) => {
  const { userId, country, library, tags = [], rating } = props
  const { ratingMode, isUserRatingIncluded = false } = options
  const { min, max } = rating ?? {}

  if (
    (!isUndefined(min) && (!isFiniteNumber(min) || min < 1 || min > 10)) ||
    (!isUndefined(max) && (!isFiniteNumber(max) || max < 1 || max > 10)) ||
    (!isUndefined(min) && !isUndefined(max) && min > max)
  ) {
    throw new RangeError(DICTIONARY.item.invalidRatingRange)
  }

  const allowedStatuses = resolveRecommendationLibraryStatuses(library)

  if (allowedStatuses.length === 0) {
    return null
  }

  const pipeline = new AggregationBuilder()
  const isRatingFiltered = !isUndefined(min) || !isUndefined(max)

  if (!isUndefined(ratingMode) || isRatingFiltered) {
    pipeline.use(createRecommendationMetricsLookup(min, max), {
      $unwind: {
        path: "$metrics",
        preserveNullAndEmptyArrays:
          ratingMode === "optional" && !isRatingFiltered,
      },
    })
  }

  return pipeline
    .use(createRecommendationLibraryEntryLookup(userId, isUserRatingIncluded))
    .match({
      $expr: {
        $in: [
          {
            $ifNull: [{ $arrayElemAt: ["$libraryEntry.status", 0] }, "outside"],
          },
          allowedStatuses,
        ],
      },
    })
    .use(createRecommendationActiveBansLookup(country))
    .match({ "activeBans.0": { $exists: false } })
    .use(...createItemTagFilterPipeline(tags))
    .build()
}

export { createRecommendationEligibilityPipeline }
