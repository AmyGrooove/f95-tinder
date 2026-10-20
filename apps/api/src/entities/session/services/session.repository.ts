import { createHash } from "node:crypto"

import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { CreateOptions, HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"

import { Session } from "../schemas/session.schema"
import type { TCreateSession } from "../schemas/session.schema"
import type { ICreateSessionProps } from "../types/ICreateSessionProps"

@Injectable()
class SessionRepository {
  readonly read: MongoReadRepository<Session, HydratedDocument<Session>>
  readonly write: MongoWriteRepository<
    Session,
    HydratedDocument<Session>,
    TCreateSession
  >
  readonly pagination: MongoPaginationRepository<
    Session,
    HydratedDocument<Session>
  >
  readonly bulk: MongoBulkRepository<
    Session,
    HydratedDocument<Session>,
    TCreateSession
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Session>>

  constructor(
    @InjectModel(Session.name) model: Model<HydratedDocument<Session>>,
  ) {
    this.read = new MongoReadRepository<Session, HydratedDocument<Session>>(
      model,
    )
    this.write = new MongoWriteRepository<
      Session,
      HydratedDocument<Session>,
      TCreateSession
    >(model)
    this.pagination = new MongoPaginationRepository<
      Session,
      HydratedDocument<Session>
    >(model)
    this.bulk = new MongoBulkRepository<
      Session,
      HydratedDocument<Session>,
      TCreateSession
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<Session>
    >(model)
  }

  createNew(props: ICreateSessionProps, options?: CreateOptions) {
    const { refreshToken, id, userId, userAgent = null } = props

    const refreshTokenHash = createHash("sha256")
      .update(refreshToken)
      .digest("hex")
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRATION * 1000)

    return this.write.create(
      {
        _id: id,
        user: userId,
        refreshTokenHash,
        userAgent,
        expiresAt,
      },
      options,
    )
  }
}

export { SessionRepository }
