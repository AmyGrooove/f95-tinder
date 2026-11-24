enum EUserActivityType {
  LIBRARY_ITEM_ADDED = "library.itemAdded",
  LIBRARY_STATUS_CHANGED = "library.statusChanged",
  LIBRARY_RATING_CHANGED = "library.ratingChanged",
  LIBRARY_FAVORITE_CHANGED = "library.favoriteChanged",
}

const USER_LIBRARY_ACTIVITY_TYPES = [
  EUserActivityType.LIBRARY_ITEM_ADDED,
  EUserActivityType.LIBRARY_STATUS_CHANGED,
  EUserActivityType.LIBRARY_RATING_CHANGED,
  EUserActivityType.LIBRARY_FAVORITE_CHANGED,
] as const

type TUserLibraryActivityType = (typeof USER_LIBRARY_ACTIVITY_TYPES)[number]

export { EUserActivityType, USER_LIBRARY_ACTIVITY_TYPES }
export type { TUserLibraryActivityType }
