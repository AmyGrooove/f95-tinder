import type {
  FilterQuery,
  Model,
  ProjectionType,
  QueryOptions,
  UpdateQuery,
} from "mongoose"

import { isNil } from "@shared/functions/isNil"
import { createPaginatedResult } from "@shared/functions/createPaginatedResult"
import { normalizePagination } from "@shared/functions/normalizePagination"
import type { IPaginatedResult } from "@shared/types/IPaginatedResult"

import type { IBaseMongoRepositoryOptions } from "../types/IBaseMongoRepositoryOptions"

abstract class BaseMongoRepository<TSchema, TDocument, TCreatePayload> {
  protected constructor(
    private readonly model: Model<TDocument>,
    private readonly repositoryOptions: IBaseMongoRepositoryOptions = {},
  ) {}

  async create(payload: TCreatePayload): Promise<TDocument> {
    const documentPayload = payload as Parameters<Model<TDocument>["create"]>[0]
    const createdDocument = await this.model.create(documentPayload)

    return createdDocument
  }

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

    if (isNil(options?.sort) && !isNil(this.repositoryOptions.defaultSort)) {
      query.sort(this.repositoryOptions.defaultSort)
    }

    const documents = await query.exec()

    return documents
  }

  async findManyPaginated(
    filter: FilterQuery<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
    pagination?: { page?: number; limit?: number },
  ): Promise<IPaginatedResult<TDocument>> {
    const { page, limit } = normalizePagination(pagination, 20)
    const skip = (page - 1) * limit
    const query = this.model
      .find(
        filter as FilterQuery<TDocument>,
        projection as ProjectionType<TDocument>,
        options as QueryOptions<TDocument>,
      )
      .skip(skip)
      .limit(limit)

    if (isNil(options?.sort) && !isNil(this.repositoryOptions.defaultSort)) {
      query.sort(this.repositoryOptions.defaultSort)
    }

    const [items, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter as FilterQuery<TDocument>).exec(),
    ])
    return createPaginatedResult(items, total, page, limit)
  }

  async checkIsExists(filter: FilterQuery<TSchema>): Promise<boolean> {
    const document = await this.model
      .exists(filter as FilterQuery<TDocument>)
      .exec()

    return !isNil(document)
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

  async deleteById(id: string): Promise<TDocument | null> {
    const document = await this.model.findByIdAndDelete(id).exec()

    return document
  }
}

export { BaseMongoRepository }
