import type { PipelineStage, Types } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createRecommendationFilterTagsLookup = (
  tagIds: readonly Types.ObjectId[],
): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: TagItem.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({ tag: { $in: tagIds } })
        .use({
          $lookup: {
            from: Tag.name,
            localField: "tag",
            foreignField: "_id",
            pipeline: AggregationBuilder.forLookup()
              .project({ _id: 1 })
              .build(),
            as: "existingTag",
          },
        })
        .match({ "existingTag.0": { $exists: true } })
        .project({ _id: 0, tag: 1 })
        .build(),
      as: "filterTags",
    },
  }
}

export { createRecommendationFilterTagsLookup }
