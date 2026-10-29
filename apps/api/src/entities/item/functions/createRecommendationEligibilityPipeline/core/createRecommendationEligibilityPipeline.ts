import type { PipelineStage } from "mongoose"

import { ItemBan } from "@entities/itemBan/schemas/itemBan.schema"
import { ItemCollection } from "@entities/itemCollection/schemas/itemCollection.schema"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { createItemFilterPipeline } from "../../createItemFilterPipeline"
import type { IReadRecommendationsProps } from "../../../types/IReadRecommendationsProps"

const createRecommendationEligibilityPipeline = (
  props: IReadRecommendationsProps,
): PipelineStage[] => {
  const filter = props.filter
  const pipeline: PipelineStage[] = [
    ...createItemFilterPipeline(props),
    { $project: { _id: 1, type: 1, title: 1, media: 1 } },
  ]

  if (!isUndefined(filter?.collectionId)) {
    pipeline.push(
      {
        $lookup: {
          from: ItemCollection.name,
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
      $set: {
        isRecommendationExcluded: {
          $anyElementTrue: [
            {
              $map: {
                input: "$recommendationUserItems",
                as: "entry",
                in: {
                  $or: [
                    { $eq: ["$$entry.status", EUserItemStatus.BLOCKED] },
                    {
                      $and: [
                        { $eq: ["$$entry.status", EUserItemStatus.SKIPPED] },
                        {
                          $or: [
                            {
                              $eq: [
                                { $ifNull: ["$$entry.expiresAt", null] },
                                null,
                              ],
                            },
                            { $gt: ["$$entry.expiresAt", props.now] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  )

  if (props.isIncludingExcluded !== true) {
    pipeline.push({ $match: { isRecommendationExcluded: false } })
  }

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
        from: ItemBan.name,
        localField: "_id",
        foreignField: "item",
        pipeline: [
          {
            $match: {
              $or: [
                { countries: { $size: 0 } },
                { countries: props.country ?? ECountry.UNKNOWN },
              ],
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "recommendationBans",
      },
    },
    {
      $set: {
        isRecommendationExcluded: {
          $or: [
            "$isRecommendationExcluded",
            { $gt: [{ $size: "$recommendationBans" }, 0] },
          ],
        },
      },
    },
    { $unset: "recommendationBans" },
  )

  if (props.isIncludingExcluded !== true) {
    pipeline.push({ $match: { isRecommendationExcluded: false } })
  }

  return pipeline
}

export { createRecommendationEligibilityPipeline }
