import type { EItemType } from "../../../schemas/EItemType"
import type { IRecommendationEligibilityProps } from "./IRecommendationEligibilityProps"

interface IReadPopularItemIdsProps extends IRecommendationEligibilityProps {
  type: EItemType
  limit: number
  siteRatingAverage: number | null
}

interface IItemReleaseWindow {
  from: Date
  through: Date
}

interface IReadNewItemIdsProps extends IReadPopularItemIdsProps {
  releaseWindow: IItemReleaseWindow
}

export type {
  IItemReleaseWindow,
  IReadNewItemIdsProps,
  IReadPopularItemIdsProps,
}
