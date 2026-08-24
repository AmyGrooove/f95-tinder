import type { SortOrder } from "mongoose"

interface IBaseMongoRepositoryOptions {
  defaultSort?: Record<string, SortOrder>
}

export type { IBaseMongoRepositoryOptions }
