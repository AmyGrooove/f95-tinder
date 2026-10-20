import type { ProjectionType, QueryFilter, QueryOptions } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"

import { MongoCoreRepository } from "./mongoCore.repository"

class MongoReadRepository<
  TSchema,
  TDocument,
> extends MongoCoreRepository<TDocument> {
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
    filter: QueryFilter<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findOne(
        filter as QueryFilter<TDocument>,
        projection as ProjectionType<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .exec()

    return document
  }

  async findMany(
    filter: QueryFilter<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument[]> {
    const query = this.model.find(
      filter as QueryFilter<TDocument>,
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
    filter: QueryFilter<TSchema>,
    options?: QueryOptions<TSchema>,
  ) {
    const document = await this.model
      .exists(filter as QueryFilter<TDocument>)
      .setOptions(options as QueryOptions<TDocument>)
      .exec()

    return !isNil(document)
  }
}

export { MongoReadRepository }
