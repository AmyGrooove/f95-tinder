import { createHash, randomBytes, randomInt } from "node:crypto"

import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { CreateOptions, HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { User } from "../schemas/user.schema"
import type { TCreateUser } from "../schemas/user.schema"
import { USERNAME_ADJECTIVES } from "../static/USERNAME_ADJECTIVES"
import { USERNAME_NOUNS } from "../static/USERNAME_NOUNS"

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

  async createNew(options?: CreateOptions) {
    const accessCode = randomBytes(24).toString("base64url")
    const accessCodeHash = createHash("sha256").update(accessCode).digest("hex")

    const adjective = USERNAME_ADJECTIVES[randomInt(USERNAME_ADJECTIVES.length)]
    const noun = USERNAME_NOUNS[randomInt(USERNAME_NOUNS.length)]
    const digits = randomInt(1000).toString().padStart(3, "0")
    const displayName = `${adjective}${noun.charAt(0).toUpperCase()}${noun.slice(1)}${digits}`
    const username = displayName.toLowerCase()

    const user = await this.write.create(
      {
        username,
        displayName,
        accessCodeHash,
      },
      options,
    )

    return { user, accessCode }
  }
}

export { UserRepository }
