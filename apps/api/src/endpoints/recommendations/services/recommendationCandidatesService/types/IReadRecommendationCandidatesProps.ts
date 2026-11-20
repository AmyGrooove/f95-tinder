import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"

interface IRecommendationCandidateFilter {
  tags?: readonly ValueFilter<Types.ObjectId>[]
  library?: ValueFilter<TLibraryStatus | "outside">
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
