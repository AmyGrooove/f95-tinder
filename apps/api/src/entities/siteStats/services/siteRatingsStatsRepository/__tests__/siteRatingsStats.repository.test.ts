import { describe, expect, it, jest } from "@jest/globals"
import type { ClientSession } from "mongoose"

import { ESiteStatsKey } from "../../../schemas/ESiteStatsKey"
import { SiteRatingsStatsRepository } from ".."
import type { Model } from "mongoose"
import type { SiteRatingsStats } from "../../../schemas/siteRatingsStats.schema"

describe("SiteRatingsStatsRepository", () => {
  it.each([
    { metric: null, average: null },
    { metric: { average: null }, average: null },
    { metric: { average: 7.5 }, average: 7.5 },
  ])("читает среднюю оценку сайта (%j)", async ({ metric, average }) => {
    const exec = jest.fn(async () => metric)
    const findOne = jest.fn<
      (...args: unknown[]) => { lean: () => { exec: typeof exec } }
    >(() => ({ lean: () => ({ exec }) }))
    const repository = new SiteRatingsStatsRepository({
      findOne,
    } as unknown as Model<SiteRatingsStats>)

    await expect(repository.readAverage()).resolves.toBe(average)

    expect(findOne).toHaveBeenCalledWith(
      { key: ESiteStatsKey.RATINGS },
      { average: 1 },
    )
  })

  it("передаёт дельты в атомарное обновление и возвращает проверенный документ", async () => {
    const metric = { validate: jest.fn(async () => {}) }
    const exec = jest.fn(async () => metric)
    const findOneAndUpdate = jest.fn<
      (...args: unknown[]) => { orFail: () => { exec: typeof exec } }
    >(() => ({ orFail: () => ({ exec }) }))
    const repository = new SiteRatingsStatsRepository({
      findOneAndUpdate,
    } as unknown as Model<SiteRatingsStats>)
    const session = {} as ClientSession

    await expect(
      repository.applyChanges({ sum: -8, count: -1, session }),
    ).resolves.toBe(metric)

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { key: ESiteStatsKey.RATINGS },
      [
        {
          $set: {
            createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
            sum: { $add: [{ $ifNull: ["$sum", 0] }, -8] },
            count: { $add: [{ $ifNull: ["$count", 0] }, -1] },
          },
        },
        {
          $set: {
            average: {
              $cond: [
                { $gt: ["$count", 0] },
                { $divide: ["$sum", "$count"] },
                null,
              ],
            },
          },
        },
      ],
      { session, upsert: true, returnDocument: "after", updatePipeline: true },
    )
    expect(metric.validate).toHaveBeenCalledTimes(1)
  })
})
