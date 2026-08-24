import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"

import { Game, type GameDocument } from "../schemas/game.schema"
import type { TCreateGamePayload } from "../types/TCreateGamePayload"
import { isNil } from "@shared/functions/isNil"

@Injectable()
class GameRepository {
  constructor(
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
  ) {}

  countByFilter(filter: Record<string, unknown>): Promise<number> {
    return this.gameModel.countDocuments(filter).exec()
  }

  findByFilter(
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<GameDocument[]> {
    return this.gameModel
      .find(filter)
      .sort({ f95UpdatedAt: -1, _id: -1 })
      .limit(limit)
      .exec()
  }

  findById(gameId: string | Types.ObjectId): Promise<GameDocument | null> {
    return this.gameModel.findById(gameId).exec()
  }

  findByF95ThreadId(f95ThreadId: number): Promise<GameDocument | null> {
    return this.gameModel.findOne({ f95ThreadId }).exec()
  }

  async upsertByF95ThreadId(payload: TCreateGamePayload) {
    const existingGame = await this.findByF95ThreadId(payload.f95ThreadId)
    const game = await this.gameModel
      .findOneAndUpdate({ f95ThreadId: payload.f95ThreadId }, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()

    return {
      game,
      isCreated: isNil(existingGame),
    }
  }
}

export { GameRepository }
