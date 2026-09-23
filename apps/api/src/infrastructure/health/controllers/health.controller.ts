import { Controller, Get } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { HealthCheck } from "@nestjs/terminus"

import { HealthService } from "../services/health.service"

@ApiTags("Health")
@Controller("health")
class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Get API health status" })
  @ApiOkResponse({ description: "Dependency health status" })
  getHealth() {
    return this.healthService.checkHealth()
  }

  @Get("live")
  @ApiOperation({ summary: "Check API liveness" })
  @ApiOkResponse({ description: "HTTP API is responding" })
  getLiveness() {
    return { status: "ok" }
  }
}

export { HealthController }
