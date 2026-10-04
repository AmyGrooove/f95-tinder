import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { TagRelation } from "../schemas/tagRelation.schema"
import type { TCreateTagRelation } from "../schemas/tagRelation.schema"

@Injectable()
class TagRelationRepository {
  readonly read: MongoReadRepository<TagRelation, HydratedDocument<TagRelation>>
  readonly write: MongoWriteRepository<
    TagRelation,
    HydratedDocument<TagRelation>,
    TCreateTagRelation
  >
  readonly pagination: MongoPaginationRepository<
    TagRelation,
    HydratedDocument<TagRelation>
  >
  readonly bulk: MongoBulkRepository<
    TagRelation,
    HydratedDocument<TagRelation>,
    TCreateTagRelation
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<TagRelation>
  >

  constructor(
    @InjectModel(TagRelation.name) model: Model<HydratedDocument<TagRelation>>,
  ) {
    this.read = new MongoReadRepository<
      TagRelation,
      HydratedDocument<TagRelation>
    >(model)
    this.write = new MongoWriteRepository<
      TagRelation,
      HydratedDocument<TagRelation>,
      TCreateTagRelation
    >(model)
    this.pagination = new MongoPaginationRepository<
      TagRelation,
      HydratedDocument<TagRelation>
    >(model)
    this.bulk = new MongoBulkRepository<
      TagRelation,
      HydratedDocument<TagRelation>,
      TCreateTagRelation
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<TagRelation>
    >(model)
  }
}

export { TagRelationRepository }
