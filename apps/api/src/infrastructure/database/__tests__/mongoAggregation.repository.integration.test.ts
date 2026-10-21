import { beforeAll, describe, expect, it } from "@jest/globals"

import { AggregationBuilder } from "../services/aggregationBuilder"
import { createRepositoryFixture } from "./functions/createRepositoryFixture"

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
