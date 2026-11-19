import { describe, expect, it, jest, beforeAll } from "@jest/globals"
import type { Model } from "mongoose"
import { MongoBulkRepository } from "../core/mongoBulk.repository"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createRepositoryFixture } =
    await import("../../../__tests__/functions/createRepositoryFixture")

  describe("MongoBulkRepository", () => {
    let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>

    beforeAll(async () => {
      fixture = await createRepositoryFixture("RepositoryBulkTest")
    })

    it("создаёт несколько документов со значениями по умолчанию", async () => {
      const documents = await fixture.bulk.createMany([
        { key: "one", score: 1 },
        { key: "two", score: 2 },
      ])

      expect(documents.map(({ key, group }) => ({ key, group }))).toEqual([
        { key: "one", group: "first" },
        { key: "two", group: "first" },
      ])
      expect(documents[0]?.toObject()).toMatchObject({ score: 1 })
      expect(await fixture.model.countDocuments()).toBe(2)
    })

    it("возвращает результат вставки при rawResult", async () => {
      const result = await fixture.bulk.createMany([{ key: "one", score: 1 }], {
        rawResult: true,
      })

      expect(result).toMatchObject({ acknowledged: true, insertedCount: 1 })
      expect(await fixture.model.findById(result.insertedIds[0])).toMatchObject(
        {
          key: "one",
        },
      )
    })

    it("возвращает обычные объекты без defaults при lean", async () => {
      const result = await fixture.bulk.createMany([{ key: "one", score: 1 }], {
        lean: true,
      })

      expect(result[0]).toMatchObject({ key: "one", score: 1 })
      expect(result[0]).not.toHaveProperty("toObject")
      expect(result[0]).not.toHaveProperty("group")
      expect(
        await fixture.model.collection.findOne({ key: "one" }),
      ).not.toHaveProperty("group")
    })

    it("отклоняет невалидные документы и конфликт уникальности", async () => {
      await expect(
        fixture.bulk.createMany([{ key: "invalid", score: -1 }]),
      ).rejects.toMatchObject({ name: "ValidationError" })
      expect(await fixture.model.countDocuments()).toBe(0)
      await fixture.model.create({ key: "one", score: 1 })
      await expect(
        fixture.bulk.createMany([{ key: "one", score: 2 }]),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it("обновляет только совпавшие документы и возвращает счётчики", async () => {
      await fixture.model.create([
        { key: "one", score: 1 },
        { key: "two", score: 2, group: "second" },
      ])

      expect(
        await fixture.bulk.updateMany(
          { group: "first" },
          { $set: { score: 5 } },
        ),
      ).toMatchObject({ matchedCount: 1, modifiedCount: 1 })
      expect(await fixture.model.findOne({ key: "two" })).toMatchObject({
        score: 2,
      })
      expect(
        await fixture.bulk.updateMany(
          { key: "missing" },
          { $set: { score: 5 } },
        ),
      ).toMatchObject({ matchedCount: 0, modifiedCount: 0 })
    })

    it("проверяет обновления по умолчанию и сохраняет явное отключение валидаторов", async () => {
      await fixture.model.create({ key: "one", score: 1 })

      await expect(
        fixture.bulk.updateMany({}, { $set: { score: -1 } }),
      ).rejects.toMatchObject({ name: "ValidationError" })
      expect(await fixture.model.findOne()).toMatchObject({ score: 1 })
      await fixture.bulk.updateMany(
        {},
        { $set: { score: -1 } },
        { runValidators: false },
      )
      expect(await fixture.model.findOne()).toMatchObject({ score: -1 })
    })

    it("поддерживает pipeline обновления", async () => {
      await fixture.model.create({ key: "one", score: 1 })

      await fixture.bulk.updateMany(
        {},
        [{ $set: { score: { $add: ["$score", 2] } } }],
        { updatePipeline: true },
      )
      expect(await fixture.model.findOne()).toMatchObject({ score: 3 })
    })

    it("удаляет только совпавшие документы и возвращает счётчик", async () => {
      await fixture.model.create([
        { key: "one", score: 1 },
        { key: "two", score: 2 },
      ])

      expect(await fixture.bulk.deleteMany({ score: 1 })).toMatchObject({
        deletedCount: 1,
      })
      expect(await fixture.bulk.deleteMany({ score: 1 })).toMatchObject({
        deletedCount: 0,
      })
      expect(await fixture.model.findOne()).toMatchObject({ key: "two" })
    })

    it("выполняет смешанный bulkWrite и возвращает результаты операций", async () => {
      await fixture.model.create([
        { key: "update", score: 1 },
        { key: "delete", score: 2 },
      ])

      const result = await fixture.bulk.bulkWrite(
        [
          {
            insertOne: {
              document: { key: "insert", score: 3, group: "first" },
            },
          },
          {
            updateOne: {
              filter: { key: "update" },
              update: { $set: { score: 4 } },
            },
          },
          { deleteOne: { filter: { key: "delete" } } },
        ],
        { ordered: true },
      )

      expect(result).toMatchObject({
        insertedCount: 1,
        modifiedCount: 1,
        deletedCount: 1,
      })
      expect(
        await fixture.model
          .find()
          .sort({ key: 1 })
          .select({ key: 1, score: 1, _id: 0 })
          .lean(),
      ).toEqual([
        { key: "insert", score: 3 },
        { key: "update", score: 4 },
      ])
    })
  })
} else {
  describe("MongoBulkRepository", () => {
    it.each([undefined, false])(
      "сохраняет настройку массовой валидации %j",
      async (isValidationEnabled) => {
        const result = { matchedCount: 2, modifiedCount: 2 }
        const exec = jest.fn(async () => result)
        const setOptions = jest.fn(() => ({ exec }))
        const updateMany = jest.fn(() => ({ setOptions }))
        const repository = new MongoBulkRepository({
          updateMany,
        } as unknown as Model<unknown>)
        const filter = { title: "Книга" }
        const update = { $set: { title: "Новое название" } }
        const options = { runValidators: isValidationEnabled }

        await expect(
          repository.updateMany(filter, update, options),
        ).resolves.toBe(result)
        expect(updateMany.mock.calls).toEqual([[filter, update, options]])
        expect(setOptions.mock.calls).toEqual([
          [{ runValidators: isValidationEnabled ?? true }],
        ])
      },
    )
  })
}
