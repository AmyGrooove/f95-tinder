import type { PipelineStage } from "mongoose"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { createBriefUserItemProgress } from "@entities/userItem/functions/createBriefUserItemProgress"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createCollectionViewerItemLookup = (
  userId: UserItem["user"],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: UserItem.name,
      localField: "item._id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({ user: userId })
        .project({
          _id: 0,
          status: 1,
          rating: 1,
          progress: {
            $let: {
              vars: { attempt: { $arrayElemAt: ["$attempts", -1] } },
              in: createBriefUserItemProgress("$$attempt"),
            },
          },
        })
        .build(),
      as: "viewerItem",
    },
  }
}

export { createCollectionViewerItemLookup }
