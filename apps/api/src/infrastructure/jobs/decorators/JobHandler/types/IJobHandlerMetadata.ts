import type { JobDefinition } from "../../../types/JobDefinition"

interface IJobHandlerMetadata {
  definition: JobDefinition<unknown>
}

export type { IJobHandlerMetadata }
