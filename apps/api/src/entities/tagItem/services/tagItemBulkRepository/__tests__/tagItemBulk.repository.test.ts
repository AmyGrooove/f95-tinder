import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"

import type { TagItemMutationService } from "../../tagItemMutationService"
import { TagItemBulkRepository } from "../core/tagItemBulk.repository"

describe("TagItemBulkRepository", () => {
  const createRepository = () => {
    const run = jest.fn<TagItemMutationService["run"]>(async ({ mutate }) =>
      mutate(),
    )
    const repository = new TagItemBulkRepository(
      {} as ConstructorParameters<typeof TagItemBulkRepository>[0],
      { run } as unknown as TagItemMutationService,
    )
    return { repository, run }
  }

  it("передаёт id всех добавляемых тайтлов и сохраняет результат вставки", async () => {
    const { repository, run } = createRepository()
    const tag = new Types.ObjectId()
    const payloads = [new Types.ObjectId(), new Types.ObjectId()].map(
      (item) => ({
        item,
        tag,
        relevanceScore: 0.5,
      }),
    )
    const records = payloads.map((payload) => ({
      ...payload,
      _id: new Types.ObjectId(),
    }))
    const insert = jest
      .spyOn(MongoBulkRepository.prototype, "createMany")
      .mockResolvedValue(records)

    await expect(repository.createMany(payloads)).resolves.toBe(records)
    expect(insert).toHaveBeenCalledWith(payloads, {})
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        itemIds: payloads.map(({ item }) => item),
        isPartialWritePossible: true,
      }),
    )
  })

  it.each(["updateMany", "deleteMany"] as const)(
    "передаёт фильтр, сессию и признак частичной записи для %s",
    async (method) => {
      const { repository, run } = createRepository()
      const error = new Error("Ошибка массовой записи")
      const operation = jest
        .spyOn(MongoBulkRepository.prototype, method)
        .mockRejectedValue(error)
      const filter = { tag: new Types.ObjectId() }
      const update = { $set: { relevanceScore: 1 } }
      const session = {} as ClientSession
      const options = { session }

      if (method === "updateMany") {
        await expect(
          repository.updateMany(filter, update, options),
        ).rejects.toBe(error)
        expect(operation).toHaveBeenCalledWith(filter, update, options)
      } else {
        await expect(repository.deleteMany(filter, options)).rejects.toBe(error)
        expect(operation).toHaveBeenCalledWith(filter, options)
      }
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [filter],
          session,
          isPartialWritePossible: true,
        }),
      )
    },
  )

  it("отделяет id вставляемых тайтлов от фильтров обновления, удаления и замены", async () => {
    const { repository, run } = createRepository()
    const session = {} as ClientSession
    const item = new Types.ObjectId()
    const tag = new Types.ObjectId()
    const document = { item, tag, relevanceScore: 1 }
    const filters = Array.from({ length: 5 }, () => ({
      _id: new Types.ObjectId(),
    }))
    const operations = [
      { insertOne: { document } },
      {
        updateOne: {
          filter: filters[0],
          update: { $set: { relevanceScore: 0.5 } },
        },
      },
      {
        updateMany: {
          filter: filters[1],
          update: { $set: { relevanceScore: 0.5 } },
        },
      },
      { deleteOne: { filter: filters[2] } },
      { deleteMany: { filter: filters[3] } },
      { replaceOne: { filter: filters[4], replacement: document } },
    ]
    const error = new Error("Ошибка массовой записи")
    const bulkWrite = jest
      .spyOn(MongoBulkRepository.prototype, "bulkWrite")
      .mockRejectedValue(error)

    await expect(repository.bulkWrite(operations, { session })).rejects.toBe(
      error,
    )
    expect(bulkWrite).toHaveBeenCalledWith(operations, { session })
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        filters,
        itemIds: [item],
        session,
        isPartialWritePossible: true,
      }),
    )
  })
})
