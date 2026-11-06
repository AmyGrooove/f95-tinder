import { describe, expect, it, jest } from "@jest/globals"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { TagRepository } from "@entities/tag/services/tagRepository"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { SearchService } from "@infrastructure/search/services/searchService"

import { SyncTagSearchJobHandler } from "../core/syncTagSearchJob.handler"

describe("SyncTagSearchJobHandler", () => {
  const createHandler = async ({
    isIndexPresent,
    checkpoint,
  }: {
    isIndexPresent: boolean
    checkpoint: number | null
  }) => {
    const id = new Types.ObjectId()
    const findMany = jest
      .fn()
      .mockReturnValueOnce([
        { _id: id, key: "exampleTag", group: null, name: { en: "Adventure" } },
      ])
      .mockReturnValueOnce([])
    const get = jest.fn().mockReturnValue(checkpoint)
    const set = jest.fn()
    const ensureIndex = jest.fn()
    const upsert = jest.fn()
    const readDocumentIds = jest
      .fn()
      .mockReturnValueOnce(["deleted-id", id.toString()])
      .mockReturnValueOnce([])
    const deleteMany = jest.fn()
    const removeCheckpoint = jest.fn()
    const module = await Test.createTestingModule({
      providers: [
        SyncTagSearchJobHandler,
        { provide: TagRepository, useValue: { read: { findMany } } },
        {
          provide: CacheService,
          useValue: { get, set, delete: removeCheckpoint },
        },
        {
          provide: SearchService,
          useValue: {
            hasIndex: jest.fn().mockReturnValue(isIndexPresent),
            ensureIndex,
            upsert,
            readDocumentIds,
            deleteMany,
          },
        },
      ],
    }).compile()

    const handler = module.get(SyncTagSearchJobHandler)
    const run = async () => {
      try {
        await handler.handle(null, {
          id: "test",
          attempt: 1,
          updateProgress: async () => {},
          throwIfCancelled: async () => {},
        })
      } finally {
        await module.close()
      }
    }

    return {
      id,
      run,
      ensureIndex,
      findMany,
      upsert,
      readDocumentIds,
      deleteMany,
      set,
      removeCheckpoint,
    }
  }

  it("создаёт индекс для обоих языков, удаляет устаревшие теги и отмечает успешное обновление", async () => {
    const { id, run, ensureIndex, upsert, readDocumentIds, deleteMany, set } =
      await createHandler({
        isIndexPresent: false,
        checkpoint: null,
      })

    await run()

    expect(ensureIndex).toHaveBeenCalledWith(
      "site_tags",
      expect.objectContaining({
        searchableAttributes: ["name.ru", "name.en"],
        typoTolerance: expect.objectContaining({ enabled: true }),
      }),
      true,
    )
    expect(upsert).toHaveBeenCalledWith(
      "site_tags",
      [
        {
          id: id.toString(),
          key: "exampleTag",
          group: "ungrouped",
          name: { ru: null, en: "Adventure" },
        },
      ],
      true,
    )
    expect(deleteMany).toHaveBeenCalledWith("site_tags", ["deleted-id"])
    expect(readDocumentIds).toHaveBeenLastCalledWith("site_tags", {
      offset: 1,
      limit: 500,
    })
    expect(set).toHaveBeenCalledWith(
      "tagSearch:checkpoint:v1",
      expect.any(Number),
      0,
    )
  })

  it("пропускает повторное обновление за текущую неделю, если индекс существует", async () => {
    const { run, findMany, ensureIndex, set } = await createHandler({
      isIndexPresent: true,
      checkpoint: Date.now(),
    })

    await run()

    expect(ensureIndex).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it("при исчезновении индекса сбрасывает старую отметку и сохраняет ошибку задачи для повтора", async () => {
    const { run, upsert, set, removeCheckpoint } = await createHandler({
      isIndexPresent: false,
      checkpoint: Date.now(),
    })
    upsert.mockImplementationOnce(() => {
      throw new Error("index unavailable")
    })

    await expect(run()).rejects.toThrow("index unavailable")
    expect(removeCheckpoint).toHaveBeenCalledWith("tagSearch:checkpoint:v1")
    expect(set).not.toHaveBeenCalled()
  })

  it("обновляет индекс после пропущенной недели", async () => {
    const { run, upsert, set } = await createHandler({
      isIndexPresent: true,
      checkpoint: 1,
    })

    await run()

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledTimes(1)
  })
})
