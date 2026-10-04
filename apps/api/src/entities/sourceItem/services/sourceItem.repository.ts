import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { SourceItem } from "../schemas/sourceItem.schema"
import type { TCreateSourceItem } from "../schemas/sourceItem.schema"

@Injectable()
class SourceItemRepository {
  readonly read: MongoReadRepository<SourceItem, HydratedDocument<SourceItem>>
  readonly write: MongoWriteRepository<
    SourceItem,
    HydratedDocument<SourceItem>,
    TCreateSourceItem
  >
  readonly pagination: MongoPaginationRepository<
    SourceItem,
    HydratedDocument<SourceItem>
  >
  readonly bulk: MongoBulkRepository<
    SourceItem,
    HydratedDocument<SourceItem>,
    TCreateSourceItem
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<SourceItem>>

  constructor(
    @InjectModel(SourceItem.name) model: Model<HydratedDocument<SourceItem>>,
  ) {
    this.read = new MongoReadRepository<
      SourceItem,
      HydratedDocument<SourceItem>
    >(model)
    this.write = new MongoWriteRepository<
      SourceItem,
      HydratedDocument<SourceItem>,
      TCreateSourceItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      SourceItem,
      HydratedDocument<SourceItem>
    >(model)
    this.bulk = new MongoBulkRepository<
      SourceItem,
      HydratedDocument<SourceItem>,
      TCreateSourceItem
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<SourceItem>
    >(model)
  }
}

export { SourceItemRepository }
