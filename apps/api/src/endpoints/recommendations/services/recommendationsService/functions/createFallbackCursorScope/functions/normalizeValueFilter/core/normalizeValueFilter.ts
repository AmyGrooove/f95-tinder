import type { Types } from "mongoose"

import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { normalizeValues } from "../../normalizeValues"

const normalizeValueFilter = (
  filter: IValueFilter<string | Types.ObjectId>,
) => {
  return [
    normalizeValues(filter.allOf ?? []),
    isUndefined(filter.anyOf) ? null : normalizeValues(filter.anyOf),
    normalizeValues(filter.noneOf ?? []),
  ] as const
}

export { normalizeValueFilter }
