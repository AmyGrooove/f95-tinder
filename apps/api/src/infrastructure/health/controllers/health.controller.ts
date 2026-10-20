import { Controller, Get } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { HealthCheck } from "@nestjs/terminus"

import { HealthService } from "../services/health.service"
import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

@ApiTags(SWAGGER_DICTIONARY.health.tag)
@Controller("health")
class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: SWAGGER_DICTIONARY.health.getHealth.summary })
  @ApiOkResponse({
    description: SWAGGER_DICTIONARY.health.getHealth.description,
  })
  getHealth() {
    return this.healthService.checkHealth()
  }

  @Get("live")
  @ApiOperation({ summary: SWAGGER_DICTIONARY.health.getLiveness.summary })
  @ApiOkResponse({
    description: SWAGGER_DICTIONARY.health.getLiveness.description,
  })
  getLiveness() {
    return { status: "ok" }
  }
}

export { HealthController }
