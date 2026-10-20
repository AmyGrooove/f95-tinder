declare const JOB_PAYLOAD: unique symbol

interface IJobDefinition<TPayload> {
  readonly name: string
  readonly version: number
  readonly retryDelays: readonly number[]
  readonly [JOB_PAYLOAD]?: TPayload
}

export type { IJobDefinition }
