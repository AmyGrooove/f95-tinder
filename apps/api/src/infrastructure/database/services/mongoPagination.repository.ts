import type { ProjectionType, QueryFilter, QueryOptions } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import type { IPaginatedResult } from "../types/IPaginatedResult"

import { MongoCoreRepository } from "./mongoCore.repository"
import { isString } from "@shared/functions/checks/isString"

class MongoPaginationRepository<
  TSchema,
  TDocument,
> extends MongoCoreRepository<TDocument> {
  async findManyPaginated(
    filter: QueryFilter<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
    pagination?: { page?: number; limit?: number },
  ): Promise<IPaginatedResult<TDocument>> {
    const { page, limit } = normalizePagination(pagination, 20)
    const skip = (page - 1) * limit
    const query = this.model
      .find(
        filter as QueryFilter<TDocument>,
        projection as ProjectionType<TDocument>,
        { ...options, sort: undefined } as QueryOptions<TDocument>,
      )
      .skip(skip)
      .limit(limit)

    const sort: Parameters<typeof query.sort>[0] = options?.sort

    query.sort(isString(sort) && sort.trim() === "" ? undefined : sort, {
      override: true,
    })

    if (Object.keys(query.getOptions().sort ?? {}).length === 0) {
      query.sort(this.defaultSort)
    }

    if (!Object.hasOwn(query.getOptions().sort ?? {}, "_id")) {
      query.sort({ _id: -1 })
    }

    const countQuery = this.model
      .countDocuments(filter as QueryFilter<TDocument>)
      .setOptions({ session: options?.session })

    const [items, total] = !isNil(options?.session)
      ? [await query.exec(), await countQuery.exec()]
      : await Promise.all([query.exec(), countQuery.exec()])

    return createPaginatedResult(items, total, page, limit)
  }
}

export { MongoPaginationRepository }
