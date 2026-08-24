import type { TJobState } from "./TJobState"

interface IJobListItem {
  id: string
  name: string
  payload: unknown
  state: TJobState
  progress: number | object
  attemptsMade: number
  createdAt: Date

  failedReason?: string
  finishedAt?: Date
  processedAt?: Date
  status?: string
}

export type { IJobListItem }
