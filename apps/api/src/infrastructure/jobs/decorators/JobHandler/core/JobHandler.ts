import { SetMetadata } from "@nestjs/common"

import { JOB_HANDLER_METADATA_KEY } from "../../../static/JOB_HANDLER_METADATA_KEY"
import type { IJobDefinition } from "../../../types/IJobDefinition"
import type { IJobHandler } from "../../../types/IJobHandler"
import type { IJobHandlerMetadata } from "../types/IJobHandlerMetadata"

const JobHandler = <TPayload>(definition: IJobDefinition<TPayload>) => {
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
