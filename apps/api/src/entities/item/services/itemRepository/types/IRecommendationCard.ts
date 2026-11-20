import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"

import type { IItemPosterCard } from "./IItemPosterCard"

interface IRecommendationCard extends IItemPosterCard {
  ratingAverage: number | null
  userRating: number | null
  userStatus: TLibraryStatus | null
}

export type { IRecommendationCard }
