import type {
  InsertManyOptions,
  Model,
  MongooseBaseQueryOptions,
  MongooseBulkWriteOptions,
  QueryFilter,
  UpdateQuery,
  UpdateWithAggregationPipeline,
  mongo,
} from "mongoose"

import { MongoRepositoryCore } from "./mongoRepositoryCore.repository"

class MongoBulkRepository<
  TSchema,
  TDocument,
  TCreatePayload,
> extends MongoRepositoryCore<TDocument> {
  async createMany(payloads: TCreatePayload[]): Promise<TDocument[]>
  async createMany(
    payloads: TCreatePayload[],
    options: InsertManyOptions & { rawResult: true },
  ): Promise<mongo.InsertManyResult<TDocument>>
  async createMany(
    payloads: TCreatePayload[],
    options: InsertManyOptions & { lean: true },
  ): Promise<TSchema[]>
  async createMany(
    payloads: TCreatePayload[],
    options: InsertManyOptions,
  ): Promise<TDocument[] | TSchema[] | mongo.InsertManyResult<TDocument>>
  async createMany(
    payloads: TCreatePayload[],
    options?: InsertManyOptions,
  ): Promise<TDocument[] | TSchema[] | mongo.InsertManyResult<TDocument>> {
    const documents = await this.model.insertMany<TCreatePayload>(
      payloads,
      options ?? {},
    )

    return documents as TDocument[]
  }

  async updateMany(
    filter: QueryFilter<TSchema>,
    payload: UpdateQuery<TSchema> | UpdateWithAggregationPipeline,
    options?: Parameters<Model<TSchema>["updateMany"]>[2],
  ): Promise<mongo.UpdateResult> {
    const result = await this.model
      .updateMany(
        filter as QueryFilter<TDocument>,
        payload as UpdateQuery<TDocument> | UpdateWithAggregationPipeline,
        options as Parameters<Model<TDocument>["updateMany"]>[2],
      )
      .setOptions({ runValidators: options?.runValidators ?? true })
      .exec()

    return result
  }

  async deleteMany(
    filter: QueryFilter<TSchema>,
    options?: mongo.DeleteOptions & MongooseBaseQueryOptions<TSchema>,
  ): Promise<mongo.DeleteResult> {
    const result = await this.model
      .deleteMany(
        filter as QueryFilter<TDocument>,
        options as mongo.DeleteOptions & MongooseBaseQueryOptions<TDocument>,
      )
      .exec()

    return result
  }

  async bulkWrite(
    operations: Parameters<Model<TSchema>["bulkWrite"]>[0],
    options?: MongooseBulkWriteOptions,
  ): Promise<mongo.BulkWriteResult> {
    const result = await this.model.bulkWrite(
      operations as Parameters<Model<TDocument>["bulkWrite"]>[0],
      options,
    )

    return result
  }
}

export { MongoBulkRepository }
