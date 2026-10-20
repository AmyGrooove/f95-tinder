import { createHash } from "node:crypto"

import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  CreateOptions,
  HydratedDocument,
  Model,
  QueryOptions,
  Types,
  mongo,
} from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"
import { isNil } from "@shared/functions/checks/isNil"

import { Session } from "../schemas/session.schema"
import type { TCreateSession } from "../schemas/session.schema"
import type { ICreateSessionProps } from "../types/ICreateSessionProps"
import type { ISessionOwnerProps } from "../types/ISessionOwnerProps"
import type { IUpdateSessionRefreshTokenProps } from "../types/IUpdateSessionRefreshTokenProps"

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

  findActive(props: ISessionOwnerProps) {
    return this.read.findOne(
      {
        _id: props.id,
        user: props.userId,
        expiresAt: { $gt: new Date() },
      },
      { _id: 1, expiresAt: 1 },
    )
  }

  findActiveByUser(userId: Types.ObjectId) {
    return this.read.findMany(
      { user: userId, expiresAt: { $gt: new Date() } },
      {
        _id: 1,
        userAgent: 1,
        createdAt: 1,
        expiresAt: 1,
        lastRefreshedAt: 1,
      },
      { sort: { createdAt: -1, _id: -1 } },
    )
  }

  deleteActive(props: ISessionOwnerProps) {
    return this.write.deleteByFilter({
      _id: props.id,
      user: props.userId,
      expiresAt: { $gt: new Date() },
    })
  }

  deleteOthers(
    props: ISessionOwnerProps,
    options?: Pick<mongo.DeleteOptions, "session">,
  ) {
    return this.bulk.deleteMany(
      { user: props.userId, _id: { $ne: props.id } },
      options,
    )
  }

  deleteByUser(
    userId: Types.ObjectId,
    options?: Pick<mongo.DeleteOptions, "session">,
  ) {
    return this.bulk.deleteMany({ user: userId }, options)
  }

  updateRefreshToken(
    props: IUpdateSessionRefreshTokenProps,
    options?: Pick<QueryOptions<Session>, "session">,
  ) {
    const now = new Date()

    return this.write.updateByFilter(
      {
        _id: props.id,
        user: props.userId,
        expiresAt: { $gt: now },
        ...(!isNil(props.currentRefreshToken)
          ? {
              refreshTokenHash: createHash("sha256")
                .update(props.currentRefreshToken)
                .digest("hex"),
            }
          : {}),
      },
      {
        $set: {
          refreshTokenHash: createHash("sha256")
            .update(props.refreshToken)
            .digest("hex"),
          expiresAt: new Date(now.getTime() + JWT_REFRESH_EXPIRATION * 1000),
          lastRefreshedAt: now,
        },
      },
      options,
    )
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
