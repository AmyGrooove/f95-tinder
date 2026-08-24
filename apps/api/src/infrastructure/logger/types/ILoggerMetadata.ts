interface ILoggerMetadata {
  [key: string]: unknown;

  context?: string;
  requestId?: string;
  jobId?: string;
}

export type { ILoggerMetadata };
