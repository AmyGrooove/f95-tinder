interface IJobContext {
  jobId: string
  updateProgress(progress: number, status?: string): Promise<void>
  isCancellationRequested(): Promise<boolean>
  throwIfCancellationRequested(): Promise<void>
}

export type { IJobContext }
