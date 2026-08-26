import type { IJobHandlerOptions } from "../../../types/IJobHandlerOptions"
import type { TJobType } from "../../../types/IJobPayloadMap"

interface IJobHandlerMetadata extends IJobHandlerOptions {
  type: TJobType
}

export type { IJobHandlerMetadata }
