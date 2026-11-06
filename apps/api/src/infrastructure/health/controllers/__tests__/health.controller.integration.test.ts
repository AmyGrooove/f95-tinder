import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { TerminusModule } from "@nestjs/terminus"
import { Test } from "@nestjs/testing"
import { APP_FILTER } from "@nestjs/core"

import { CacheHealthService } from "@infrastructure/cache/services/cacheHealthService"
import { MongoHealthService } from "@infrastructure/database/services/mongoHealthService"
import { JobsHealthService } from "@infrastructure/jobs/services/jobsHealthService"
import { MailHealthService } from "@infrastructure/mail/services/mailHealthService"
import { SchedulerHealthService } from "@infrastructure/scheduler/services/schedulerHealthService"
import { SearchHealthService } from "@infrastructure/search/services/searchHealthService"
import { StorageHealthService } from "@infrastructure/storage/services/storageHealthService"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { LoggerService } from "@infrastructure/logger/services/loggerService"

import { HealthService } from "../../services/healthService"
import { HealthController } from "../health.controller"

describe("HealthController", () => {
  let app: NestFastifyApplication
  const databaseCheck = jest
    .fn<() => Promise<boolean>>()
    .mockResolvedValue(true)
  const check = jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
  const logError = jest.fn()

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: APP_FILTER, useClass: AppExceptionFilter },
        { provide: LoggerService, useValue: { error: logError } },
        {
          provide: MongoHealthService,
          useValue: { healthCheck: databaseCheck },
        },
        { provide: CacheHealthService, useValue: { healthCheck: check } },
        { provide: JobsHealthService, useValue: { checkHealth: check } },
        { provide: MailHealthService, useValue: { healthCheck: check } },
        { provide: SchedulerHealthService, useValue: { checkHealth: check } },
        { provide: SearchHealthService, useValue: { healthCheck: check } },
        { provide: StorageHealthService, useValue: { healthCheck: check } },
      ],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app?.close()
  })

  it("возвращает 200 без авторизации и статусы всех зависимостей", async () => {
    const response = await app.inject({ method: "GET", url: "/health" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: "ok",
      error: {},
      details: {
        database: { status: "up" },
        cache: { status: "up" },
        jobs: { status: "up" },
        mail: { status: "up" },
        scheduler: { status: "up" },
        search: { status: "up" },
        storage: { status: "up" },
      },
    })
  })

  it("возвращает 503 при ошибке зависимости", async () => {
    databaseCheck.mockRejectedValueOnce(new Error("database offline"))

    const response = await app.inject({ method: "GET", url: "/health" })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
      error: {
        code: "HTTP_503",
        message: expect.any(String),
        details: null,
        requestId: expect.any(String),
      },
    })
    expect(logError).toHaveBeenCalledTimes(1)
  })

  it("возвращает 200 без авторизации и без запуска проверки зависимостей", async () => {
    const response = await app.inject({ method: "GET", url: "/health/live" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: "ok" })
    expect(databaseCheck).not.toHaveBeenCalled()
    expect(check).not.toHaveBeenCalled()
  })
})
