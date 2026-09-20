import { Injectable } from "@nestjs/common"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { LOGGER_HEALTH_CHECK_TIMEOUT_MS } from "../static/LOGGER_HEALTH_CHECK_TIMEOUT_MS"

@Injectable()
class LoggerHealthService {
  constructor(
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async healthCheck() {
    const { url } = this.infrastructureConfigService.openObserve

    try {
      const response = await fetch(new URL("/healthz", url), {
        signal: AbortSignal.timeout(LOGGER_HEALTH_CHECK_TIMEOUT_MS),
      })

      return response.ok
    } catch {
      return false
    }
  }
}

export { LoggerHealthService }
