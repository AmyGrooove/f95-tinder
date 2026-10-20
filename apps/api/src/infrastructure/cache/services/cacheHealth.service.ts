import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"

import { CacheService } from "./cache.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class CacheHealthService implements OnApplicationBootstrap {
  constructor(private readonly cacheService: CacheService) {}

  async onApplicationBootstrap() {
    await this.healthCheck()
  }

  async healthCheck() {
    const key = `health-check:${crypto.randomUUID()}`
    const value = crypto.randomUUID()
    let healthCheckError: unknown
    let isHealthCheckFailed = false

    try {
      await this.cacheService.set(key, value, 10_000)

      const cachedValue = await this.cacheService.get<string>(key)

      if (cachedValue !== value) {
        throw new Error(DICTIONARY.cache.unexpectedHealthValue)
      }
    } catch (error) {
      healthCheckError = error
      isHealthCheckFailed = true
    }

    try {
      await this.cacheService.delete(key)
    } catch (cleanupError) {
      if (isHealthCheckFailed) {
        throw new AggregateError(
          [healthCheckError, cleanupError],
          DICTIONARY.cache.healthAndCleanupFailed,
          { cause: cleanupError },
        )
      }

      throw cleanupError
    }

    if (isHealthCheckFailed) {
      throw healthCheckError
    }

    return true
  }
}

export { CacheHealthService }
