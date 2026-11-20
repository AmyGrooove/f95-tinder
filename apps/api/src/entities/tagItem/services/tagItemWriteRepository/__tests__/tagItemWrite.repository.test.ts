import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import type { TagItemMutationService } from "../../tagItemMutationService"
import { TagItemWriteRepository } from "../core/tagItemWrite.repository"

describe("TagItemWriteRepository", () => {
  const createRepository = () => {
    const run = jest.fn<TagItemMutationService["run"]>(async ({ mutate }) =>
      mutate(),
    )
    const repository = new TagItemWriteRepository(
      {} as ConstructorParameters<typeof TagItemWriteRepository>[0],
      { run } as unknown as TagItemMutationService,
    )
    return { repository, run }
  }

  it("сообщает об item при создании связи и возвращает созданную запись", async () => {
    const { repository, run } = createRepository()
    const payload = {
      item: new Types.ObjectId(),
      tag: new Types.ObjectId(),
      relevanceScore: 1,
    }
    const record = { ...payload, _id: new Types.ObjectId() }
    const create = jest
      .spyOn(MongoWriteRepository.prototype, "create")
      .mockResolvedValue(record)
    const session = {} as ClientSession

    await expect(repository.create(payload, { session })).resolves.toBe(record)
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ itemIds: [payload.item], session }),
    )
    expect(create).toHaveBeenCalledWith(payload, { session })
  })

  it.each(["updateById", "deleteById"] as const)(
    "передаёт ObjectId записи и сессию в обёртку %s",
    async (method) => {
      const { repository, run } = createRepository()
      const operation = jest
        .spyOn(MongoWriteRepository.prototype, method)
        .mockResolvedValue(null)
      const id = new Types.ObjectId()
      const session = {} as ClientSession
      const options = { session }
      const update = { $set: { relevanceScore: 0.5 } }

      if (method === "updateById") {
        await expect(
          repository.updateById(id.toHexString(), update, options),
        ).resolves.toBeNull()
        expect(operation).toHaveBeenCalledWith(
          id.toHexString(),
          update,
          options,
        )
      } else {
        await expect(
          repository.deleteById(id.toHexString(), options),
        ).resolves.toBeNull()
        expect(operation).toHaveBeenCalledWith(id.toHexString(), options)
      }
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ filters: [{ _id: id }], session }),
      )
    },
  )

  it.each(["updateByFilter", "deleteByFilter"] as const)(
    "передаёт исходный фильтр в обёртку %s и сохраняет ошибку операции",
    async (method) => {
      const { repository, run } = createRepository()
      const error = new Error("Ошибка записи")
      const operation = jest
        .spyOn(MongoWriteRepository.prototype, method)
        .mockRejectedValue(error)
      const filter = { tag: new Types.ObjectId() }
      const update = { $set: { relevanceScore: 0.5 } }

      if (method === "updateByFilter") {
        await expect(repository.updateByFilter(filter, update)).rejects.toBe(
          error,
        )
        expect(operation).toHaveBeenCalledWith(filter, update, undefined)
      } else {
        await expect(repository.deleteByFilter(filter)).rejects.toBe(error)
        expect(operation).toHaveBeenCalledWith(filter, undefined)
      }
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ filters: [filter] }),
      )
    },
  )
})
