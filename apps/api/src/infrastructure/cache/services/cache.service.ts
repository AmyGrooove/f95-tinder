import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Inject, Injectable } from "@nestjs/common"
import { isArray } from "@shared/functions/isArray"
import { isObject } from "@shared/functions/isObject"
import { isString } from "@shared/functions/isString"
import type { Cache } from "cache-manager"

import { isIterableCacheStore } from "../functions/isIterableCacheStore"

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

  async deleteByPrefix(prefix: string) {
    const stores = this.getStores()

    for (const store of stores) {
      if (!isIterableCacheStore(store)) {
        continue
      }

      for await (const [key] of store.iterator({})) {
        if (!isString(key)) {
          continue
        }

        if (key.startsWith(prefix)) {
          await store.delete(key)
        }
      }
    }
  }

  async healthCheck() {
    const key = `health-check:${crypto.randomUUID()}`

    await this.get(key)

    return true
  }

  private getStores() {
    const cache = this.cache as unknown

    if (!isObject(cache) || !("stores" in cache) || !isArray(cache.stores)) {
      return []
    }

    return cache.stores
  }
}

export { CacheService }
