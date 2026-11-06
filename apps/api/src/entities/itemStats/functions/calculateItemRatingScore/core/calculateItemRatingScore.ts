import { isNil } from "@shared/functions/checks/isNil"

import { ITEM_RATING_SCORE_SETTINGS } from "../../../static/ITEM_RATING_SCORE_SETTINGS"

interface ICalculateItemRatingScoreProps {
  ratingAverage: number | null
  ratingsCount: number
  siteRatingAverage: number | null
}

const calculateItemRatingScore = (props: ICalculateItemRatingScoreProps) => {
  const { ratingAverage, ratingsCount, siteRatingAverage } = props

  if (!isNil(ratingAverage) && ratingsCount > 0) {
    const { priorWeight, defaultSiteRatingAverage } = ITEM_RATING_SCORE_SETTINGS
    const baseline = siteRatingAverage ?? defaultSiteRatingAverage

    return (
      (ratingsCount * ratingAverage + priorWeight * baseline) /
      (ratingsCount + priorWeight)
    )
  }

  return null
}

export { calculateItemRatingScore }
