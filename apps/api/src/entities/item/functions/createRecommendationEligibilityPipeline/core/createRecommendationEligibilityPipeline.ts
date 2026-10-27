import type { PipelineStage } from "mongoose"

import { BannedItem } from "@entities/bannedItem/schemas/bannedItem.schema"
import { CollectionItem } from "@entities/collectionItem/schemas/collectionItem.schema"
import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { SourceItem } from "@entities/sourceItem/schemas/sourceItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isDate } from "@shared/functions/checks/isDate"

import { EAgeRestriction } from "../../../schemas/EAgeRestriction"
import { EItemField } from "../../../schemas/EItemField"
import type { IReadRecommendationsProps } from "../../../types/IReadRecommendationsProps"

const createRecommendationEligibilityPipeline = (
  props: IReadRecommendationsProps,
): PipelineStage[] => {
  const filter = props.filter
  const pipeline: PipelineStage[] = [
    {
      $match: {
        deletedAt: null,
        ...(!isUndefined(filter?.types) ? { type: { $in: filter.types } } : {}),
        ...(!isUndefined(props.excludeItemIds)
          ? { _id: { $nin: props.excludeItemIds } }
          : {}),
      },
    },
  ]

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

    pipeline.push({
      $match: {
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
      },
    })
  }

  pipeline.push({ $project: { _id: 1, type: 1, title: 1, media: 1 } })

  if (!isUndefined(filter?.collectionId)) {
    pipeline.push(
      {
        $lookup: {
          from: CollectionItem.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                collectionId: filter.collectionId,
                groupId: { $in: props.collectionGroupIds ?? [] },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "recommendationMembership",
        },
      },
      { $match: { "recommendationMembership.0": { $exists: true } } },
      { $unset: "recommendationMembership" },
    )
  }

  if (!isUndefined(filter?.tagIds) && filter.tagIds.length > 0) {
    pipeline.push(
      {
        $lookup: {
          from: ItemTag.name,
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
          as: "recommendationFilterTags",
        },
      },
      {
        $match: {
          $expr: {
            $setIsSubset: [filter.tagIds, "$recommendationFilterTags.tag"],
          },
        },
      },
      { $unset: "recommendationFilterTags" },
    )
  }

  pipeline.push(
    {
      $lookup: {
        from: UserItem.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          { $match: { user: props.userId } },
          { $project: { _id: 0, status: 1, expiresAt: 1 } },
        ],
        as: "recommendationUserItems",
      },
    },
    {
      $match: {
        recommendationUserItems: {
          $not: {
            $elemMatch: {
              $or: [
                { status: EUserItemStatus.BLOCKED },
                {
                  status: EUserItemStatus.SKIPPED,
                  $or: [{ expiresAt: null }, { expiresAt: { $gt: props.now } }],
                },
              ],
            },
          },
        },
      },
    },
  )

  const library = props.library

  if (!isUndefined(library?.only)) {
    pipeline.push({
      $match: { "recommendationUserItems.status": { $in: library.only } },
    })
  } else if (!isUndefined(library?.include)) {
    const libraryStatuses = [
      EUserItemStatus.PLANNED,
      EUserItemStatus.IN_PROGRESS,
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.COMPLETED,
      EUserItemStatus.DROPPED,
    ]

    pipeline.push({
      $match: {
        $or: [
          { "recommendationUserItems.status": { $nin: libraryStatuses } },
          { "recommendationUserItems.status": { $in: library.include } },
        ],
      },
    })
  }

  if (!isUndefined(library?.exclude)) {
    pipeline.push({
      $match: { "recommendationUserItems.status": { $nin: library.exclude } },
    })
  }

  pipeline.push(
    {
      $lookup: {
        from: SourceItem.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          {
            $lookup: {
              from: BannedItem.name,
              localField: "source",
              foreignField: "source",
              let: { externalId: "$externalId" },
              pipeline: [
                { $match: { $expr: { $eq: ["$externalId", "$$externalId"] } } },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: "ban",
            },
          },
          { $match: { "ban.0": { $exists: true } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "recommendationBans",
      },
    },
    { $match: { "recommendationBans.0": { $exists: false } } },
    { $unset: "recommendationBans" },
  )

  return pipeline
}

export { createRecommendationEligibilityPipeline }
