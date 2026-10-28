import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import type { CollectionRepository } from "@entities/collection/services/collection.repository"
import type { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { SynchronizeTagCollectionsJobHandler } from "../handlers/synchronizeTagCollectionsJob.handler"

describe("SynchronizeTagCollectionsJobHandler", () => {
  const item = new Types.ObjectId()
  const tag = new Types.ObjectId()
  const oldTag = new Types.ObjectId()
  const collection = new Types.ObjectId()
  const oldCollection = new Types.ObjectId()
  const groupId = new Types.ObjectId()
  const assignments = jest.fn<() => Promise<unknown[]>>()
  const memberships = jest.fn<() => Promise<unknown[]>>()
  const collections = jest.fn<(filter: unknown) => Promise<unknown[]>>()
  const update =
    jest.fn<
      (filter: unknown, change: unknown, options: unknown) => Promise<unknown>
    >()
  const remove = jest.fn<(filter: unknown) => Promise<unknown>>()
  const cancel = jest.fn<IJobContext["throwIfCancelled"]>()
  const context = {
    id: "unit",
    attempt: 1,
    throwIfCancelled: cancel,
    updateProgress: async () => {},
  } satisfies IJobContext
  const handler = new SynchronizeTagCollectionsJobHandler(
    { read: { findMany: assignments } } as unknown as ItemTagRepository,
    { read: { findMany: collections } } as unknown as CollectionRepository,
    {
      read: { findMany: memberships },
      write: { updateByFilter: update, deleteByFilter: remove },
    } as unknown as CollectionItemRepository,
  )

  beforeEach(() => {
    assignments.mockReset().mockResolvedValue([{ tag, relevanceScore: 0.01 }])
    memberships.mockReset().mockResolvedValue([{ collectionId: oldCollection }])
    collections.mockReset().mockResolvedValue([
      {
        _id: collection,
        tag,
        deletedAt: null,
        blocks: [{ id: groupId, type: "group" }],
      },
      { _id: oldCollection, tag: oldTag, deletedAt: null, blocks: [] },
    ])
    update.mockReset().mockResolvedValue(null)
    remove.mockReset().mockResolvedValue(null)
    cancel.mockReset().mockResolvedValue()
  })

  it("копирует любую положительную значимость и удаляет прежнее членство, не перезаписывая позиции и заметки", async () => {
    await expect(handler.handle(String(item), context)).resolves.toEqual({
      processedItems: 1,
    })

    expect(update).toHaveBeenCalledWith(
      { collectionId: collection, item },
      {
        $set: { relevanceScore: 0.01 },
        $setOnInsert: { collectionId: collection, item, groupId, position: 0 },
      },
      { upsert: true },
    )
    expect(remove).toHaveBeenCalledWith({ collectionId: oldCollection, item })
    expect(collections).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tag",
        author: null,
        tag: { $ne: null },
      }),
    )
  })

  it("при повторном событии читает новые назначения вместо применения старого состояния", async () => {
    await handler.handle(String(item), context)
    update.mockClear()
    remove.mockClear()
    assignments.mockResolvedValue([])

    await handler.handle(String(item), context)

    expect(update).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it("удаляет членство из удалённой коллекции даже при сохранённом теге", async () => {
    collections.mockResolvedValue([
      { _id: collection, tag, deletedAt: new Date(), blocks: [] },
    ])

    await handler.handle(String(item), context)

    expect(update).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith({ collectionId: collection, item })
  })

  it("сообщает об отсутствии группы, не создавая новый способ представления состава", async () => {
    collections.mockResolvedValue([
      { _id: collection, tag, deletedAt: null, blocks: [] },
    ])

    await expect(handler.handle(String(item), context)).rejects.toThrow(
      "has no group",
    )
    expect(update).not.toHaveBeenCalled()
  })

  it("останавливает запись при отмене после чтения назначений", async () => {
    cancel.mockResolvedValueOnce().mockRejectedValueOnce(new Error("cancelled"))

    await expect(handler.handle(String(item), context)).rejects.toThrow(
      "cancelled",
    )
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it("не пишет состав при ошибке чтения или записи и передаёт ошибку для повтора задания", async () => {
    assignments.mockRejectedValueOnce(new Error("read failed"))
    await expect(handler.handle(String(item), context)).rejects.toThrow(
      "read failed",
    )
    expect(update).not.toHaveBeenCalled()

    update.mockRejectedValueOnce(new Error("write failed"))
    await expect(handler.handle(String(item), context)).rejects.toThrow(
      "write failed",
    )
    expect(remove).not.toHaveBeenCalled()
  })
})
