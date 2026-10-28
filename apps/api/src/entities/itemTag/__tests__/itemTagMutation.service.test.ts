import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type {
  ClientSession,
  Connection,
  HydratedDocument,
  Model,
} from "mongoose"

import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { ItemTagMutationService } from "../services/itemTagMutation.service"
import type { ItemTagEventsService } from "../services/itemTagEvents.service"
import type { ItemTag } from "../schemas/itemTag.schema"

describe("ItemTagMutationService", () => {
  const id = new Types.ObjectId()
  const previousItem = new Types.ObjectId()
  const currentItem = new Types.ObjectId()
  const find = jest.fn<(...args: unknown[]) => unknown>()
  const publish = jest.fn<ItemTagEventsService["publishChanged"]>()
  const mutate = jest.fn<() => Promise<unknown>>()
  const transaction = new MongoTransactionService({} as Connection)
  const service = new ItemTagMutationService(
    { find } as unknown as Model<HydratedDocument<ItemTag>>,
    { publishChanged: publish } as unknown as ItemTagEventsService,
    transaction,
  )
  const query = (records: unknown[]) => ({
    lean: () => ({ exec: async () => records }),
  })

  beforeEach(() => {
    find
      .mockReset()
      .mockReturnValueOnce(query([{ _id: id, item: previousItem }]))
      .mockReturnValue(query([{ _id: id, item: currentItem }]))
    publish.mockReset().mockResolvedValue()
    mutate.mockReset().mockResolvedValue({ _id: id })
  })

  it("публикует старое и новое произведение только после успешной записи", async () => {
    mutate.mockImplementation(async () => {
      expect(publish).not.toHaveBeenCalled()
      return { _id: id }
    })

    await service.run({ filters: [{ _id: id }], mutate })

    expect(publish).toHaveBeenCalledWith([previousItem, currentItem], undefined)
  })

  it("не публикует событие при неудачной одиночной записи", async () => {
    mutate.mockRejectedValueOnce(new Error("write failed"))

    await expect(
      service.run({ filters: [{ _id: id }], mutate }),
    ).rejects.toThrow("write failed")
    expect(publish).not.toHaveBeenCalled()
  })

  it.each([
    { upsertedId: id },
    { insertedIds: { 0: id } },
    { upsertedIds: { 0: id } },
    [{ _id: id }],
  ])(
    "включает новые записи из результата upsert и bulk: %j",
    async (result) => {
      find.mockReset().mockReturnValue(query([{ _id: id, item: currentItem }]))
      mutate.mockResolvedValue(result)

      await service.run({ mutate })

      expect(publish).toHaveBeenCalledWith([currentItem], undefined)
    },
  )

  it("запрашивает сверку после частичного успеха bulk и сохраняет исходную ошибку", async () => {
    const error = Object.assign(new Error("partial"), {
      result: { insertedIds: { 0: id } },
    })
    mutate.mockRejectedValue(error)

    await expect(
      service.run({
        mutate,
        itemIds: [currentItem],
        isPartialWritePossible: true,
      }),
    ).rejects.toBe(error)
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it("отклоняет чужую активную транзакцию до чтения и записи", async () => {
    const session = { inTransaction: () => true } as unknown as ClientSession

    await expect(service.run({ mutate, session })).rejects.toThrow(
      "MongoTransactionService.run",
    )
    expect(find).not.toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it("передаёт ошибку публикации после успешной записи", async () => {
    publish.mockRejectedValueOnce(new Error("publish failed"))

    await expect(
      service.run({ mutate, itemIds: [currentItem] }),
    ).rejects.toThrow("publish failed")
    expect(mutate).toHaveBeenCalledTimes(1)
  })
})
