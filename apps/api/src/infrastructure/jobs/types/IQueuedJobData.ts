interface IQueuedJobData<TPayload> {
  isCancellationRequested: boolean
  payload: TPayload

  status?: string
}

export type { IQueuedJobData }
