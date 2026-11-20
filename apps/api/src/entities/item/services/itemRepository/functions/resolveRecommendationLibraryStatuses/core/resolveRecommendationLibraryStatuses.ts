import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { filterSingleValues } from "@entities/shared/functions/filterSingleValues"

import type { IRecommendationEligibilityProps } from "../../../types/IRecommendationEligibilityProps"

const resolveRecommendationLibraryStatuses = (
  library: IRecommendationEligibilityProps["library"] = { anyOf: ["outside"] },
) => {
  return filterSingleValues(
    [...USER_ITEM_LIBRARY_STATUSES, "outside"] as const,
    library,
  )
}

export { resolveRecommendationLibraryStatuses }
