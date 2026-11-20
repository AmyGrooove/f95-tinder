import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createSiteRatingsStatsUpdatePipeline = (sum: number, count: number) => {
  return AggregationBuilder.forUpdate()
    .use(
      {
        $set: {
          createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
          sum: { $add: [{ $ifNull: ["$sum", 0] }, sum] },
          count: { $add: [{ $ifNull: ["$count", 0] }, count] },
        },
      },
      {
        $set: {
          average: {
            $cond: [
              { $gt: ["$count", 0] },
              { $divide: ["$sum", "$count"] },
              null,
            ],
          },
        },
      },
    )
    .build()
}

export { createSiteRatingsStatsUpdatePipeline }
