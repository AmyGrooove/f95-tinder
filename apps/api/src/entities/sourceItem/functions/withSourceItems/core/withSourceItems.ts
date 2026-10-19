import type { PipelineStage, Types } from "mongoose"

import { SourceItem } from "../../../schemas/sourceItem.schema"

const withSourceItems = (sourceId: Types.ObjectId): PipelineStage[] => {
  return [
    {
      $lookup: {
        from: SourceItem.name,
        let: { itemId: "$_id" },
        pipeline: [
          {
            $match: {
              source: sourceId,
              $expr: { $eq: ["$item", "$$itemId"] },
            },
          },
          { $project: { externalId: 1 } },
        ],
        as: "sourceItems",
      },
    },
    { $match: { "sourceItems.0": { $exists: true } } },
  ]
}

export { withSourceItems }
