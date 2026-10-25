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
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common"
import { FastifyAdapter } from "@nestjs/platform-fastify"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Types } from "mongoose"
import type { FastifyInstance } from "fastify"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { LoggerService } from "@infrastructure/logger/services/logger.service"

import { UserItemController } from "../controllers/userItem.controller"
import type { UserItemResponseDto } from "../dto/response/userItem.response"
import { UserItemService } from "../services/userItem.service"

describe("UserItemController", () => {
  const id = "507f1f77bcf86cd799439011"
  const itemId = "507f1f77bcf86cd799439012"
  const attemptId = "507f1f77bcf86cd799439013"
  const headers = { cookie: "__Host-accessToken=access-token; other=value" }
  const result: UserItemResponseDto = {
    id,
    itemId,
    status: EUserItemStatus.COMPLETED,
    expiresAt: null,
    rating: 9,
    isFavorite: false,
    note: null,
    attempts: [
      {
        id: attemptId,
        isCompleted: true,
        progress: 90,
        unit: EUnit.MINUTE,
        startedAt: "2026-01-01T10:00:00.000Z",
        completedAt: "2026-01-01T11:30:00.000Z",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }
  const service = {
    query: jest.fn<UserItemService["query"]>(),
    create: jest.fn<UserItemService["create"]>(),
    skip: jest.fn<UserItemService["skip"]>(),
    block: jest.fn<UserItemService["block"]>(),
    update: jest.fn<UserItemService["update"]>(),
    remove: jest.fn<UserItemService["remove"]>(),
    createAttempt: jest.fn<UserItemService["createAttempt"]>(),
    updateAttempt: jest.fn<UserItemService["updateAttempt"]>(),
  }
  const logger = { error: jest.fn<LoggerService["error"]>() }
  let app: NestFastifyApplication
  const getFastify = (): FastifyInstance => {
    return app.getHttpAdapter().getInstance()
  }

  it("включает QUERY с JSON-телом и кратким массивом ответа в генерируемое описание", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )
    expect(document.paths["/userItems"]?.query).toMatchObject({
      operationId: "UserItemController_query",
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/QueryUserItemsBodyDto" },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/UserItemSummaryResponseDto",
                },
              },
            },
          },
        },
      },
    })
    expect(
      document.components?.schemas?.UserItemSummaryResponseDto,
    ).toMatchObject({
      required: ["id", "itemId", "rating", "isFavorite", "status"],
    })
    expect(
      document.components?.schemas?.UserItemSummaryResponseDto,
    ).not.toHaveProperty("properties.attempts")
    expect(
      document.components?.schemas?.UserItemSummaryResponseDto,
    ).not.toHaveProperty("properties.note")
    for (const name of [
      "CreateAttemptBodyDto",
      "UpdateAttemptBodyDto",
      "AttemptResponseDto",
    ]) {
      expect(document.components?.schemas?.[name]).toMatchObject({
        properties: {
          unit: { enum: [EUnit.MINUTE, EUnit.PERCENT, EUnit.EPISODE] },
        },
      })
    }
  })

  it("читает краткие записи методом QUERY с JSON-телом и запрещает кеширование", async () => {
    const summary = {
      id,
      itemId,
      rating: 9,
      isFavorite: false,
      status: EUserItemStatus.COMPLETED,
    }
    service.query.mockResolvedValue([summary])
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers,
      payload: { ids: [id] },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([summary])
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["accept-query"]).toBe("application/json")
    expect(service.query).toHaveBeenCalledWith("access-token", { ids: [id] })
  })

  it.each([
    {},
    { ids: [] },
    { ids: null },
    { ids: id },
    { ids: [null] },
    { ids: ["bad"] },
    { ids: [id, id] },
    { ids: [id, id.toUpperCase()] },
    { ids: [id], userId: itemId },
  ])(
    "отклоняет некорректное тело QUERY %j до вызова сервиса",
    async (payload) => {
      const response = await getFastify().inject({
        method: "QUERY",
        url: "/userItems",
        headers,
        payload,
      })
      expect(response.statusCode).toBe(400)
      expect(service.query).not.toHaveBeenCalled()
    },
  )

  it.each([61, 100])(
    "отклоняет %i ID UserItem до вызова сервиса",
    async (count) => {
      const response = await getFastify().inject({
        method: "QUERY",
        url: "/userItems",
        headers,
        payload: {
          ids: Array.from({ length: count }, () =>
            new Types.ObjectId().toHexString(),
          ),
        },
      })
      expect(response.statusCode).toBe(400)
      expect(service.query).not.toHaveBeenCalled()
    },
  )

  it("принимает верхнюю границу в 60 уникальных ID UserItem", async () => {
    const ids = Array.from({ length: 60 }, () =>
      new Types.ObjectId().toHexString(),
    )
    service.query.mockResolvedValue([])
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers,
      payload: { ids },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([])
    expect(service.query).toHaveBeenCalledWith("access-token", { ids })
  })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserItemController],
      providers: [
        { provide: UserItemService, useValue: service },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(
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
    app.useGlobalFilters(new AppExceptionFilter(moduleRef.get(LoggerService)))
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  beforeEach(() => {
    jest.resetAllMocks()
    service.create.mockResolvedValue(result)
    service.skip.mockResolvedValue(result)
    service.block.mockResolvedValue(result)
    service.update.mockResolvedValue(result)
    service.remove.mockResolvedValue(undefined)
    service.createAttempt.mockResolvedValue(result)
    service.updateAttempt.mockResolvedValue(result)
  })

  afterAll(async () => {
    await app?.close()
  })

  it("добавляет произведение через POST и возвращает 201 с записью и запретом кеширования", async () => {
    const payload = { itemId, status: EUserItemStatus.PLANNED }
    const response = await app.inject({
      method: "POST",
      url: "/userItems",
      headers,
      payload,
    })

    expect(response.statusCode).toBe(201)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual(result)
    expect(service.create).toHaveBeenCalledTimes(1)
    expect(service.create).toHaveBeenCalledWith("access-token", payload)
  })

  it.each([
    {
      payload: {
        status: EUserItemStatus.COMPLETED,
        rating: 9,
        isFavorite: true,
        note: "Пересмотреть",
      },
    },
    { payload: { rating: null, note: null } },
    { payload: { isFavorite: false } },
    { payload: { status: EUserItemStatus.PLANNED } },
    { payload: { status: EUserItemStatus.IN_PROGRESS } },
    { payload: { status: EUserItemStatus.ON_HOLD } },
    { payload: { status: EUserItemStatus.COMPLETED } },
    { payload: { status: EUserItemStatus.DROPPED } },
    { payload: { status: EUserItemStatus.SKIPPED } },
    { payload: { status: EUserItemStatus.BLOCKED } },
    { payload: { isFavorite: true } },
    { payload: { isFavorite: false } },
    { payload: { rating: 1 } },
    { payload: { rating: 10 } },
    { payload: { rating: null } },
    { payload: { note: "Заметка" } },
    { payload: { note: "" } },
    { payload: { note: null } },
  ])(
    "передаёт поля PATCH /userItems/:id без подстановки пропущенных значений: $payload",
    async ({ payload }) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${id}`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(result)
      expect(service.update).toHaveBeenCalledTimes(1)
      expect(service.update).toHaveBeenCalledWith("access-token", {
        id: new Types.ObjectId(id),
        body: payload,
      })
    },
  )

  it("удаляет запись через DELETE и возвращает 204 без тела", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/userItems/${id}`,
      headers,
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(service.remove).toHaveBeenCalledTimes(1)
    expect(service.remove).toHaveBeenCalledWith(
      "access-token",
      new Types.ObjectId(id),
    )
  })

  it.each([
    {},
    { isCompleted: false, progress: 0 },
    { progress: 5, unit: EUnit.EPISODE },
    {
      isCompleted: true,
      progress: 90,
      unit: EUnit.MINUTE,
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: "2026-01-01T11:30:00.000Z",
    },
    {
      isCompleted: false,
      progress: null,
      startedAt: null,
      completedAt: null,
    },
  ] as const)(
    "передаёт данные попытки %j и возвращает 201",
    async (payload) => {
      const response = await app.inject({
        method: "POST",
        url: `/userItems/${id}/attempts`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(201)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(result)
      expect(service.createAttempt).toHaveBeenCalledTimes(1)
      expect(service.createAttempt).toHaveBeenCalledWith("access-token", {
        id: new Types.ObjectId(id),
        body: payload,
      })
    },
  )

  it.each([
    { progress: 0 },
    { progress: 100, unit: EUnit.PERCENT },
    { progress: 5, unit: EUnit.EPISODE },
    { unit: EUnit.EPISODE },
    { isCompleted: false },
    { progress: null, startedAt: null, completedAt: null },
    { isCompleted: true, progress: 90, unit: EUnit.MINUTE },
    { completedAt: "2026-01-01T11:30:00.000Z" },
  ] as const)(
    "изменяет переданные поля попытки, преобразуя оба ID в ObjectId: %j",
    async (payload) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${id}/attempts/${attemptId}`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(result)
      expect(service.updateAttempt).toHaveBeenCalledTimes(1)
      expect(service.updateAttempt).toHaveBeenCalledWith("access-token", {
        id: new Types.ObjectId(id),
        attemptId: new Types.ObjectId(attemptId),
        body: payload,
      })
    },
  )

  it.each([
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId, status: "skipped" },
    },
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId, status: "blocked" },
    },
    { method: "POST", url: "/userItems", payload: { itemId } },
    { method: "POST", url: "/userItems", payload: { itemId, status: null } },
    { method: "POST", url: "/userItems", payload: { status: "planned" } },
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId: "invalid", status: "planned" },
    },
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId, status: "unknown" },
    },
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId, status: "planned", rating: 9 },
    },
    { method: "PATCH", url: `/userItems/${id}`, payload: { status: null } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { isFavorite: null } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { rating: 0 } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { rating: "9" } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { note: 123 } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { itemId } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { user: itemId } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { attempts: [] } },
    {
      method: "PATCH",
      url: `/userItems/${id}`,
      payload: { status: "unknown" },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}`,
      payload: { isFavorite: "false" },
    },
    { method: "PATCH", url: `/userItems/${id}`, payload: { rating: 11 } },
    { method: "PATCH", url: `/userItems/${id}`, payload: { rating: 1.5 } },
  ] as const)(
    "возвращает 400 до вызова сервиса для $method $url с телом $payload",
    async ({ method, url, payload }) => {
      const response = await app.inject({ method, url, headers, payload })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: {
          code: "BAD_REQUEST",
          details: { errors: expect.any(Array) },
          requestId: expect.any(String),
        },
      })

      for (const mock of Object.values(service)) {
        expect(mock).not.toHaveBeenCalled()
      }
    },
  )

  it.each([
    { status: null },
    { isCompleted: null },
    { isCompleted: "true" },
    { status: EUserItemStatus.PLANNED },
    { progress: -1 },
    { progress: 0.5 },
    {
      progress: Number.MAX_SAFE_INTEGER + 1,
    },
    { progress: "5" },
    { unit: null },
    { unit: EUnit.USD },
    { startedAt: "invalid" },
    {
      completedAt: "2026-02-30T10:00:00.000Z",
    },
    { id: attemptId },
  ])("отклоняет некорректное тело создания попытки: %j", async (payload) => {
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${id}/attempts`,
      headers,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(service.createAttempt).not.toHaveBeenCalled()
  })

  it.each([
    { status: null },
    { status: EUserItemStatus.PLANNED },
    { isCompleted: null },
    { isCompleted: "false" },
    { progress: -1 },
    { progress: Number.MAX_SAFE_INTEGER + 1 },
    { unit: null },
    { startedAt: "invalid" },
    { completedAt: 123 },
    { id: itemId },
  ])("отклоняет некорректное тело изменения попытки: %j", async (payload) => {
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${id}/attempts/${attemptId}`,
      headers,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(service.updateAttempt).not.toHaveBeenCalled()
  })

  it.each([
    { method: "DELETE", url: "/userItems/invalid" },
    { method: "PATCH", url: "/userItems/invalid", payload: { rating: 9 } },
    {
      method: "POST",
      url: "/userItems/invalid/attempts",
      payload: { status: "completed" },
    },
    {
      method: "PATCH",
      url: `/userItems/invalid/attempts/${attemptId}`,
      payload: { progress: 1 },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/attempts/invalid`,
      payload: { progress: 1 },
    },
  ] as const)(
    "отклоняет некорректный ID в $method $url до вызова сервиса",
    async (request) => {
      const response = await app.inject({ ...request, headers })

      expect(response.statusCode).toBe(400)

      for (const mock of Object.values(service)) {
        expect(mock).not.toHaveBeenCalled()
      }
    },
  )

  it.each([
    {
      method: "POST",
      url: "/userItems/skip",
      payload: { itemId },
      serviceMethod: "skip",
    },
    {
      method: "POST",
      url: "/userItems/block",
      payload: { itemId },
      serviceMethod: "block",
    },
    {
      method: "POST",
      url: "/userItems",
      payload: { itemId, status: "planned" },
      serviceMethod: "create",
    },
    {
      method: "PATCH",
      url: `/userItems/${id}`,
      payload: { rating: 9 },
      serviceMethod: "update",
    },
    { method: "DELETE", url: `/userItems/${id}`, serviceMethod: "remove" },
    {
      method: "POST",
      url: `/userItems/${id}/attempts`,
      payload: { isCompleted: true },
      serviceMethod: "createAttempt",
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/attempts/${attemptId}`,
      payload: { progress: 1 },
      serviceMethod: "updateAttempt",
    },
  ] as const)(
    "передаёт отсутствие cookie сервису и возвращает его 401 для $method $url",
    async ({ serviceMethod, ...request }) => {
      service[serviceMethod].mockRejectedValue(new UnauthorizedException())
      const response = await app.inject(request)

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({
        error: { code: "UNAUTHORIZED", requestId: expect.any(String) },
      })
      expect(service[serviceMethod].mock.calls[0]?.[0]).toBeUndefined()
    },
  )

  it("не использует Bearer или refresh cookie вместо access cookie", async () => {
    service.create.mockRejectedValue(new UnauthorizedException())
    const response = await app.inject({
      method: "POST",
      url: "/userItems",
      headers: {
        authorization: "Bearer access-token",
        cookie: "__Host-refreshToken=refresh-token",
      },
      payload: { itemId, status: "planned" },
    })

    expect(response.statusCode).toBe(401)
    expect(service.create).toHaveBeenCalledWith(undefined, {
      itemId,
      status: EUserItemStatus.PLANNED,
    })
  })

  it("сохраняет конфликт повторного добавления из сервиса", async () => {
    service.create.mockRejectedValue(new ConflictException("Уже добавлено"))
    const response = await app.inject({
      method: "POST",
      url: "/userItems",
      headers,
      payload: { itemId, status: "planned" },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: { message: "Уже добавлено" },
    })
  })

  it("сохраняет ответ 404 для отсутствующей или чужой записи", async () => {
    service.remove.mockRejectedValue(new NotFoundException("Запись не найдена"))
    const response = await app.inject({
      method: "DELETE",
      url: `/userItems/${id}`,
      headers,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: { message: "Запись не найдена" },
    })
  })

  it("сохраняет отказ сервиса при пустом общем PATCH", async () => {
    service.update.mockRejectedValue(new BadRequestException("Нет изменений"))
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${id}`,
      headers,
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(service.update).toHaveBeenCalledWith("access-token", {
      id: new Types.ObjectId(id),
      body: {},
    })
    expect(response.json()).toMatchObject({
      error: { message: "Нет изменений" },
    })
  })

  it("сохраняет запрет добавления попытки для текущего статуса", async () => {
    service.createAttempt.mockRejectedValue(
      new ConflictException("Добавление попытки запрещено"),
    )
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${id}/attempts`,
      headers,
      payload: { isCompleted: false },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: { message: "Добавление попытки запрещено" },
    })
  })

  it("сохраняет ответ 404 при отсутствии попытки", async () => {
    service.updateAttempt.mockRejectedValue(
      new NotFoundException("Попытка не найдена"),
    )
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${id}/attempts/${attemptId}`,
      headers,
      payload: { progress: 1 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: { message: "Попытка не найдена" },
    })
  })

  it.each([
    { path: "status", payload: { status: "planned" } },
    { path: "favorite", payload: { isFavorite: true } },
    { path: "rating", payload: { rating: 9 } },
    { path: "note", payload: { note: "Заметка" } },
  ])(
    "не предоставляет удалённый PATCH /userItems/:id/$path",
    async ({ path, payload }) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${id}/${path}`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(404)

      for (const mock of Object.values(service)) {
        expect(mock).not.toHaveBeenCalled()
      }
    },
  )

  it.each(["skip", "block"] as const)(
    "создаёт исключение через %s с кодом 201 и запретом кеширования",
    async (operation) => {
      const exclusion = {
        ...result,
        status:
          operation === "skip"
            ? EUserItemStatus.SKIPPED
            : EUserItemStatus.BLOCKED,
        rating: null,
        attempts: [],
        expiresAt: operation === "skip" ? "2026-04-01T00:00:00.000Z" : null,
      }
      service[operation].mockResolvedValue(exclusion)
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers,
        payload: { itemId },
      })
      expect(response.statusCode).toBe(201)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(exclusion)
      expect(service[operation]).toHaveBeenCalledWith("access-token", {
        itemId,
      })
      expect(service.create).not.toHaveBeenCalled()
    },
  )

  it.each(["skip", "block"] as const)(
    "отклоняет некорректное тело %s до вызова сервиса",
    async (operation) => {
      for (const payload of [
        {},
        { itemId: null },
        { itemId: "invalid" },
        { itemId, status: "planned" },
        { itemId, rating: 8 },
      ]) {
        const response = await app.inject({
          method: "POST",
          url: "/userItems/" + operation,
          headers,
          payload,
        })
        expect(response.statusCode).toBe(400)
        expect(service[operation]).not.toHaveBeenCalled()
      }
    },
  )

  it.each(["skip", "block"] as const)(
    "сохраняет конфликт существующей записи для %s",
    async (operation) => {
      service[operation].mockRejectedValue(
        new ConflictException("Запись уже существует"),
      )
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers,
        payload: { itemId },
      })
      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({
        error: { message: "Запись уже существует" },
      })
    },
  )

  it.each(["/userItems", `/userItems/${id}`])(
    "не предоставляет GET-маршрут $url",
    async (url) => {
      const response = await app.inject({ method: "GET", url, headers })

      expect(response.statusCode).toBe(404)
    },
  )
})
