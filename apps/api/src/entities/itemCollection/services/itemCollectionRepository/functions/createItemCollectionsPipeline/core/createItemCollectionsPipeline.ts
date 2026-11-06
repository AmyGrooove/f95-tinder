import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import type { PipelineStage } from "mongoose"

import { Item } from "@entities/item/schemas/item.schema"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { escapeRegex } from "@shared/functions/regex/escapeRegex"

import type { IReadItemCollectionsProps } from "../../../types/IReadItemCollectionsProps"

const createItemCollectionsPipeline = (
  props: IReadItemCollectionsProps,
): PipelineStage[] => {
  const {
    collectionId,
    groupId,
    groupIds,
    query,
    tags,
    excludeTags,
    fields,
    ratingMin,
    ratingMax,
    sort: sortMode,
    isGrouped,
    direction,
    language,
    page,
    limit,
  } = props

  const pipeline: PipelineStage[] = [
    {
      $match: {
        collectionId,
        groupId: isUndefined(groupId) ? { $in: groupIds } : groupId,
      },
    },
    {
      $lookup: {
        from: Item.name,
        localField: "item",
        foreignField: "_id",
        pipeline: [
          { $match: { deletedAt: null } },
          {
            $project: {
              _id: 1,
              type: 1,
              title: 1,
              aliases: 1,
              media: 1,
              releaseDate: 1,
              ageRestriction: {
                $convert: {
                  input: {
                    $cond: [
                      {
                        $eq: [
                          "$ageRestriction",
                          EAgeRestriction.AGE_18_PLUS_PLUS,
                        ],
                      },
                      EAgeRestriction.AGE_18,
                      "$ageRestriction",
                    ],
                  },
                  to: "int",
                  onError: null,
                  onNull: null,
                },
              },
              movie: 1,
              series: 1,
              game: 1,
            },
          },
        ],
        as: "itemDocument",
      },
    },
    { $unwind: "$itemDocument" },
  ]

  if (!isUndefined(query)) {
    const search = { $regex: escapeRegex(query), $options: "i" }

    pipeline.push({
      $match: {
        $or: [
          { [`itemDocument.title.${ELanguage.RUSSIAN}`]: search },
          { [`itemDocument.title.${ELanguage.ENGLISH}`]: search },
          { "itemDocument.aliases": search },
        ],
      },
    })
  }

  if (tags.length > 0 || excludeTags.length > 0) {
    pipeline.push(
      {
        $lookup: {
          from: TagItem.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            { $match: { tag: { $in: [...tags, ...excludeTags] } } },
            { $project: { _id: 0, tag: 1 } },
          ],
          as: "matchedTags",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $setIsSubset: [tags, "$matchedTags.tag"] },
              {
                $eq: [
                  {
                    $size: {
                      $setIntersection: [excludeTags, "$matchedTags.tag"],
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

  for (const field of fields) {
    const condition =
      field.valueType === EItemFieldValueType.NUMBER
        ? {
            $gte: field.min ?? -Number.MAX_VALUE,
            $lte: field.max ?? Number.MAX_VALUE,
          }
        : {
            ...(!isUndefined(field.min) ? { $gte: field.min } : {}),
            ...(!isUndefined(field.max) ? { $lte: field.max } : {}),
          }

    const fieldPath = `itemDocument.${field.field}`

    pipeline.push({
      $match: {
        [fieldPath]: condition,
        $expr:
          field.valueType === EItemFieldValueType.NUMBER
            ? { $isNumber: `$${fieldPath}` }
            : { $eq: [{ $type: `$${fieldPath}` }, "date"] },
      },
    })
  }

  if (!isUndefined(ratingMin) || !isUndefined(ratingMax)) {
    pipeline.push(
      {
        $lookup: {
          from: ItemStats.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                ratingAverage: {
                  $ne: null,
                  ...(!isUndefined(ratingMin) ? { $gte: ratingMin } : {}),
                  ...(!isUndefined(ratingMax) ? { $lte: ratingMax } : {}),
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: "matchedMetric",
        },
      },
      { $match: { "matchedMetric.0": { $exists: true } } },
    )
  }

  const sort: Record<string, 1 | -1> =
    sortMode === "collection"
      ? { groupOrder: 1, position: 1, _id: 1 }
      : {
          ...(isGrouped ? { groupOrder: 1 as const } : {}),
          ...(sortMode === "relevanceScore"
            ? {
                isRelevanceMissing: 1 as const,
                relevanceScore: direction,
              }
            : { sortTitle: direction }),
          _id: 1,
        }
  const languageTitle = `$itemDocument.title.${language}`
  const fallbackTitle = `$itemDocument.title.${language === ELanguage.RUSSIAN ? ELanguage.ENGLISH : ELanguage.RUSSIAN}`

  pipeline.push({
    $facet: {
      count: [{ $count: "total" }],
      items: [
        {
          $set: {
            groupOrder: { $indexOfArray: [groupIds, "$groupId"] },
            ...(sortMode === "relevanceScore"
              ? {
                  isRelevanceMissing: {
                    $eq: [{ $ifNull: ["$relevanceScore", null] }, null],
                  },
                }
              : {}),
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
        { $skip: (page - 1) * limit },
        { $limit: limit },
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
          },
        },
      ],
    },
  })

  return pipeline
}

export { createItemCollectionsPipeline }
