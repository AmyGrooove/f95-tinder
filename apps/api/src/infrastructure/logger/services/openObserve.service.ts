import { Injectable, Logger } from "@nestjs/common"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isNil } from "@shared/functions/checks/isNil"

import { CHECK_TIMEOUT_MS } from "../../health/static/CHECK_TIMEOUT_MS"
import type { ILogRecord } from "../types/ILogRecord"

@Injectable()
class OpenObserveService {
  private readonly logger = new Logger(OpenObserveService.name)

  constructor(
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async send(record: ILogRecord) {
    if (!this.checkIsEnabled()) {
      this.writeFallback(record)

      return
    }

    try {
      const response = await fetch(
        this.infrastructureConfigService.openObserve.url,
        {
          method: "POST",
          headers: {
            Authorization: this.getAuthorizationHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify([record]),
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        },
      )

      if (!response.ok) {
        this.writeFallback(record)
      }
    } catch {
      this.writeFallback(record)
    }
  }

  async healthCheck() {
    if (!this.checkIsEnabled()) {
      return false
    }

    try {
      const url = new URL(
        "/healthz",
        this.infrastructureConfigService.openObserve.url,
      )
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      })

      return response.ok
    } catch {
      return false
    }
  }

  private checkIsEnabled() {
    const { password, username } = this.infrastructureConfigService.openObserve

    return (
      !isNil(username) &&
      username.length > 0 &&
      !isNil(password) &&
      password.length > 0
    )
  }

  private getAuthorizationHeader() {
    const { password, username } = this.infrastructureConfigService.openObserve

    const credentials = `${username ?? ""}:${password ?? ""}`

    return `Basic ${Buffer.from(credentials).toString("base64")}`
  }

  private writeFallback(record: ILogRecord) {
    try {
      const output = JSON.stringify(record)

      if (record.level === "error") {
        this.logger.error(output)

        return
      }

      this.logger.log(output)
    } catch {
      this.logger.error("Failed to serialize log record")
    }
  }
}

export { OpenObserveService }
