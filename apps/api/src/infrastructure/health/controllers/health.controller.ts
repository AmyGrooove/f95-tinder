import { Controller, Get } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { HealthCheck } from "@nestjs/terminus"

import { HealthService } from "../services/healthService"
import { HEALTH_CHECK_KEYS } from "../services/healthService/static/HEALTH_CHECK_KEYS"
import {
  ApiEndpoint,
  createSwaggerErrorExample,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

const readinessHeaders = {
  "Cache-Control": {
    description: SWAGGER_DICTIONARY.headers.cacheControl,
    schema: {
      type: "string" as const,
      enum: ["no-cache, no-store, must-revalidate"],
    },
  },
}

const healthDetails = Object.fromEntries(
  Object.values(HEALTH_CHECK_KEYS).map((key) => [key, { status: "up" }]),
)

@ApiTags(SWAGGER_DICTIONARY.health.tag)
@Controller("health")
class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck({ noCache: true, swaggerDocumentation: false })
  @ApiEndpoint({
    operationId: "HealthController_getHealth",
    summary: SWAGGER_DICTIONARY.health.getHealth.summary,
    description: SWAGGER_DICTIONARY.health.getHealth.operationDescription,
    response: {
      status: 200,
      description: SWAGGER_DICTIONARY.health.getHealth.description,
      headers: readinessHeaders,
      schema: {
        type: "object",
        required: ["status", "error", "details"],
        properties: {
          status: { type: "string", enum: ["ok"] },
          error: { type: "object", maxProperties: 0 },
          details: {
            type: "object",
            required: Object.values(HEALTH_CHECK_KEYS),
            additionalProperties: {
              type: "object",
              required: ["status"],
              properties: { status: { type: "string", enum: ["up"] } },
            },
          },
        },
      },
      examples: {
        ready: {
          summary: "Все зависимости доступны",
          value: { status: "ok", error: {}, details: healthDetails },
        },
      },
    },
    errors: [
      {
        status: 503,
        description: SWAGGER_DICTIONARY.health.getHealth.unavailable,
        headers: readinessHeaders,
        examples: {
          unavailable: createSwaggerErrorExample(
            503,
            "Отказ проверки готовности",
            "Service Unavailable Exception",
          ),
        },
      },
      { status: 429, description: SWAGGER_DICTIONARY.rateLimitExceeded },
    ],
  })
  getHealth() {
    return this.healthService.checkHealth()
  }

  @Get("live")
  @ApiEndpoint({
    operationId: "HealthController_getLiveness",
    summary: SWAGGER_DICTIONARY.health.getLiveness.summary,
    description: SWAGGER_DICTIONARY.health.getLiveness.operationDescription,
    response: {
      status: 200,
      description: SWAGGER_DICTIONARY.health.getLiveness.description,
      schema: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["ok"] } },
      },
      examples: {
        alive: {
          summary: "Процесс отвечает по HTTP",
          value: { status: "ok" },
        },
      },
    },
    errors: [
      { status: 429, description: SWAGGER_DICTIONARY.rateLimitExceeded },
    ],
  })
  getLiveness() {
    return { status: "ok" }
  }
}

export { HealthController }
