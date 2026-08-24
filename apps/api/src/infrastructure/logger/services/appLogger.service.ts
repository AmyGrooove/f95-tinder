import { Injectable, Logger, type LoggerService } from "@nestjs/common"
import { isNil } from "@shared/functions/isNil"

import { normalizeError } from "../functions/normalizeError"
import { redactLogValue } from "../functions/redactLogValue"
import type { ILoggerMetadata } from "../types/ILoggerMetadata"
import type { TLogLevel } from "../types/TLogLevel"

@Injectable()
class AppLoggerService implements LoggerService {
  private readonly logger = new Logger(AppLoggerService.name)

  log(message: unknown, metadata?: ILoggerMetadata): void {
    this.write("log", message, undefined, metadata)
  }

  warn(message: unknown, metadata?: ILoggerMetadata): void {
    this.write("warn", message, undefined, metadata)
  }

  debug(message: unknown, metadata?: ILoggerMetadata): void {
    this.write("debug", message, undefined, metadata)
  }

  verbose(message: unknown, metadata?: ILoggerMetadata): void {
    this.write("verbose", message, undefined, metadata)
  }

  error(message: unknown, error?: unknown, metadata?: ILoggerMetadata): void {
    this.write("error", message, error, metadata)
  }

  private write(
    level: TLogLevel,
    message: unknown,
    error: unknown,
    metadata?: ILoggerMetadata,
  ): void {
    const normalizedMessage = normalizeError(message)
    const normalizedError = isNil(error) ? undefined : normalizeError(error)
    const record = {
      timestamp: new Date().toISOString(),
      level,
      message: normalizedMessage.message,
      context: metadata?.context,
      requestId: metadata?.requestId,
      jobId: metadata?.jobId,
      metadata: isNil(metadata) ? undefined : redactLogValue(metadata),
      error: normalizedError,
    }
    const output = JSON.stringify(record)

    if (level === "error") {
      this.logger.error(output)

      return
    }

    if (level === "warn") {
      this.logger.warn(output)

      return
    }

    if (level === "debug") {
      this.logger.debug(output)

      return
    }

    if (level === "verbose") {
      this.logger.verbose(output)

      return
    }

    this.logger.log(output)
  }
}

export { AppLoggerService }
