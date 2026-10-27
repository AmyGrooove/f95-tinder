import type { ICreateItemRatingScoreExpressionProps } from "../types/ICreateItemRatingScoreExpressionProps"

const createItemRatingScoreExpression = (
  props: ICreateItemRatingScoreExpressionProps,
) => {
  const siteAverage = props.siteRatingAverage ?? 5.5
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
