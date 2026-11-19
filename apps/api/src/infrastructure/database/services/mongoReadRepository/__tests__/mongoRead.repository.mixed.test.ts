import { describe, expect, it, jest, beforeAll } from "@jest/globals"
import { type Model, Types } from "mongoose"
import { MongoReadRepository } from "../core/mongoRead.repository"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createRepositoryFixture } =
    await import("../../../__tests__/functions/createRepositoryFixture")

  describe("MongoReadRepository", () => {
    let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>

    beforeAll(async () => {
      fixture = await createRepositoryFixture("RepositoryReadTest")
    })

    it("находит документ по id и фильтру с учётом projection", async () => {
      const document = await fixture.model.create({ key: "one", score: 1 })

      expect(await fixture.read.findById(document.id)).toMatchObject({
        key: "one",
      })
      const selected = await fixture.read.findOne(
        { key: "one" },
        { key: 1, _id: 0 },
      )
      expect(selected?.toObject()).toEqual({ key: "one" })
    })

    it("возвращает null и пустой список для отсутствующих документов", async () => {
      await expect(
        fixture.read.findById(new Types.ObjectId().toString()),
      ).resolves.toBeNull()
      await expect(fixture.read.findOne({ key: "missing" })).resolves.toBeNull()
      await expect(fixture.read.findMany({})).resolves.toEqual([])
    })

    it("применяет defaultSort и позволяет переопределить его", async () => {
      await fixture.model.create([
        { key: "low", score: 1 },
        { key: "high", score: 2 },
      ])

      expect((await fixture.read.findMany({})).map(({ key }) => key)).toEqual([
        "high",
        "low",
      ])
      expect(
        (
          await fixture.read.findMany({}, undefined, {
            sort: { score: 1 },
            limit: 1,
          })
        ).map(({ key }) => key),
      ).toEqual(["low"])
    })

    it("поддерживает lean и проверяет существование по фильтру", async () => {
      await fixture.model.create({ key: "one", score: 1 })

      const document = await fixture.read.findById(
        (await fixture.model.findOne().orFail()).id,
        { key: 1, _id: 0 },
        { lean: true },
      )
      expect(document).toEqual({ key: "one" })
      await expect(fixture.read.checkIsExists({ score: 1 })).resolves.toBe(true)
      await expect(fixture.read.checkIsExists({ score: 2 })).resolves.toBe(
        false,
      )
    })

    it("передаёт ошибку приведения некорректного id", async () => {
      await expect(fixture.read.findById("invalid")).rejects.toMatchObject({
        name: "CastError",
      })
    })
  })
} else {
  describe("MongoReadRepository", () => {
    it("использует сортировку репозитория только без явной сортировки запроса", async () => {
      const sort = jest.fn()
      const exec = jest.fn(async () => [{ title: "Книга" }])
      const find = jest.fn(() => ({ sort, exec }))
      const repository = new MongoReadRepository(
        { find } as unknown as Model<{ title: string }>,
        {
          defaultSort: { title: 1 },
        },
      )

      await expect(repository.findMany({})).resolves.toEqual([
        { title: "Книга" },
      ])
      expect(sort).toHaveBeenCalledWith({ title: 1 })

      sort.mockClear()
      await repository.findMany({}, undefined, { sort: { title: -1 } })
      expect(sort).not.toHaveBeenCalled()
      expect(find.mock.lastCall).toEqual([
        {},
        undefined,
        { sort: { title: -1 } },
      ])
    })
  })
}
