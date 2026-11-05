import type { ProjectionType, QueryFilter, QueryOptions } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"
import { createPaginatedResult } from "@infrastructure/database/functions/createPaginatedResult"
import { normalizePagination } from "@infrastructure/database/functions/normalizePagination"
import type { IPagePagination } from "../../../types/IPaginationInput"
import type { IPagePaginationResult } from "../../../types/IPaginationResult"

import { MongoCoreRepository } from "@infrastructure/database/services/mongoCoreRepository"
import { isString } from "@shared/functions/checks/isString"

class MongoPaginationRepository<
  TSchema,
  TDocument,
> extends MongoCoreRepository<TDocument> {
  async findManyPaginated(
    filter: QueryFilter<TSchema>,
    projection?: ProjectionType<TSchema>,
    options?: QueryOptions<TSchema>,
    pagination?: IPagePagination,
  ): Promise<IPagePaginationResult<TDocument>> {
    const { page, limit } = normalizePagination(pagination)
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
