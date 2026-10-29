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

import { UserSession } from "../schemas/userSession.schema"
import type { TCreateUserSession } from "../schemas/userSession.schema"
import type { ICreateUserSessionProps } from "../types/ICreateUserSessionProps"
import type { IUserSessionOwnerProps } from "../types/IUserSessionOwnerProps"
import type { IUpdateUserSessionRefreshTokenProps } from "../types/IUpdateUserSessionRefreshTokenProps"

@Injectable()
class UserSessionRepository {
  readonly read: MongoReadRepository<UserSession, HydratedDocument<UserSession>>
  readonly write: MongoWriteRepository<
    UserSession,
    HydratedDocument<UserSession>,
    TCreateUserSession
  >
  readonly pagination: MongoPaginationRepository<
    UserSession,
    HydratedDocument<UserSession>
  >
  readonly bulk: MongoBulkRepository<
    UserSession,
    HydratedDocument<UserSession>,
    TCreateUserSession
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserSession>
  >

  constructor(
    @InjectModel(UserSession.name) model: Model<HydratedDocument<UserSession>>,
  ) {
    this.read = new MongoReadRepository<
      UserSession,
      HydratedDocument<UserSession>
    >(model)
    this.write = new MongoWriteRepository<
      UserSession,
      HydratedDocument<UserSession>,
      TCreateUserSession
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserSession,
      HydratedDocument<UserSession>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserSession,
      HydratedDocument<UserSession>,
      TCreateUserSession
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserSession>
    >(model)
  }

  findActive(props: IUserSessionOwnerProps) {
    return this.read.findOne(
      {
        _id: props.id,
        user: props.userId,
        expiresAt: { $gt: new Date() },
      },
      { _id: 1, expiresAt: 1, country: 1 },
    )
  }

  findActiveByUser(userId: Types.ObjectId) {
    return this.read.findMany(
      { user: userId, expiresAt: { $gt: new Date() } },
      {
        _id: 1,
        userAgent: 1,
        country: 1,
        createdAt: 1,
        expiresAt: 1,
        lastRefreshedAt: 1,
      },
      { sort: { createdAt: -1, _id: -1 } },
    )
  }

  deleteActive(props: IUserSessionOwnerProps) {
    return this.write.deleteByFilter({
      _id: props.id,
      user: props.userId,
      expiresAt: { $gt: new Date() },
    })
  }

  deleteOthers(
    props: IUserSessionOwnerProps,
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
    props: IUpdateUserSessionRefreshTokenProps,
    options?: Pick<QueryOptions<UserSession>, "session">,
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

  createNew(props: ICreateUserSessionProps, options?: CreateOptions) {
    const { refreshToken, id, userId, userAgent = null, country } = props

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
        country,
        expiresAt,
      },
      options,
    )
  }
}

export { UserSessionRepository }
