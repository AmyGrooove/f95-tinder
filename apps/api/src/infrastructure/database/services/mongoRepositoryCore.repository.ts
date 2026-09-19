import type { Model } from "mongoose"

import type { IMongoRepositoryOptions } from "../types/IMongoRepositoryOptions"

abstract class MongoRepositoryCore<TDocument> {
  protected readonly defaultSort: IMongoRepositoryOptions["defaultSort"]

  constructor(
    protected readonly model: Model<TDocument>,
    repositoryOptions: IMongoRepositoryOptions = {},
  ) {
    this.defaultSort = repositoryOptions.defaultSort
  }
}

export { MongoRepositoryCore }
