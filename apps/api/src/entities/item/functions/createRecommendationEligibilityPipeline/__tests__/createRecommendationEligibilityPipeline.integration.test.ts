import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { getTestDatabase } from "@test/setup/setupDatabase"

import { createRecommendationEligibilityPipeline } from "../core/createRecommendationEligibilityPipeline"

describe("createRecommendationEligibilityPipeline", () => {
  it.each([false, true])(
    "учитывает блокировку и границу истечения пропуска при включении исключённых: %s",
    async (isIncludingExcluded) => {
      const { connection } = getTestDatabase()
      const userId = new Types.ObjectId()
      const now = new Date("2026-01-01")
      const ids = Array.from({ length: 5 }, () => new Types.ObjectId())
      await connection
        .collection("Item")
        .insertMany(ids.map((_id) => ({ _id })))
      await connection.collection("UserItem").insertMany([
        { user: userId, item: ids[0], status: EUserItemStatus.BLOCKED },
        {
          user: userId,
          item: ids[1],
          status: EUserItemStatus.SKIPPED,
          expiresAt: new Date(now.getTime() + 1),
        },
        {
          user: userId,
          item: ids[2],
          status: EUserItemStatus.SKIPPED,
          expiresAt: now,
        },
        { user: userId, item: ids[3], status: EUserItemStatus.SKIPPED },
        {
          user: new Types.ObjectId(),
          item: ids[4],
          status: EUserItemStatus.BLOCKED,
        },
      ])
      const result = await connection
        .collection("Item")
        .aggregate(
          createRecommendationEligibilityPipeline({
            userId,
            now,
            preferences: [],
            siteRatingAverage: null,
            page: 1,
            limit: 20,
            isIncludingExcluded,
          }),
        )
        .toArray()
      expect(result.map(({ _id }) => String(_id)).sort()).toEqual(
        (isIncludingExcluded ? ids : [ids[2], ids[4]]).map(String).sort(),
      )
      if (isIncludingExcluded) {
        expect(
          result
            .filter(
              ({ isRecommendationExcluded }) =>
                isRecommendationExcluded === true,
            )
            .map(({ _id }) => String(_id))
            .sort(),
        ).toEqual([ids[0], ids[1], ids[3]].map(String).sort())
      }
    },
  )

  it.each(["only", "include", "exclude"] as const)(
    "применяет пустой список библиотеки %s",
    async (mode) => {
      const { connection } = getTestDatabase()
      const userId = new Types.ObjectId()
      const outsider = new Types.ObjectId()
      const planned = new Types.ObjectId()
      await connection
        .collection("Item")
        .insertMany([{ _id: outsider }, { _id: planned }])
      await connection.collection("UserItem").insertOne({
        user: userId,
        item: planned,
        status: EUserItemStatus.PLANNED,
      })
      const result = await connection
        .collection("Item")
        .aggregate(
          createRecommendationEligibilityPipeline({
            userId,
            now: new Date(),
            preferences: [],
            siteRatingAverage: null,
            page: 1,
            limit: 20,
            library: { [mode]: [] },
          }),
        )
        .toArray()
      expect(result.map(({ _id }) => String(_id)).sort()).toEqual(
        (mode === "only"
          ? []
          : mode === "include"
            ? [outsider]
            : [outsider, planned]
        )
          .map(String)
          .sort(),
      )
    },
  )

  it("сопоставляет глобальный запрет по ID произведения", async () => {
    const { connection } = getTestDatabase()
    const banned = new Types.ObjectId()
    const allowed = new Types.ObjectId()
    await connection
      .collection("Item")
      .insertMany([{ _id: banned }, { _id: allowed }])
    await connection
      .collection("ItemBan")
      .insertOne({ item: banned, countries: [] })
    const result = await connection
      .collection("Item")
      .aggregate(
        createRecommendationEligibilityPipeline({
          userId: new Types.ObjectId(),
          now: new Date(),
          preferences: [],
          siteRatingAverage: null,
          page: 1,
          limit: 20,
        }),
      )
      .toArray()
    expect(result.map(({ _id }) => _id)).toEqual([allowed])
  })
})
