interface IJobProgress {
  progress: number
  status?: string
  executionState?: "queued" | "running"
}

export type { IJobProgress }
