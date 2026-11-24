import { EItemType } from "@entities/item/schemas/EItemType"
import { isNil } from "@shared/functions/checks/isNil"

import { FALLBACK_PAGE_SETTINGS } from "../../../static/FALLBACK_PAGE_SETTINGS"
import { normalizeValues } from "../functions/normalizeValues"
import { normalizeValueFilter } from "../functions/normalizeValueFilter"
import type { ICreateFallbackCursorScopeProps } from "../types/ICreateFallbackCursorScopeProps"

const createFallbackCursorScope = (props: ICreateFallbackCursorScopeProps) => {
  const {
    viewer,
    limit,
    filter,
    namespace = FALLBACK_PAGE_SETTINGS.namespace,
  } = props
  const {
    types,
    tags = [],
    library = { anyOf: ["outside"] },
    rating,
  } = filter ?? {}
  const tagGroups = tags
    .map(normalizeValueFilter)
    .filter((tagGroup) => {
      const [allOf, anyOf, noneOf] = tagGroup

      return allOf.length > 0 || !isNil(anyOf) || noneOf.length > 0
    })
    .map((group) => JSON.stringify(group))

  return [
    namespace,
    viewer.userId.toHexString(),
    viewer.country,
    limit,
    normalizeValues(types ?? Object.values(EItemType)),
    [...new Set(tagGroups)].sort(),
    normalizeValueFilter(library),
    rating?.min?.toString() ?? null,
    rating?.max?.toString() ?? null,
  ]
}

export { createFallbackCursorScope }
