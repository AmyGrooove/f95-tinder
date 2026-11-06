import type { Types } from "mongoose"

import type { ECountry } from "@entities/shared/schemas/ECountry"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"

import type { EItemType } from "../../../schemas/EItemType"

interface IReadPopularItemIdsProps {
  type: EItemType
  limit: number
  siteRatingAverage: number | null
  userId: Types.ObjectId
  country: ECountry

  library?: IValueFilter<TLibraryStatus | "outside">
  tags?: readonly IValueFilter<Types.ObjectId>[]
  rating?: {
    min?: number
    max?: number
  }
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
