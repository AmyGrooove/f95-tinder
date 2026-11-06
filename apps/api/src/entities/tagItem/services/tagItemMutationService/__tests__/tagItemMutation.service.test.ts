import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import type { TagItemEventsService } from "@entities/tagItem/services/tagItemEventsService"

import { TagItemMutationService } from ".."
import type { Model, HydratedDocument } from "mongoose"
import type { TagItem } from "../../../schemas/tagItem.schema"

describe("TagItemMutationService", () => {
  const setup = () => {
    const exec = jest.fn<() => Promise<unknown[]>>()
    const find = jest.fn<
      (...args: unknown[]) => { lean: () => { exec: typeof exec } }
    >(() => ({ lean: () => ({ exec }) }))
    const publishChanged = jest.fn<TagItemEventsService["publishChanged"]>()
    const assertManagedSession =
      jest.fn<MongoTransactionService["assertManagedSession"]>()
    const service = new TagItemMutationService(
      { find } as unknown as Model<HydratedDocument<TagItem>>,
      { publishChanged } as unknown as TagItemEventsService,
      { assertManagedSession } as unknown as MongoTransactionService,
    )
    return { service, exec, find, publishChanged, assertManagedSession }
  }

  it("публикует прежние, новые и явно переданные идентификаторы произведений", async () => {
    const { service, exec, find, publishChanged } = setup()
    const previous = { _id: new Types.ObjectId(), item: new Types.ObjectId() }
    const insertedId = new Types.ObjectId()
    const currentItem = new Types.ObjectId()
    const explicitItem = new Types.ObjectId()
    const filter = { _id: previous._id }
    const result = { upsertedIds: { 0: insertedId.toHexString() } }
    exec
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([{ item: currentItem }])

    await expect(
      service.run({
        filters: [filter],
        itemIds: [explicitItem],
        mutate: async () => result,
      }),
    ).resolves.toBe(result)

    expect(find).toHaveBeenNthCalledWith(
      1,
      { $or: [filter] },
      { _id: 1, item: 1 },
      { session: undefined },
    )
    expect(find).toHaveBeenNthCalledWith(
      2,
      { _id: { $in: [previous._id, insertedId] } },
      { item: 1 },
      { session: undefined },
    )
    expect(publishChanged).toHaveBeenCalledWith(
      [previous.item, currentItem, explicitItem],
      undefined,
    )
  })

  it("публикует изменения из частичного результата вне транзакции и пробрасывает исходную ошибку", async () => {
    const { service, exec, find, publishChanged } = setup()
    const insertedId = new Types.ObjectId()
    const item = new Types.ObjectId()
    const error = Object.assign(new Error("bulk write failed"), {
      result: { insertedIds: { 0: insertedId } },
    })
    exec.mockResolvedValueOnce([{ item }])

    await expect(
      service.run({
        isPartialWritePossible: true,
        mutate: async () => {
          throw error
        },
      }),
    ).rejects.toBe(error)

    expect(find).toHaveBeenCalledWith(
      { _id: { $in: [insertedId] } },
      { item: 1 },
      { session: undefined },
    )
    expect(publishChanged).toHaveBeenCalledWith([item], undefined)
  })

  it("не публикует частичный результат неудачной записи внутри транзакции", async () => {
    const { service, find, publishChanged, assertManagedSession } = setup()
    const session = { inTransaction: () => true } as unknown as ClientSession
    const error = new Error("bulk write failed")

    await expect(
      service.run({
        session,
        itemIds: [new Types.ObjectId()],
        isPartialWritePossible: true,
        mutate: async () => {
          throw error
        },
      }),
    ).rejects.toBe(error)

    expect(assertManagedSession).toHaveBeenCalledWith(session)
    expect(find).not.toHaveBeenCalled()
    expect(publishChanged).not.toHaveBeenCalled()
  })
})
