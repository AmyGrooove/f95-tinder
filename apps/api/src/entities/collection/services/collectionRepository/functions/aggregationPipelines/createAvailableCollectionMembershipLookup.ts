import type { PipelineStage } from "mongoose"
import { ItemCollection } from "@entities/itemCollection/schemas/itemCollection.schema"
import { Item } from "@entities/item/schemas/item.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { ECollectionBlockType } from "../../../../schemas/ECollectionBlockType"

const createAvailableCollectionMembershipLookup = (): PipelineStage.Lookup => {
  return {
    $lookup: {
      from: ItemCollection.name,
      localField: "_id",
      foreignField: "collectionId",
      let: {
        groupIds: {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: ["$blocks", []] },
                cond: {
                  $eq: ["$$this.type", ECollectionBlockType.GROUP],
                },
              },
            },
            in: "$$this.id",
          },
        },
      },
      pipeline: AggregationBuilder.forLookup()
        .match({ $expr: { $in: ["$groupId", "$$groupIds"] } })
        .use({
          $lookup: {
            from: Item.name,
            localField: "item",
            foreignField: "_id",
            pipeline: AggregationBuilder.forLookup()
              .match({ deletedAt: null })
              .project({ _id: 1 })
              .build(),
            as: "availableItem",
          },
        })
        .match({ "availableItem.0": { $exists: true } })
        .limit(1)
        .project({ _id: 1 })
        .build(),
      as: "availableMembership",
    },
  }
}

export { createAvailableCollectionMembershipLookup }
