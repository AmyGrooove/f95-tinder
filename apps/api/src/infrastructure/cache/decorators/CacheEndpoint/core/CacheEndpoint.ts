import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager"
import { applyDecorators, UseInterceptors } from "@nestjs/common"

import { DEFAULT_CACHE_ENDPOINT_TTL_MS } from "../static/DEFAULT_CACHE_ENDPOINT_TTL_MS"
import type { ICacheEndpointOptions } from "../types/ICacheEndpointOptions"

const CacheEndpoint = (
  options: ICacheEndpointOptions = {},
): MethodDecorator => {
  return applyDecorators(
    UseInterceptors(CacheInterceptor),
    CacheTTL(options.ttlMs ?? DEFAULT_CACHE_ENDPOINT_TTL_MS),
  )
}

export { CacheEndpoint }
