import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { getTestDatabase } from "@test/setup/setupDatabase"

import type { IReadRecommendationsProps } from "../../../types/IReadRecommendationsProps"

import { createRecommendationPipeline } from "../core/createRecommendationPipeline"

describe("createRecommendationPipeline", () => {
  it.each(["asc", "desc"] as const)(
    "ранжирует до пагинации, разрешает равенство рейтингом и считает total: %s",
    async (direction) => {
      const { connection } = getTestDatabase()
      const userId = new Types.ObjectId()
      const ids = Array.from({ length: 11 }, () => new Types.ObjectId())
      await connection
        .collection("Item")
        .insertMany(
          ids.map((_id) => ({ _id, title: { ru: "Название" }, media: [] })),
        )
      await connection.collection("ItemStats").insertMany([
        { item: ids[0], ratingAverage: 9, ratingsCount: 20 },
        { item: ids[1], ratingAverage: 7, ratingsCount: 20 },
      ])
      await connection.collection("UserItem").insertOne({
        user: userId,
        item: ids[2],
        status: EUserItemStatus.PLANNED,
      })
      const props: IReadRecommendationsProps = {
        userId,
        now: new Date(),
        preferences: [],
        siteRatingAverage: 5,
        page: 1,
        limit: 10,
        direction,
      }
      const [result] = await connection
        .collection("Item")
        .aggregate(createRecommendationPipeline(props))
        .toArray()
      expect(result.count).toEqual([{ total: 11 }])
      expect(
        result.items.map(({ _id }: { _id: Types.ObjectId }) => _id),
      ).toEqual(
        direction === "desc"
          ? [ids[2], ids[0], ids[1], ...ids.slice(3, 10)]
          : [ids[0], ids[1], ...ids.slice(3)],
      )
      const planned = direction === "desc" ? result.items[0] : undefined
      if (planned !== undefined) {
        expect(planned.finalScore).toBe(1.2)
        expect(planned.baseScore).toBe(1)
      }
      const [emptyPage] = await connection
        .collection("Item")
        .aggregate(createRecommendationPipeline({ ...props, page: 3 }))
        .toArray()
      expect(emptyPage).toEqual({ items: [], count: [{ total: 11 }] })
    },
  )

  it("фильтрует по исходной оценке, исключая отсутствующий рейтинг", async () => {
    const { connection } = getTestDatabase()
    const ids = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ]
    await connection.collection("Item").insertMany(ids.map((_id) => ({ _id })))
    await connection.collection("ItemStats").insertMany([
      { item: ids[0], ratingAverage: 8, ratingsCount: 1 },
      { item: ids[1], ratingAverage: 7, ratingsCount: 100 },
    ])
    const [result] = await connection
      .collection("Item")
      .aggregate(
        createRecommendationPipeline({
          userId: new Types.ObjectId(),
          now: new Date(),
          preferences: [],
          siteRatingAverage: 5,
          page: 1,
          limit: 20,
          filter: { ratingMin: 8, ratingMax: 8 },
        }),
      )
      .toArray()
    expect(result.count).toEqual([{ total: 1 }])
    expect(result.items[0]._id).toEqual(ids[0])
    expect(result.items[0].ratingScore).toBeCloseTo(108 / 21, 12)
  })
})
