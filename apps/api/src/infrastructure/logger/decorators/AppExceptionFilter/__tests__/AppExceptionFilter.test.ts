import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, HttpException } from "@nestjs/common"
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host"
import { Test } from "@nestjs/testing"

import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"

import { AppExceptionFilter } from "../index"

describe("AppExceptionFilter", () => {
  const createFilter = async (requestId = "req-1") => {
    const logger = { error: jest.fn<LoggerService["error"]>() }
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppExceptionFilter,
        { provide: LoggerService, useValue: logger },
      ],
    }).compile()
    const response = {
      status: jest.fn<(code: number) => unknown>().mockReturnThis(),
      send: jest.fn<(body: unknown) => unknown>(),
    }
    const host = new ExecutionContextHost([{ id: requestId }, response])

    return { filter: moduleRef.get(AppExceptionFilter), logger, response, host }
  }

  it.each([
    { status: 400, code: "BAD_REQUEST" },
    { status: 401, code: "UNAUTHORIZED" },
    { status: 403, code: "FORBIDDEN" },
    { status: 404, code: "NOT_FOUND" },
    { status: 409, code: "CONFLICT" },
    { status: 422, code: "UNPROCESSABLE_ENTITY" },
    { status: 429, code: "TOO_MANY_REQUESTS" },
    { status: 418, code: "HTTP_418" },
  ])(
    "возвращает статус $status и код $code без логирования",
    async ({ status, code }) => {
      const { filter, logger, response, host } =
        await createFilter("req-client")

      filter.catch(new HttpException("Ошибка запроса", status), host)

      expect(response.status).toHaveBeenCalledTimes(1)
      expect(response.status).toHaveBeenCalledWith(status)
      expect(response.send).toHaveBeenCalledTimes(1)
      expect(response.send).toHaveBeenCalledWith({
        error: {
          code,
          message: "Ошибка запроса",
          details: null,
          requestId: "req-client",
        },
      })
      expect(logger.error).not.toHaveBeenCalled()
    },
  )

  it("преобразует сообщения валидации в детали ошибки", async () => {
    const { filter, logger, response, host } = await createFilter()
    const errors = ["email must be an email", "password should not be empty"]

    filter.catch(new BadRequestException(errors), host)

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.send).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        details: { errors },
        requestId: "req-1",
      },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it.each([
    { details: { field: "email" }, expected: { field: "email" } },
    { details: ["email занят"], expected: { errors: ["email занят"] } },
    { details: "скрытые детали", expected: null },
    { details: undefined, expected: null },
    { details: null, expected: null },
  ])(
    "сохраняет структурированную ошибку и нормализует детали $details",
    async ({ details, expected }) => {
      const { filter, response, host } = await createFilter()

      filter.catch(
        new HttpException(
          { code: "CONFLICT", message: "Email занят", details },
          409,
        ),
        host,
      )

      expect(response.status).toHaveBeenCalledWith(409)
      expect(response.send).toHaveBeenCalledWith({
        error: {
          code: "CONFLICT",
          message: "Email занят",
          details: expected,
          requestId: "req-1",
        },
      })
    },
  )

  it("сохраняет явный код HTTP и допускает отсутствие деталей", async () => {
    const { filter, response, host } = await createFilter()

    filter.catch(
      new HttpException({ code: "HTTP_418", message: "Чайник" }, 418),
      host,
    )

    expect(response.send).toHaveBeenCalledWith({
      error: {
        code: "HTTP_418",
        message: "Чайник",
        details: null,
        requestId: "req-1",
      },
    })
  })

  it.each(["CUSTOM_ERROR", 123])(
    "заменяет неподдерживаемый явный код %s кодом HTTP-статуса",
    async (code) => {
      const { filter, response, host } = await createFilter()

      filter.catch(
        new HttpException(
          { code, message: "Ошибка", details: { secret: true } },
          400,
        ),
        host,
      )

      expect(response.send).toHaveBeenCalledWith({
        error: {
          code: "BAD_REQUEST",
          message: "Ошибка",
          details: null,
          requestId: "req-1",
        },
      })
    },
  )

  it("использует сообщение исключения, если ответ не содержит строкового сообщения", async () => {
    const { filter, response, host } = await createFilter()
    const exception = new HttpException({ reason: "invalid" }, 400)

    filter.catch(exception, host)

    expect(response.send).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: exception.message,
        details: null,
        requestId: "req-1",
      },
    })
  })

  it.each([
    { status: 499, code: "HTTP_499" },
    { status: 500, code: "INTERNAL_ERROR" },
    { status: 503, code: "HTTP_503" },
  ])(
    "логирует HTTP-ошибку $status только начиная со статуса 500",
    async ({ status, code }) => {
      const { filter, logger, response, host } = await createFilter()
      const exception = new HttpException("Сервис недоступен", status)

      filter.catch(exception, host)

      expect(response.status).toHaveBeenCalledWith(status)
      expect(response.send).toHaveBeenCalledWith({
        error: {
          code,
          message: "Сервис недоступен",
          details: null,
          requestId: "req-1",
        },
      })

      if (status >= 500) {
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(
          DICTIONARY.logger.unhandledException,
          exception,
          {
            context: "AppExceptionFilter",
            requestId: "req-1",
          },
        )
      } else {
        expect(logger.error).not.toHaveBeenCalled()
      }
    },
  )

  it.each([
    new Error("Пароль базы данных"),
    "секрет",
    null,
    undefined,
    { statusCode: 404, message: "секрет" },
  ])(
    "скрывает неизвестное исключение %p и логирует исходное значение",
    async (exception) => {
      const { filter, logger, response, host } =
        await createFilter("req-server")

      filter.catch(exception, host)

      expect(response.status).toHaveBeenCalledWith(500)
      expect(response.send).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_ERROR",
          message: ERROR_MESSAGES.INTERNAL_ERROR,
          details: null,
          requestId: "req-server",
        },
      })
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith(
        DICTIONARY.logger.unhandledException,
        exception,
        {
          context: "AppExceptionFilter",
          requestId: "req-server",
        },
      )
    },
  )
})
