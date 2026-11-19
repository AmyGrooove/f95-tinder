import { describe, expect, it, jest, beforeAll } from "@jest/globals"
import type { Model } from "mongoose"
import { MongoAggregationRepository } from "../core/mongoAggregation.repository"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createRepositoryFixture } =
    await import("../../../__tests__/functions/createRepositoryFixture")

  describe("MongoAggregationRepository", () => {
    let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>

    beforeAll(async () => {
      fixture = await createRepositoryFixture("RepositoryAggregationTest")
    })

    it("выполняет pipeline из builder и возвращает обычные объекты", async () => {
      await fixture.model.create([
        { key: "one", score: 1 },
        { key: "two", score: 2 },
        { key: "three", score: 3, group: "second" },
      ])
      const pipeline = new AggregationBuilder()
        .match({ group: "first" })
        .sort({ score: -1 })
        .limit(1)
        .project({ key: 1, _id: 0 })
        .build()

      await expect(fixture.aggregation.aggregate(pipeline)).resolves.toEqual([
        { key: "two" },
      ])
    })

    it("передаёт опции collation", async () => {
      await fixture.model.create({ key: "Example", score: 1 })

      await expect(
        fixture.aggregation.aggregate(
          [{ $match: { key: "example" } }, { $project: { key: 1, _id: 0 } }],
          { collation: { locale: "en", strength: 2 } },
        ),
      ).resolves.toEqual([{ key: "Example" }])
    })

    it("возвращает пустой список при отсутствии совпадений", async () => {
      await expect(
        fixture.aggregation.aggregate([{ $match: { key: "missing" } }]),
      ).resolves.toEqual([])
    })

    it("передаёт ошибку выполнения pipeline", async () => {
      await fixture.model.create({ key: "one", score: 1 })

      await expect(
        fixture.aggregation.aggregate([
          { $project: { value: { $divide: ["$score", 0] } } },
        ]),
      ).rejects.toThrow()
    })
  })
} else {
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

      await expect(repository.aggregate(pipeline, options)).resolves.toBe(
        results,
      )
      expect(aggregate.mock.calls).toEqual([[pipeline, options]])
      expect(exec).toHaveBeenCalledTimes(1)
    })
  })
}
