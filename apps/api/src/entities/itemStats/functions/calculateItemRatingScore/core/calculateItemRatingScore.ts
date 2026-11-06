import { isNil } from "@shared/functions/checks/isNil"

const RATING_PRIOR_WEIGHT = 20
const DEFAULT_SITE_RATING_AVERAGE = 5.5

interface ICalculateItemRatingScoreProps {
  ratingAverage: number | null
  ratingsCount: number
  siteRatingAverage: number | null
}

const calculateItemRatingScore = (props: ICalculateItemRatingScoreProps) => {
  const { ratingAverage, ratingsCount, siteRatingAverage } = props

  if (!isNil(ratingAverage) && ratingsCount > 0) {
    const baseline = siteRatingAverage ?? DEFAULT_SITE_RATING_AVERAGE

    return (
      (ratingsCount * ratingAverage + RATING_PRIOR_WEIGHT * baseline) /
      (ratingsCount + RATING_PRIOR_WEIGHT)
    )
  }

  return null
}

export { calculateItemRatingScore }
