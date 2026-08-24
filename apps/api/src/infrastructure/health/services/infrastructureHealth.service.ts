import { Injectable } from "@nestjs/common"
import { InjectConnection } from "@nestjs/mongoose"
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from "@nestjs/terminus"
import type { Connection } from "mongoose"

import { CacheService } from "@infrastructure/cache/services/cache.service"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { SearchService } from "@infrastructure/search/services/search.service"
import { StorageService } from "@infrastructure/storage/services/storage.service"
import { isNil } from "@shared/functions/isNil"

import { CHECK_TIMEOUT_MS } from "../static/CHECK_TIMEOUT_MS"
import { HEALTH_CHECK_KEYS } from "../static/HEALTH_CHECK_KEYS"

@Injectable()
class InfrastructureHealthService {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly cacheService: CacheService,
    @InjectConnection() private readonly connection: Connection,
    private readonly jobService: JobService,
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
        return this.cacheService.healthCheck()
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

  private async pingDatabase(): Promise<boolean> {
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

  private async runWithTimeout(
    check: () => Promise<boolean>,
  ): Promise<boolean> {
    let timeout: NodeJS.Timeout | undefined

    try {
      const timeoutResult = new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => {
          resolve(false)
        }, CHECK_TIMEOUT_MS)
      })
      const checkResult = check().catch(() => {
        return false
      })

      return await Promise.race([checkResult, timeoutResult])
    } finally {
      if (!isNil(timeout)) {
        clearTimeout(timeout)
      }
    }
  }
}

export { InfrastructureHealthService }
