import { describe, expect, it, jest } from "@jest/globals"

import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { requestContext } from "@shared/functions/context/requestContext"
import { LoggerService } from "../core/logger.service"

describe("LoggerService", () => {
  const config = {
    app: { name: "bisky-test", environment: "development" },
  } as InfrastructureConfigService

  it.each(["info", "warn"] as const)(
    "пишет запись уровня %s в stdout",
    (level) => {
      const write = jest.spyOn(process.stdout, "write").mockReturnValue(true)
      const logger = new LoggerService(config)

      logger[level]("Сообщение", { requestId: "request-id", context: "test" })

      expect(write).toHaveBeenCalledTimes(1)
      expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
        level,
        message: "Сообщение",
        service: "bisky-test",
        environment: "development",
        requestId: "request-id",
        context: "test",
      })
    },
  )

  it("берёт идентификатор из текущего запроса и скрывает секреты в метаданных", () => {
    const write = jest.spyOn(process.stdout, "write").mockReturnValue(true)
    const logger = new LoggerService(config)

    requestContext.run(
      { requestId: "current-id", method: "POST", path: "/login" },
      () => {
        logger.info("Вход", {
          requestId: "metadata-id",
          data: { password: "secret" },
        })
      },
    )

    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      requestId: "current-id",
      method: "POST",
      path: "/login",
      metadata: { password: "[REDACTED]" },
    })
  })

  it("пишет ошибку с нормализованным исключением в stderr", () => {
    const write = jest.spyOn(process.stderr, "write").mockReturnValue(true)
    const logger = new LoggerService(config)

    logger.error("Сбой", new TypeError("invalid input"))

    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      level: "error",
      message: "Сбой",
      error: { name: "TypeError", message: "invalid input" },
    })
  })
})
