import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { RATING_DISTRIBUTION_VALUES } from "../../../../static/RATING_DISTRIBUTION_VALUES"
import type { IUpdateItemStatsProps } from "../../types/IUpdateItemStatsProps"

const createItemStatsUpdatePipeline = (props: IUpdateItemStatsProps) => {
  const {
    ratingsCount,
    favoritesCount,
    completedAttemptsCount,
    ratingDistribution,
    statusCounts,
  } = props
  const ratingKeys = Object.keys(
    RATING_DISTRIBUTION_VALUES,
  ) as (keyof typeof RATING_DISTRIBUTION_VALUES)[]
  const increments = {
    ratingsCount,
    favoritesCount,
    completedAttemptsCount,
    ...Object.fromEntries(
      ratingKeys.map((key) => [
        `ratingDistribution.${key}`,
        ratingDistribution[key] ?? 0,
      ]),
    ),
    ...Object.fromEntries(
      USER_ITEM_LIBRARY_STATUSES.map((status) => [
        `statusCounts.${status}`,
        statusCounts[status] ?? 0,
      ]),
    ),
  }

  return AggregationBuilder.forUpdate()
    .use(
      {
        $set: Object.fromEntries(
          Object.entries(increments).map(([key, value]) => [
            key,
            { $add: [{ $ifNull: [`$${key}`, 0] }, value] },
          ]),
        ),
      },
      {
        $set: {
          createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
          ratingAverage: {
            $cond: [
              { $gt: ["$ratingsCount", 0] },
              {
                $divide: [
                  {
                    $add: ratingKeys.map((key) => ({
                      $multiply: [
                        `$ratingDistribution.${key}`,
                        RATING_DISTRIBUTION_VALUES[key],
                      ],
                    })),
                  },
                  "$ratingsCount",
                ],
              },
              null,
            ],
          },
        },
      },
    )
    .build()
}

export { createItemStatsUpdatePipeline }
