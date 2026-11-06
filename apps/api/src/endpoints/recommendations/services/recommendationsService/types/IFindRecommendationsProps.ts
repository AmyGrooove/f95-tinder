import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { ICursorPagination } from "@infrastructure/database/types/IPaginationInput"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"

interface IRecommendationFilter {
  types?: readonly EItemType[]
  tags?: readonly IValueFilter<Types.ObjectId>[]
  library?: IValueFilter<TLibraryStatus | "outside">
  rating?: {
    min?: number
    max?: number
  }
}

interface IFindRecommendationsProps extends ICursorPagination {
  sessionId: Types.ObjectId

  filter?: IRecommendationFilter
}

export type { IFindRecommendationsProps }
