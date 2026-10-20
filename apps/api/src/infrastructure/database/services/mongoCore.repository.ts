import type { Model } from "mongoose"

import type { IMongoRepositoryOptions } from "../types/IMongoRepositoryOptions"

abstract class MongoCoreRepository<TDocument> {
  protected readonly defaultSort: IMongoRepositoryOptions["defaultSort"]

  constructor(
    protected readonly model: Model<TDocument>,
    repositoryOptions: IMongoRepositoryOptions = {},
  ) {
    this.defaultSort = repositoryOptions.defaultSort
  }
}

export { MongoCoreRepository }
