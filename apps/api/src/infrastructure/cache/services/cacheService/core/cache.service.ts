import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Inject, Injectable } from "@nestjs/common"
import type { Cache } from "cache-manager"

@Injectable()
class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<TValue>(key: string) {
    const value = await this.cache.get<TValue>(key)

    return value ?? null
  }

  async set<TValue>(key: string, value: TValue, ttl?: number) {
    await this.cache.set(key, value, ttl)
  }

  async delete(key: string) {
    await this.cache.del(key)
  }
}

export { CacheService }
