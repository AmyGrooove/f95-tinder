import type { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

type TRecommendationLibraryStatus = Exclude<
  EUserItemStatus,
  EUserItemStatus.BLOCKED | EUserItemStatus.SKIPPED
>

interface IRecommendationLibrary {
  include?: readonly TRecommendationLibraryStatus[]
  exclude?: readonly TRecommendationLibraryStatus[]
  only?: readonly TRecommendationLibraryStatus[]
}

export type { IRecommendationLibrary, TRecommendationLibraryStatus }
