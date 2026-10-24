import type { PipelineStage } from "mongoose"

import { Item } from "@entities/item/schemas/item.schema"
import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { ItemFeature } from "@entities/itemFeature/schemas/itemFeature.schema"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { escapeRegex } from "@shared/functions/regex/escapeRegex"

import type { IReadCollectionItemsProps } from "../../../types/IReadCollectionItemsProps"

const createCollectionItemsPipeline = (
  props: IReadCollectionItemsProps,
): PipelineStage[] => {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        collectionId: props.collectionId,
        groupId: isUndefined(props.groupId)
          ? { $in: props.groupIds }
          : props.groupId,
      },
    },
    {
      $lookup: {
        from: Item.name,
        localField: "item",
        foreignField: "_id",
        pipeline: [
          { $match: { deletedAt: null } },
          { $project: { _id: 1, type: 1, title: 1, aliases: 1, media: 1 } },
        ],
        as: "itemDocument",
      },
    },
    { $unwind: "$itemDocument" },
  ]

  if (!isUndefined(props.query)) {
    const search = { $regex: escapeRegex(props.query), $options: "i" }

    pipeline.push({
      $match: {
        $or: [
          { "itemDocument.title.ru": search },
          { "itemDocument.title.en": search },
          { "itemDocument.aliases": search },
        ],
      },
    })
  }

  if (props.tags.length > 0 || props.excludeTags.length > 0) {
    pipeline.push(
      {
        $lookup: {
          from: ItemTag.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            { $match: { tag: { $in: [...props.tags, ...props.excludeTags] } } },
            { $project: { _id: 0, tag: 1 } },
          ],
          as: "matchedTags",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $setIsSubset: [props.tags, "$matchedTags.tag"] },
              {
                $eq: [
                  {
                    $size: {
                      $setIntersection: [props.excludeTags, "$matchedTags.tag"],
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
    )
  }

  for (const feature of props.features) {
    const value =
      feature.valueType === EFeatureValueType.BOOLEAN
        ? { $in: feature.values }
        : {
            ...(!isUndefined(feature.min) ? { $gte: feature.min } : {}),
            ...(!isUndefined(feature.max) ? { $lte: feature.max } : {}),
          }
    const typeCheck =
      feature.valueType === EFeatureValueType.NUMBER
        ? {
            $and: [
              { $isNumber: "$value" },
              { $gte: ["$value", -Number.MAX_VALUE] },
              { $lte: ["$value", Number.MAX_VALUE] },
            ],
          }
        : {
            $eq: [
              { $type: "$value" },
              feature.valueType === EFeatureValueType.DATE ? "date" : "bool",
            ],
          }

    pipeline.push(
      {
        $lookup: {
          from: ItemFeature.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            { $match: { feature: feature.featureId, value, $expr: typeCheck } },
            { $project: { _id: 1 } },
            { $limit: 1 },
          ],
          as: "matchedFeature",
        },
      },
      { $match: { "matchedFeature.0": { $exists: true } } },
    )
  }

  if (!isUndefined(props.userId)) {
    pipeline.push(
      {
        $lookup: {
          from: UserItem.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            { $match: { user: props.userId } },
            {
              $project: {
                _id: 1,
                status: 1,
                rating: 1,
                isFavorite: 1,
                currentAttempt: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$attempts",
                            as: "attempt",
                            cond: {
                              $in: [
                                "$$attempt.status",
                                [
                                  EUserItemStatus.IN_PROGRESS,
                                  EUserItemStatus.ON_HOLD,
                                ],
                              ],
                            },
                          },
                        },
                        0,
                      ],
                    },
                    null,
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                rating: 1,
                isFavorite: 1,
                "currentAttempt.id": 1,
                "currentAttempt.status": 1,
                "currentAttempt.progress": 1,
                "currentAttempt.unit": 1,
                "currentAttempt.startedAt": 1,
              },
            },
          ],
          as: "userItemDocument",
        },
      },
      {
        $set: {
          userItem: {
            $ifNull: [{ $arrayElemAt: ["$userItemDocument", 0] }, null],
          },
        },
      },
    )

    if (!isUndefined(props.isInLibrary)) {
      pipeline.push({
        $match: { "userItem._id": { $exists: props.isInLibrary } },
      })
    }

    if (!isUndefined(props.statuses)) {
      pipeline.push({ $match: { "userItem.status": { $in: props.statuses } } })
    }

    if (!isUndefined(props.isFavorite)) {
      pipeline.push({ $match: { "userItem.isFavorite": props.isFavorite } })
    }

    if (!isUndefined(props.ratingMin) || !isUndefined(props.ratingMax)) {
      pipeline.push({
        $match: {
          "userItem.rating": {
            $ne: null,
            ...(!isUndefined(props.ratingMin) ? { $gte: props.ratingMin } : {}),
            ...(!isUndefined(props.ratingMax) ? { $lte: props.ratingMax } : {}),
          },
        },
      })
    }
  }

  const sort: Record<string, 1 | -1> =
    props.sort === "collection"
      ? { groupOrder: 1, position: 1, _id: 1 }
      : props.isGrouped
        ? { groupOrder: 1, sortTitle: props.direction, _id: 1 }
        : { sortTitle: props.direction, _id: 1 }
  const languageTitle = `$itemDocument.title.${props.language}`
  const fallbackTitle = `$itemDocument.title.${props.language === "ru" ? "en" : "ru"}`

  pipeline.push({
    $facet: {
      count: [{ $count: "total" }],
      items: [
        {
          $set: {
            groupOrder: { $indexOfArray: [props.groupIds, "$groupId"] },
            sortTitle: {
              $cond: [
                {
                  $gt: [
                    {
                      $strLenCP: {
                        $trim: { input: { $ifNull: [languageTitle, ""] } },
                      },
                    },
                    0,
                  ],
                },
                languageTitle,
                fallbackTitle,
              ],
            },
          },
        },
        { $sort: sort },
        { $skip: (props.page - 1) * props.limit },
        { $limit: props.limit },
        {
          $project: {
            _id: 0,
            groupId: 1,
            position: 1,
            note: 1,
            item: {
              _id: "$itemDocument._id",
              type: "$itemDocument.type",
              title: "$itemDocument.title",
              media: "$itemDocument.media",
            },
            ...(!isUndefined(props.userId) ? { userItem: 1 } : {}),
          },
        },
      ],
    },
  })

  return pipeline
}

export { createCollectionItemsPipeline }
