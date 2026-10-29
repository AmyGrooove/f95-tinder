import { DEFAULT_SITE_RATING_AVERAGE } from "@entities/siteMetric/static/DEFAULT_SITE_RATING_AVERAGE"

import type { ICreateItemRatingScoreExpressionProps } from "../types/ICreateItemRatingScoreExpressionProps"

const createItemRatingScoreExpression = (
  props: ICreateItemRatingScoreExpressionProps,
) => {
  const siteAverage = props.siteRatingAverage ?? DEFAULT_SITE_RATING_AVERAGE
  const smoothingCount = 20

  return {
    $cond: [
      {
        $and: [
          { $gt: [{ $ifNull: [props.ratingsCount, 0] }, 0] },
          { $ne: [{ $ifNull: [props.ratingAverage, null] }, null] },
        ],
      },
      {
        $divide: [
          {
            $add: [
              { $multiply: [props.ratingsCount, props.ratingAverage] },
              smoothingCount * siteAverage,
            ],
          },
          { $add: [props.ratingsCount, smoothingCount] },
        ],
      },
      siteAverage,
    ],
  }
}

export { createItemRatingScoreExpression }
