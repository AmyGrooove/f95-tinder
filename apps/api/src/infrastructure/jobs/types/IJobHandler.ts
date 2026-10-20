import type { IJobContext } from "./IJobContext"

interface IJobHandler<TPayload> {
  handle(payload: TPayload, context: IJobContext): Promise<unknown> | unknown
}

export type { IJobHandler }
