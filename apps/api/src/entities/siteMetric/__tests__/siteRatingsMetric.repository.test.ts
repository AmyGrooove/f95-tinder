import { describe, expect, it, jest } from "@jest/globals"
import type { Model } from "mongoose"

import type { SiteRatingsMetric } from "../schemas/siteRatingsMetric.schema"
import { SiteRatingsMetricRepository } from "../services/siteRatingsMetric.repository"
import { DEFAULT_SITE_RATING_AVERAGE } from "../static/DEFAULT_SITE_RATING_AVERAGE"

describe("SiteRatingsMetricRepository", () => {
  it.each([
    { metric: null, expected: DEFAULT_SITE_RATING_AVERAGE },
    { metric: { average: null }, expected: DEFAULT_SITE_RATING_AVERAGE },
    { metric: { average: 8.75 }, expected: 8.75 },
  ])(
    "возвращает сохранённую среднюю или ориентир при отсутствии оценок: $metric",
    async ({ metric, expected }) => {
      const exec = jest.fn(async () => metric)
      const select = jest.fn<
        (projection: unknown) => { lean: () => { exec: typeof exec } }
      >(() => ({ lean: () => ({ exec }) }))
      const findOne = jest.fn<(filter: unknown) => { select: typeof select }>(
        () => ({ select }),
      )
      const repository = new SiteRatingsMetricRepository({
        findOne,
      } as unknown as Model<SiteRatingsMetric>)
      await expect(repository.readRatingBaseline()).resolves.toEqual({
        average: expected,
      })
      expect(findOne).toHaveBeenCalledWith({ key: "ratings" })
      expect(select).toHaveBeenCalledWith({ average: 1 })
    },
  )

  it("передаёт ошибку чтения общей метрики вместо выдуманного значения", async () => {
    const error = new Error("MongoDB unavailable")
    const repository = new SiteRatingsMetricRepository({
      findOne: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => {
              throw error
            },
          }),
        }),
      }),
    } as unknown as Model<SiteRatingsMetric>)
    await expect(repository.readRatingBaseline()).rejects.toBe(error)
  })
})
