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
import { EItemField } from "@entities/item/schemas/EItemField"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import type { Item } from "@entities/item/schemas/item.schema"
import { CacheService } from "@infrastructure/cache/services/cache.service"
import { SearchService } from "@infrastructure/search/services/search.service"
import { createTestApplication } from "@test/functions/createTestApplication"

import { SyncSearchJobHandler } from "../handlers/syncSearchJob.handler"
import { SEARCH_SETTINGS } from "../static/SEARCH_SETTINGS"
import type { SearchResponseDto } from "../dto/response/search.response"

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
      displayName: "Nebula user",
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
      items: {
        hits: [
          {
            id: String(item._id),
            type: "movie",
            title: { ru: "Актуальное название", en: "Orbit" },
            media: [],
          },
        ],
        estimatedTotalHits: 1,
      },
      users: {
        hits: [
          {
            id: String(user._id),
            username: "nebula",
            displayName: "Nebula user",
            avatarUrl: null,
          },
        ],
        estimatedTotalHits: 1,
      },
      collections: {
        hits: [
          {
            id: String(collection._id),
            type: "custom",
            title: collection.title,
            media: [],
            authorId: String(user._id),
          },
        ],
        estimatedTotalHits: 1,
      },
    })
    expect(
      await Promise.all(
        ["Item", "User", "Collection", "UserItem"].map(async (name) =>
          connection.collection(name).find().toArray(),
        ),
      ),
    ).toEqual(before)
  })

  it("совмещает все теги, тип, дату, числовое поле и оценку до подсчёта и пагинации", async () => {
    const tags = [new Types.ObjectId(), new Types.ObjectId()]
    await application.connection
      .collection("Tag")
      .insertMany(
        tags.map((_id, index) => ({ _id, key: `searchFilter${index}` })),
      )
    const candidates = await Promise.all([
      seedItem({
        movie: { duration: 90 },
        releaseDate: new Date("2020-01-01"),
      }),
      seedItem({
        movie: { duration: 120 },
        releaseDate: new Date("2020-12-31"),
      }),
      seedItem({
        movie: { duration: 121 },
        releaseDate: new Date("2020-01-01"),
      }),
      seedItem({ movie: { duration: 100 } }),
      seedItem({
        type: EItemType.GAME,
        movie: { duration: 100 },
        releaseDate: new Date("2020-01-01"),
      }),
      seedItem({
        movie: { duration: 100 },
        releaseDate: new Date("2020-01-01"),
      }),
      seedItem({
        movie: { duration: 100 },
        releaseDate: new Date("2020-01-01"),
      }),
    ])
    await application.connection.collection("TagItem").insertMany(
      candidates.flatMap((item, index) =>
        (index === 5 ? tags.slice(0, 1) : tags).map((tag) => ({
          item: item._id,
          tag,
          relevanceScore: 1,
        })),
      ),
    )
    await application.connection
      .collection("ItemStats")
      .insertMany(
        candidates
          .slice(0, 6)
          .map((item) => ({ item: item._id, ratingAverage: 7.5 })),
      )
    await synchronize()
    const body = {
      search: "Орбита",
      limit: 1,
      items: {
        types: ["movie"],
        tagIds: tags.map((tag) => String(tag).toUpperCase()),
        ratingMin: 7.5,
        ratingMax: 7.5,
        fields: [
          { field: "movie.duration", min: 90, max: 120 },
          { field: "releaseDate", min: "2020-01-01", max: "2020-12-31" },
        ],
        sort: "releaseDate",
        direction: "asc",
      },
    }
    for (const [page, expected] of [
      [1, candidates[0]],
      [2, candidates[1]],
      [3, undefined],
    ] as const) {
      const response = await query({ ...body, page })
      expect(response.statusCode).toBe(200)
      expect(response.json<SearchResponseDto>().items).toMatchObject({
        hits:
          expected === undefined
            ? []
            : [expect.objectContaining({ id: String(expected._id) })],
        estimatedTotalHits: 2,
      })
    }
  })

  it.each<{
    field: EItemField
    values: Partial<Item>
    min: number | string
    max: number | string
  }>([
    {
      field: EItemField.EPISODE_COUNT,
      values: { series: { episodeCount: 12 } },
      min: 12,
      max: 12,
    },
    {
      field: EItemField.RELEASED_EPISODE_COUNT,
      values: { series: { releasedEpisodeCount: 0 } },
      min: 0,
      max: 0,
    },
    {
      field: EItemField.EPISODE_DURATION,
      values: { series: { episodeDuration: 24.5 } },
      min: 24.5,
      max: 24.5,
    },
    {
      field: EItemField.NEXT_EPISODE_AT,
      values: { series: { nextEpisodeAt: new Date("2026-10-28T09:00:00Z") } },
      min: "2026-10-28T12:00:00+03:00",
      max: "2026-10-28T09:00:00Z",
    },
    {
      field: EItemField.MAIN_STORY_DURATION,
      values: { game: { mainStoryDuration: 60.5 } },
      min: 60.5,
      max: 60.5,
    },
    {
      field: EItemField.FULL_COMPLETION_DURATION,
      values: { game: { fullCompletionDuration: 120 } },
      min: 120,
      max: 120,
    },
  ])(
    "фильтрует поле $field по включительным границам и исключает неизвестное значение",
    async ({ field, values, min, max }) => {
      const matched = await seedItem({
        ...values,
        type: field.startsWith("game.") ? EItemType.GAME : EItemType.SERIES,
      })
      await seedItem()
      await synchronize()
      const response = await query({
        search: "Орбита",
        items: { fields: [{ field, min, max }] },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json<SearchResponseDto>().items.estimatedTotalHits).toBe(
        1,
      )
      expect(
        response.json<SearchResponseDto>().items.hits.map((hit) => hit.id),
      ).toEqual([String(matched._id)])
    },
  )

  it.each(["asc", "desc"])(
    "держит неизвестные оценки и даты в конце при направлении %s",
    async (direction) => {
      const unknown = await seedItem()
      const low = await seedItem({ releaseDate: new Date("2000-01-01") })
      const high = await seedItem({ releaseDate: new Date("2020-01-01") })
      await application.connection.collection("ItemStats").insertMany([
        { item: low._id, ratingAverage: 6 },
        { item: high._id, ratingAverage: 9 },
      ])
      await synchronize()
      for (const sort of ["rating", "releaseDate"]) {
        const response = await query({
          search: "Орбита",
          items: { sort, direction },
        })
        expect(response.statusCode).toBe(200)
        expect(
          response.json<SearchResponseDto>().items.hits.map((hit) => hit.id),
        ).toEqual(
          [...(direction === "asc" ? [low, high] : [high, low]), unknown].map(
            (item) => String(item._id),
          ),
        )
      }
    },
  )

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
        items: { sort: "title", language },
      })
      expect(response.statusCode).toBe(200)
      expect(
        response.json<SearchResponseDto>().items.hits.map((hit) => hit.id),
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
        types: ["custom"],
        authorIds: [String(author).toUpperCase()],
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json<SearchResponseDto>().collections).toEqual({
      hits: [
        {
          id: String(collections[0]._id),
          type: "custom",
          title: collections[0].title,
          media: [],
          authorId: String(author),
        },
      ],
      estimatedTotalHits: 1,
    })
    expect(response.json<SearchResponseDto>().items.estimatedTotalHits).toBe(1)
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
    expect(stale.json<SearchResponseDto>().items).toEqual({
      hits: [],
      estimatedTotalHits: 2,
    })
    await synchronize()
    const refreshed = await query({ search: "Орбита" })
    expect(refreshed.statusCode).toBe(200)
    expect(refreshed.json<SearchResponseDto>().items).toEqual({
      hits: [],
      estimatedTotalHits: 0,
    })
  })

  it("обновляет теги и метрики при неизменном updatedAt произведения и игнорирует отсутствующие теги", async () => {
    const item = await seedItem({
      ageRestriction: EAgeRestriction.AGE_18_PLUS_PLUS,
    })
    const tagId = new Types.ObjectId()
    await application.connection
      .collection("TagItem")
      .insertOne({ item: item._id, tag: tagId })
    await synchronize()
    const body = {
      search: "Орбита",
      items: {
        tagIds: [String(tagId)],
        ratingMin: 8,
        fields: [{ field: EItemField.AGE_RESTRICTION, min: 18, max: 18 }],
      },
    }
    expect((await query(body)).json<SearchResponseDto>().items.hits).toEqual([])
    await application.connection
      .collection("Tag")
      .insertOne({ _id: tagId, key: "searchUpdatedTag" })
    await application.connection
      .collection("ItemStats")
      .insertOne({ item: item._id, ratingAverage: 8 })
    await synchronize()
    const matched = await query(body)
    expect(matched.statusCode).toBe(200)
    expect(
      matched.json<SearchResponseDto>().items.hits.map((hit) => hit.id),
    ).toEqual([String(item._id)])
    await application.connection
      .collection("TagItem")
      .deleteMany({ item: item._id })
    await synchronize()
    expect((await query(body)).json<SearchResponseDto>().items.hits).toEqual([])
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
      response.json<SearchResponseDto>().items.hits.map((hit) => hit.id),
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
      page: 251,
      limit: 2,
      items: { direction: "asc" },
      users: { direction: "asc" },
      collections: { direction: "asc" },
    })
    expect(response.statusCode).toBe(200)
    const result = response.json<SearchResponseDto>()
    for (const [group, records] of [
      ["items", items],
      ["users", users],
      ["collections", collections],
    ] as const) {
      expect(result[group].estimatedTotalHits).toBe(count)
      expect(result[group].hits.map((hit) => hit.id)).toEqual(
        records
          .map((record) => String(record._id))
          .sort()
          .slice(500),
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
    expect(oldResults.json<SearchResponseDto>().users).toEqual({
      hits: [],
      estimatedTotalHits: 0,
    })
    expect(oldResults.json<SearchResponseDto>().collections).toEqual({
      hits: [],
      estimatedTotalHits: 0,
    })
    const updated = await query({ search: "Nebula" })
    expect(updated.statusCode).toBe(200)
    expect(
      updated.json<SearchResponseDto>().users.hits.map((hit) => hit.id),
    ).toEqual([String(user._id)])
    expect(
      updated.json<SearchResponseDto>().collections.hits.map((hit) => hit.id),
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
    expect(deleted.json<SearchResponseDto>().users).toEqual({
      hits: [],
      estimatedTotalHits: 0,
    })
    expect(deleted.json<SearchResponseDto>().collections).toEqual({
      hits: [],
      estimatedTotalHits: 0,
    })
  })

  it("возвращает пустые группы при отсутствии совпадений и 503 до первой синхронизации", async () => {
    const unavailable = await query({ search: "Орбита" })
    expect(unavailable.statusCode).toBe(503)
    expect(unavailable.json()).toMatchObject({ error: { code: "HTTP_503" } })
    await synchronize()
    const empty = await query({ search: "несуществующийзапрос" })
    expect(empty.statusCode).toBe(200)
    expect(empty.json()).toEqual(
      Object.fromEntries(
        ["items", "users", "collections"].map((group) => [
          group,
          { hits: [], estimatedTotalHits: 0 },
        ]),
      ),
    )
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
    { search: "x", page: "1" },
    { search: "x", limit: "10" },
    { search: "x", page: 0 },
    { search: "x", page: 1.5 },
    { search: "x", limit: 51 },
    { search: "x", page: 201, limit: 50 },
    { search: "x", unknown: true },
    { search: "x", items: null },
    { search: "x", users: [] },
    { search: "x", collections: "bad" },
    { search: "x", items: { sort: "recommended" } },
    { search: "x", items: { direction: "up" } },
    { search: "x", items: { language: "de" } },
    { search: "x", items: { types: [] } },
    { search: "x", items: { types: ["movie", "movie"] } },
    { search: "x", items: { tagIds: ["bad"] } },
    {
      search: "x",
      items: {
        tagIds: ["abcdefabcdefabcdefabcdef", "ABCDEFABCDEFABCDEFABCDEF"],
      },
    },
    { search: "x", items: { ratingMin: "8" } },
    { search: "x", items: { ratingMin: 8, ratingMax: 7 } },
    { search: "x", items: { fields: [] } },
    { search: "x", items: { fields: [{ field: "movie.duration" }] } },
    {
      search: "x",
      items: { fields: [{ field: "movie.duration", min: "90" }] },
    },
    {
      search: "x",
      items: { fields: [{ field: "movie.duration", min: 91, max: 90 }] },
    },
    {
      search: "x",
      items: { fields: [{ field: "releaseDate", min: "2026-02-30" }] },
    },
    {
      search: "x",
      items: { fields: [{ field: "releaseDate", min: "2026-01-01T12:00:00" }] },
    },
    {
      search: "x",
      items: {
        fields: [
          { field: "releaseDate", min: "2026-01-02", max: "2026-01-01" },
        ],
      },
    },
    {
      search: "x",
      items: {
        fields: [
          { field: "movie.duration", min: 1 },
          { field: "movie.duration", max: 10 },
        ],
      },
    },
    { search: "x", collections: { authorIds: [] } },
    { search: "x", collections: { types: ["bad"] } },
    { search: "x", users: { sort: "rating" } },
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
