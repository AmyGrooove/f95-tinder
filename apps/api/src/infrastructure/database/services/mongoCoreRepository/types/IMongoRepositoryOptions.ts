import type { SortOrder } from "mongoose"

interface IMongoRepositoryOptions {
  defaultSort?: Record<string, SortOrder>
}

export type { IMongoRepositoryOptions }
