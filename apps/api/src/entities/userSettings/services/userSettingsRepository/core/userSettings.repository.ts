import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { UserSettings } from "../../../schemas/userSettings.schema"
import type { TCreateUserSettings } from "../../../schemas/userSettings.schema"

@Injectable()
class UserSettingsRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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
