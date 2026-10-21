import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { CollectionItem } from "../schemas/collectionItem.schema"
import type { TCreateCollectionItem } from "../schemas/collectionItem.schema"

@Injectable()
class CollectionItemRepository {
  readonly read: MongoReadRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>
  >
  readonly write: MongoWriteRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>,
    TCreateCollectionItem
  >
  readonly pagination: MongoPaginationRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>
  >
  readonly bulk: MongoBulkRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>,
    TCreateCollectionItem
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<CollectionItem>
  >

  constructor(
    @InjectModel(CollectionItem.name)
    model: Model<HydratedDocument<CollectionItem>>,
  ) {
    this.read = new MongoReadRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>
    >(model)
    this.write = new MongoWriteRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>,
      TCreateCollectionItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>
    >(model)
    this.bulk = new MongoBulkRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>,
      TCreateCollectionItem
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<CollectionItem>
    >(model)
  }
}

export { CollectionItemRepository }
