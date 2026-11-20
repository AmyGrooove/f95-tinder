import type { Types } from "mongoose"

import type { ECountry } from "@entities/shared/schemas/ECountry"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

import type { EItemType } from "../../../schemas/EItemType"

interface IRecommendationEligibilityProps {
  userId: Types.ObjectId
  country: ECountry

  library?: ValueFilter<TLibraryStatus | "outside">
  tags?: readonly ValueFilter<Types.ObjectId>[]
  rating?: {
    min?: number
    max?: number
  }
}

interface IReadEligibleRecommendationItemsProps extends IRecommendationEligibilityProps {
  ids: readonly Types.ObjectId[]

  types?: readonly EItemType[]
}

export type {
  IRecommendationEligibilityProps,
  IReadEligibleRecommendationItemsProps,
}
