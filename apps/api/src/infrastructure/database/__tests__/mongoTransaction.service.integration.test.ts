import { beforeAll, describe, expect, it } from "@jest/globals"

import { MongoTransactionService } from "../services/mongoTransaction.service"
import { createRepositoryFixture } from "./functions/createRepositoryFixture"

describe("MongoTransactionService MongoDB", () => {
  let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>
  let service: MongoTransactionService

  beforeAll(async () => {
    fixture = await createRepositoryFixture("RepositoryTransactionTest")
    service = new MongoTransactionService(fixture.connection)
  })

  it("фиксирует изменения и возвращает результат callback", async () => {
    const result = await service.run(async (session) => {
      const created = await fixture.write.create(
        { key: "one", score: 1 },
        { session },
      )
      await fixture.write.updateById(
        created.id,
        { $set: { score: 2 } },
        { session },
      )
      await fixture.bulk.createMany([{ key: "two", score: 3 }], { session })
      await fixture.bulk.updateMany(
        { key: "two" },
        { $set: { score: 4 } },
        { session },
      )
      await fixture.bulk.bulkWrite(
        [
          {
            insertOne: { document: { key: "three", score: 5, group: "first" } },
          },
        ],
        { session },
      )

      expect(
        await fixture.read.findById(created.id, undefined, { session }),
      ).toMatchObject({ score: 2 })
      expect(
        await fixture.read.findOne({ key: "two" }, undefined, { session }),
      ).toMatchObject({ score: 4 })
      expect(
        await fixture.read.findMany({}, undefined, { session }),
      ).toHaveLength(3)
      await expect(
        fixture.read.checkIsExists({ key: "three" }, { session }),
      ).resolves.toBe(true)
      const page = await fixture.pagination.findManyPaginated(
        {},
        undefined,
        { session },
        { limit: 1 },
      )
      expect(page.total).toBe(3)
      expect(page.items[0]).toMatchObject({ key: "three" })
      await expect(
        fixture.aggregation.aggregate([{ $count: "total" }], { session }),
      ).resolves.toEqual([{ total: 3 }])
      expect(await fixture.model.countDocuments()).toBe(0)
      return created.id
    })

    expect(await fixture.model.findById(result)).toMatchObject({ score: 2 })
    expect(await fixture.model.countDocuments()).toBe(3)
  })

  it("откатывает несколько записей и передаёт исходную ошибку", async () => {
    const document = await fixture.model.create({ key: "existing", score: 1 })
    const error = new Error("rollback")

    await expect(
      service.run(async (session) => {
        await fixture.write.updateByFilter(
          { key: "existing" },
          { $set: { score: 9 } },
          { session },
        )
        await fixture.bulk.createMany([{ key: "new", score: 2 }], { session })
        throw error
      }),
    ).rejects.toBe(error)

    expect(await fixture.model.findById(document._id)).toMatchObject({
      score: 1,
    })
    expect(await fixture.model.countDocuments()).toBe(1)
  })

  it("откатывает удаления через все методы репозиториев", async () => {
    const first = await fixture.model.create({ key: "one", score: 1 })
    await fixture.model.create([
      { key: "two", score: 2 },
      { key: "three", score: 3 },
    ])
    const error = new Error("rollback deletes")

    await expect(
      service.run(async (session) => {
        await fixture.write.deleteById(first.id, { session })
        await fixture.write.deleteByFilter({ key: "two" }, { session })
        await fixture.bulk.deleteMany({ key: "three" }, { session })
        expect(await fixture.read.findMany({}, undefined, { session })).toEqual(
          [],
        )
        throw error
      }),
    ).rejects.toBe(error)

    expect(await fixture.model.countDocuments()).toBe(3)
  })
})
