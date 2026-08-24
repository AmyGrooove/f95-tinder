import { Injectable, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"

import { GameRepository } from "@entities/game/services/game.repository"
import { UserGameStateRepository } from "@entities/userGameState/services/userGameState.repository"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"
import { toGameResponse } from "../../games/functions/toGameResponse"

import type { GameDocument } from "@entities/game/schemas/game.schema"
import type { UserGameStateDocument } from "@entities/userGameState/schemas/userGameState.schema"
import type { TUserGameListType } from "@entities/userGameState/types/TUserGameListType"
import type { TListResponse } from "@shared/types/TListResponse"
import type {
  LibraryGameStateResponseDto,
  LibraryInfoResponseDto,
} from "../dto/response/library-info.response"
import type { GameResponseDto } from "../../games/dto/response/game-list.response"
import { isNil } from "@shared/functions/isNil"

@Injectable()
class LibraryService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly userGameStateRepository: UserGameStateRepository,
  ) {}

  async getLibraryInfo(userId: string): Promise<LibraryInfoResponseDto> {
    const [total, favorites, trash, played] = await Promise.all([
      this.userGameStateRepository.countByUser(userId),
      this.userGameStateRepository.countByUserAndListType(userId, "favorite"),
      this.userGameStateRepository.countByUserAndListType(userId, "trash"),
      this.userGameStateRepository.countByUserAndListType(userId, "played"),
    ])

    return {
      total,
      favorites,
      trash,
      played,
    }
  }

  async listLibraryGames(
    userId: string,
    listType: TUserGameListType,
  ): Promise<TListResponse<GameResponseDto>> {
    const states = await this.userGameStateRepository.findByUserAndListType(
      userId,
      listType,
    )
    const games = await Promise.all(
      states.map((state) => {
        return this.gameRepository.findById(state.gameId)
      }),
    )
    const items = games
      .filter((game): game is GameDocument => {
        return !isNil(game)
      })
      .map((game) => {
        return toGameResponse(game)
      })

    return {
      items,
      count: states.length,
      nextCursor: null,
    }
  }

  async updateGameState(
    userId: string,
    gameId: string,
    listType: TUserGameListType,
  ): Promise<LibraryGameStateResponseDto> {
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new NotFoundException(ERROR_MESSAGES.GAME_NOT_FOUND)
    }

    const state = await this.userGameStateRepository.upsertState({
      userId: new Types.ObjectId(userId),
      gameId: new Types.ObjectId(gameId),
      listType,
    })

    if (!state) {
      throw new NotFoundException(ERROR_MESSAGES.GAME_NOT_FOUND)
    }

    return this.toLibraryGameStateResponse(state)
  }

  async deleteGameState(userId: string, gameId: string): Promise<void> {
    await this.userGameStateRepository.deleteByUserAndGame(userId, gameId)
  }

  private toLibraryGameStateResponse(
    state: UserGameStateDocument,
  ): LibraryGameStateResponseDto {
    return {
      id: state._id.toString(),
      userId: state.userId.toString(),
      gameId: state.gameId.toString(),
      listType: state.listType,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    }
  }
}

export { LibraryService }
