import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { Relation } from "../../../schemas/relation.schema"
import type { TCreateRelation } from "../../../schemas/relation.schema"

@Injectable()
class RelationRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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
