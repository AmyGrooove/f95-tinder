import { Injectable } from "@nestjs/common"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import { normalizeError } from "../functions/normalizeError"
import type { ILoggerMetadata } from "../types/ILoggerMetadata"
import type { ILogRecord } from "../types/ILogRecord"
import type { TLogLevel } from "../types/TLogLevel"
import { OpenObserveService } from "./openObserve.service"

@Injectable()
class LoggerService {
  constructor(
    private readonly infrastructureConfigService: InfrastructureConfigService,
    private readonly openObserveService: OpenObserveService,
  ) {}

  info(message: string, metadata?: ILoggerMetadata) {
    this.write("info", message, undefined, metadata)
  }

  warn(message: string, metadata?: ILoggerMetadata) {
    this.write("warn", message, undefined, metadata)
  }

  error(message: string, error?: unknown, metadata?: ILoggerMetadata) {
    this.write("error", message, error, metadata)
  }

  private write(
    level: TLogLevel,
    message: string,
    error: unknown,
    metadata?: ILoggerMetadata,
  ) {
    const { context, data, jobId, requestId } = metadata ?? {}
    const currentRequest = requestContext.getAll()
    const {
      requestId: currentRequestId,
      method,
      path,
      ...additionalContext
    } = currentRequest ?? {}

    const record: ILogRecord = {
      _timestamp: new Date().toISOString(),
      level,
      service: this.infrastructureConfigService.app.name,
      environment: this.infrastructureConfigService.app.environment ?? "",
      message,
      context,
      requestId: currentRequestId ?? requestId,
      method: isString(method) ? method : undefined,
      path: isString(path) ? path : undefined,
      requestContext:
        Object.keys(additionalContext).length > 0
          ? additionalContext
          : undefined,
      jobId,
      metadata: data,
      error: isNil(error) ? undefined : normalizeError(error),
    }

    void this.openObserveService.send(record)
  }
}

export { LoggerService }
