import { setTimeout as wait } from "node:timers/promises"

import { Injectable } from "@nestjs/common"
import { HealthCheckService, HealthIndicatorService } from "@nestjs/terminus"

import { CacheHealthService } from "@infrastructure/cache/services/cacheHealthService"
import { MongoHealthService } from "@infrastructure/database/services/mongoHealthService"
import { JobsHealthService } from "@infrastructure/jobs/services/jobsHealthService"
import { MailHealthService } from "@infrastructure/mail/services/mailHealthService"
import { SchedulerHealthService } from "@infrastructure/scheduler/services/schedulerHealthService"
import { SearchHealthService } from "@infrastructure/search/services/searchHealthService"
import { StorageHealthService } from "@infrastructure/storage/services/storageHealthService"

import { CHECK_TIMEOUT_MS } from "../static/CHECK_TIMEOUT_MS"
import { HEALTH_CHECK_KEYS } from "../static/HEALTH_CHECK_KEYS"

@Injectable()
class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly mongoHealthService: MongoHealthService,
    private readonly cacheHealthService: CacheHealthService,
    private readonly jobsHealthService: JobsHealthService,
    private readonly mailHealthService: MailHealthService,
    private readonly schedulerHealthService: SchedulerHealthService,
    private readonly searchHealthService: SearchHealthService,
    private readonly storageHealthService: StorageHealthService,
  ) {}

  async checkHealth() {
    const checks = [
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.database, async () => {
          return this.mongoHealthService.healthCheck()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.cache, async () => {
          return this.cacheHealthService.healthCheck()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.jobs, async () => {
          return this.jobsHealthService.checkHealth()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.mail, async () => {
          return this.mailHealthService.healthCheck()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.scheduler, async () => {
          return this.schedulerHealthService.checkHealth()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.search, async () => {
          return this.searchHealthService.healthCheck()
        })
      },
      async () => {
        return this.createIndicator(HEALTH_CHECK_KEYS.storage, async () => {
          return this.storageHealthService.healthCheck()
        })
      },
    ]

    const result = await this.healthCheckService.check(checks)

    return {
      status: result.status,
      error: result.error,
      details: result.details,
    }
  }

  private async createIndicator(key: string, check: () => Promise<boolean>) {
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
