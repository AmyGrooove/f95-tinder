import { describe, expect, it } from "@jest/globals"
import {
  HealthIndicatorService,
  type HealthCheckService,
  type HealthIndicatorResult,
} from "@nestjs/terminus"

import type { CacheHealthService } from "@infrastructure/cache/services/cacheHealthService"
import type { MongoHealthService } from "@infrastructure/database/services/mongoHealthService"
import type { JobsHealthService } from "@infrastructure/jobs/services/jobsHealthService"
import type { MailHealthService } from "@infrastructure/mail/services/mailHealthService"
import type { SchedulerHealthService } from "@infrastructure/scheduler/services/schedulerHealthService"
import type { SearchHealthService } from "@infrastructure/search/services/searchHealthService"
import type { StorageHealthService } from "@infrastructure/storage/services/storageHealthService"

import { HealthService } from "../core/health.service"

describe("HealthService", () => {
  it("помечает отказ, исключение и превышение таймаута как недоступность зависимостей", async () => {
    const check = async (checks: (() => Promise<HealthIndicatorResult>)[]) => {
      const results = await Promise.all(checks.map(async (probe) => probe()))
      const details = Object.fromEntries(results.flatMap(Object.entries))

      return { status: "error", info: {}, error: {}, details }
    }
    const available = { healthCheck: async () => true }
    const unavailable = { healthCheck: async () => false }
    const stalled = { healthCheck: async () => new Promise<boolean>(() => {}) }
    const failing = {
      checkHealth: async () => {
        throw new Error("offline")
      },
    }
    const scheduler = { checkHealth: async () => true }
    const service = new HealthService(
      { check } as unknown as HealthCheckService,
      new HealthIndicatorService(),
      available as unknown as MongoHealthService,
      stalled as unknown as CacheHealthService,
      failing as unknown as JobsHealthService,
      unavailable as unknown as MailHealthService,
      scheduler as unknown as SchedulerHealthService,
      available as unknown as SearchHealthService,
      available as unknown as StorageHealthService,
    )

    await expect(service.checkHealth()).resolves.toEqual({
      status: "error",
      error: {},
      details: {
        database: { status: "up" },
        cache: { status: "down" },
        jobs: { status: "down" },
        mail: { status: "down" },
        scheduler: { status: "up" },
        search: { status: "up" },
        storage: { status: "up" },
      },
    })
  })
})
