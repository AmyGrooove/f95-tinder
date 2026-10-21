import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Collection } from "../schemas/collection.schema"
import type { TCreateCollection } from "../schemas/collection.schema"

@Injectable()
class CollectionRepository {
  readonly read: MongoReadRepository<Collection, HydratedDocument<Collection>>
  readonly write: MongoWriteRepository<
    Collection,
    HydratedDocument<Collection>,
    TCreateCollection
  >
  readonly pagination: MongoPaginationRepository<
    Collection,
    HydratedDocument<Collection>
  >
  readonly bulk: MongoBulkRepository<
    Collection,
    HydratedDocument<Collection>,
    TCreateCollection
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Collection>>

  constructor(
    @InjectModel(Collection.name) model: Model<HydratedDocument<Collection>>,
  ) {
    this.read = new MongoReadRepository<
      Collection,
      HydratedDocument<Collection>
    >(model)
    this.write = new MongoWriteRepository<
      Collection,
      HydratedDocument<Collection>,
      TCreateCollection
    >(model)
    this.pagination = new MongoPaginationRepository<
      Collection,
      HydratedDocument<Collection>
    >(model)
    this.bulk = new MongoBulkRepository<
      Collection,
      HydratedDocument<Collection>,
      TCreateCollection
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<Collection>
    >(model)
  }
}

export { CollectionRepository }
