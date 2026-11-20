import type { RatingRangeDto } from "@entities/shared/dto/body/ratingRange.body"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"

interface IItemSearchPersonalFilters {
  isCompletedOrDroppedExcluded: boolean
  isBlockedExcluded: boolean
  isFavorite: boolean

  isUserItemPresent?: boolean
  statuses?: (TLibraryStatus | "outside")[]
  userRating?: RatingRangeDto
}

export type { IItemSearchPersonalFilters }
