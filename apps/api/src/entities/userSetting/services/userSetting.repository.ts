import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserSetting } from "../schemas/userSetting.schema"
import type { TCreateUserSetting } from "../schemas/userSetting.schema"

@Injectable()
class UserSettingRepository {
  readonly read: MongoReadRepository<UserSetting, HydratedDocument<UserSetting>>
  readonly write: MongoWriteRepository<
    UserSetting,
    HydratedDocument<UserSetting>,
    TCreateUserSetting
  >
  readonly pagination: MongoPaginationRepository<
    UserSetting,
    HydratedDocument<UserSetting>
  >
  readonly bulk: MongoBulkRepository<
    UserSetting,
    HydratedDocument<UserSetting>,
    TCreateUserSetting
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserSetting>
  >

  constructor(
    @InjectModel(UserSetting.name) model: Model<HydratedDocument<UserSetting>>,
  ) {
    this.read = new MongoReadRepository<
      UserSetting,
      HydratedDocument<UserSetting>
    >(model)
    this.write = new MongoWriteRepository<
      UserSetting,
      HydratedDocument<UserSetting>,
      TCreateUserSetting
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserSetting,
      HydratedDocument<UserSetting>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserSetting,
      HydratedDocument<UserSetting>,
      TCreateUserSetting
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserSetting>
    >(model)
  }
}

export { UserSettingRepository }
