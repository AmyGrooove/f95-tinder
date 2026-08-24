import { Injectable } from "@nestjs/common"
import {
  HealthCheckService,
  type HealthCheckResult,
  type HealthIndicatorResult,
} from "@nestjs/terminus"

import { InfrastructureHealthService } from "./infrastructureHealth.service"

@Injectable()
class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly infrastructureHealthService: InfrastructureHealthService,
  ) {}

  checkReadiness(): Promise<HealthCheckResult> {
    const checks: Array<() => Promise<HealthIndicatorResult>> = [
      async (): Promise<HealthIndicatorResult> => {
        return this.infrastructureHealthService.checkDatabase()
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.infrastructureHealthService.checkCache()
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.infrastructureHealthService.checkJobs()
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.infrastructureHealthService.checkStorage()
      },
      async (): Promise<HealthIndicatorResult> => {
        return this.infrastructureHealthService.checkSearch()
      },
    ]

    return this.healthCheckService.check(checks)
  }
}

export { HealthService }
