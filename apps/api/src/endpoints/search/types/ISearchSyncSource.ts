import type { Types } from "mongoose"

import type { ISearchIndexOptions } from "@infrastructure/search/types/ISearchIndexOptions"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import type { TSiteSearchDocument } from "./ISiteSearchDocument"

interface ISearchSyncEntry {
  id: Types.ObjectId
  document: TSiteSearchDocument | null
}

interface ISearchSyncSource {
  index: string
  options: ISearchIndexOptions
  readBatch(
    afterId: Types.ObjectId | undefined,
    updatedSince: Date | undefined,
  ): Promise<ISearchSyncEntry[]>
  readExisting(ids: string[]): Promise<string[]>
}

interface ISynchronizeSearchProps {
  source: ISearchSyncSource
  updatedSince: Date | undefined
  context: IJobContext
}

export type { ISearchSyncSource, ISynchronizeSearchProps }
