import type { TJobState } from "./TJobState"

interface IJobListOptions {
  cursor?: string
  limit?: number
  states?: readonly TJobState[]
}

export type { IJobListOptions }
