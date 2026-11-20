import type { PipelineStage } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import type { ICheckTagItemKeysProps } from "../../types/ICheckTagItemKeysProps"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createMatchedTagKeysLookup = (
  group: ICheckTagItemKeysProps["group"],
  keys: ICheckTagItemKeysProps["keys"],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: Tag.name,
      localField: "tag",
      foreignField: "_id",
      pipeline: AggregationBuilder.forLookup()
        .match({ group, key: { $in: keys } })
        .project({ _id: 1 })
        .build(),
      as: "matchedTag",
    },
  }
}

export { createMatchedTagKeysLookup }
