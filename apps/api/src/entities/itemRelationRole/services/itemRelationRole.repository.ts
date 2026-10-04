import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemRelationRole } from "../schemas/itemRelationRole.schema"
import type { TCreateItemRelationRole } from "../schemas/itemRelationRole.schema"

@Injectable()
class ItemRelationRoleRepository {
  readonly read: MongoReadRepository<
    ItemRelationRole,
    HydratedDocument<ItemRelationRole>
  >
  readonly write: MongoWriteRepository<
    ItemRelationRole,
    HydratedDocument<ItemRelationRole>,
    TCreateItemRelationRole
  >
  readonly pagination: MongoPaginationRepository<
    ItemRelationRole,
    HydratedDocument<ItemRelationRole>
  >
  readonly bulk: MongoBulkRepository<
    ItemRelationRole,
    HydratedDocument<ItemRelationRole>,
    TCreateItemRelationRole
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<ItemRelationRole>
  >

  constructor(
    @InjectModel(ItemRelationRole.name)
    model: Model<HydratedDocument<ItemRelationRole>>,
  ) {
    this.read = new MongoReadRepository<
      ItemRelationRole,
      HydratedDocument<ItemRelationRole>
    >(model)
    this.write = new MongoWriteRepository<
      ItemRelationRole,
      HydratedDocument<ItemRelationRole>,
      TCreateItemRelationRole
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemRelationRole,
      HydratedDocument<ItemRelationRole>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemRelationRole,
      HydratedDocument<ItemRelationRole>,
      TCreateItemRelationRole
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemRelationRole>
    >(model)
  }
}

export { ItemRelationRoleRepository }
