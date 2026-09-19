import type { FilterQuery, ProjectionType, QueryOptions } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"

import { MongoRepositoryCore } from "./mongoRepositoryCore.repository"

class MongoReadRepository<
  TSchema,
  TDocument,
> extends MongoRepositoryCore<TDocument> {
  async findById(
    id: string,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findById(
        id,
        projection as ProjectionType<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .exec()

    return document
  }

  async findOne(
    filter: FilterQuery<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findOne(
        filter as FilterQuery<TDocument>,
        projection as ProjectionType<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .exec()

    return document
  }

  async findMany(
    filter: FilterQuery<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument[]> {
    const query = this.model.find(
      filter as FilterQuery<TDocument>,
      projection as ProjectionType<TDocument>,
      options as QueryOptions<TDocument>,
    )

    if (isNil(options?.sort) && !isNil(this.defaultSort)) {
      query.sort(this.defaultSort)
    }

    const documents = await query.exec()

    return documents
  }

  async checkIsExists(
    filter: FilterQuery<TSchema>,
    options?: QueryOptions<TSchema>,
  ) {
    const document = await this.model
      .exists(filter as FilterQuery<TDocument>)
      .setOptions(options as QueryOptions<TDocument>)
      .exec()

    return !isNil(document)
  }
}

export { MongoReadRepository }
