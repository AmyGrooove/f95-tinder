import type { PipelineStage } from "mongoose"

import { ItemFeature } from "../../../schemas/itemFeature.schema"
import type { IMatchItemFeatureProps } from "../types/IMatchItemFeatureProps"

const matchItemFeature = ({
  featureId,
  value,
}: IMatchItemFeatureProps): PipelineStage[] => {
  return [
    {
      $lookup: {
        from: ItemFeature.name,
        let: { itemId: "$_id" },
        pipeline: [
          {
            $match: {
              feature: featureId,
              value,
              $expr: { $eq: ["$item", "$$itemId"] },
            },
          },
        ],
        as: "matchedItemFeatures",
      },
    },
    { $match: { "matchedItemFeatures.0": { $exists: true } } },
  ]
}

export { matchItemFeature }
