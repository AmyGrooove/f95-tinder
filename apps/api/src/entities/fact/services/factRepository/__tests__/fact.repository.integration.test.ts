import { beforeAll, describe, expect, it } from "@jest/globals"
import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { Fact, FactSchema } from "../../../schemas/fact.schema"
import { FactRepository } from "../core/fact.repository"

describe("FactRepository", () => {
  let repository: FactRepository

  beforeAll(() => {
    repository = new FactRepository(
      getTestDatabase().connection.model(
        Fact.name,
        FactSchema,
      ) as unknown as Model<HydratedDocument<Fact>>,
    )
  })

  it("возвращает пустую выборку из пустого каталога", async () => {
    await expect(repository.sampleIds(3)).resolves.toEqual([])
  })

  it("возвращает указанное количество уникальных id фактов", async () => {
    const facts = await repository.bulk.createMany(
      ["one", "two", "three"].map((en) => ({ text: { en, ru: null } })),
    )
    const sample = await repository.sampleIds(2)
    const ids = facts.map(({ _id }) => _id.toHexString())

    expect(sample).toHaveLength(2)
    expect(new Set(sample.map(({ _id }) => _id.toHexString())).size).toBe(2)
    for (const entry of sample) {
      expect(Object.keys(entry)).toEqual(["_id"])
      expect(ids).toContain(entry._id.toHexString())
    }
  })
})
