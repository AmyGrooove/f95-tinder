import { describe, expect, it } from "@jest/globals"
import { CACHE_TTL_METADATA, CacheInterceptor } from "@nestjs/cache-manager"
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants"

import { CacheEndpoint } from "../index"
import type { ICacheEndpointOptions } from "../index"

describe("CacheEndpoint", () => {
  it.each([
    { options: undefined, ttlMs: 60_000 },
    { options: {}, ttlMs: 60_000 },
    { options: { ttlMs: 1_500 }, ttlMs: 1_500 },
    { options: { ttlMs: 0 }, ttlMs: 0 },
  ] satisfies Array<{
    options: ICacheEndpointOptions | undefined
    ttlMs: number
  }>)(
    "подключает кеширование с TTL $ttlMs при настройках $options",
    ({ options, ttlMs }) => {
      class TestController {
        @CacheEndpoint(options)
        handle() {
          return "value"
        }
      }

      const handler = TestController.prototype.handle

      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toEqual([
        CacheInterceptor,
      ])
      expect(Reflect.getMetadata(CACHE_TTL_METADATA, handler)).toBe(ttlMs)
    },
  )
})
