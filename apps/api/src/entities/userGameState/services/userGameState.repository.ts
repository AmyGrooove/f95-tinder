import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"

import {
  UserGameState,
  type UserGameStateDocument,
} from "../schemas/userGameState.schema"
import type { TCreateUserGameStatePayload } from "../types/TCreateUserGameStatePayload"
import type { TUserGameListType } from "../types/TUserGameListType"

@Injectable()
class UserGameStateRepository {
  constructor(
    @InjectModel(UserGameState.name)
    private readonly userGameStateModel: Model<UserGameStateDocument>,
  ) {}

  countByUserAndListType(
    userId: string | Types.ObjectId,
    listType: TUserGameListType,
  ): Promise<number> {
    return this.userGameStateModel.countDocuments({ userId, listType }).exec()
  }

  countByUser(userId: string | Types.ObjectId): Promise<number> {
    return this.userGameStateModel.countDocuments({ userId }).exec()
  }

  deleteByUserAndGame(
    userId: string | Types.ObjectId,
    gameId: string | Types.ObjectId,
  ): Promise<UserGameStateDocument | null> {
    return this.userGameStateModel.findOneAndDelete({ userId, gameId }).exec()
  }

  findGameIdsByUser(
    userId: string | Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    return this.userGameStateModel.distinct("gameId", { userId }).exec()
  }

  findByUserAndListType(
    userId: string | Types.ObjectId,
    listType: TUserGameListType,
  ): Promise<UserGameStateDocument[]> {
    return this.userGameStateModel
      .find({ userId, listType })
      .sort({ updatedAt: -1, _id: -1 })
      .exec()
  }

  upsertState(
    payload: TCreateUserGameStatePayload,
  ): Promise<UserGameStateDocument | null> {
    return this.userGameStateModel
      .findOneAndUpdate(
        { userId: payload.userId, gameId: payload.gameId },
        { listType: payload.listType },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec()
  }
}

export { UserGameStateRepository }
