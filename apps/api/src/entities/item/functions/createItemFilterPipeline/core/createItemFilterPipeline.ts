import type { PipelineStage } from "mongoose"

import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isDate } from "@shared/functions/checks/isDate"

import { EAgeRestriction } from "../../../schemas/EAgeRestriction"
import { EItemField } from "../../../schemas/EItemField"
import type { ICreateItemFilterPipelineProps } from "../types/ICreateItemFilterPipelineProps"

const createItemFilterPipeline = (
  props: ICreateItemFilterPipelineProps,
): PipelineStage[] => {
  const { filter, candidateItemIds, excludeItemIds } = props
  const builder = new AggregationBuilder().match({
    deletedAt: null,
    ...(!isUndefined(filter?.types) ? { type: { $in: filter.types } } : {}),
    ...(!isUndefined(candidateItemIds) || !isUndefined(excludeItemIds)
      ? {
          _id: {
            ...(!isUndefined(candidateItemIds)
              ? { $in: candidateItemIds }
              : {}),
            ...(!isUndefined(excludeItemIds) ? { $nin: excludeItemIds } : {}),
          },
        }
      : {}),
  })

  for (const field of filter?.fields ?? []) {
    const value =
      field.field === EItemField.AGE_RESTRICTION
        ? {
            $convert: {
              input: {
                $cond: [
                  {
                    $eq: ["$ageRestriction", EAgeRestriction.AGE_18_PLUS_PLUS],
                  },
                  EAgeRestriction.AGE_18,
                  "$ageRestriction",
                ],
              },
              to: "int",
              onError: null,
              onNull: null,
            },
          }
        : `$${field.field}`

    builder.match({
      $expr: {
        $and: [
          {
            $in: [
              { $type: value },
              isDate(field.min) || isDate(field.max)
                ? ["date"]
                : ["int", "long", "double", "decimal"],
            ],
          },
          ...(!isUndefined(field.min) ? [{ $gte: [value, field.min] }] : []),
          ...(!isUndefined(field.max) ? [{ $lte: [value, field.max] }] : []),
        ],
      },
    })
  }

  if (!isUndefined(filter?.tagIds) && filter.tagIds.length > 0) {
    builder
      .use({
        $lookup: {
          from: TagItem.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            { $match: { tag: { $in: filter.tagIds } } },
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
          as: "searchFilterTags",
        },
      })
      .match({
        $expr: { $setIsSubset: [filter.tagIds, "$searchFilterTags.tag"] },
      })
      .use({ $unset: "searchFilterTags" })
  }

  return builder.build()
}

export { createItemFilterPipeline }
