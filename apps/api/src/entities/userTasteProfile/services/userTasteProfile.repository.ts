import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserTasteProfile } from "../schemas/userTasteProfile.schema"
import type { TCreateUserTasteProfile } from "../schemas/userTasteProfile.schema"

@Injectable()
class UserTasteProfileRepository {
  readonly read: MongoReadRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>
  >
  readonly write: MongoWriteRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>,
    TCreateUserTasteProfile
  >
  readonly pagination: MongoPaginationRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>
  >
  readonly bulk: MongoBulkRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>,
    TCreateUserTasteProfile
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserTasteProfile>
  >

  constructor(
    @InjectModel(UserTasteProfile.name)
    model: Model<HydratedDocument<UserTasteProfile>>,
  ) {
    this.read = new MongoReadRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>
    >(model)
    this.write = new MongoWriteRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>,
      TCreateUserTasteProfile
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>,
      TCreateUserTasteProfile
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserTasteProfile>
    >(model)
  }
}

export { UserTasteProfileRepository }
