import type { FilterQuery, ProjectionType, QueryOptions } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import type { IPaginatedResult } from "@shared/types/IPaginatedResult"

import { MongoRepositoryCore } from "./mongoRepositoryCore.repository"

class MongoPaginationRepository<
  TSchema,
  TDocument,
> extends MongoRepositoryCore<TDocument> {
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

    if (isNil(options?.sort) && !isNil(this.defaultSort)) {
      query.sort(this.defaultSort)
    }

    const countQuery = this.model
      .countDocuments(filter as FilterQuery<TDocument>)
      .setOptions({ session: options?.session })

    const [items, total] = !isNil(options?.session)
      ? [await query.exec(), await countQuery.exec()]
      : await Promise.all([query.exec(), countQuery.exec()])

    return createPaginatedResult(items, total, page, limit)
  }
}

export { MongoPaginationRepository }
