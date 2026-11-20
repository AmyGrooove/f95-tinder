import type { PipelineStage, Types } from "mongoose"

import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { createRecommendationFilterTagsLookup } from "./createRecommendationFilterTagsLookup"

const createItemTagFilterPipeline = (
  groups: readonly ValueFilter<Types.ObjectId>[],
): PipelineStage[] => {
  const conditions = groups.flatMap(({ allOf = [], anyOf, noneOf = [] }) => [
    ...(allOf.length > 0 ? [{ "filterTags.tag": { $all: allOf } }] : []),
    ...(!isUndefined(anyOf) ? [{ "filterTags.tag": { $in: anyOf } }] : []),
    ...(noneOf.length > 0 ? [{ "filterTags.tag": { $nin: noneOf } }] : []),
  ])

  if (conditions.length === 0) {
    return []
  }

  const tagIds = groups.flatMap(({ allOf = [], anyOf = [], noneOf = [] }) => [
    ...allOf,
    ...anyOf,
    ...noneOf,
  ])

  return new AggregationBuilder()
    .use(createRecommendationFilterTagsLookup(tagIds))
    .match({ $and: conditions })
    .use({ $unset: "filterTags" })
    .build()
}

export { createItemTagFilterPipeline }
