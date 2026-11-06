import type { PipelineStage, Types } from "mongoose"

import { Tag } from "@entities/tag/schemas/tag.schema"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const createItemTagFilterPipeline = (
  groups: readonly IValueFilter<Types.ObjectId>[],
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
    .use({
      $lookup: {
        from: TagItem.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          { $match: { tag: { $in: tagIds } } },
          {
            $lookup: {
              from: Tag.name,
              localField: "tag",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 1 } }],
              as: "existingTag",
            },
          },
          { $match: { "existingTag.0": { $exists: true } } },
          { $project: { _id: 0, tag: 1 } },
        ],
        as: "filterTags",
      },
    })
    .match({ $and: conditions })
    .use({ $unset: "filterTags" })
    .build()
}

export { createItemTagFilterPipeline }
