import type { PipelineStage } from "mongoose"

import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"

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
        from: TagItem.name,
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
                { $project: { _id: 0, weightModifier: 1, parents: 1 } },
              ],
              as: "tagDocument",
            },
          },
          { $unwind: "$tagDocument" },
          {
            $graphLookup: {
              from: Tag.name,
              startWith: "$tagDocument.parents",
              connectFromField: "parents",
              connectToField: "_id",
              as: "parentTags",
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
              ancestors: "$parentTags._id",
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
