import { setTimeout as wait } from "node:timers/promises"

import { Injectable } from "@nestjs/common"
import { InjectConnection } from "@nestjs/mongoose"
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from "@nestjs/terminus"
import type { Connection } from "mongoose"

import { CacheHealthService } from "@infrastructure/cache/services/cacheHealth.service"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { OpenObserveService } from "@infrastructure/logger/services/openObserve.service"
import { SearchService } from "@infrastructure/search/services/search.service"
import { StorageService } from "@infrastructure/storage/services/storage.service"
import { isNil } from "@shared/functions/checks/isNil"

import { CHECK_TIMEOUT_MS } from "../static/CHECK_TIMEOUT_MS"
import { HEALTH_CHECK_KEYS } from "../static/HEALTH_CHECK_KEYS"

@Injectable()
class InfrastructureHealthService {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly cacheHealthService: CacheHealthService,
    @InjectConnection() private readonly connection: Connection,
    private readonly jobService: JobService,
    private readonly openObserveService: OpenObserveService,
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
  ) {}

  async checkDatabase(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.database,
      async (): Promise<boolean> => {
        return this.pingDatabase()
      },
    )
  }

  async checkCache(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.cache,
      async (): Promise<boolean> => {
        return this.cacheHealthService.healthCheck()
      },
    )
  }

  async checkJobs(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.jobs,
      async (): Promise<boolean> => {
        return this.jobService.healthCheck()
      },
    )
  }

  async checkStorage(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.storage,
      async (): Promise<boolean> => {
        return this.storageService.healthCheck()
      },
    )
  }

  async checkSearch(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.search,
      async (): Promise<boolean> => {
        return this.searchService.healthCheck()
      },
    )
  }

  async checkOpenObserve(): Promise<HealthIndicatorResult> {
    return this.createIndicator(
      HEALTH_CHECK_KEYS.openObserve,
      async (): Promise<boolean> => {
        return this.openObserveService.healthCheck()
      },
    )
  }

  private async pingDatabase() {
    if (isNil(this.connection.db)) {
      return false
    }

    await this.connection.db.admin().ping()

    return true
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

export { InfrastructureHealthService }
