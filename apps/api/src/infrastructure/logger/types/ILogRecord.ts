import type { TNormalizedError } from "./TNormalizedError"
import type { TLogLevel } from "./TLogLevel"

interface ILogRecord {
  _timestamp: string
  level: TLogLevel
  service: string
  environment: string
  message: string

  context?: string
  requestId?: string
  jobId?: string
  metadata?: unknown
  error?: TNormalizedError
}

export type { ILogRecord }
