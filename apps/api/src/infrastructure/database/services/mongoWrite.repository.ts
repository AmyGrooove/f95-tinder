import type {
  CreateOptions,
  QueryFilter,
  QueryOptions,
  UpdateQuery,
} from "mongoose"

import { MongoCoreRepository } from "./mongoCore.repository"

class MongoWriteRepository<
  TSchema,
  TDocument,
  TCreatePayload,
> extends MongoCoreRepository<TDocument> {
  async create(
    payload: TCreatePayload,
    options?: CreateOptions,
  ): Promise<TDocument> {
    const documentPayload = payload as Parameters<typeof this.model.create>[0]
    const [createdDocument] = await this.model.create(
      [documentPayload],
      options,
    )

    return createdDocument
  }

  async updateById(
    id: string,
    payload: UpdateQuery<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const query = this.model.findByIdAndUpdate(
      id,
      payload as UpdateQuery<TDocument>,
      options as QueryOptions<TDocument>,
    )

    query.setOptions({
      new: options?.new ?? true,
      runValidators: options?.runValidators ?? true,
    })

    const document = await query.exec()

    return document
  }

  async updateByFilter(
    filter: QueryFilter<TSchema>,
    payload: UpdateQuery<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findOneAndUpdate(
        filter as QueryFilter<TDocument>,
        payload as UpdateQuery<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .setOptions({
        new: options?.new ?? true,
        runValidators: options?.runValidators ?? true,
      })
      .exec()

    return document
  }

  async deleteById(
    id: string,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findByIdAndDelete(id, options as QueryOptions<TDocument>)
      .exec()

    return document
  }

  async deleteByFilter(
    filter: QueryFilter<TSchema>,
    options?: QueryOptions<TSchema>,
  ): Promise<TDocument | null> {
    const document = await this.model
      .findOneAndDelete(
        filter as QueryFilter<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .exec()

    return document
  }
}

export { MongoWriteRepository }
