import type { Types } from "mongoose"

import type { IRecommendationViewer } from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { FALLBACK_PAGE_SETTINGS } from "../../../static/FALLBACK_PAGE_SETTINGS"
import type { IFindRecommendationsProps } from "../../../types/IFindRecommendationsProps"

interface ICreateFallbackCursorScopeProps {
  viewer: IRecommendationViewer
  limit: TPageSize

  filter?: IFindRecommendationsProps["filter"]
}

const normalizeValues = (values: readonly (string | Types.ObjectId)[]) =>
  [...new Set(values.map(String))].sort()

const normalizeValueFilter = (filter: IValueFilter<string | Types.ObjectId>) =>
  [
    normalizeValues(filter.allOf ?? []),
    isUndefined(filter.anyOf) ? null : normalizeValues(filter.anyOf),
    normalizeValues(filter.noneOf ?? []),
  ] as const

const createFallbackCursorScope = (props: ICreateFallbackCursorScopeProps) => {
  const { viewer, limit, filter } = props
  const {
    types,
    tags = [],
    library = { anyOf: ["outside"] },
    rating,
  } = filter ?? {}
  const tagGroups = tags
    .map(normalizeValueFilter)
    .filter(
      ([allOf, anyOf, noneOf]) =>
        allOf.length > 0 || anyOf !== null || noneOf.length > 0,
    )
    .map((group) => JSON.stringify(group))

  return [
    FALLBACK_PAGE_SETTINGS.namespace,
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
