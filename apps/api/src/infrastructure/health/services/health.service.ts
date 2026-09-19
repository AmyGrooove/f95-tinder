import { setTimeout as wait } from "node:timers/promises"

import { Injectable } from "@nestjs/common"
import {
  HealthCheckService,
  HealthIndicatorService,
  type HealthCheckResult,
  type HealthIndicatorResult,
} from "@nestjs/terminus"

import { CacheHealthService } from "@infrastructure/cache/services/cacheHealth.service"
import { MongoHealthService } from "@infrastructure/database/services/mongoHealth.service"
import { LoggerHealthService } from "@infrastructure/logger/services/loggerHealth.service"
import { StorageHealthService } from "@infrastructure/storage/services/storageHealth.service"

import { CHECK_TIMEOUT_MS } from "../static/CHECK_TIMEOUT_MS"
import { HEALTH_CHECK_KEYS } from "../static/HEALTH_CHECK_KEYS"

@Injectable()
class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly mongoHealthService: MongoHealthService,
    private readonly cacheHealthService: CacheHealthService,
    private readonly loggerHealthService: LoggerHealthService,
    private readonly storageHealthService: StorageHealthService,
  ) {}

  checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<() => Promise<HealthIndicatorResult>> = [
      async (): Promise<HealthIndicatorResult> => {
        return this.createIndicator(HEALTH_CHECK_KEYS.database, async () => {
          return this.mongoHealthService.healthCheck()
        })
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.createIndicator(HEALTH_CHECK_KEYS.cache, async () => {
          return this.cacheHealthService.healthCheck()
        })
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.createIndicator(HEALTH_CHECK_KEYS.openObserve, async () => {
          return this.loggerHealthService.healthCheck()
        })
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.createIndicator(HEALTH_CHECK_KEYS.storage, async () => {
          return this.storageHealthService.healthCheck()
        })
      },
    ]

    return this.healthCheckService.check(checks)
  }

  private async createIndicator(
    key: string,
    check: () => Promise<boolean>,
  ): Promise<HealthIndicatorResult> {
    const isHealthy = await this.runWithTimeout(check)
    const indicator = this.healthIndicatorService.check(key)

    if (isHealthy) {
      return indicator.up()
    }

    return indicator.down()
  }

  private async runWithTimeout(check: () => Promise<boolean>) {
    const timeoutController = new AbortController()

    try {
      const timeoutResult = wait(CHECK_TIMEOUT_MS, false, {
        signal: timeoutController.signal,
      }).catch(() => {
        return false
      })
      const checkResult = check().catch(() => {
        return false
      })

      return await Promise.race([checkResult, timeoutResult])
    } finally {
      timeoutController.abort()
    }
  }
}

export { HealthService }
