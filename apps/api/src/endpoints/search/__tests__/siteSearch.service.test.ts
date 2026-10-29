import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import type { Collection } from "@entities/collection/schemas/collection.schema"
import type { User } from "@entities/user/schemas/user.schema"
import type { Item } from "@entities/item/schemas/item.schema"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { CacheService } from "@infrastructure/cache/services/cache.service"
import { SearchService } from "@infrastructure/search/services/search.service"

import { SearchBodyDto } from "../dto/body/search.body"
import { SiteSearchService } from "../services/siteSearch.service"
import { SEARCH_SETTINGS } from "../static/SEARCH_SETTINGS"

describe("SiteSearchService", () => {
  const cache = { get: jest.fn<CacheService["get"]>() }
  const search = {
    search: jest.fn<SearchService["search"]>(),
    iterateMatches: jest.fn<SearchService["iterateMatches"]>(),
  }
  const items = {
    read: {
      findMany:
        jest.fn<
          () => Promise<Pick<Item, "_id" | "type" | "title" | "media">[]>
        >(),
    },
  }
  const users = {
    read: {
      findMany:
        jest.fn<
          (
            ...args: Parameters<UserRepository["read"]["findMany"]>
          ) => Promise<
            Pick<User, "_id" | "username" | "displayName" | "avatarUrl">[]
          >
        >(),
    },
  }
  const collections = {
    read: {
      findMany:
        jest.fn<
          (
            ...args: Parameters<CollectionRepository["read"]["findMany"]>
          ) => Promise<
            Pick<Collection, "_id" | "type" | "title" | "media" | "author">[]
          >
        >(),
    },
  }
  let service: SiteSearchService
  let module: TestingModule

  beforeEach(async () => {
    jest.resetAllMocks()
    module = await Test.createTestingModule({
      providers: [
        SiteSearchService,
        { provide: SearchService, useValue: search },
        { provide: CacheService, useValue: cache },
        { provide: ItemRepository, useValue: items },
        { provide: UserRepository, useValue: users },
        { provide: CollectionRepository, useValue: collections },
      ],
    }).compile()
    service = module.get(SiteSearchService)
    cache.get.mockResolvedValue(1)
    search.search.mockImplementation(async (_index, query, options) => ({
      hits: [],
      estimatedTotalHits: 0,
      query,
      offset: options?.offset ?? 0,
      limit: options?.limit ?? 10,
      processingTimeMs: 0,
    }))
    items.read.findMany.mockResolvedValue([])
    users.read.findMany.mockResolvedValue([])
    collections.read.findMany.mockResolvedValue([])
  })

  afterEach(async () => module?.close())

  it("передаёт обычную сортировку и смещение в поисковую систему до загрузки карточек", async () => {
    await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        page: 3,
        limit: 4,
        items: { sort: "title", language: ELanguage.ENGLISH },
        users: { sort: "username" },
        collections: { sort: "updatedAt" },
      }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.items,
      "orbit",
      expect.objectContaining({
        offset: 8,
        limit: 4,
        sort: ["sortTitle.en:asc", "id:asc"],
        attributesToRetrieve: ["id"],
      }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.users,
      "orbit",
      expect.objectContaining({ sort: ["sortUsername:asc", "id:asc"] }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.collections,
      "orbit",
      expect.objectContaining({ sort: ["updatedAt:desc", "id:asc"] }),
    )
    expect(search.iterateMatches).not.toHaveBeenCalled()
  })

  it("сохраняет порядок поиска и пропускает отсутствующие карточки во всех группах без раскрытия полей хранения", async () => {
    const first = new Types.ObjectId("000000000000000000000001")
    const missing = new Types.ObjectId("000000000000000000000002")
    const last = new Types.ObjectId("000000000000000000000003")
    search.search.mockResolvedValue({
      hits: [first, missing, last].map((id) => ({ id: String(id) })),
      estimatedTotalHits: 3,
      query: "orbit",
      offset: 0,
      limit: 10,
      processingTimeMs: 0,
    })
    items.read.findMany.mockResolvedValue(
      [last, first].map((_id) => ({
        _id,
        type: EItemType.MOVIE,
        title: { ru: "Актуальное название", en: null },
        media: [],
        secret: "internal",
      })),
    )
    users.read.findMany.mockResolvedValue(
      [last, first].map((_id) => ({
        _id,
        username: "username",
        displayName: "Имя",
        avatarUrl: null,
        passwordHash: "internal",
      })),
    )
    collections.read.findMany.mockResolvedValue(
      [last, first].map((_id) => ({
        _id,
        type: ECollectionType.CUSTOM,
        title: { ru: "Подборка", en: null },
        media: [],
        author: _id.equals(first) ? first : null,
        secret: "internal",
      })),
    )

    const result = await service.search(
      Object.assign(new SearchBodyDto(), { search: "orbit" }),
    )

    expect(result).toEqual({
      items: {
        hits: [first, last].map((id) => ({
          id: String(id),
          type: "movie",
          title: { ru: "Актуальное название", en: null },
          media: [],
        })),
        estimatedTotalHits: 3,
      },
      users: {
        hits: [first, last].map((id) => ({
          id: String(id),
          username: "username",
          displayName: "Имя",
          avatarUrl: null,
        })),
        estimatedTotalHits: 3,
      },
      collections: {
        hits: [first, last].map((id) => ({
          id: String(id),
          type: "custom",
          title: { ru: "Подборка", en: null },
          media: [],
          authorId: id.equals(first) ? String(first) : null,
        })),
        estimatedTotalHits: 3,
      },
    })
  })

  it("обходит кандидатов за пределами maxTotalHits при обратной релевантности и разрешает равенство по ID", async () => {
    const ids = Array.from(
      { length: SEARCH_SETTINGS.maxTotalHits + 2 },
      (_, index) =>
        new Types.ObjectId((index + 1).toString(16).padStart(24, "0")),
    )
    search.iterateMatches.mockImplementation(async function* () {
      yield ids
        .slice(0, 500)
        .map((id) => ({ id: String(id), _rankingScore: 0.9 }))
      yield ids
        .slice(500, -2)
        .map((id) => ({ id: String(id), _rankingScore: 0.8 }))
      yield [...ids.slice(-2)]
        .reverse()
        .map((id) => ({ id: String(id), _rankingScore: 0.1 }))
    })
    items.read.findMany.mockResolvedValue(
      ids
        .slice(-2)
        .reverse()
        .map((_id) => ({
          _id,
          type: EItemType.MOVIE,
          title: { ru: "Орбита", en: null },
          media: [],
        })),
    )
    const result = await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        limit: 1,
        page: 2,
        items: { direction: "asc" },
      }),
    )
    expect(result.items).toEqual({
      hits: [
        {
          id: String(ids.at(-1)),
          type: "movie",
          title: { ru: "Орбита", en: null },
          media: [],
        },
      ],
      estimatedTotalHits: SEARCH_SETTINGS.maxTotalHits + 2,
    })
    expect(search.iterateMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        index: SEARCH_SETTINGS.indexes.items,
        batchSize: 500,
      }),
    )
  })

  it.each([undefined, NaN, Infinity])(
    "возвращает 503 вместо частичного результата при неверном _rankingScore %s",
    async (score) => {
      search.iterateMatches.mockImplementation(async function* () {
        yield [
          { id: String(new Types.ObjectId()), _rankingScore: score as number },
        ]
      })
      await expect(
        service.search(
          Object.assign(new SearchBodyDto(), {
            search: "orbit",
            users: { direction: "asc" },
          }),
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException)
      expect(items.read.findMany).not.toHaveBeenCalled()
    },
  )

  it("не обращается к индексам без контрольной отметки", async () => {
    cache.get.mockResolvedValue(null)
    await expect(
      service.search(Object.assign(new SearchBodyDto(), { search: "orbit" })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(search.search).not.toHaveBeenCalled()
  })

  it("отклоняет недоступную глубину страницы до обращения к Redis", async () => {
    await expect(
      service.search(
        Object.assign(new SearchBodyDto(), {
          search: "orbit",
          page: 201,
          limit: 50,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(cache.get).not.toHaveBeenCalled()
  })

  it("усекает последнюю доступную страницу на границе maxTotalHits", async () => {
    await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        page: 204,
        limit: 49,
      }),
    )
    expect(search.search).toHaveBeenCalledTimes(3)
    for (const call of search.search.mock.calls) {
      expect(call[2]).toMatchObject({ offset: 9947, limit: 49 })
    }
    await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        page: 205,
        limit: 49,
      }),
    )
    for (const call of search.search.mock.calls.slice(3)) {
      expect(call[2]).toMatchObject({ offset: 9996, limit: 4 })
    }
  })

  it.each(["cache", "index", "database"])(
    "преобразует сбой %s в 503 с исходной причиной",
    async (source) => {
      const error = new Error("unavailable")
      if (source === "cache") {
        cache.get.mockRejectedValue(error)
      } else if (source === "index") {
        search.search.mockRejectedValue(error)
      } else {
        items.read.findMany.mockRejectedValue(error)
      }
      await expect(
        service.search(Object.assign(new SearchBodyDto(), { search: "orbit" })),
      ).rejects.toMatchObject({ status: 503, cause: error })
    },
  )
})
