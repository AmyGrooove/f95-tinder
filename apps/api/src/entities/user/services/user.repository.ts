import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { User } from "../schemas/user.schema"
import type { TCreateUser } from "../schemas/user.schema"

@Injectable()
class UserRepository {
  readonly read: MongoReadRepository<User, HydratedDocument<User>>
  readonly write: MongoWriteRepository<
    User,
    HydratedDocument<User>,
    TCreateUser
  >
  readonly pagination: MongoPaginationRepository<User, HydratedDocument<User>>
  readonly bulk: MongoBulkRepository<User, HydratedDocument<User>, TCreateUser>
  readonly aggregation: MongoAggregationRepository<HydratedDocument<User>>

  constructor(@InjectModel(User.name) model: Model<HydratedDocument<User>>) {
    this.read = new MongoReadRepository<User, HydratedDocument<User>>(model)
    this.write = new MongoWriteRepository<
      User,
      HydratedDocument<User>,
      TCreateUser
    >(model)
    this.pagination = new MongoPaginationRepository<
      User,
      HydratedDocument<User>
    >(model)
    this.bulk = new MongoBulkRepository<
      User,
      HydratedDocument<User>,
      TCreateUser
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<User>>(
      model,
    )
  }
}

export { UserRepository }
