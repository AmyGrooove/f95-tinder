import type { Types } from "mongoose"

import type { JobContext } from "@infrastructure/jobs/types/JobContext"

interface IKodikMovieCollectionContext {
  context: JobContext
  sourceId: Types.ObjectId
  storagePath: string
  savedIds: Set<string>
}

export type { IKodikMovieCollectionContext }
