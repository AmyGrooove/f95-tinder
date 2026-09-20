import type { TJobState } from "./TJobState"
interface IJobDetails {
  id: string
  name: string
  state: TJobState
  progress: number
  attempt: number
  createdAt: Date

  status?: string
  startedAt?: Date
  finishedAt?: Date
  failedReason?: string
}

export type { IJobDetails }
