import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Feature } from "../schemas/feature.schema"
import type { TCreateFeature } from "../schemas/feature.schema"

@Injectable()
class FeatureRepository {
  readonly read: MongoReadRepository<Feature, HydratedDocument<Feature>>
  readonly write: MongoWriteRepository<
    Feature,
    HydratedDocument<Feature>,
    TCreateFeature
  >
  readonly pagination: MongoPaginationRepository<
    Feature,
    HydratedDocument<Feature>
  >
  readonly bulk: MongoBulkRepository<
    Feature,
    HydratedDocument<Feature>,
    TCreateFeature
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Feature>>

  constructor(
    @InjectModel(Feature.name) model: Model<HydratedDocument<Feature>>,
  ) {
    this.read = new MongoReadRepository<Feature, HydratedDocument<Feature>>(
      model,
    )
    this.write = new MongoWriteRepository<
      Feature,
      HydratedDocument<Feature>,
      TCreateFeature
    >(model)
    this.pagination = new MongoPaginationRepository<
      Feature,
      HydratedDocument<Feature>
    >(model)
    this.bulk = new MongoBulkRepository<
      Feature,
      HydratedDocument<Feature>,
      TCreateFeature
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<Feature>
    >(model)
  }

  findFilterDefinitionsByIds(ids: Types.ObjectId[]) {
    return this.read.findMany(
      { _id: { $in: ids } },
      { _id: 1, key: 1, valueType: 1 },
    )
  }
}

export { FeatureRepository }
