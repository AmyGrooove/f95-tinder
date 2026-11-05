import type { IJobHandler } from "../../../types/IJobHandler"
import type { IJobDefinition } from "../../../types/IJobDefinition"

interface IRegisteredJobHandler {
  handler: IJobHandler<unknown>
  definition: IJobDefinition<unknown>
}

export type { IRegisteredJobHandler }
