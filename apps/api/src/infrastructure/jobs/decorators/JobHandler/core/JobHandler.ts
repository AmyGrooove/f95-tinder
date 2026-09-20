import { SetMetadata } from "@nestjs/common"

import { JOB_HANDLER_METADATA_KEY } from "../../../static/JOB_HANDLER_METADATA_KEY"
import type { JobDefinition } from "../../../types/JobDefinition"
import type { IJobHandler } from "../../../types/IJobHandler"
import type { IJobHandlerMetadata } from "../types/IJobHandlerMetadata"

const JobHandler = <TPayload>(definition: JobDefinition<TPayload>) => {
  return <
    T extends abstract new (...args: never[]) => IJobHandler<NoInfer<TPayload>>,
  >(
    target: T,
  ) => {
    SetMetadata(JOB_HANDLER_METADATA_KEY, {
      definition,
    } satisfies IJobHandlerMetadata)(target)
  }
}

export { JobHandler }
