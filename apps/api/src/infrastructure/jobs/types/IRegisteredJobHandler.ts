import type { IJobHandler } from "./IJobHandler"
import type { JobDefinition } from "./JobDefinition"

interface IRegisteredJobHandler {
  handler: IJobHandler<unknown>
  definition: JobDefinition<unknown>
}

export type { IRegisteredJobHandler }
