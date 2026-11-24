import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { ClientSession, Model } from "mongoose"

import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { UserItemHistory } from "../../../schemas/userItemHistory.schema"
import type { TCreateUserItemHistory } from "../../../schemas/userItemHistory.schema"
import type { IReadUserItemHistoryProps } from "../types/IReadUserItemHistoryProps"

@Injectable()
class UserItemHistoryRepository {
  private readonly read
  private readonly bulk

  constructor(
    @InjectModel(UserItemHistory.name) model: Model<UserItemHistory>,
  ) {
    this.read = new MongoReadRepository<UserItemHistory, UserItemHistory>(model)
    this.bulk = new MongoBulkRepository<
      UserItemHistory,
      UserItemHistory,
      TCreateUserItemHistory
    >(model)
  }

  readPage(props: IReadUserItemHistoryProps) {
    const { userId, limit, after } = props

    return this.read.findMany(
      {
        user: userId,
        ...(!isUndefined(after) && {
          $or: [
            { createdAt: { $lt: after.createdAt } },
            { createdAt: after.createdAt, _id: { $lt: after.id } },
          ],
        }),
      },
      {
        _id: 1,
        createdAt: 1,
        item: 1,
        type: 1,
        status: 1,
        rating: 1,
        isFavorite: 1,
      },
      { sort: { createdAt: -1, _id: -1 }, limit: limit + 1, lean: true },
    )
  }

  async append(events: TCreateUserItemHistory[], session: ClientSession) {
    if (events.length > 0) {
      await this.bulk.createMany(events, { session })
    }
  }
}

export { UserItemHistoryRepository }
