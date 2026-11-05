import type { INormalizedError } from "./INormalizedError"
import type { TLogLevel } from "./TLogLevel"

interface ILogRecord {
  _timestamp: string
  level: TLogLevel
  service: string
  environment: string
  message: string

  context?: string
  requestId?: string
  method?: string
  path?: string
  requestContext?: Record<string, unknown>
  jobId?: string
  metadata?: unknown
  error?: INormalizedError
}

export type { ILogRecord }
