import type { IJobHandlerOptions } from "./IJobHandlerOptions"
import type { IJobPayloadMap, TJobType } from "./IJobPayloadMap"

interface IRegisteredJobHandler<TType extends TJobType = TJobType> {
  handler: {
    handle(id: string, payload: IJobPayloadMap[TType]): Promise<unknown> | unknown
  }
  options: Required<IJobHandlerOptions>
}

export type { IRegisteredJobHandler }
