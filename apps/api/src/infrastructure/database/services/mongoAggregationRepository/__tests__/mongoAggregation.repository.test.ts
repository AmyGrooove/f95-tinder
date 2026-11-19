import { describe, expect, it, jest } from "@jest/globals"
import type { Model } from "mongoose"

import { MongoAggregationRepository } from "../core/mongoAggregation.repository"

describe("MongoAggregationRepository", () => {
  it("выполняет переданный pipeline с опциями и возвращает результаты", async () => {
    const results = [{ count: 2 }]
    const exec = jest.fn(async () => results)
    const aggregate = jest.fn(() => ({ exec }))
    const repository = new MongoAggregationRepository({
      aggregate,
    } as unknown as Model<unknown>)
    const pipeline = [{ $count: "count" }]
    const options = { allowDiskUse: true }

    await expect(repository.aggregate(pipeline, options)).resolves.toBe(results)
    expect(aggregate.mock.calls).toEqual([[pipeline, options]])
    expect(exec).toHaveBeenCalledTimes(1)
  })
})
