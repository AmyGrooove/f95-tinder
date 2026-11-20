import type { Types } from "mongoose"

import type { ValueFilter } from "@entities/shared/types/ValueFilter"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { normalizeValues } from "../../normalizeValues"

const normalizeValueFilter = (filter: ValueFilter<string | Types.ObjectId>) => {
  return [
    normalizeValues(filter.allOf ?? []),
    isUndefined(filter.anyOf) ? null : normalizeValues(filter.anyOf),
    normalizeValues(filter.noneOf ?? []),
  ] as const
}

export { normalizeValueFilter }
