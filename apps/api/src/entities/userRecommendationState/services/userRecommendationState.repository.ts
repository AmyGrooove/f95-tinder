import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserRecommendationState } from "../schemas/userRecommendationState.schema"
import type { TCreateUserRecommendationState } from "../schemas/userRecommendationState.schema"

@Injectable()
class UserRecommendationStateRepository {
  readonly read: MongoReadRepository<
    UserRecommendationState,
    HydratedDocument<UserRecommendationState>
  >
  readonly write: MongoWriteRepository<
    UserRecommendationState,
    HydratedDocument<UserRecommendationState>,
    TCreateUserRecommendationState
  >
  readonly pagination: MongoPaginationRepository<
    UserRecommendationState,
    HydratedDocument<UserRecommendationState>
  >
  readonly bulk: MongoBulkRepository<
    UserRecommendationState,
    HydratedDocument<UserRecommendationState>,
    TCreateUserRecommendationState
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserRecommendationState>
  >

  constructor(
    @InjectModel(UserRecommendationState.name)
    model: Model<HydratedDocument<UserRecommendationState>>,
  ) {
    this.read = new MongoReadRepository<
      UserRecommendationState,
      HydratedDocument<UserRecommendationState>
    >(model)
    this.write = new MongoWriteRepository<
      UserRecommendationState,
      HydratedDocument<UserRecommendationState>,
      TCreateUserRecommendationState
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserRecommendationState,
      HydratedDocument<UserRecommendationState>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserRecommendationState,
      HydratedDocument<UserRecommendationState>,
      TCreateUserRecommendationState
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserRecommendationState>
    >(model)
  }
}

export { UserRecommendationStateRepository }
