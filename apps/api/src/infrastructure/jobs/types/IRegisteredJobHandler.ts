import type { IJobHandler } from "./IJobHandler"
import type { IJobDefinition } from "./IJobDefinition"

interface IRegisteredJobHandler {
  handler: IJobHandler<unknown>
  definition: IJobDefinition<unknown>
}

export type { IRegisteredJobHandler }
