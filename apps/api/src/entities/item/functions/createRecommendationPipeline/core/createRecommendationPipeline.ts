import type { PipelineStage } from "mongoose"

import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { createItemRatingScoreExpression } from "@entities/itemStats/functions/createItemRatingScoreExpression"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IReadRecommendationsProps } from "../../../types/IReadRecommendationsProps"
import { createRecommendationEligibilityPipeline } from "../../createRecommendationEligibilityPipeline"
import { createRecommendationTastePipeline } from "../../createRecommendationTastePipeline"
import { createRecommendationRelationPipeline } from "../../createRecommendationRelationPipeline"

const createRecommendationPipeline = (
  props: IReadRecommendationsProps,
): PipelineStage[] => {
  const pipeline: PipelineStage[] = [
    ...createRecommendationEligibilityPipeline(props),
    {
      $lookup: {
        from: ItemStats.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [{ $project: { _id: 0, ratingAverage: 1, ratingsCount: 1 } }],
        as: "recommendationMetrics",
      },
    },
    {
      $set: {
        recommendationMetric: { $arrayElemAt: ["$recommendationMetrics", 0] },
      },
    },
    { $unset: "recommendationMetrics" },
  ]

  if (
    !isUndefined(props.filter?.ratingMin) ||
    !isUndefined(props.filter?.ratingMax)
  ) {
    pipeline.push({
      $match: {
        "recommendationMetric.ratingAverage": {
          $ne: null,
          ...(!isUndefined(props.filter.ratingMin)
            ? { $gte: props.filter.ratingMin }
            : {}),
          ...(!isUndefined(props.filter.ratingMax)
            ? { $lte: props.filter.ratingMax }
            : {}),
        },
      },
    })
  }

  pipeline.push(
    ...createRecommendationTastePipeline(props.preferences),
    ...createRecommendationRelationPipeline(props.userId),
    {
      $set: {
        baseScore: { $add: [1, { $divide: ["$tasteScore", 2] }] },
        plannedBoost: {
          $cond: [
            {
              $in: [EUserItemStatus.PLANNED, "$recommendationUserItems.status"],
            },
            0.2,
            0,
          ],
        },
        ratingScore: createItemRatingScoreExpression({
          ratingAverage: "$recommendationMetric.ratingAverage",
          ratingsCount: "$recommendationMetric.ratingsCount",
          siteRatingAverage: props.siteRatingAverage,
        }),
      },
    },
    {
      $project: {
        _id: 1,
        type: 1,
        title: 1,
        media: 1,
        tasteScore: 1,
        baseScore: 1,
        plannedBoost: 1,
        relationBoost: 1,
        ratingScore: 1,
        isRecommendationExcluded: 1,
        finalScore: {
          $round: [
            {
              $multiply: [
                "$baseScore",
                { $add: [1, "$plannedBoost", "$relationBoost"] },
              ],
            },
            12,
          ],
        },
      },
    },
    {
      $sort: {
        isRecommendationExcluded: 1,
        finalScore: props.direction === "asc" ? 1 : -1,
        ratingScore: -1,
        _id: 1,
      },
    },
    { $unset: "isRecommendationExcluded" },
    {
      $facet: {
        items: [
          { $skip: (props.page - 1) * props.limit },
          { $limit: props.limit },
        ],
        count: [{ $count: "total" }],
      },
    },
  )

  return pipeline
}

export { createRecommendationPipeline }
