import { describe, expect, it } from "@jest/globals"

import { ApiEndpoint } from "../index"
import type { IApiEndpointOptions } from "../index"

describe("ApiEndpoint", () => {
  const createHandler = (options: Partial<IApiEndpointOptions> = {}) => {
    class TestController {
      @ApiEndpoint({
        operationId: "getItem",
        summary: "Получить запись",
        ...options,
      })
      handle() {
        return "value"
      }
    }

    return TestController.prototype.handle
  }

  it("сохраняет идентификатор, заголовок и описание операции", () => {
    const handler = createHandler({ description: "Подробное описание" })

    expect(Reflect.getMetadata("swagger/apiOperation", handler)).toEqual({
      operationId: "getItem",
      summary: "Получить запись",
      description: "Подробное описание",
    })
    expect(handler()).toBe("value")
  })

  it("не добавляет ответы и авторизацию без соответствующих опций", () => {
    const handler = createHandler()

    expect(Reflect.getMetadata("swagger/apiResponse", handler)).toBeUndefined()
    expect(Reflect.getMetadata("swagger/apiSecurity", handler)).toBeUndefined()
  })

  it("сохраняет успешный ответ вместе с ответами ошибок", () => {
    class ItemResponse {}

    const handler = createHandler({
      response: { status: 201, type: ItemResponse, description: "Создано" },
      errors: [{ status: 400, description: "Некорректный запрос" }],
    })

    expect(Reflect.getMetadata("swagger/apiResponse", handler)).toMatchObject({
      "201": { type: ItemResponse, description: "Создано" },
      "400": { description: "Некорректный запрос" },
    })
  })

  it.each([
    { status: 400, code: "BAD_REQUEST" },
    { status: 401, code: "UNAUTHORIZED" },
    { status: 403, code: "FORBIDDEN" },
    { status: 404, code: "NOT_FOUND" },
    { status: 409, code: "CONFLICT" },
    { status: 422, code: "UNPROCESSABLE_ENTITY" },
    { status: 429, code: "TOO_MANY_REQUESTS" },
    { status: 500, code: "INTERNAL_ERROR" },
    { status: 503, code: "HTTP_503" },
  ])("описывает конверт ошибки $status с кодом $code", ({ status, code }) => {
    const handler = createHandler({ errors: [{ status }] })

    expect(Reflect.getMetadata("swagger/apiResponse", handler)).toMatchObject({
      [status]: {
        schema: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "details", "requestId"],
              properties: {
                code: { type: "string", example: code },
                message: { type: "string", example: expect.any(String) },
                details: {
                  type: "object",
                  nullable: true,
                  additionalProperties: true,
                  example: null,
                },
                requestId: { type: "string", example: "req-1" },
              },
            },
          },
        },
      },
    })
  })

  it("использует код HTTP_500 для ошибки без статуса", () => {
    const handler = createHandler({ errors: [{ description: "Ошибка" }] })

    expect(Reflect.getMetadata("swagger/apiResponse", handler)).toMatchObject({
      default: {
        schema: {
          properties: {
            error: { properties: { code: { example: "HTTP_500" } } },
          },
        },
      },
    })
  })

  it("позволяет переопределить стандартную схему ошибки", () => {
    const schema = { type: "string", example: "custom error" }
    const handler = createHandler({ errors: [{ status: 400, schema }] })

    expect(Reflect.getMetadata("swagger/apiResponse", handler)).toMatchObject({
      "400": { schema },
    })
  })

  it.each(["accessToken", ""])(
    "добавляет Bearer-авторизацию с именем схемы «%s»",
    (auth) => {
      const handler = createHandler({ auth })

      expect(Reflect.getMetadata("swagger/apiSecurity", handler)).toEqual([
        { [auth]: [] },
      ])
    },
  )
})
