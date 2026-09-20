interface IJobAddOptions {
  jobId?: string
  delay?: number
  deduplication?: {
    id: string
    ttl?: number
    extend?: boolean
    replace?: boolean
    keepLastIfActive?: boolean
  }
}

export type { IJobAddOptions }
