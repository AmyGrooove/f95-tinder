import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model, Types } from "mongoose"

import { isUndefined } from "@shared/functions/checks/isUndefined"

import { USER_LIBRARY_ACTIVITY_TYPES } from "../../../schemas/EUserActivityType"
import { UserActivity } from "../../../schemas/userActivity.schema"
import type {
  TCreateUserActivity,
  TUserLibraryActivity,
} from "../../../schemas/userActivity.schema"

interface IReadLibraryActivityProps {
  userId: Types.ObjectId
  limit: number
  after?: { createdAt: Date; id: Types.ObjectId }
}

@Injectable()
class UserActivityRepository {
  constructor(
    @InjectModel(UserActivity.name) private readonly model: Model<UserActivity>,
  ) {}

  readLibraryPage({ userId, limit, after }: IReadLibraryActivityProps) {
    return this.model
      .find({
        user: userId,
        type: { $in: USER_LIBRARY_ACTIVITY_TYPES },
        ...(!isUndefined(after) && {
          $or: [
            { createdAt: { $lt: after.createdAt } },
            { createdAt: after.createdAt, _id: { $lt: after.id } },
          ],
        }),
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<TUserLibraryActivity[]>()
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
