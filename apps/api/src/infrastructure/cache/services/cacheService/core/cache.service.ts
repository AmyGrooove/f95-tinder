import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Inject, Injectable } from "@nestjs/common"
import KeyvRedis from "@keyv/redis"
import type { Cache } from "cache-manager"

import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<TValue>(key: string) {
    const value = await this.cache.stores[0].get<TValue>(key)

    return value ?? null
  }

  async set<TValue>(key: string, value: TValue, ttl?: number) {
    await this.cache.set(key, value, ttl)
  }

  async setIfAbsent<TValue>(key: string, value: TValue, ttl: number) {
    const keyv = this.cache.stores[0]
    const store: unknown = keyv.store
    if (!(store instanceof KeyvRedis)) {
      throw new Error(DICTIONARY.cache.redisStoreRequired)
    }

    const serializedValue = await keyv.serializeData({ value })
    if (!isString(serializedValue)) {
      throw new Error(DICTIONARY.cache.invalidSerializedValue)
    }

    const client = await store.getClient()
    const previous = await client.set(
      store.createKeyPrefix(key, store.namespace),
      serializedValue,
      { NX: true, GET: true, PX: ttl },
    )
    if (isNil(previous)) {
      return value
    }

    const stored = await keyv.deserializeData<TValue>(previous)
    if (isUndefined(stored?.value)) {
      throw new Error(DICTIONARY.cache.invalidSerializedValue)
    }

    return stored.value
  }

  async delete(key: string) {
    await this.cache.del(key)
  }
}

export { CacheService }
