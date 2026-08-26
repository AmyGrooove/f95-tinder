import type { TJobState } from "./TJobState"

interface IJobListOptions {
  page?: number
  limit?: number
  states?: readonly TJobState[]
}

export type { IJobListOptions }
