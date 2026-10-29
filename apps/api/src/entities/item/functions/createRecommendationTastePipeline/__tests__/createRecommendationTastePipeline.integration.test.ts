import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { getTestDatabase } from "@test/setup/setupDatabase"

import { EItemType } from "../../../schemas/EItemType"
import { createRecommendationTastePipeline } from "../core/createRecommendationTastePipeline"

describe("createRecommendationTastePipeline", () => {
  it.each([
    { preferences: [] },
    {
      preferences: [
        { tag: new Types.ObjectId(), count: 0, weight: 1, explicitWeight: 0 },
      ],
    },
  ])(
    "возвращает нейтральный вкус без известных предпочтений: %j",
    async ({ preferences }) => {
      const collection = getTestDatabase().connection.collection("Item")
      await collection.insertOne({ type: EItemType.GAME })
      const result = await collection
        .aggregate(createRecommendationTastePipeline(preferences))
        .toArray()
      expect(result[0].tasteScore).toBe(0)
    },
  )

  it("применяет уверенность к вычисленному весу и усредняет вклад с ручным весом", async () => {
    const { connection } = getTestDatabase()
    const item = new Types.ObjectId()
    const tags = [new Types.ObjectId(), new Types.ObjectId()]
    await connection
      .collection("Item")
      .insertOne({ _id: item, type: EItemType.GAME })
    await connection.collection("Tag").insertMany([
      { _id: tags[0], group: ETagGroup.GENRE, weightModifier: 2, parents: [] },
      { _id: tags[1], group: ETagGroup.STYLE, weightModifier: 1, parents: [] },
    ])
    await connection.collection("TagItem").insertMany([
      { item, tag: tags[0], relevanceScore: 0.5 },
      { item, tag: tags[1], relevanceScore: 1 },
    ])
    const result = await connection
      .collection("Item")
      .aggregate(
        createRecommendationTastePipeline([
          { tag: tags[0], count: 5, weight: 1, explicitWeight: 0 },
          { tag: tags[1], count: 0, weight: 1, explicitWeight: -1 },
        ]),
      )
      .toArray()
    expect(result[0].tasteScore).toBeCloseTo(-1 / 6, 12)
    expect(result[0]).not.toHaveProperty("recommendationTasteTags")
    expect(result[0]).not.toHaveProperty("recommendationAncestorTags")
  })

  it("подавляет известного предка, игнорирует неподходящую группу и нулевую выраженность", async () => {
    const { connection } = getTestDatabase()
    const item = new Types.ObjectId()
    const tags = Array.from({ length: 4 }, () => new Types.ObjectId())
    await connection
      .collection("Item")
      .insertOne({ _id: item, type: EItemType.MOVIE })
    await connection.collection("Tag").insertMany(
      tags.map((_id, index) => ({
        _id,
        group: index === 2 ? ETagGroup.GAME_MECHANIC : ETagGroup.GENRE,
        parents: index === 1 ? [tags[0]] : [],
      })),
    )
    await connection.collection("TagItem").insertMany(
      tags.map((tag, index) => ({
        item,
        tag,
        relevanceScore: index === 3 ? 0 : 1,
      })),
    )
    const result = await connection
      .collection("Item")
      .aggregate(
        createRecommendationTastePipeline(
          tags.map((tag, index) => ({
            tag,
            count: 0,
            weight: 0,
            explicitWeight: index === 1 ? -0.5 : 1,
          })),
        ),
      )
      .toArray()
    expect(result[0].tasteScore).toBe(-0.5)
  })
})
