import type { PipelineStage } from "mongoose"

import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"
import { TagRelation } from "@entities/tagRelation/schemas/tagRelation.schema"
import { ETagRelationType } from "@entities/tagRelation/schemas/ETagRelationType"

import { EItemType } from "../../../schemas/EItemType"
import type { IReadRecommendationsProps } from "../../../types/IReadRecommendationsProps"

const createRecommendationTastePipeline = (
  preferences: IReadRecommendationsProps["preferences"],
): PipelineStage[] => {
  const knownPreferences = preferences
    .filter(
      (preference) => preference.count > 0 || preference.explicitWeight !== 0,
    )
    .map((preference) => ({
      tag: preference.tag,
      value:
        preference.explicitWeight !== 0
          ? preference.explicitWeight
          : (preference.weight * preference.count) / (preference.count + 5),
    }))

  if (knownPreferences.length === 0) {
    return [{ $set: { tasteScore: 0 } }]
  }

  const groupsByType = Object.values(EItemType).map((type) => ({
    case: { $eq: ["$$candidateType", type] },
    then: Object.values(ETagGroup).filter((group) => {
      const rule = TAG_GROUP_RULES[group]
      const itemTypes: readonly EItemType[] = rule.itemTypes

      return rule.isUsedForTaste && itemTypes.includes(type)
    }),
  }))

  return [
    {
      $lookup: {
        from: ItemTag.name,
        localField: "_id",
        foreignField: "item",
        let: { candidateType: "$type" },
        pipeline: [
          {
            $match: {
              tag: {
                $in: knownPreferences.map((preference) => preference.tag),
              },
              relevanceScore: { $gt: 0 },
            },
          },
          {
            $lookup: {
              from: Tag.name,
              localField: "tag",
              foreignField: "_id",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: [
                        "$group",
                        { $switch: { branches: groupsByType, default: [] } },
                      ],
                    },
                  },
                },
                { $project: { _id: 0, weightModifier: 1 } },
              ],
              as: "tagDocument",
            },
          },
          { $unwind: "$tagDocument" },
          {
            $graphLookup: {
              from: TagRelation.name,
              startWith: "$tag",
              connectFromField: "second",
              connectToField: "first",
              restrictSearchWithMatch: { type: ETagRelationType.PARENT },
              as: "parentRelations",
            },
          },
          {
            $set: {
              preference: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $literal: knownPreferences },
                      as: "preference",
                      cond: { $eq: ["$$preference.tag", "$tag"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
              tag: 1,
              ancestors: "$parentRelations.second",
              significance: { $ifNull: ["$tagDocument.weightModifier", 1] },
              contribution: {
                $multiply: [
                  "$preference.value",
                  "$relevanceScore",
                  { $ifNull: ["$tagDocument.weightModifier", 1] },
                ],
              },
            },
          },
        ],
        as: "recommendationTasteTags",
      },
    },
    {
      $set: {
        recommendationAncestorTags: {
          $reduce: {
            input: "$recommendationTasteTags",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this.ancestors"] },
          },
        },
      },
    },
    {
      $set: {
        recommendationTasteTags: {
          $filter: {
            input: "$recommendationTasteTags",
            as: "tag",
            cond: {
              $not: [{ $in: ["$$tag.tag", "$recommendationAncestorTags"] }],
            },
          },
        },
      },
    },
    {
      $set: {
        tasteScore: {
          $cond: [
            { $gt: [{ $sum: "$recommendationTasteTags.significance" }, 0] },
            {
              $divide: [
                { $sum: "$recommendationTasteTags.contribution" },
                { $sum: "$recommendationTasteTags.significance" },
              ],
            },
            0,
          ],
        },
      },
    },
    { $unset: ["recommendationTasteTags", "recommendationAncestorTags"] },
  ]
}

export { createRecommendationTastePipeline }
