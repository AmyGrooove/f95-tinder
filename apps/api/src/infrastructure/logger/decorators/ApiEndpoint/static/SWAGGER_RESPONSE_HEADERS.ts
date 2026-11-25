import type { ApiResponseOptions } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

const { headers } = SWAGGER_DICTIONARY

const noStore = {
  "Cache-Control": {
    description: headers.cacheControl,
    schema: { type: "string", enum: ["no-store"] },
  },
} satisfies NonNullable<ApiResponseOptions["headers"]>

const SWAGGER_RESPONSE_HEADERS = {
  noStore,
  jsonQuery: {
    ...noStore,
    "Accept-Query": {
      description: headers.acceptQuery,
      schema: { type: "string", enum: ["application/json"] },
    },
  },
  rateLimit: {
    "X-RateLimit-Limit": {
      description: headers.rateLimit,
      schema: { type: "integer", minimum: 1 },
    },
    "X-RateLimit-Remaining": {
      description: headers.rateRemaining,
      schema: { type: "integer", minimum: 0 },
    },
    "X-RateLimit-Reset": {
      description: headers.rateReset,
      schema: { type: "integer", minimum: -1 },
    },
  },
  retryAfter: {
    "Retry-After": {
      description: headers.retryAfter,
      schema: { type: "integer", minimum: -1 },
    },
  },
} satisfies Record<string, NonNullable<ApiResponseOptions["headers"]>>

export { SWAGGER_RESPONSE_HEADERS }
