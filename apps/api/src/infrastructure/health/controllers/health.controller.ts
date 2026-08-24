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
  @ApiOperation({ summary: "Get API readiness" })
  @ApiOkResponse({ description: "Required dependency health status" })
  getHealth() {
    return this.healthService.checkReadiness()
  }
}

export { HealthController }
