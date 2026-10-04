import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserSourceAccount } from "../schemas/userSourceAccount.schema"
import type { TCreateUserSourceAccount } from "../schemas/userSourceAccount.schema"

@Injectable()
class UserSourceAccountRepository {
  readonly read: MongoReadRepository<
    UserSourceAccount,
    HydratedDocument<UserSourceAccount>
  >
  readonly write: MongoWriteRepository<
    UserSourceAccount,
    HydratedDocument<UserSourceAccount>,
    TCreateUserSourceAccount
  >
  readonly pagination: MongoPaginationRepository<
    UserSourceAccount,
    HydratedDocument<UserSourceAccount>
  >
  readonly bulk: MongoBulkRepository<
    UserSourceAccount,
    HydratedDocument<UserSourceAccount>,
    TCreateUserSourceAccount
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserSourceAccount>
  >

  constructor(
    @InjectModel(UserSourceAccount.name)
    model: Model<HydratedDocument<UserSourceAccount>>,
  ) {
    this.read = new MongoReadRepository<
      UserSourceAccount,
      HydratedDocument<UserSourceAccount>
    >(model)
    this.write = new MongoWriteRepository<
      UserSourceAccount,
      HydratedDocument<UserSourceAccount>,
      TCreateUserSourceAccount
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserSourceAccount,
      HydratedDocument<UserSourceAccount>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserSourceAccount,
      HydratedDocument<UserSourceAccount>,
      TCreateUserSourceAccount
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserSourceAccount>
    >(model)
  }
}

export { UserSourceAccountRepository }
