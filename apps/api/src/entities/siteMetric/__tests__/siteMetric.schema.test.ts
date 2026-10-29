import { afterAll, describe, expect, it } from "@jest/globals"
import { createConnection, Types } from "mongoose"

import { ESiteMetricKey } from "../schemas/ESiteMetricKey"
import { SiteMetricSchema } from "../schemas/siteMetric.schema"
import { SiteRatingsMetricSchema } from "../schemas/siteRatingsMetric.schema"

describe("SiteMetric schema", () => {
  const connection = createConnection()
  const base = connection.model("SchemaSiteMetric", SiteMetricSchema.clone())
  const ratings = base.discriminator(
    "SchemaSiteRatingsMetric",
    SiteRatingsMetricSchema.clone(),
    ESiteMetricKey.RATINGS,
  )

  afterAll(async () => {
    await connection.close()
  })

  it("хранит ratings в общей коллекции с генерируемым ObjectId и уникальным key", async () => {
    const metric = new ratings({ sum: 17, count: 2, average: 8.5 })
    await expect(metric.validate()).resolves.toBeUndefined()
    expect(metric._id).toBeInstanceOf(Types.ObjectId)
    expect(metric.get("key")).toBe("ratings")
    expect(ratings.collection.name).toBe("SiteMetric")
    expect(base.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ key: 1 }, expect.objectContaining({ unique: true })],
      ]),
    )
    expect(metric.toObject()).not.toHaveProperty("calculatedAt")
  })

  it("допускает пустую статистику с null вместо выставленной оценки", async () => {
    await expect(
      new ratings({ sum: 0, count: 0, average: null }).validate(),
    ).resolves.toBeUndefined()
  })

  it.each([
    { sum: -1, count: 1, average: 7 },
    { sum: Number.POSITIVE_INFINITY, count: 1, average: 7 },
    { sum: 7, count: -1, average: 7 },
    { sum: 7, count: 1.5, average: 7 },
    { sum: 7, count: Number.MAX_SAFE_INTEGER + 1, average: 7 },
    { sum: 7, count: 1, average: 0 },
    { sum: 7, count: 1, average: 11 },
  ])("отклоняет недопустимые значения метрики %j", async (payload) => {
    await expect(new ratings(payload).validate()).rejects.toThrow()
  })
})
