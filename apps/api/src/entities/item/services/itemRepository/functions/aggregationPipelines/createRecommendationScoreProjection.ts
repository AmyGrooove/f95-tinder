import type { PipelineStage } from "mongoose"

const createRecommendationScoreProjection = (
  priorWeight: number,
  baseline: number,
): PipelineStage.Project["$project"] => {
  return {
    releaseDate: 1,
    ratingsCount: "$metrics.ratingsCount",
    ratingScore: {
      $divide: [
        {
          $add: [
            {
              $multiply: ["$metrics.ratingsCount", "$metrics.ratingAverage"],
            },
            priorWeight * baseline,
          ],
        },
        { $add: ["$metrics.ratingsCount", priorWeight] },
      ],
    },
  }
}

export { createRecommendationScoreProjection }
