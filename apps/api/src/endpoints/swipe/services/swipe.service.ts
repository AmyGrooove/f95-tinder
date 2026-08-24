import { Injectable, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"

import { CreatorRepository } from "@entities/creator/services/creator.repository"
import { GameRepository } from "@entities/game/services/game.repository"
import { UserGameStateRepository } from "@entities/userGameState/services/userGameState.repository"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"
import { createGameFilter } from "../../games/functions/createGameFilter"
import { createNextGameCursor } from "../../games/functions/createNextGameCursor"
import { toGameResponse } from "../../games/functions/toGameResponse"

import type { TUserGameListType } from "@entities/userGameState/types/TUserGameListType"
import type { TListResponse } from "@shared/types/TListResponse"
import type { GameResponseDto } from "../../games/dto/response/game-list.response"
import type { LibraryGameStateResponseDto } from "../../library/dto/response/library-info.response"
import type { SwipeQueueQueryDto } from "../dto/query/swipe-queue.query"

@Injectable()
class SwipeService {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly gameRepository: GameRepository,
    private readonly userGameStateRepository: UserGameStateRepository,
  ) {}

  async getQueue(
    userId: string,
    query: SwipeQueueQueryDto,
  ): Promise<TListResponse<GameResponseDto>> {
    const limit = query.limit ?? 20
    const excludedGameIds =
      await this.userGameStateRepository.findGameIdsByUser(userId)
    const creatorIds = await this.findCreatorIdsBySearch(query.search)
    const filter = createGameFilter({ query, creatorIds, excludedGameIds })
    const games = await this.gameRepository.findByFilter(filter, limit + 1)
    const pageGames = games.slice(0, limit)
    const count = await this.gameRepository.countByFilter(filter)

    return {
      items: pageGames.map((game) => {
        return toGameResponse(game)
      }),
      count,
      nextCursor: games.length > limit ? createNextGameCursor(pageGames) : null,
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

    return {
      id: state._id.toString(),
      userId: state.userId.toString(),
      gameId: state.gameId.toString(),
      listType: state.listType,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    }
  }

  private async findCreatorIdsBySearch(search: string | undefined) {
    if (!search?.trim()) {
      return undefined
    }

    const creators = await this.creatorRepository.findByNameSearch(
      search.trim(),
    )

    return creators.map((creator) => {
      return creator._id
    })
  }
}

export { SwipeService }
