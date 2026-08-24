import type { TJobState } from "./TJobState"

interface IJobListOptions {
  limit?: number
  offset?: number
  states?: readonly TJobState[]
}

export type { IJobListOptions }
