import { Injectable, Logger } from "@nestjs/common"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isNil } from "@shared/functions/checks/isNil"

import { redactLogValue } from "../functions/redactLogValue"
import { LOGGER_SEND_TIMEOUT_MS } from "../static/LOGGER_SEND_TIMEOUT_MS"
import type { ILogRecord } from "../types/ILogRecord"
import type { TLogLevel } from "../types/TLogLevel"

@Injectable()
class OpenObserveService {
  private readonly logger = new Logger(OpenObserveService.name)

  constructor(
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async send(record: ILogRecord) {
    let output: string

    try {
      output = JSON.stringify(redactLogValue(record))
    } catch {
      this.logger.error("Failed to serialize log record")

      return
    }

    if (!this.checkIsEnabled()) {
      this.writeFallback(output, record.level)

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
          body: `[${output}]`,
          signal: AbortSignal.timeout(LOGGER_SEND_TIMEOUT_MS),
        },
      )

      if (!response.ok) {
        this.writeFallback(output, record.level)
      }
    } catch {
      this.writeFallback(output, record.level)
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

  private writeFallback(output: string, level: TLogLevel) {
    if (level === "error") {
      this.logger.error(output)

      return
    }

    if (level === "warn") {
      this.logger.warn(output)

      return
    }

    this.logger.log(output)
  }
}

export { OpenObserveService }
