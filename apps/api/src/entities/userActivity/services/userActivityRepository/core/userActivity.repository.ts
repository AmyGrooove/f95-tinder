import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model, Types } from "mongoose"

import { isUndefined } from "@shared/functions/checks/isUndefined"

import { UserActivity } from "../../../schemas/userActivity.schema"
import type {
  TCreateUserActivity,
  TUserActivityEvent,
} from "../../../schemas/userActivity.schema"

interface IReadActivityPageProps {
  userId: Types.ObjectId
  limit: number

  after?: { createdAt: Date; id: Types.ObjectId }
}

type TActivityPageEntry = Pick<UserActivity, "_id" | "createdAt"> &
  TUserActivityEvent

@Injectable()
class UserActivityRepository {
  constructor(
    @InjectModel(UserActivity.name) private readonly model: Model<UserActivity>,
  ) {}

  readPage({ userId, limit, after }: IReadActivityPageProps) {
    return this.model
      .find({
        user: userId,
        ...(!isUndefined(after) && {
          $or: [
            { createdAt: { $lt: after.createdAt } },
            { createdAt: after.createdAt, _id: { $lt: after.id } },
          ],
        }),
      })
      .select({ _id: 1, createdAt: 1, type: 1, payload: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<TActivityPageEntry[]>()
      .exec()
  }

  async appendOnce(events: TCreateUserActivity[]) {
    if (events.length === 0) {
      return
    }

    await Promise.all(events.map((event) => new this.model(event).validate()))
    await this.model.bulkWrite(
      events.map((event) => ({
        updateOne: {
          filter: { _id: event._id },
          update: { $setOnInsert: event },
          upsert: true,
          timestamps: false,
        },
      })),
    )
  }
}

export { UserActivityRepository }
