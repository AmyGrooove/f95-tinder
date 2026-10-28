import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { CacheService } from "@infrastructure/cache/services/cache.service"
import { SearchService } from "@infrastructure/search/services/search.service"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import { SyncSearchJobHandler } from "../handlers/syncSearchJob.handler"
import { SEARCH_SETTINGS } from "../static/SEARCH_SETTINGS"

describe("SyncSearchJobHandler", () => {
  const cache = {
    get: jest.fn<CacheService["get"]>(),
    set: jest.fn<CacheService["set"]>(),
    delete: jest.fn<CacheService["delete"]>(),
  }
  const search = {
    hasIndex: jest.fn<SearchService["hasIndex"]>(),
    ensureIndex: jest.fn<SearchService["ensureIndex"]>(),
    upsert: jest.fn<SearchService["upsert"]>(),
    deleteMany: jest.fn<SearchService["deleteMany"]>(),
    readDocumentIds: jest.fn<SearchService["readDocumentIds"]>(),
  }
  const items = {
    readSearchIndexBatch: jest.fn<ItemRepository["readSearchIndexBatch"]>(),
    read: { findMany: jest.fn<ItemRepository["read"]["findMany"]>() },
  }
  const users = {
    read: { findMany: jest.fn<UserRepository["read"]["findMany"]>() },
  }
  const collections = {
    read: { findMany: jest.fn<CollectionRepository["read"]["findMany"]>() },
  }
  const context = {
    id: "search-job",
    attempt: 1,
    updateProgress: jest.fn<IJobContext["updateProgress"]>(),
    throwIfCancelled: jest.fn<IJobContext["throwIfCancelled"]>(),
  }
  let handler: SyncSearchJobHandler
  let module: TestingModule

  beforeEach(async () => {
    jest.resetAllMocks()
    search.hasIndex.mockResolvedValue(true)
    search.readDocumentIds.mockResolvedValue([])
    cache.get.mockResolvedValue(120_000)
    items.readSearchIndexBatch.mockResolvedValue([])
    items.read.findMany.mockResolvedValue([])
    users.read.findMany.mockResolvedValue([])
    collections.read.findMany.mockResolvedValue([])
    module = await Test.createTestingModule({
      providers: [
        SyncSearchJobHandler,
        { provide: SearchService, useValue: search },
        { provide: CacheService, useValue: cache },
        { provide: ItemRepository, useValue: items },
        { provide: UserRepository, useValue: users },
        { provide: CollectionRepository, useValue: collections },
      ],
    }).compile()
    handler = module.get(SyncSearchJobHandler)
  })

  afterEach(async () => module?.close())

  it("публикует контрольную отметку начала только после завершения всех индексов", async () => {
    const startedAt = Date.now()
    search.ensureIndex.mockImplementation(async () => {
      expect(cache.set).not.toHaveBeenCalled()
    })
    await handler.handle(null, context)
    expect(search.ensureIndex).toHaveBeenCalledTimes(3)
    expect(cache.set).toHaveBeenCalledTimes(1)
    const [key, checkpoint, ttl] = cache.set.mock.calls[0]
    expect(key).toBe(SEARCH_SETTINGS.checkpointKey)
    expect(checkpoint).toBeGreaterThanOrEqual(startedAt)
    expect(checkpoint).toBeLessThanOrEqual(Date.now())
    expect(ttl).toBe(0)
    expect(users.read.findMany).toHaveBeenCalledWith(
      { updatedAt: { $gte: new Date(60_000) } },
      expect.any(Object),
      expect.objectContaining({ limit: 500 }),
    )
    expect(items.readSearchIndexBatch).toHaveBeenCalledWith({
      afterId: undefined,
      limit: 500,
    })
  })

  it("сбрасывает отметку и полностью перечитывает данные при потере любого индекса", async () => {
    search.hasIndex.mockResolvedValueOnce(false)
    await handler.handle(null, context)
    expect(cache.get).not.toHaveBeenCalled()
    expect(cache.delete).toHaveBeenCalledWith(SEARCH_SETTINGS.checkpointKey)
    expect(users.read.findMany).toHaveBeenCalledWith(
      {},
      expect.any(Object),
      expect.any(Object),
    )
    expect(collections.read.findMany).toHaveBeenCalledWith(
      {},
      expect.any(Object),
      expect.any(Object),
    )
  })

  it("продолжает очистку с прежнего смещения после удаления всей страницы сирот", async () => {
    const ids = Array.from({ length: 3 }, () => String(new Types.ObjectId()))
    search.readDocumentIds
      .mockResolvedValueOnce(ids.slice(0, 2))
      .mockResolvedValueOnce(ids.slice(2))
      .mockResolvedValue([])
    await handler.handle(null, context)
    expect(search.deleteMany.mock.calls).toEqual([
      [SEARCH_SETTINGS.indexes.items, ids.slice(0, 2)],
      [SEARCH_SETTINGS.indexes.items, ids.slice(2)],
    ])
    expect(search.readDocumentIds.mock.calls.slice(0, 3)).toEqual([
      [SEARCH_SETTINGS.indexes.items, { offset: 0, limit: 500 }],
      [SEARCH_SETTINGS.indexes.items, { offset: 0, limit: 500 }],
      [SEARCH_SETTINGS.indexes.items, { offset: 0, limit: 500 }],
    ])
  })

  it.each(["settings", "read", "cleanup", "delete"])(
    "сохраняет прежнюю отметку и исходную ошибку при сбое %s",
    async (phase) => {
      const error = new Error("search failed")
      if (phase === "settings") {
        search.ensureIndex.mockRejectedValueOnce(error)
      } else if (phase === "read") {
        items.readSearchIndexBatch.mockRejectedValueOnce(error)
      } else if (phase === "cleanup") {
        search.readDocumentIds.mockRejectedValueOnce(error)
      } else {
        search.readDocumentIds.mockResolvedValueOnce([
          String(new Types.ObjectId()),
        ])
        search.deleteMany.mockRejectedValueOnce(error)
      }
      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(cache.set).not.toHaveBeenCalled()
      expect(cache.delete).not.toHaveBeenCalled()
    },
  )

  it.each([1, 2, 3, 10])(
    "не публикует новую отметку при отмене на проверке %i",
    async (step) => {
      const error = new Error("cancelled")
      for (let index = 1; index < step; index += 1) {
        context.throwIfCancelled.mockResolvedValueOnce(undefined)
      }
      context.throwIfCancelled.mockRejectedValueOnce(error)
      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(cache.set).not.toHaveBeenCalled()
    },
  )
})
