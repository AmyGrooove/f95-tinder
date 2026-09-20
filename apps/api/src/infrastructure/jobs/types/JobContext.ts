import type { IJobProgress } from "./IJobProgress"

interface JobContext {
  readonly id: string
  readonly attempt: number
  updateProgress(progress: IJobProgress): Promise<void>
  throwIfCancelled(): Promise<void>
}

export type { JobContext }
