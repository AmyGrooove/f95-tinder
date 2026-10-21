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
import { Types } from "mongoose"

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
    rating: 9,
    isFavorite: false,
    note: null,
    attempts: [
      {
        id: attemptId,
        status: EUserItemStatus.COMPLETED,
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
    create: jest.fn<UserItemService["create"]>(),
    update: jest.fn<UserItemService["update"]>(),
    remove: jest.fn<UserItemService["remove"]>(),
    createAttempt: jest.fn<UserItemService["createAttempt"]>(),
    updateAttempt: jest.fn<UserItemService["updateAttempt"]>(),
  }
  const logger = { error: jest.fn<LoggerService["error"]>() }
  let app: NestFastifyApplication

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
      path: "",
      payload: {
        status: EUserItemStatus.COMPLETED,
        rating: 9,
        isFavorite: true,
        note: "Пересмотреть",
      },
    },
    { path: "", payload: { rating: null, note: null } },
    { path: "", payload: { isFavorite: false } },
    { path: "/status", payload: { status: EUserItemStatus.PLANNED } },
    { path: "/status", payload: { status: EUserItemStatus.IN_PROGRESS } },
    { path: "/status", payload: { status: EUserItemStatus.ON_HOLD } },
    { path: "/status", payload: { status: EUserItemStatus.COMPLETED } },
    { path: "/status", payload: { status: EUserItemStatus.DROPPED } },
    { path: "/favorite", payload: { isFavorite: true } },
    { path: "/favorite", payload: { isFavorite: false } },
    { path: "/rating", payload: { rating: 1 } },
    { path: "/rating", payload: { rating: 10 } },
    { path: "/rating", payload: { rating: null } },
    { path: "/note", payload: { note: "Заметка" } },
    { path: "/note", payload: { note: "" } },
    { path: "/note", payload: { note: null } },
  ])(
    "передаёт поля PATCH $path без подстановки пропущенных значений: $payload",
    async ({ path, payload }) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${id}${path}`,
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
    { status: EUserItemStatus.IN_PROGRESS },
    { status: EUserItemStatus.ON_HOLD, progress: 0 },
    {
      status: EUserItemStatus.COMPLETED,
      progress: 90,
      unit: EUnit.MINUTE,
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: "2026-01-01T11:30:00.000Z",
    },
    {
      status: EUserItemStatus.DROPPED,
      progress: null,
      startedAt: null,
      completedAt: null,
    },
  ] as const)(
    "передаёт данные текущей или исторической попытки $status и возвращает 201",
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
    { progress: null, startedAt: null, completedAt: null },
    { status: EUserItemStatus.COMPLETED, progress: 90, unit: EUnit.MINUTE },
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
    { method: "PATCH", url: `/userItems/${id}/status`, payload: {} },
    {
      method: "PATCH",
      url: `/userItems/${id}/status`,
      payload: { status: null },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/status`,
      payload: { status: "unknown" },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/status`,
      payload: { status: "planned", rating: 9 },
    },
    { method: "PATCH", url: `/userItems/${id}/favorite`, payload: {} },
    {
      method: "PATCH",
      url: `/userItems/${id}/favorite`,
      payload: { isFavorite: null },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/favorite`,
      payload: { isFavorite: "false" },
    },
    { method: "PATCH", url: `/userItems/${id}/rating`, payload: {} },
    { method: "PATCH", url: `/userItems/${id}/rating`, payload: { rating: 0 } },
    {
      method: "PATCH",
      url: `/userItems/${id}/rating`,
      payload: { rating: 11 },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/rating`,
      payload: { rating: 1.5 },
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/rating`,
      payload: { rating: "9" },
    },
    { method: "PATCH", url: `/userItems/${id}/note`, payload: {} },
    { method: "PATCH", url: `/userItems/${id}/note`, payload: { note: 123 } },
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
    {},
    { status: null },
    { status: EUserItemStatus.PLANNED },
    { status: EUserItemStatus.IN_PROGRESS, progress: -1 },
    { status: EUserItemStatus.IN_PROGRESS, progress: 0.5 },
    {
      status: EUserItemStatus.IN_PROGRESS,
      progress: Number.MAX_SAFE_INTEGER + 1,
    },
    { status: EUserItemStatus.IN_PROGRESS, progress: "5" },
    { status: EUserItemStatus.IN_PROGRESS, unit: null },
    { status: EUserItemStatus.IN_PROGRESS, unit: EUnit.USD },
    { status: EUserItemStatus.IN_PROGRESS, startedAt: "invalid" },
    {
      status: EUserItemStatus.COMPLETED,
      completedAt: "2026-02-30T10:00:00.000Z",
    },
    { status: EUserItemStatus.COMPLETED, id: attemptId },
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
      method: "PATCH",
      url: "/userItems/invalid/status",
      payload: { status: "planned" },
    },
    {
      method: "PATCH",
      url: "/userItems/invalid/favorite",
      payload: { isFavorite: true },
    },
    {
      method: "PATCH",
      url: "/userItems/invalid/rating",
      payload: { rating: 9 },
    },
    {
      method: "PATCH",
      url: "/userItems/invalid/note",
      payload: { note: null },
    },
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
      method: "PATCH",
      url: `/userItems/${id}/status`,
      payload: { status: "planned" },
      serviceMethod: "update",
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/favorite`,
      payload: { isFavorite: true },
      serviceMethod: "update",
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/rating`,
      payload: { rating: 9 },
      serviceMethod: "update",
    },
    {
      method: "PATCH",
      url: `/userItems/${id}/note`,
      payload: { note: null },
      serviceMethod: "update",
    },
    {
      method: "POST",
      url: `/userItems/${id}/attempts`,
      payload: { status: "completed" },
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

  it("сохраняет конфликт текущих попыток из сервиса", async () => {
    service.createAttempt.mockRejectedValue(
      new ConflictException("Текущая попытка уже есть"),
    )
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${id}/attempts`,
      headers,
      payload: { status: "inProgress" },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: { message: "Текущая попытка уже есть" },
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

  it.each(["/userItems", `/userItems/${id}`])(
    "не предоставляет GET-маршрут $url",
    async (url) => {
      const response = await app.inject({ method: "GET", url, headers })

      expect(response.statusCode).toBe(404)
    },
  )
})
