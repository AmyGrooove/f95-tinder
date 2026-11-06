import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { ELanguage } from "@entities/shared/schemas/ELanguage"

import { createItemCollectionsPipeline } from ".."

describe("createItemCollectionsPipeline", () => {
  it("ограничивает выбранную группу и считает результат до применения пагинации", () => {
    const collectionId = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const pipeline = createItemCollectionsPipeline({
      collectionId,
      groupId,
      groupIds: [new Types.ObjectId(), groupId],
      isGrouped: true,
      sort: "collection",
      direction: -1,
      language: ELanguage.RUSSIAN,
      page: 3,
      limit: 10,
      tags: [],
      excludeTags: [],
      fields: [],
    })

    expect(pipeline[0]).toEqual({ $match: { collectionId, groupId } })
    const facet = pipeline.at(-1)
    expect(facet).toHaveProperty("$facet.count", [{ $count: "total" }])
    expect(facet).toHaveProperty("$facet.items.1", {
      $sort: { groupOrder: 1, position: 1, _id: 1 },
    })
    expect(facet).toHaveProperty("$facet.items.2", { $skip: 20 })
    expect(facet).toHaveProperty("$facet.items.3", { $limit: 10 })
  })
})
