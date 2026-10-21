import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { createRepositoryFixture } from "./functions/createRepositoryFixture"

describe("MongoWriteRepository", () => {
  let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>

  beforeAll(async () => {
    fixture = await createRepositoryFixture("RepositoryWriteTest")
  })

  it("создаёт документ со значениями схемы по умолчанию", async () => {
    const created = await fixture.write.create({ key: "one", score: 1 })

    expect(created).toMatchObject({ key: "one", score: 1, group: "first" })
    expect(await fixture.model.findById(created._id)).toMatchObject({
      key: "one",
    })
  })

  it("отклоняет создание невалидного и повторяющегося документа", async () => {
    await expect(
      fixture.write.create({ key: "one", score: -1 }),
    ).rejects.toMatchObject({ name: "ValidationError" })
    await fixture.write.create({ key: "one", score: 1 })
    await expect(
      fixture.write.create({ key: "one", score: 2 }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  describe.each(["id", "filter"] as const)("обновление по %s", (mode) => {
    const update = async (
      ...args: Parameters<typeof fixture.write.updateById>
    ) => {
      const [id, payload, options] = args
      return mode === "id"
        ? await fixture.write.updateById(id, payload, options)
        : await fixture.write.updateByFilter(
            { _id: new Types.ObjectId(id) },
            payload,
            options,
          )
    }

    it.each([
      { options: undefined, score: 2 },
      { options: { new: false }, score: 1 },
      { options: { new: true }, score: 2 },
      { options: { new: false, returnDocument: "after" as const }, score: 2 },
      { options: { new: true, returnDocument: "before" as const }, score: 1 },
    ])(
      "выбирает возвращаемое состояние для опций $options",
      async ({ options, score }) => {
        const document = await fixture.model.create({ key: "one", score: 1 })

        expect(
          await update(document.id, { $set: { score: 2 } }, options),
        ).toMatchObject({ score })
        expect(await fixture.model.findById(document._id)).toMatchObject({
          score: 2,
        })
      },
    )

    it("проверяет валидаторы по умолчанию и позволяет их отключить", async () => {
      const document = await fixture.model.create({ key: "one", score: 1 })

      await expect(
        update(document.id, { $set: { score: -1 } }),
      ).rejects.toMatchObject({ name: "ValidationError" })
      expect(await fixture.model.findById(document._id)).toMatchObject({
        score: 1,
      })
      expect(
        await update(
          document.id,
          { $set: { score: -1 } },
          { runValidators: false },
        ),
      ).toMatchObject({ score: -1 })
    })

    it("возвращает null при отсутствии документа", async () => {
      await expect(
        update(new Types.ObjectId().toString(), { $set: { score: 2 } }),
      ).resolves.toBeNull()
    })
  })

  it("удаляет по id и фильтру и возвращает null при повторном удалении", async () => {
    const first = await fixture.model.create({ key: "one", score: 1 })
    await fixture.model.create({ key: "two", score: 2 })

    expect(await fixture.write.deleteById(first.id)).toMatchObject({
      key: "one",
    })
    await expect(fixture.write.deleteById(first.id)).resolves.toBeNull()
    expect(await fixture.write.deleteByFilter({ key: "two" })).toMatchObject({
      key: "two",
    })
    await expect(
      fixture.write.deleteByFilter({ key: "two" }),
    ).resolves.toBeNull()
    expect(await fixture.model.countDocuments()).toBe(0)
  })
})
