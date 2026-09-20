interface IJobData<TPayload = unknown> {
  name: string
  version: number
  payload: TPayload
  retryDelays: readonly number[]
  cancellationState: "none" | "cancelling" | "cancelled"
}

export type { IJobData }
