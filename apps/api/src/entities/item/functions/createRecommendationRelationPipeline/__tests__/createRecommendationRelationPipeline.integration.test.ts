import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { getTestDatabase } from "@test/setup/setupDatabase"

import { createRecommendationRelationPipeline } from "../core/createRecommendationRelationPipeline"

describe("createRecommendationRelationPipeline", () => {
  it("возвращает нулевой бонус без связей и удаляет служебные поля", async () => {
    const collection = getTestDatabase().connection.collection("Item")
    await collection.insertOne({})
    const result = await collection
      .aggregate(createRecommendationRelationPipeline(new Types.ObjectId()))
      .toArray()
    expect(result[0].relationBoost).toBe(0)
    expect(result[0]).not.toHaveProperty("recommendationRelations_first")
    expect(result[0]).not.toHaveProperty("recommendationRelations_second")
  })

  it.each([true, false])(
    "использует роль кандидата с обеих сторон связи: %s",
    async (isFirst) => {
      const { connection } = getTestDatabase()
      const candidate = new Types.ObjectId()
      const source = new Types.ObjectId()
      const user = new Types.ObjectId()
      const role = new Types.ObjectId()
      const sourceRole = new Types.ObjectId()
      await connection
        .collection("Item")
        .insertMany([{ _id: candidate }, { _id: source }])
      await connection.collection("ItemRelationRole").insertMany([
        { _id: role, bonusMultiplier: 2 },
        { _id: sourceRole, bonusMultiplier: 10 },
      ])
      const sides = [
        { item: candidate, role },
        { item: source, role: sourceRole },
      ]
      await connection.collection("Relation").insertOne({
        first: sides[isFirst ? 0 : 1],
        second: sides[isFirst ? 1 : 0],
      })
      await connection.collection("UserItem").insertOne({
        user,
        item: source,
        status: EUserItemStatus.COMPLETED,
        rating: 8,
        isFavorite: false,
      })
      const result = await connection
        .collection("Item")
        .aggregate([
          { $match: { _id: candidate } },
          ...createRecommendationRelationPipeline(user),
        ])
        .toArray()
      expect(result[0].relationBoost).toBe(0.5)
      await connection
        .collection("UserItem")
        .updateOne({ user }, { $set: { status: EUserItemStatus.SKIPPED } })
      const skipped = await connection
        .collection("Item")
        .aggregate([
          { $match: { _id: candidate } },
          ...createRecommendationRelationPipeline(user),
        ])
        .toArray()
      expect(skipped[0].relationBoost).toBe(0)
    },
  )
})
