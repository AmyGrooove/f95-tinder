import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common"
import { FastifyAdapter } from "@nestjs/platform-fastify"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"

import { CollectionReadController } from "../controllers/collectionRead.controller"
import { CollectionService } from "../services/collection.service"
import { CollectionContentService } from "../services/collectionContent.service"
import { ECollectionMode } from "../types/ECollectionMode"
import { CollectionFiltersQueryDto } from "../dto/query/collectionFilters.query"

describe("CollectionReadController", () => {
  const createController = async () => {
    const service = { getById: jest.fn<CollectionService["getById"]>() }
    const content = {
      getItems: jest.fn<CollectionContentService["getItems"]>(),
      getFilters: jest.fn<CollectionContentService["getFilters"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionReadController],
      providers: [
        { provide: CollectionService, useValue: service },
        { provide: CollectionContentService, useValue: content },
      ],
    }).compile()

    return {
      moduleRef,
      controller: moduleRef.get(CollectionReadController),
      service,
      content,
      id: new Types.ObjectId(),
    }
  }

  describe("QUERY /collections/:id/items", () => {
    let app: NestFastifyApplication
    let context: Awaited<ReturnType<typeof createController>>

    beforeAll(async () => {
      context = await createController()
      app = context.moduleRef.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
        { logger: false },
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

    beforeEach(() => {
      jest.resetAllMocks()
    })

    afterAll(async () => app?.close())

    it("читает JSON-тело QUERY и передаёт фильтры сервису без изменений", async () => {
      const payload = {
        page: 2,
        limit: 10,
        query: " Alpha ",
        tags: [new Types.ObjectId().toHexString()],
        excludeTags: [new Types.ObjectId().toHexString()],
        features: [
          { featureId: new Types.ObjectId().toHexString(), values: [false] },
        ],
      }
      const result = {
        items: [],
        page: 2,
        limit: 10,
        total: 0,
        pages: 0,
        isNextPage: false,
        isPreviousPage: true,
        mode: ECollectionMode.FLAT,
        displayBlocks: [],
      }
      context.content.getItems.mockResolvedValue(result)
      const response = await app.inject({
        method: "QUERY",
        url: `/collections/${context.id.toHexString()}/items`,
        payload,
      } as unknown as Parameters<typeof app.inject>[0])
      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(result)
      expect(context.content.getItems).toHaveBeenCalledWith({
        id: context.id,
        query: { ...payload, query: "Alpha" },
      })
    })

    it.each([{}])("принимает пустой набор фильтров %j", async (payload) => {
      context.content.getItems.mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        isNextPage: false,
        isPreviousPage: false,
        mode: ECollectionMode.FLAT,
        displayBlocks: [],
      })
      const response = await app.inject({
        method: "QUERY",
        url: `/collections/${context.id.toHexString()}/items`,
        payload,
      } as unknown as Parameters<typeof app.inject>[0])
      expect(response.statusCode).toBe(200)
      expect(context.content.getItems).toHaveBeenCalledWith({
        id: context.id,
        query: {},
      })
    })

    it.each([
      undefined,
      { tags: [] },
      { tags: "507f1f77bcf86cd799439011" },
      { excludeTags: ["invalid"] },
      { features: "[]" },
      { features: [{ featureId: "invalid", values: [false] }] },
      { features: [{ featureId: "507f1f77bcf86cd799439011", unknown: true }] },
      { page: 0 },
      { query: " " },
      { isFavorite: false },
    ])(
      "отклоняет некорректное JSON-тело %j до вызова сервиса",
      async (payload) => {
        const response = await app.inject({
          method: "QUERY",
          url: `/collections/${context.id.toHexString()}/items`,
          payload,
        } as unknown as Parameters<typeof app.inject>[0])
        expect(response.statusCode).toBe(400)
        expect(context.content.getItems).not.toHaveBeenCalled()
      },
    )

    it("возвращает 404 для прежнего метода GET", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/collections/${context.id.toHexString()}/items`,
      })
      expect(response.statusCode).toBe(404)
      expect(context.content.getItems).not.toHaveBeenCalled()
    })

    it("описывает QUERY с JSON-телом в OpenAPI", () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
      )
      const path = document.paths["/collections/{id}/items"]
      expect(path).not.toHaveProperty("get")
      expect(path).toHaveProperty(
        "query.requestBody.content.application/json.schema.$ref",
        "#/components/schemas/CollectionItemsBodyDto",
      )
    })
  })

  it("читает публичные метаданные по ObjectId и возвращает результат сервиса", async () => {
    const { controller, service, id } = await createController()
    const result = {
      id: id.toHexString(),
      version: 0,
      authorId: null,
      type: ECollectionType.CUSTOM,
      title: { ru: "Тест", en: null },
      description: { ru: null, en: null },
      blocks: [],
      media: [],
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
    }
    service.getById.mockResolvedValue(result)
    await expect(controller.getById(id)).resolves.toBe(result)
    expect(service.getById).toHaveBeenCalledTimes(1)
    expect(service.getById).toHaveBeenCalledWith(id)
  })

  it("передаёт id и публичные фильтры для страницы произведений", async () => {
    const { controller, content, id } = await createController()
    const query = { page: 2, limit: 1, ratingMin: 7.5, ratingMax: 9 }
    const result = {
      items: [],
      page: 2,
      limit: 1,
      total: 0,
      pages: 0,
      isNextPage: false,
      isPreviousPage: true,
      mode: ECollectionMode.FLAT,
      displayBlocks: [],
    }
    content.getItems.mockResolvedValue(result)
    await expect(controller.getItems(id, query)).resolves.toBe(result)
    expect(content.getItems).toHaveBeenCalledTimes(1)
    expect(content.getItems).toHaveBeenCalledWith({ id, query })
  })

  it("передаёт id и возвращает доступные фильтры всей подборки", async () => {
    const { controller, content, id } = await createController()
    const result = {
      tags: [],
      features: [],
      sorting: { availableModes: [ECollectionMode.FLAT] },
    }
    content.getFilters.mockResolvedValue(result)
    await expect(controller.getFilters({}, id)).resolves.toBe(result)
    expect(content.getFilters).toHaveBeenCalledTimes(1)
    expect(content.getFilters).toHaveBeenCalledWith(id)
  })

  it("сохраняет ошибку отсутствующей подборки", async () => {
    const { controller, service, id } = await createController()
    const error = new NotFoundException()
    service.getById.mockRejectedValue(error)
    await expect(controller.getById(id)).rejects.toBe(error)
  })

  it("сохраняет ошибку некорректного диапазона общей оценки", async () => {
    const { controller, content, id } = await createController()
    const error = new BadRequestException()
    content.getItems.mockRejectedValue(error)
    await expect(
      controller.getItems(id, { ratingMin: 9, ratingMax: 2 }),
    ).rejects.toBe(error)
  })

  it("сохраняет ошибку отсутствующей подборки при чтении фильтров", async () => {
    const { controller, content, id } = await createController()
    const error = new NotFoundException()
    content.getFilters.mockRejectedValue(error)
    await expect(controller.getFilters({}, id)).rejects.toBe(error)
  })

  it("не объявляет query-параметры фильтров в Swagger", async () => {
    const { moduleRef } = await createController()
    const app = moduleRef.createNestApplication(new FastifyAdapter())

    try {
      const document = SwaggerModule.createDocument(app, {
        info: { title: "Collections", version: "1" },
        openapi: "3.0.0",
      })
      expect(
        document.paths["/collections/{id}/filters"].get?.parameters,
      ).toEqual([expect.objectContaining({ name: "id", in: "path" })])
    } finally {
      await app.close()
    }
  })

  it("принимает отсутствие query-параметров фильтров", async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
    await expect(
      pipe.transform(
        {},
        { type: "query", metatype: CollectionFiltersQueryDto },
      ),
    ).resolves.toEqual({})
  })

  it.each([
    { groupId: new Types.ObjectId().toHexString() },
    { groupId: "invalid" },
    { groupId: "" },
    { page: "1" },
    { query: "Alpha" },
    { unknown: "1" },
  ])("отклоняет неподдерживаемый query фильтров: %j", async (query) => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
    await expect(
      pipe.transform(query, {
        type: "query",
        metatype: CollectionFiltersQueryDto,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
