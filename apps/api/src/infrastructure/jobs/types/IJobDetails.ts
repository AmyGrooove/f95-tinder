import type { TJobState } from "./TJobState"
import type { TJobType } from "./IJobPayloadMap"

interface IJobDetails {
  type: TJobType
  state: TJobState
  progress: number
  createdAt: Date

  status?: string
  startedAt?: Date
  finishedAt?: Date
  failedReason?: string
}

export type { IJobDetails }
