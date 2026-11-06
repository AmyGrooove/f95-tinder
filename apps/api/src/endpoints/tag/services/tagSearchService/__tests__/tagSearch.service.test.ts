import { describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common"

import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import type { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import type { SearchService } from "@infrastructure/search/services/searchService"

import { TAG_SEARCH_SETTINGS } from "../../../static/TAG_SEARCH_SETTINGS"
import { TagSearchService } from "../core/tagSearch.service"

describe("TagSearchService", () => {
  const setup = () => {
    const cache = {
      get: jest
        .fn<(key: string) => Promise<number | null>>()
        .mockResolvedValue(1),
    }
    const index = { search: jest.fn<SearchService["search"]>() }
    const service = new TagSearchService(
      index as unknown as SearchService,
      cache as unknown as CacheService,
      new CursorService(),
    )
    return { cache, index, service }
  }

  it("возвращает пустую страницу без обращения к индексу для несовместимых обязательных групп", async () => {
    const { cache, index, service } = setup()

    await expect(
      service.search({
        group: { allOf: [null, ETagGroup.GENRE] },
        limit: 10,
      }),
    ).resolves.toEqual({ items: [], nextCursor: null })
    expect(cache.get).not.toHaveBeenCalled()
    expect(index.search).not.toHaveBeenCalled()
  })

  it("отклоняет невалидный курсор до чтения индекса", async () => {
    const { cache, index, service } = setup()

    await expect(
      service.search({ limit: 10, cursor: "broken" }),
    ).rejects.toThrow(BadRequestException)
    expect(cache.get).not.toHaveBeenCalled()
    expect(index.search).not.toHaveBeenCalled()
  })

  it("возвращает 503 при ошибке чтения контрольной отметки", async () => {
    const { cache, index, service } = setup()
    cache.get.mockRejectedValueOnce(new Error("Cache unavailable"))

    await expect(service.search({ limit: 10 })).rejects.toThrow(
      ServiceUnavailableException,
    )
    expect(cache.get).toHaveBeenCalledWith(TAG_SEARCH_SETTINGS.checkpointKey)
    expect(index.search).not.toHaveBeenCalled()
  })
})
