import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"

import type { IRecommendationEligibilityProps } from "../../../types/IRecommendationEligibilityProps"

const resolveRecommendationLibraryStatuses = (
  library: IRecommendationEligibilityProps["library"] = { anyOf: ["outside"] },
) => {
  const { allOf = [], anyOf, noneOf = [] } = library

  return ([...USER_ITEM_LIBRARY_STATUSES, "outside"] as const).filter(
    (status) =>
      allOf.every((value) => value === status) &&
      (anyOf?.includes(status) ?? true) &&
      !noneOf.includes(status),
  )
}

export { resolveRecommendationLibraryStatuses }
