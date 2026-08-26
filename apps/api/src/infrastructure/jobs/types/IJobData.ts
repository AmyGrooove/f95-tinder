import type { IJobPayloadMap, TJobType } from "./IJobPayloadMap"

interface IJobData<TType extends TJobType> {
  type: TType
  payload: IJobPayloadMap[TType]
  cancellationState: "none" | "cancelling" | "cancelled"
}

export type { IJobData }
