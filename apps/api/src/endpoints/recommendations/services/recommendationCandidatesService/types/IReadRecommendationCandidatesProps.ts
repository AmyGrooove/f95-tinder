import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"

interface IRecommendationCandidateFilter {
  tags?: readonly IValueFilter<Types.ObjectId>[]
  library?: IValueFilter<TLibraryStatus | "outside">
  rating?: {
    min?: number
    max?: number
  }
}

interface IReadRecommendationCandidatesProps<
  TLimit extends number = TPageSize,
> {
  type: EItemType

  limit?: TLimit
  filter?: IRecommendationCandidateFilter
}

export type {
  IRecommendationCandidateFilter,
  IReadRecommendationCandidatesProps,
}
