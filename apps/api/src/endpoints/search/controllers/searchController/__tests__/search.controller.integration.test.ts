import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import { promisify } from "node:util"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import type { FastifyInstance } from "fastify"
import { Meilisearch } from "meilisearch"
import { Types } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import type { Item } from "@entities/item/schemas/item.schema"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { SearchService } from "@infrastructure/search/services/searchService"
import { createTestApplication } from "@app/__tests__/setup/createTestApplication"

import { SyncSearchJobHandler } from "@endpoints/search/services/syncSearchJobHandler"
import { SEARCH_SETTINGS } from "@endpoints/search/static/SEARCH_SETTINGS"
import type { SearchResponseDto } from "@endpoints/search/services/siteSearchService"

describe("SearchController HTTP + MongoDB + Redis + Meilisearch", () => {
  const docker = promisify(execFile)
  let containerId: string | undefined
  let application: Awaited<ReturnType<typeof createTestApplication>>
  let client: Meilisearch

  beforeAll(async () => {
    const apiKey = randomUUID()
    const { stdout } = await docker(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        `bisky-site-search-test-${randomUUID()}`,
        "--publish",
        "127.0.0.1::7700",
        "--env",
        `MEILI_MASTER_KEY=${apiKey}`,
        "--env",
        "MEILI_NO_ANALYTICS=true",
        "getmeili/meilisearch:v1.12.8",
      ],
      { timeout: 180_000 },
    )
    containerId = stdout.trim()
    const { stdout: port } = await docker("docker", [
      "port",
      containerId,
      "7700/tcp",
    ])
    const host = `http://${port.trim()}`
    client = new Meilisearch({ host, apiKey, timeout: 1_000 })
    const deadline = Date.now() + 30_000

    while (true) {
      try {
        await client.health()
        break
      } catch (error) {
        if (Date.now() >= deadline) {
          throw error
        }
        await setTimeout(100)
      }
    }

    application = await createTestApplication({ host, apiKey })
  }, 240_000)

  beforeEach(async () => {
    await application.reset()
    for (const index of Object.values(SEARCH_SETTINGS.indexes)) {
      if (await application.app.get(SearchService).hasIndex(index)) {
        await application.app.get(SearchService).clear(index, true)
      }
    }
  })

  afterAll(async () => {
    try {
      await application?.close()
    } finally {
      if (containerId !== undefined) {
        await docker("docker", ["rm", "--force", containerId], {
          timeout: 30_000,
        })
      }
    }
  }, 60_000)

  const synchronize = async () => {
    await application.app.get(SyncSearchJobHandler).handle(null, {
      id: "search-test",
      attempt: 1,
      updateProgress: async () => {},
      throwIfCancelled: async () => {},
    })
  }

  const query = async (
    payload: unknown,
    headers: Record<string, string> = {},
  ) => {
    const fastify: FastifyInstance = application.app
      .getHttpAdapter()
      .getInstance()
    return fastify.inject({
      method: "QUERY",
      url: "/search",
      payload: JSON.stringify(payload),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        ...headers,
      },
    })
  }

  const seedItem = async (overrides: Partial<Item> = {}) => {
    const item = {
      _id: new Types.ObjectId(),
      type: EItemType.MOVIE,
      title: { ru: "Орбита", en: "Orbit" },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
    await application.connection.collection("Item").insertOne(item)
    return item
  }

  it("возвращает независимые публичные группы с актуальными карточками без проверки cookie и записи данных", async () => {
    const { connection } = application
    const item = await seedItem({
      aliases: ["Nebula"],
      description: { ru: "Секретное описание", en: null },
    })
    const user = {
      _id: new Types.ObjectId(),
      username: "nebula",
      displayName: "Pilot",
      avatarUrl: null,
      passwordHash: "private-password",
      accessCodeHash: "private-code",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const collection = {
      _id: new Types.ObjectId(),
      type: "custom",
      author: user._id,
      title: { ru: "Nebula collection", en: null },
      description: { ru: null, en: null },
      media: [],
      blocks: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await connection.collection("User").insertOne(user)
    await connection.collection("Collection").insertOne(collection)
    await synchronize()
    await connection
      .collection("Item")
      .updateOne(
        { _id: item._id },
        { $set: { "title.ru": "Актуальное название" } },
      )
    const before = await Promise.all(
      ["Item", "User", "Collection", "UserItem"].map(async (name) =>
        connection.collection(name).find().toArray(),
      ),
    )

    const response = await query(
      { search: "  Nebula  " },
      { cookie: "__Host-accessToken=invalid" },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["accept-query"]).toBe("application/json")
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(response.json()).toEqual({
      items: [
        {
          id: String(item._id),
          type: "movie",
          title: { ru: "Актуальное название", en: "Orbit" },
          media: [],
        },
      ],
      users: [
        {
          id: String(user._id),
          username: "nebula",
          displayName: "Pilot",
          avatarUrl: null,
        },
      ],
      collections: [
        {
          id: String(collection._id),
          type: "custom",
          title: collection.title,
          media: [],
        },
      ],
      nextCursor: null,
    })
    expect(
      await Promise.all(
        ["Item", "User", "Collection", "UserItem"].map(async (name) =>
          connection.collection(name).find().toArray(),
        ),
      ),
    ).toEqual(before)
  })

  it("применяет все условия по тегам, тип и рейтинг до курсорной пагинации", async () => {
    const requiredTag = new Types.ObjectId()
    const alternativeTag = new Types.ObjectId()
    const excludedTag = new Types.ObjectId()
    await application.connection.collection("Tag").insertMany(
      [requiredTag, alternativeTag, excludedTag].map((_id, index) => ({
        _id,
        key: `searchFilter${index}`,
      })),
    )

    const matched = await Promise.all(
      Array.from({ length: 11 }, () => seedItem()),
    )
    const excluded = await seedItem()
    const wrongType = await seedItem({ type: EItemType.GAME })
    const missingRating = await seedItem()
    const missingAlternative = await seedItem()
    const missingRequired = await seedItem()
    await application.connection.collection("TagItem").insertMany([
      ...[...matched, wrongType, missingRating].flatMap((item) =>
        [requiredTag, alternativeTag].map((tag) => ({
          item: item._id,
          tag,
          relevanceScore: 1,
        })),
      ),
      ...[requiredTag, alternativeTag, excludedTag].map((tag) => ({
        item: excluded._id,
        tag,
        relevanceScore: 1,
      })),
      { item: missingAlternative._id, tag: requiredTag, relevanceScore: 1 },
      { item: missingRequired._id, tag: alternativeTag, relevanceScore: 1 },
    ])
    await application.connection.collection("ItemStats").insertMany(
      [
        ...matched,
        excluded,
        wrongType,
        missingAlternative,
        missingRequired,
      ].map((item) => ({
        item: item._id,
        ratingAverage: 7.5,
        ratingsCount: 1,
      })),
    )
    const collectionId = new Types.ObjectId()
    await application.connection.collection("Collection").insertOne({
      _id: collectionId,
      type: "custom",
      title: { ru: "Орбита", en: null },
      description: { ru: null, en: null },
      media: [],
      author: null,
      deletedAt: null,
      updatedAt: new Date(),
    })
    await synchronize()

    const body = {
      search: "Орбита",
      limit: 10,
      types: {
        allOf: ["items", "users"],
        anyOf: ["collections"],
        noneOf: ["users"],
      },
      items: {
        types: ["movie"],
        tags: {
          allOf: [String(requiredTag).toUpperCase()],
          anyOf: [String(alternativeTag), String(excludedTag)],
          noneOf: [String(excludedTag)],
        },
        rating: { min: 7.5, max: 7.5 },
        sort: { type: "rating" },
      },
    }
    const expected = matched.map((item) => String(item._id)).sort()
    const firstResponse = await query(body)
    expect(firstResponse.statusCode).toBe(200)
    const first = firstResponse.json<SearchResponseDto>()
    expect(first.items.map((item) => item.id)).toEqual(expected.slice(0, 10))
    expect(first.collections.map((collection) => collection.id)).toEqual([
      String(collectionId),
    ])
    expect(first.users).toEqual([])
    expect(first.nextCursor).toEqual(expect.any(String))

    const secondResponse = await query({ ...body, cursor: first.nextCursor })
    expect(secondResponse.statusCode).toBe(200)
    const second = secondResponse.json<SearchResponseDto>()
    expect(second.items.map((item) => item.id)).toEqual(expected.slice(10))
    expect(second.collections).toEqual([])
    expect(second.nextCursor).toBeNull()

    const incompatible = await query({
      ...body,
      search: "Небула",
      cursor: first.nextCursor,
    })
    expect(incompatible.statusCode).toBe(400)
    expect(incompatible.json()).toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Некорректный курсор поиска",
        details: null,
      },
    })
  })

  it.each(["asc", "desc"])(
    "держит неизвестные оценки и даты в конце при направлении %s",
    async (direction) => {
      const unknown = await seedItem()
      const low = await seedItem({ releaseDate: new Date("2000-01-01") })
      const high = await seedItem({ releaseDate: new Date("2020-01-01") })
      await application.connection.collection("ItemStats").insertMany([
        { item: low._id, ratingAverage: 6, ratingsCount: 1 },
        { item: high._id, ratingAverage: 9, ratingsCount: 1 },
      ])
      await synchronize()
      for (const sort of ["rating", "releaseDate"]) {
        const response = await query({
          search: "Орбита",
          items: { sort: { type: sort, direction } },
        })
        expect(response.statusCode).toBe(200)
        expect(
          response.json<SearchResponseDto>().items.map((hit) => hit.id),
        ).toEqual(
          [...(direction === "asc" ? [low, high] : [high, low]), unknown].map(
            (item) => String(item._id),
          ),
        )
      }
    },
  )

  it("сортирует с учётом числа голосов и пересчитывает порядок после изменения среднего сайта", async () => {
    const oneVote = await seedItem()
    const manyVotes = await seedItem()
    const fewerTiedVotes = await seedItem()
    const moreTiedVotes = await seedItem()
    const noVotes = await seedItem()
    await application.connection.collection("ItemStats").insertMany([
      { item: oneVote._id, ratingAverage: 9, ratingsCount: 1 },
      { item: manyVotes._id, ratingAverage: 8, ratingsCount: 100 },
      { item: fewerTiedVotes._id, ratingAverage: 5.5, ratingsCount: 2 },
      { item: moreTiedVotes._id, ratingAverage: 5.5, ratingsCount: 20 },
      { item: noVotes._id, ratingAverage: 10, ratingsCount: 0 },
    ])
    await synchronize()

    const readIds = async (
      direction: "asc" | "desc",
      rating?: { min: number; max: number },
    ) => {
      const response = await query({
        search: "Орбита",
        items: { rating, sort: { type: "rating", direction } },
      })
      expect(response.statusCode).toBe(200)
      return response.json<SearchResponseDto>().items.map((item) => item.id)
    }

    expect(await readIds("desc")).toEqual(
      [manyVotes, oneVote, moreTiedVotes, fewerTiedVotes, noVotes].map((item) =>
        String(item._id),
      ),
    )
    expect(await readIds("asc")).toEqual(
      [moreTiedVotes, fewerTiedVotes, oneVote, manyVotes, noVotes].map((item) =>
        String(item._id),
      ),
    )
    const rating = { min: 8, max: 9 }
    expect(await readIds("desc", rating)).toEqual([
      String(manyVotes._id),
      String(oneVote._id),
    ])

    await application.connection.collection("SiteStats").insertOne({
      key: "ratings",
      sum: 9,
      count: 1,
      average: 9,
    })
    await synchronize()

    expect(await readIds("desc", rating)).toEqual([
      String(oneVote._id),
      String(manyVotes._id),
    ])
  })

  it("сортирует названия на выбранном языке с резервным переводом", async () => {
    const first = await seedItem({ title: { ru: "Zulu", en: "Alpha" } })
    const second = await seedItem({ title: { ru: "Alpha", en: "Zulu" } })
    const fallback = await seedItem({ title: { ru: null, en: "Beta" } })
    await application.connection
      .collection("Item")
      .updateMany({}, { $set: { aliases: ["common"] } })
    await synchronize()
    for (const [language, expected] of [
      ["ru", [second, fallback, first]],
      ["en", [first, fallback, second]],
    ] as const) {
      const response = await query({
        search: "common",
        items: { sort: { type: "title", language } },
      })
      expect(response.statusCode).toBe(200)
      expect(
        response.json<SearchResponseDto>().items.map((hit) => hit.id),
      ).toEqual(expected.map((item) => String(item._id)))
    }
  })

  it("фильтрует подборки по типу и автору независимо от произведений и пользователей", async () => {
    const author = new Types.ObjectId()
    const definitions = [
      { type: "custom", author },
      { type: "tag", author },
      { type: "custom", author: null },
      { type: "custom", author: new Types.ObjectId() },
    ]
    const collections = definitions.map((definition, index) => ({
      _id: new Types.ObjectId(),
      ...definition,
      title: { ru: `Орбита ${index}`, en: null },
      description: { ru: null, en: null },
      media: [],
      deletedAt: null,
      updatedAt: new Date(),
    }))
    await application.connection
      .collection("Collection")
      .insertMany(collections)
    await seedItem()
    await synchronize()
    const response = await query({
      search: "Орбита",
      collections: {
        types: { allOf: ["custom"] },
        authorIds: { anyOf: [String(author).toUpperCase()] },
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json<SearchResponseDto>().collections).toEqual([
      {
        id: String(collections[0]._id),
        type: "custom",
        title: collections[0].title,
        media: [],
      },
    ])
    expect(response.json<SearchResponseDto>().items).toHaveLength(1)

    const excludedAuthor = await query({
      search: "Орбита",
      types: { anyOf: ["collections"] },
      collections: {
        types: { anyOf: ["custom", "tag"], noneOf: ["tag"] },
        authorIds: { noneOf: [String(author)] },
      },
    })
    expect(excludedAuthor.statusCode).toBe(200)
    const excludedAuthorResult = excludedAuthor.json<SearchResponseDto>()
    expect(
      excludedAuthorResult.collections
        .map((collection) => collection.id)
        .sort(),
    ).toEqual(
      collections
        .slice(2)
        .map((collection) => String(collection._id))
        .sort(),
    )
    expect(excludedAuthorResult.items).toEqual([])

    for (const filters of [
      { types: { allOf: ["custom", "tag"] } },
      { authorIds: { allOf: [String(author), String(definitions[3].author)] } },
    ]) {
      const impossible = await query({ search: "Орбита", collections: filters })
      expect(impossible.statusCode).toBe(200)
      expect(impossible.json<SearchResponseDto>().collections).toEqual([])
    }
  })

  it("не возвращает удалённые MongoDB записи из устаревшего индекса и очищает их при синхронизации", async () => {
    const softDeleted = await seedItem()
    const hardDeleted = await seedItem()
    await synchronize()
    await application.connection
      .collection("Item")
      .updateOne({ _id: softDeleted._id }, { $set: { deletedAt: new Date() } })
    await application.connection
      .collection("Item")
      .deleteOne({ _id: hardDeleted._id })
    const stale = await query({ search: "Орбита" })
    expect(stale.statusCode).toBe(200)
    expect(stale.json<SearchResponseDto>().items).toEqual([])
    await synchronize()
    const refreshed = await query({ search: "Орбита" })
    expect(refreshed.statusCode).toBe(200)
    expect(refreshed.json<SearchResponseDto>().items).toEqual([])
  })

  it("обновляет теги и метрики при неизменном updatedAt произведения и игнорирует отсутствующие теги", async () => {
    const item = await seedItem()
    const tagId = new Types.ObjectId()
    await application.connection
      .collection("TagItem")
      .insertOne({ item: item._id, tag: tagId })
    await synchronize()
    const body = {
      search: "Орбита",
      items: {
        tags: { allOf: [String(tagId)] },
        rating: { min: 8 },
      },
    }
    expect((await query(body)).json<SearchResponseDto>().items).toEqual([])
    await application.connection
      .collection("Tag")
      .insertOne({ _id: tagId, key: "searchUpdatedTag" })
    await application.connection
      .collection("ItemStats")
      .insertOne({ item: item._id, ratingAverage: 8, ratingsCount: 1 })
    await synchronize()
    const matched = await query(body)
    expect(matched.statusCode).toBe(200)
    expect(
      matched.json<SearchResponseDto>().items.map((hit) => hit.id),
    ).toEqual([String(item._id)])
    await application.connection
      .collection("TagItem")
      .deleteMany({ item: item._id })
    await synchronize()
    expect((await query(body)).json<SearchResponseDto>().items).toEqual([])
  })

  it("восстанавливает потерянный индекс даже при существующей контрольной отметке", async () => {
    const item = await seedItem()
    await synchronize()
    const task = await client.deleteIndex(SEARCH_SETTINGS.indexes.items)
    await client.tasks.waitForTask(task.taskUid)
    await synchronize()
    const response = await query({ search: "Орбита" })
    expect(response.statusCode).toBe(200)
    expect(
      response.json<SearchResponseDto>().items.map((hit) => hit.id),
    ).toEqual([String(item._id)])
  })

  it("обходит несколько пакетов при синхронизации и обратной релевантности всех трёх групп", async () => {
    const { connection } = application
    const count = SEARCH_SETTINGS.batchSize + 2
    const items = Array.from({ length: count }, () => ({
      _id: new Types.ObjectId(),
      type: "movie",
      title: { ru: "Orbit", en: null },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      deletedAt: null,
    }))
    const users = Array.from({ length: count }, (_, index) => ({
      _id: new Types.ObjectId(),
      username: `user${index}`,
      displayName: "Orbit",
      avatarUrl: null,
    }))
    const collections = Array.from({ length: count }, () => ({
      _id: new Types.ObjectId(),
      type: "custom",
      title: { ru: "Orbit", en: null },
      description: { ru: null, en: null },
      media: [],
      author: null,
      deletedAt: null,
      updatedAt: new Date(),
    }))
    await connection.collection("Item").insertMany(items)
    await connection.collection("User").insertMany(users)
    await connection.collection("Collection").insertMany(collections)
    await synchronize()
    const response = await query({
      search: "Orbit",
      limit: 10,
      items: { sort: { type: "relevance", direction: "asc" } },
      users: { sort: { type: "relevance", direction: "asc" } },
      collections: { sort: { type: "relevance", direction: "asc" } },
    })
    expect(response.statusCode).toBe(200)
    const result = response.json<SearchResponseDto>()
    expect(result.nextCursor).toEqual(expect.any(String))
    for (const [group, records] of [
      ["items", items],
      ["users", users],
      ["collections", collections],
    ] as const) {
      expect(result[group].map((hit) => hit.id)).toEqual(
        records
          .map((record) => String(record._id))
          .sort()
          .slice(0, 10),
      )
    }
  })

  it("обновляет и удаляет пользователей и подборки при повторной синхронизации", async () => {
    const { connection } = application
    const old = new Date("2020-01-01")
    const user = {
      _id: new Types.ObjectId(),
      username: "orbit",
      displayName: "Orbit",
      avatarUrl: null,
      updatedAt: old,
    }
    const collection = {
      _id: new Types.ObjectId(),
      type: "custom",
      title: { ru: "Orbit", en: null },
      description: { ru: null, en: null },
      media: [],
      author: null,
      deletedAt: null,
      updatedAt: old,
    }
    await connection.collection("User").insertOne(user)
    await connection.collection("Collection").insertOne(collection)
    await synchronize()
    await connection.collection("User").updateOne(
      { _id: user._id },
      {
        $set: {
          username: "nebula",
          displayName: "Nebula",
          updatedAt: new Date(),
        },
      },
    )
    await connection
      .collection("Collection")
      .updateOne(
        { _id: collection._id },
        { $set: { "title.ru": "Nebula", updatedAt: new Date() } },
      )
    await synchronize()
    const oldResults = await query({ search: "Orbit" })
    expect(oldResults.statusCode).toBe(200)
    expect(oldResults.json<SearchResponseDto>().users).toEqual([])
    expect(oldResults.json<SearchResponseDto>().collections).toEqual([])
    const updated = await query({ search: "Nebula" })
    expect(updated.statusCode).toBe(200)
    expect(
      updated.json<SearchResponseDto>().users.map((hit) => hit.id),
    ).toEqual([String(user._id)])
    expect(
      updated.json<SearchResponseDto>().collections.map((hit) => hit.id),
    ).toEqual([String(collection._id)])
    await connection.collection("User").deleteOne({ _id: user._id })
    await connection
      .collection("Collection")
      .updateOne(
        { _id: collection._id },
        { $set: { deletedAt: new Date(), updatedAt: new Date() } },
      )
    await synchronize()
    const deleted = await query({ search: "Nebula" })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json<SearchResponseDto>().users).toEqual([])
    expect(deleted.json<SearchResponseDto>().collections).toEqual([])
  })

  it("возвращает пустые группы при отсутствии совпадений и 503 до первой синхронизации", async () => {
    const unavailable = await query({ search: "Орбита" })
    expect(unavailable.statusCode).toBe(503)
    expect(unavailable.json()).toMatchObject({ error: { code: "HTTP_503" } })
    await synchronize()
    const empty = await query({ search: "несуществующийзапрос" })
    expect(empty.statusCode).toBe(200)
    expect(empty.json()).toEqual({
      items: [],
      collections: [],
      users: [],
      nextCursor: null,
    })
    await application.app
      .get(CacheService)
      .delete(SEARCH_SETTINGS.checkpointKey)
    expect((await query({ search: "Орбита" })).statusCode).toBe(503)
  })

  it.each([
    null,
    [],
    "text",
    {},
    { search: " " },
    { search: "x".repeat(201) },
    { search: 12 },
    { search: "x", page: 1 },
    { search: "x", limit: "10" },
    { search: "x", limit: 51 },
    { search: "x", cursor: null },
    { search: "x", cursor: "broken" },
    { search: "x", unknown: true },
    { search: "x", types: { allOf: [] } },
    { search: "x", types: { anyOf: ["unknown"] } },
    { search: "x", types: { noneOf: ["items", "items"] } },
    { search: "x", items: null },
    { search: "x", users: [] },
    { search: "x", collections: "bad" },
    { search: "x", items: { sort: "rating" } },
    { search: "x", items: { sort: { type: "recommended" } } },
    { search: "x", items: { sort: { direction: "asc" } } },
    { search: "x", items: { sort: { type: "rating", direction: "up" } } },
    { search: "x", items: { sort: { type: "title", language: "de" } } },
    { search: "x", items: { types: [] } },
    { search: "x", items: { types: ["movie", "movie"] } },
    { search: "x", items: { tags: { anyOf: ["bad"] } } },
    {
      search: "x",
      items: {
        tags: {
          allOf: ["abcdefabcdefabcdefabcdef", "ABCDEFABCDEFABCDEFABCDEF"],
        },
      },
    },
    { search: "x", items: { rating: { min: "8" } } },
    { search: "x", items: { rating: { min: 8, max: 7 } } },
    { search: "x", items: { rating: {} } },
    { search: "x", items: { rating: { max: 11 } } },
    { search: "x", items: { fields: [{ field: "movie.duration", min: 90 }] } },
    { search: "x", items: { tagIds: ["abcdefabcdefabcdefabcdef"] } },
    { search: "x", collections: { authorIds: { noneOf: [] } } },
    { search: "x", collections: { types: { anyOf: ["bad"] } } },
    { search: "x", users: { sort: { type: "username" } } },
    { search: "x", users: { sort: { type: "displayName", language: "ru" } } },
  ])("отклоняет некорректный запрос без запуска поиска: %j", async (body) => {
    const search = application.app.get(SearchService)
    const searchIndex = jest.spyOn(search, "search")
    const iterateMatches = jest.spyOn(search, "iterateMatches")
    const response = await query(body)
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: "BAD_REQUEST" } })
    expect(searchIndex).not.toHaveBeenCalled()
    expect(iterateMatches).not.toHaveBeenCalled()
  })

  it("сохраняет CORS для QUERY и блокирует посторонний Origin", async () => {
    const fastify: FastifyInstance = application.app
      .getHttpAdapter()
      .getInstance()
    const preflight = await fastify.inject({
      method: "OPTIONS",
      url: "/search",
      headers: {
        origin: "http://localhost",
        "access-control-request-method": "QUERY",
        "access-control-request-headers": "content-type",
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers["access-control-allow-methods"]).toContain("QUERY")
    expect(
      (await query({ search: "Орбита" }, { origin: "https://foreign.example" }))
        .statusCode,
    ).toBe(403)
  })
})
