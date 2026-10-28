import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserSettings } from "../schemas/userSettings.schema"
import type { TCreateUserSettings } from "../schemas/userSettings.schema"

@Injectable()
class UserSettingsRepository {
  readonly read: MongoReadRepository<
    UserSettings,
    HydratedDocument<UserSettings>
  >
  readonly write: MongoWriteRepository<
    UserSettings,
    HydratedDocument<UserSettings>,
    TCreateUserSettings
  >
  readonly pagination: MongoPaginationRepository<
    UserSettings,
    HydratedDocument<UserSettings>
  >
  readonly bulk: MongoBulkRepository<
    UserSettings,
    HydratedDocument<UserSettings>,
    TCreateUserSettings
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserSettings>
  >

  constructor(
    @InjectModel(UserSettings.name)
    model: Model<HydratedDocument<UserSettings>>,
  ) {
    this.read = new MongoReadRepository<
      UserSettings,
      HydratedDocument<UserSettings>
    >(model)
    this.write = new MongoWriteRepository<
      UserSettings,
      HydratedDocument<UserSettings>,
      TCreateUserSettings
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserSettings,
      HydratedDocument<UserSettings>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserSettings,
      HydratedDocument<UserSettings>,
      TCreateUserSettings
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserSettings>
    >(model)
  }
}

export { UserSettingsRepository }
