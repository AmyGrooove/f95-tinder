import type { CreateOptions, QueryOptions, UpdateQuery } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"

import { MongoRepositoryCore } from "./mongoRepositoryCore.repository"

class MongoWriteRepository<
  TSchema,
  TDocument,
  TCreatePayload,
> extends MongoRepositoryCore<TDocument> {
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

    if (isNil(options?.new)) {
      query.setOptions({ new: true })
    }

    const document = await query.exec()

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
}

export { MongoWriteRepository }
