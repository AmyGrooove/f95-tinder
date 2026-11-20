import type { PipelineStage } from "mongoose"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"

const createSearchIndexTagsLookup = (): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: TagItem.name,
      localField: "_id",
      foreignField: "item",
      pipeline: AggregationBuilder.forLookup()
        .use({
          $lookup: {
            from: Tag.name,
            localField: "tag",
            foreignField: "_id",
            pipeline: AggregationBuilder.forLookup()
              .project({ _id: 1, group: 1, key: 1 })
              .build(),
            as: "existingTag",
          },
        })
        .match({ "existingTag.0": { $exists: true } })
        .project({
          tag: 1,
          group: { $first: "$existingTag.group" },
          key: { $first: "$existingTag.key" },
        })
        .build(),
      as: "searchTags",
    },
  }
}

export { createSearchIndexTagsLookup }
