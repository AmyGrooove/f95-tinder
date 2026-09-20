declare const JOB_PAYLOAD: unique symbol

interface JobDefinition<TPayload> {
  readonly name: string
  readonly version: number
  readonly retryDelays: readonly number[]
  readonly [JOB_PAYLOAD]?: TPayload
}

export type { JobDefinition }
