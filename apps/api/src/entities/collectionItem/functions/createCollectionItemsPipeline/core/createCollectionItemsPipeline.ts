import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import type { PipelineStage } from "mongoose"

import { Item } from "@entities/item/schemas/item.schema"
import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { ItemMetric } from "@entities/itemMetric/schemas/itemMetric.schema"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
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

  if (!isUndefined(props.query)) {
    const search = { $regex: escapeRegex(props.query), $options: "i" }

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

  for (const field of props.fields) {
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

  if (!isUndefined(props.ratingMin) || !isUndefined(props.ratingMax)) {
    pipeline.push(
      {
        $lookup: {
          from: ItemMetric.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                ratingAverage: {
                  $ne: null,
                  ...(!isUndefined(props.ratingMin)
                    ? { $gte: props.ratingMin }
                    : {}),
                  ...(!isUndefined(props.ratingMax)
                    ? { $lte: props.ratingMax }
                    : {}),
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
    props.sort === "collection"
      ? { groupOrder: 1, position: 1, _id: 1 }
      : {
          ...(props.isGrouped ? { groupOrder: 1 as const } : {}),
          ...(props.sort === "relevanceScore"
            ? {
                isRelevanceMissing: 1 as const,
                relevanceScore: props.direction,
              }
            : { sortTitle: props.direction }),
          _id: 1,
        }
  const languageTitle = `$itemDocument.title.${props.language}`
  const fallbackTitle = `$itemDocument.title.${props.language === ELanguage.RUSSIAN ? ELanguage.ENGLISH : ELanguage.RUSSIAN}`

  pipeline.push({
    $facet: {
      count: [{ $count: "total" }],
      items: [
        {
          $set: {
            groupOrder: { $indexOfArray: [props.groupIds, "$groupId"] },
            ...(props.sort === "relevanceScore"
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
          },
        },
      ],
    },
  })

  return pipeline
}

export { createCollectionItemsPipeline }
