import type { JobContext } from "./JobContext"

interface IJobHandler<TPayload> {
  handle(payload: TPayload, context: JobContext): Promise<unknown> | unknown
}

export type { IJobHandler }
