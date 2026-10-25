import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import { FastifyAdapter } from "@nestjs/platform-fastify"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"

import { ItemController } from "../controllers/item.controller"
import type { ItemResponseDto } from "../dto/response/item.response"
import { ItemService } from "../services/item.service"

describe("ItemController", () => {
  const service = { getById: jest.fn<ItemService["getById"]>() }
  let app: NestFastifyApplication
  let result: ItemResponseDto

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemController],
      providers: [{ provide: ItemService, useValue: service }],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  beforeEach(() => {
    service.getById.mockReset()
    result = {
      id: new Types.ObjectId().toHexString(),
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      tags: [],
      features: [],
      relations: [],
    }
    service.getById.mockResolvedValue(result)
  })

  afterAll(async () => app?.close())

  it.each([false, true])(
    "передаёт ObjectId сервису и возвращает публичный ответ, uppercase=%s",
    async (isUppercase) => {
      const id = isUppercase ? result.id.toUpperCase() : result.id
      const response = await app.inject({
        method: "GET",
        url: `/items/${id}`,
        headers: { cookie: "__Host-accessToken=invalid" },
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.headers["set-cookie"]).toBeUndefined()
      expect(response.json()).toEqual(result)
      expect(service.getById).toHaveBeenCalledTimes(1)
      expect(service.getById).toHaveBeenCalledWith(
        new Types.ObjectId(result.id),
      )
    },
  )

  it.each([
    "invalid",
    "abcdefghijkl",
    "0".repeat(23),
    "0".repeat(25),
    "g".repeat(24),
    "%20" + "0".repeat(24),
    "0".repeat(24) + "%20",
  ])("отклоняет некорректный ID %s до вызова сервиса", async (id) => {
    const response = await app.inject({ method: "GET", url: `/items/${id}` })

    expect(response.statusCode).toBe(400)
    expect(service.getById).not.toHaveBeenCalled()
  })

  it("сохраняет 404 сервиса для недоступного произведения", async () => {
    service.getById.mockRejectedValue(
      new NotFoundException("Произведение не найдено или удалено"),
    )

    const response = await app.inject({
      method: "GET",
      url: `/items/${result.id}`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      message: "Произведение не найдено или удалено",
    })
  })

  it("описывает гостевой маршрут, ID и ошибки в OpenAPI 3.2", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )
    const operation = document.paths["/items/{id}"].get

    expect(document.openapi).toBe("3.2.0")
    expect(operation).toMatchObject({
      operationId: "ItemController_getById",
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ItemResponseDto" },
            },
          },
        },
        "400": expect.any(Object),
        "404": expect.any(Object),
        "429": expect.any(Object),
      },
    })
    expect(operation?.security).toBeUndefined()
    expect(operation?.requestBody).toBeUndefined()
  })

  it("описывает все поля и вложенные DTO ответа без личных и служебных данных", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )
    const schemas = document.components?.schemas

    expect(schemas).toHaveProperty("ItemResponseDto.properties", {
      id: expect.any(Object),
      type: expect.any(Object),
      title: expect.any(Object),
      media: expect.any(Object),
      description: expect.any(Object),
      aliases: expect.any(Object),
      tags: expect.any(Object),
      features: expect.any(Object),
      relations: expect.any(Object),
    })
    expect(schemas).toHaveProperty("ItemSummaryResponseDto.properties", {
      id: expect.any(Object),
      type: expect.any(Object),
      title: expect.any(Object),
      media: expect.any(Object),
    })
    expect(schemas).toHaveProperty("ItemTagResponseDto.properties", {
      id: expect.any(Object),
      key: expect.any(Object),
      group: expect.any(Object),
      name: expect.any(Object),
    })
    expect(schemas).toHaveProperty("ItemFeatureResponseDto.properties", {
      id: expect.any(Object),
      key: expect.any(Object),
      name: expect.any(Object),
      valueType: expect.any(Object),
      unit: expect.any(Object),
      value: expect.any(Object),
    })
    expect(schemas).toHaveProperty(
      "ItemFeatureResponseDto.properties.value.oneOf",
      [{ type: "string" }, { type: "number" }, { type: "boolean" }],
    )
    expect(schemas).toHaveProperty("ItemRelationResponseDto.properties", {
      item: expect.any(Object),
      role: expect.any(Object),
    })
    expect(schemas).toHaveProperty("ItemRelationRoleResponseDto.properties", {
      id: expect.any(Object),
      key: expect.any(Object),
      name: expect.any(Object),
    })
    expect(schemas).toHaveProperty(
      "LanguageTextResponseDto.properties.ru.type",
      ["string", "null"],
    )
    expect(schemas).toHaveProperty(
      "LanguageTextResponseDto.properties.en.type",
      ["string", "null"],
    )
  })
})
