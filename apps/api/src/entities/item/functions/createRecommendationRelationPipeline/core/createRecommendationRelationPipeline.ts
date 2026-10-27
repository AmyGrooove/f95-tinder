import type { PipelineStage, Types } from "mongoose"

import { ItemRelationRole } from "@entities/itemRelationRole/schemas/itemRelationRole.schema"
import { Relation } from "@entities/relation/schemas/relation.schema"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

import { Item } from "../../../schemas/item.schema"

const createRecommendationRelationPipeline = (
  userId: Types.ObjectId,
): PipelineStage[] => {
  const relationLookups: PipelineStage[] = ["first", "second"].map(
    (candidateSide) => {
      const sourceSide = candidateSide === "first" ? "second" : "first"

      return {
        $lookup: {
          from: Relation.name,
          localField: "_id",
          foreignField: `${candidateSide}.item`,
          let: { candidateId: "$_id" },
          pipeline: [
            {
              $project: {
                sourceId: `$${sourceSide}.item`,
                candidateRole: `$${candidateSide}.role`,
              },
            },
            { $match: { $expr: { $ne: ["$sourceId", "$$candidateId"] } } },
            {
              $lookup: {
                from: Item.name,
                localField: "sourceId",
                foreignField: "_id",
                pipeline: [
                  { $match: { deletedAt: null } },
                  { $project: { _id: 1 } },
                ],
                as: "sourceItem",
              },
            },
            { $match: { "sourceItem.0": { $exists: true } } },
            {
              $lookup: {
                from: UserItem.name,
                localField: "sourceId",
                foreignField: "item",
                pipeline: [
                  {
                    $match: {
                      user: userId,
                      status: { $ne: EUserItemStatus.SKIPPED },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      sympathy: {
                        $switch: {
                          branches: [
                            {
                              case: {
                                $and: [
                                  { $ne: ["$rating", null] },
                                  { $lte: ["$rating", 4] },
                                ],
                              },
                              then: 0,
                            },
                            {
                              case: { $gte: ["$rating", 7] },
                              then: {
                                $cond: [
                                  "$isFavorite",
                                  {
                                    $add: [
                                      0.8,
                                      {
                                        $multiply: [
                                          0.05,
                                          { $subtract: ["$rating", 6] },
                                        ],
                                      },
                                    ],
                                  },
                                  {
                                    $divide: [{ $subtract: ["$rating", 6] }, 4],
                                  },
                                ],
                              },
                            },
                          ],
                          default: { $cond: ["$isFavorite", 0.8, 0] },
                        },
                      },
                    },
                  },
                  { $match: { sympathy: { $gt: 0 } } },
                ],
                as: "reaction",
              },
            },
            { $unwind: "$reaction" },
            {
              $lookup: {
                from: ItemRelationRole.name,
                localField: "candidateRole",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 0, bonusMultiplier: 1 } }],
                as: "role",
              },
            },
            { $unwind: "$role" },
            {
              $project: {
                _id: 0,
                boost: {
                  $multiply: [
                    {
                      $subtract: [{ $ifNull: ["$role.bonusMultiplier", 1] }, 1],
                    },
                    "$reaction.sympathy",
                  ],
                },
              },
            },
            { $sort: { boost: -1 } },
            { $limit: 1 },
          ],
          as: `recommendationRelations_${candidateSide}`,
        },
      }
    },
  )

  return [
    ...relationLookups,
    {
      $set: {
        relationBoost: {
          $max: [
            {
              $ifNull: [
                { $arrayElemAt: ["$recommendationRelations_first.boost", 0] },
                0,
              ],
            },
            {
              $ifNull: [
                { $arrayElemAt: ["$recommendationRelations_second.boost", 0] },
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $unset: [
        "recommendationRelations_first",
        "recommendationRelations_second",
      ],
    },
  ]
}

export { createRecommendationRelationPipeline }
