import { SetMetadata } from "@nestjs/common"

import { JOB_HANDLER_METADATA_KEY } from "../../../static/JOB_HANDLER_METADATA_KEY"
import type { IJobHandlerOptions } from "../../../types/IJobHandlerOptions"
import type { TJobType } from "../../../types/IJobPayloadMap"
import type { IJobHandlerMetadata } from "../types/IJobHandlerMetadata"

const JobHandler = (type: TJobType, options?: IJobHandlerOptions) => {
  return SetMetadata(JOB_HANDLER_METADATA_KEY, { ...options, type } satisfies IJobHandlerMetadata)
}

export { JobHandler }
