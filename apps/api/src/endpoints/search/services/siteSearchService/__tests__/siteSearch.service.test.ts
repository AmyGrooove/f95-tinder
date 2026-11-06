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
  ValidationPipe,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/itemRepository"
import { UserRepository } from "@entities/user/services/userRepository"
import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import type { Collection } from "@entities/collection/schemas/collection.schema"
import type { User } from "@entities/user/schemas/user.schema"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { SearchService } from "@infrastructure/search/services/searchService"
import { ESearchSortDirection } from "@infrastructure/search/types/ESearchSortDirection"

import { SearchBodyDto } from "../dto/search.body"
import { ESearchCollectionSort } from "../types/ESearchCollectionSort"
import { ESearchGroup } from "../types/ESearchGroup"
import { ESearchItemSort } from "../types/ESearchItemSort"
import { ESearchUserSort } from "../types/ESearchUserSort"
import { SiteSearchService } from "../core/siteSearch.service"
import { SEARCH_SETTINGS } from "@endpoints/search/static/SEARCH_SETTINGS"

describe("SiteSearchService", () => {
  const cache = { get: jest.fn<CacheService["get"]>() }
  const search = {
    search:
      jest.fn<
        (
          ...args: Parameters<SearchService["search"]>
        ) => ReturnType<SearchService["search"]>
      >(),
    iterateMatches: jest.fn<SearchService["iterateMatches"]>(),
  }
  const items = {
    readPosterCardsByIds: jest.fn<ItemRepository["readPosterCardsByIds"]>(),
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
    items.readPosterCardsByIds.mockResolvedValue([])
    users.read.findMany.mockResolvedValue([])
    collections.read.findMany.mockResolvedValue([])
  })

  afterEach(async () => module?.close())

  it("передаёт обычную сортировку и смещение в поисковую систему до загрузки карточек", async () => {
    await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        limit: 10,
        items: {
          sort: { type: ESearchItemSort.TITLE, language: ELanguage.ENGLISH },
        },
        users: { sort: { type: ESearchUserSort.DISPLAY_NAME } },
        collections: { sort: { type: ESearchCollectionSort.UPDATED_AT } },
      }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.items,
      "orbit",
      expect.objectContaining({
        offset: 0,
        limit: 11,
        sort: ["sortTitle.en:asc", "id:asc"],
        attributesToRetrieve: ["id"],
      }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.users,
      "orbit",
      expect.objectContaining({ sort: ["sortDisplayName:asc", "id:asc"] }),
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
    items.readPosterCardsByIds.mockResolvedValue(
      [first, last].map((_id) => ({
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

    expect(items.readPosterCardsByIds).toHaveBeenCalledWith([
      first,
      missing,
      last,
    ])
    expect(result).toEqual({
      items: [first, last].map((id) => ({
        id: String(id),
        type: "movie",
        title: { ru: "Актуальное название", en: null },
        media: [],
      })),
      users: [first, last].map((id) => ({
        id: String(id),
        username: "username",
        displayName: "Имя",
        avatarUrl: null,
      })),
      collections: [first, last].map((id) => ({
        id: String(id),
        type: "custom",
        title: { ru: "Подборка", en: null },
        media: [],
      })),
      nextCursor: null,
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
    items.readPosterCardsByIds.mockResolvedValue(
      ids.slice(-2).map((_id) => ({
        _id,
        type: EItemType.MOVIE,
        title: { ru: "Орбита", en: null },
        media: [],
      })),
    )
    const result = await service.search(
      Object.assign(new SearchBodyDto(), {
        search: "orbit",
        limit: 10,
        items: {
          sort: {
            type: ESearchItemSort.RELEVANCE,
            direction: ESearchSortDirection.ASC,
          },
        },
      }),
    )
    expect(result.items.map((item) => item.id)).toEqual(
      ids.slice(-2).map(String),
    )
    expect(items.readPosterCardsByIds).toHaveBeenCalledWith([
      ...ids.slice(-2),
      ...ids.slice(500, 508),
    ])
    expect(result.nextCursor).toEqual(expect.any(String))
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
            users: {
              sort: {
                type: ESearchUserSort.RELEVANCE,
                direction: ESearchSortDirection.ASC,
              },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException)
      expect(items.readPosterCardsByIds).not.toHaveBeenCalled()
    },
  )

  it("не обращается к индексам без контрольной отметки", async () => {
    cache.get.mockResolvedValue(null)
    await expect(
      service.search(Object.assign(new SearchBodyDto(), { search: "orbit" })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(search.search).not.toHaveBeenCalled()
  })

  it("валидирует вложенные настройки через HTTP pipe и сохраняет лимит по умолчанию", async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
    const metadata = { type: "body", metatype: SearchBodyDto } as const
    const author = "507f1f77bcf86cd799439014"
    const requiredTag = "507f1f77bcf86cd799439011"
    const body: SearchBodyDto = await pipe.transform(
      {
        search: "  orbit  ",
        types: { allOf: ["items"], anyOf: ["collections"] },
        items: {
          tags: { allOf: [requiredTag], anyOf: ["507f1f77bcf86cd799439012"] },
          rating: { min: 7 },
        },
        collections: { authorIds: { noneOf: [author] } },
      },
      metadata,
    )

    await expect(service.search(body)).resolves.toEqual({
      items: [],
      collections: [],
      users: [],
      nextCursor: null,
    })
    expect(search.search).toHaveBeenCalledTimes(2)
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.items,
      "orbit",
      expect.objectContaining({
        limit: 21,
        filter: [
          'tagIds = "507f1f77bcf86cd799439011"',
          'tagIds IN ["507f1f77bcf86cd799439012"]',
          "rating IS NOT NULL",
          "rating >= 7",
        ],
      }),
    )
    expect(search.search).toHaveBeenCalledWith(
      SEARCH_SETTINGS.indexes.collections,
      "orbit",
      expect.objectContaining({
        filter: ['authorId NOT IN ["507f1f77bcf86cd799439014"]'],
      }),
    )

    for (const invalid of [
      { search: "orbit", page: 1 },
      { search: "orbit", items: { fields: [] } },
      { search: "orbit", items: { tags: { anyOf: [] } } },
      { search: "orbit", users: { sort: { type: "username" } } },
      { search: "orbit", cursor: null },
    ]) {
      await expect(pipe.transform(invalid, metadata)).rejects.toBeInstanceOf(
        BadRequestException,
      )
    }
  })

  it("возвращает пустые группы без зависимостей при исключении всех групп или несовместимых типах коллекции", async () => {
    const emptyResult = {
      items: [],
      collections: [],
      users: [],
      nextCursor: null,
    }

    await expect(
      service.search({
        search: "orbit",
        limit: 20,
        types: {
          noneOf: [
            ESearchGroup.ITEMS,
            ESearchGroup.COLLECTIONS,
            ESearchGroup.USERS,
          ],
        },
      }),
    ).resolves.toEqual(emptyResult)
    await expect(
      service.search({
        search: "orbit",
        limit: 20,
        types: { anyOf: [ESearchGroup.COLLECTIONS] },
        collections: {
          types: { allOf: [ECollectionType.CUSTOM, ECollectionType.TAG] },
        },
      }),
    ).resolves.toEqual(emptyResult)
    expect(cache.get).not.toHaveBeenCalled()
    expect(search.search).not.toHaveBeenCalled()
  })

  it("продолжает только активные группы даже при пустой выдаче из MongoDB", async () => {
    const hits = Array.from({ length: 12 }, () => ({
      id: String(new Types.ObjectId()),
    }))
    search.search.mockImplementation(async (index, query, options) => {
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? 10

      return {
        hits: (index === SEARCH_SETTINGS.indexes.items
          ? hits
          : hits.slice(0, 10)
        ).slice(offset, offset + limit),
        estimatedTotalHits: 999_999,
        offset,
        limit,
        query,
        processingTimeMs: 0,
      }
    })
    const body = Object.assign(new SearchBodyDto(), {
      search: "orbit",
      limit: 10,
      types: {
        allOf: [ESearchGroup.ITEMS],
        anyOf: [ESearchGroup.USERS],
        noneOf: [ESearchGroup.COLLECTIONS],
      },
    })
    const first = await service.search(body)
    expect(first).toEqual({
      items: [],
      collections: [],
      users: [],
      nextCursor: expect.any(String),
    })
    expect(search.search).toHaveBeenCalledTimes(2)

    const cursor = first.nextCursor ?? undefined
    await expect(
      service.search({ ...body, search: "nebula", cursor }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.search({ ...body, limit: 20, cursor }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.search({ ...body, items: { rating: { min: 7 } }, cursor }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.search({
        ...body,
        items: { sort: { type: ESearchItemSort.RATING } },
        cursor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.search({
        ...body,
        types: { anyOf: [ESearchGroup.USERS] },
        cursor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.search({ ...body, cursor: "broken" }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(search.search).toHaveBeenCalledTimes(2)

    expect(await service.search({ ...body, cursor })).toEqual({
      items: [],
      collections: [],
      users: [],
      nextCursor: null,
    })
    expect(search.search).toHaveBeenCalledTimes(3)
    expect(search.search).toHaveBeenLastCalledWith(
      SEARCH_SETTINGS.indexes.items,
      "orbit",
      expect.objectContaining({ offset: 10, limit: 11 }),
    )
  })

  it("останавливается на 10000 совпадениях даже при завышенной оценке количества", async () => {
    const hit = { id: String(new Types.ObjectId()) }
    search.search.mockImplementation(async (_index, query, options) => ({
      hits: Array.from({ length: options?.limit ?? 0 }, () => hit),
      estimatedTotalHits: 12_000,
      query,
      offset: options?.offset ?? 0,
      limit: options?.limit ?? 0,
      processingTimeMs: 0,
    }))
    const body = Object.assign(new SearchBodyDto(), {
      search: "orbit",
      types: { anyOf: [ESearchGroup.ITEMS] },
      limit: 50,
    })
    let cursor: string | null = null

    for (let page = 0; page < 200; page += 1) {
      const response = await service.search({
        ...body,
        cursor: cursor ?? undefined,
      })
      cursor = response.nextCursor
      expect(cursor).toEqual(page < 199 ? expect.any(String) : null)
    }

    expect(search.search).toHaveBeenCalledTimes(200)
    expect(search.search).toHaveBeenLastCalledWith(
      SEARCH_SETTINGS.indexes.items,
      "orbit",
      expect.objectContaining({ offset: 9950, limit: 50 }),
    )
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
        search.search.mockResolvedValueOnce({
          hits: [{ id: String(new Types.ObjectId()) }],
          estimatedTotalHits: 1,
          query: "orbit",
          offset: 0,
          limit: 21,
          processingTimeMs: 0,
        })
        items.readPosterCardsByIds.mockRejectedValue(error)
      }
      await expect(
        service.search(Object.assign(new SearchBodyDto(), { search: "orbit" })),
      ).rejects.toMatchObject({ status: 503, cause: error })
    },
  )
})
