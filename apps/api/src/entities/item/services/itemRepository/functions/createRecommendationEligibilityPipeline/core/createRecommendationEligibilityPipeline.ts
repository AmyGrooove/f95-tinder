import { ItemBan } from "@entities/itemBan/schemas/itemBan.schema"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IRecommendationEligibilityProps } from "../../../types/IRecommendationEligibilityProps"
import { createItemTagFilterPipeline } from "../../createItemTagFilterPipeline"

const createRecommendationEligibilityPipeline = (
  props: IRecommendationEligibilityProps,
  ratingMode?: "required" | "optional",
) => {
  const {
    userId,
    country,
    library = { anyOf: ["outside"] },
    tags = [],
    rating,
  } = props
  const { min, max } = rating ?? {}

  if (
    (!isUndefined(min) && (!isFiniteNumber(min) || min < 1 || min > 10)) ||
    (!isUndefined(max) && (!isFiniteNumber(max) || max < 1 || max > 10)) ||
    (!isUndefined(min) && !isUndefined(max) && min > max)
  ) {
    throw new RangeError("Invalid item rating range")
  }

  const { allOf = [], anyOf, noneOf = [] } = library
  const allowedStatuses = (
    [...USER_ITEM_LIBRARY_STATUSES, "outside"] as const
  ).filter(
    (status) =>
      allOf.every((value) => value === status) &&
      (anyOf?.includes(status) ?? true) &&
      !noneOf.includes(status),
  )

  if (allowedStatuses.length === 0) {
    return null
  }

  const pipeline = new AggregationBuilder()
  const isRatingFiltered = !isUndefined(min) || !isUndefined(max)

  if (!isUndefined(ratingMode) || isRatingFiltered) {
    pipeline.use(
      {
        $lookup: {
          from: ItemStats.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                ratingsCount: { $gt: 0 },
                ratingAverage: {
                  $type: "number",
                  ...(!isUndefined(min) ? { $gte: min } : {}),
                  ...(!isUndefined(max) ? { $lte: max } : {}),
                },
              },
            },
            { $project: { _id: 0, ratingsCount: 1, ratingAverage: 1 } },
          ],
          as: "metrics",
        },
      },
      {
        $unwind: {
          path: "$metrics",
          preserveNullAndEmptyArrays:
            ratingMode === "optional" && !isRatingFiltered,
        },
      },
    )
  }

  return pipeline
    .use({
      $lookup: {
        from: UserItem.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          {
            $match: {
              user: userId,
              $or: [
                { status: { $ne: EUserItemStatus.SKIPPED } },
                { expiresAt: { $gt: new Date() } },
              ],
            },
          },
          { $project: { _id: 0, status: 1 } },
        ],
        as: "libraryEntry",
      },
    })
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
    .use({
      $lookup: {
        from: ItemBan.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          {
            $match: {
              $or: [{ countries: { $size: 0 } }, { countries: country }],
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "activeBans",
      },
    })
    .match({ "activeBans.0": { $exists: false } })
    .use(...createItemTagFilterPipeline(tags))
    .build()
}

export { createRecommendationEligibilityPipeline }
