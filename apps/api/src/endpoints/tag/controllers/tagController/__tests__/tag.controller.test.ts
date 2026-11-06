import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ValidationPipe } from "@nestjs/common"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { CacheService } from "@infrastructure/cache/services/cacheService"
import { SearchService } from "@infrastructure/search/services/searchService"

import { TagSearchService } from "../../../services/tagSearchService"
import { TagController } from "../core/tag.controller"

describe("TagController", () => {
  let app: NestFastifyApplication
  const getCheckpoint = jest.fn<() => Promise<number | null>>()
  const search =
    jest.fn<
      (
        ...args: Parameters<SearchService["search"]>
      ) => ReturnType<SearchService["search"]>
    >()

  const documents = Array.from({ length: 650 }, (_value, index) => ({
    id: index.toString(16).padStart(24, "0"),
    key: "exampleTag",
    group: "ungrouped",
    name: { ru: "Пример", en: null },
  }))

  const query = async (payload: Record<string, unknown> | unknown[]) => {
    return app.inject({ method: "QUERY", url: "/tags", payload })
  }

  beforeEach(async () => {
    getCheckpoint.mockResolvedValue(1)
    search.mockImplementation(async (_index, query, options) => {
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? 50

      return {
        hits: documents.slice(offset, offset + limit),
        estimatedTotalHits: documents.length,
        limit,
        offset,
        processingTimeMs: 0,
        query,
      }
    })

    const module = await Test.createTestingModule({
      controllers: [TagController],
      providers: [
        TagSearchService,
        { provide: CacheService, useValue: { get: getCheckpoint } },
        { provide: SearchService, useValue: { search } },
      ],
    }).compile()

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    )
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it("публикует маршрут QUERY и DTO запроса и ответа в OpenAPI", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )

    expect(document.paths["/tags"]?.query).toMatchObject({
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TagsBodyDto" },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagsResponseDto" },
            },
          },
        },
      },
    })
    expect(document.components?.schemas?.TagGroupBodyDto).toMatchObject({
      properties: {
        allOf: { type: "array", items: { type: ["string", "null"] } },
      },
    })
  })

  it("возвращает весь словарь порциями по 50 без повторов и лишнего курсора на точной границе", async () => {
    const ids: string[] = []
    let cursor: string | null = null

    for (let page = 0; page < 13; page += 1) {
      const response = await query(cursor === null ? {} : { cursor })
      expect(response.statusCode).toBe(200)
      const body = response.json<{
        items: { id: string }[]
        nextCursor: string | null
      }>()
      expect(body.items).toHaveLength(50)
      ids.push(...body.items.map(({ id }) => id))
      cursor = body.nextCursor
    }

    expect(ids).toEqual(documents.map(({ id }) => id))
    expect(cursor).toBeNull()
  })

  it("передаёт очищенный текст и фильтры в индекс и возвращает nullable поля", async () => {
    const response = await query({
      search: "  примре  ",
      group: { allOf: [null], anyOf: ["genre", null], noneOf: ["style"] },
      limit: 10,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().items[0]).toEqual({
      ...documents[0],
      group: null,
    })
    expect(search).toHaveBeenCalledWith("site_tags", "примре", {
      offset: 0,
      limit: 11,
      sort: ["id:asc"],
      filter: [
        'group = "ungrouped"',
        'group IN ["genre","ungrouped"]',
        'group NOT IN ["style"]',
      ],
    })
  })

  it("возвращает пустую выдачу для нескольких обязательных групп", async () => {
    const response = await query({ group: { allOf: ["genre", null] } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ items: [], nextCursor: null })
    expect(search).not.toHaveBeenCalled()
  })

  it("привязывает курсор к запросу и допускает перестановку значений фильтра", async () => {
    const first = await query({
      search: "example",
      group: { anyOf: ["genre", null] },
    })
    const { nextCursor } = first.json<{ nextCursor: string }>()
    expect(typeof nextCursor).toBe("string")

    expect(
      (
        await query({
          search: "example",
          group: { anyOf: [null, "genre"] },
          limit: 50,
          cursor: nextCursor,
        })
      ).statusCode,
    ).toBe(200)

    for (const changes of [
      { search: "other" },
      { limit: 10 },
      { group: { anyOf: [null] } },
    ]) {
      expect(
        (
          await query({
            search: "example",
            group: { anyOf: ["genre", null] },
            cursor: nextCursor,
            ...changes,
          })
        ).statusCode,
      ).toBe(400)
    }
  })

  it.each([
    { cursor: "broken" },
    { search: " " },
    { limit: "50" },
    { limit: 100 },
    { group: null },
    { group: { anyOf: [] } },
    { group: { allOf: ["genre", "genre"] } },
    { group: { noneOf: ["unknown"] } },
    { group: { unknown: ["genre"] } },
    { q: "legacy" },
  ])("отклоняет некорректное тело %j", async (body) => {
    expect((await query(body)).statusCode).toBe(400)
  })

  it("возвращает 503 до первого успешного обновления и при ошибке индекса", async () => {
    getCheckpoint.mockResolvedValueOnce(null)
    expect((await query({})).statusCode).toBe(503)
    expect(search).not.toHaveBeenCalled()

    search.mockRejectedValueOnce(new Error("index unavailable"))
    expect((await query({})).statusCode).toBe(503)
  })
})
