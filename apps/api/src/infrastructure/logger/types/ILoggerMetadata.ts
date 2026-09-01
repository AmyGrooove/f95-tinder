interface ILoggerMetadata {
  data: Record<string, unknown>

  context?: string
  requestId?: string
  jobId?: string
}

export type { ILoggerMetadata }
