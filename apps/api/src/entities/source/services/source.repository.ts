import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Source } from "../schemas/source.schema"
import type { TCreateSource } from "../schemas/source.schema"

@Injectable()
class SourceRepository {
  readonly read: MongoReadRepository<Source, HydratedDocument<Source>>
  readonly write: MongoWriteRepository<
    Source,
    HydratedDocument<Source>,
    TCreateSource
  >
  readonly pagination: MongoPaginationRepository<
    Source,
    HydratedDocument<Source>
  >
  readonly bulk: MongoBulkRepository<
    Source,
    HydratedDocument<Source>,
    TCreateSource
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Source>>

  constructor(
    @InjectModel(Source.name) model: Model<HydratedDocument<Source>>,
  ) {
    this.read = new MongoReadRepository<Source, HydratedDocument<Source>>(model)
    this.write = new MongoWriteRepository<
      Source,
      HydratedDocument<Source>,
      TCreateSource
    >(model)
    this.pagination = new MongoPaginationRepository<
      Source,
      HydratedDocument<Source>
    >(model)
    this.bulk = new MongoBulkRepository<
      Source,
      HydratedDocument<Source>,
      TCreateSource
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Source>>(
      model,
    )
  }
}

export { SourceRepository }
