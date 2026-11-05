import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { Fact } from "../schemas/fact.schema"
import type { TCreateFact } from "../schemas/fact.schema"

@Injectable()
class FactRepository {
  readonly read: MongoReadRepository<Fact, HydratedDocument<Fact>>
  readonly write: MongoWriteRepository<
    Fact,
    HydratedDocument<Fact>,
    TCreateFact
  >
  readonly pagination: MongoPaginationRepository<Fact, HydratedDocument<Fact>>
  readonly bulk: MongoBulkRepository<Fact, HydratedDocument<Fact>, TCreateFact>
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Fact>>

  constructor(@InjectModel(Fact.name) model: Model<HydratedDocument<Fact>>) {
    this.read = new MongoReadRepository<Fact, HydratedDocument<Fact>>(model)
    this.write = new MongoWriteRepository<
      Fact,
      HydratedDocument<Fact>,
      TCreateFact
    >(model)
    this.pagination = new MongoPaginationRepository<
      Fact,
      HydratedDocument<Fact>
    >(model)
    this.bulk = new MongoBulkRepository<
      Fact,
      HydratedDocument<Fact>,
      TCreateFact
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Fact>>(
      model,
    )
  }
}

export { FactRepository }
