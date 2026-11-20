import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { ClientSession, Model } from "mongoose"

import { isUndefined } from "@shared/functions/checks/isUndefined"

import { UserItemHistory } from "../../../schemas/userItemHistory.schema"
import type { IReadUserItemHistoryProps } from "../types/IReadUserItemHistoryProps"
import type { TUserItemHistoryEvent } from "../types/TUserItemHistoryEvent"

@Injectable()
class UserItemHistoryRepository {
  constructor(
    @InjectModel(UserItemHistory.name)
    private readonly model: Model<UserItemHistory>,
  ) {}

  async append(events: TUserItemHistoryEvent[], session: ClientSession) {
    if (events.length > 0) {
      await this.model.insertMany(events, { session })
    }
  }

  readPage({ userId, limit, after }: IReadUserItemHistoryProps) {
    return this.model
      .find(
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
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec()
  }
}

export { UserItemHistoryRepository }
