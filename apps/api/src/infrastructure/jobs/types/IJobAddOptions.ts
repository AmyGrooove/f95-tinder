import type { DeduplicationOptions } from "bullmq"

interface IJobAddOptions {
  jobId?: string
  delay?: number
  deduplication?: DeduplicationOptions
}

export type { IJobAddOptions }
