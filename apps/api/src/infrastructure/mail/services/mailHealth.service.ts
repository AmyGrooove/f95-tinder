import { Injectable } from "@nestjs/common"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

@Injectable()
class MailHealthService {
  constructor(
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async healthCheck() {
    const { apiKey, domain } = this.infrastructureConfigService.mail

    if (apiKey.trim() === "" || domain.trim() === "") {
      return false
    }

    try {
      const response = await fetch("https://api.resend.com/domains?limit=1", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(1_500),
      })

      const isApiAvailable = response.ok || response.status === 403

      return isApiAvailable
    } catch {
      return false
    }
  }
}

export { MailHealthService }
