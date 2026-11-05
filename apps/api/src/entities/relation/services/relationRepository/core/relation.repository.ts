import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { Relation } from "../../../schemas/relation.schema"
import type { TCreateRelation } from "../../../schemas/relation.schema"

@Injectable()
class RelationRepository {
  readonly read: MongoReadRepository<Relation, HydratedDocument<Relation>>
  readonly write: MongoWriteRepository<
    Relation,
    HydratedDocument<Relation>,
    TCreateRelation
  >
  readonly pagination: MongoPaginationRepository<
    Relation,
    HydratedDocument<Relation>
  >
  readonly bulk: MongoBulkRepository<
    Relation,
    HydratedDocument<Relation>,
    TCreateRelation
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Relation>>

  constructor(
    @InjectModel(Relation.name)
    model: Model<HydratedDocument<Relation>>,
  ) {
    this.read = new MongoReadRepository<Relation, HydratedDocument<Relation>>(
      model,
    )
    this.write = new MongoWriteRepository<
      Relation,
      HydratedDocument<Relation>,
      TCreateRelation
    >(model)
    this.pagination = new MongoPaginationRepository<
      Relation,
      HydratedDocument<Relation>
    >(model)
    this.bulk = new MongoBulkRepository<
      Relation,
      HydratedDocument<Relation>,
      TCreateRelation
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<Relation>
    >(model)
  }
}

export { RelationRepository }
