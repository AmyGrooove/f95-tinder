import { Injectable, NotFoundException } from "@nestjs/common"

import { CreatorRepository } from "@entities/creator/services/creator.repository"
import { GameRepository } from "@entities/game/services/game.repository"
import { PrefixRepository } from "@entities/prefix/services/prefix.repository"
import { TagRepository } from "@entities/tag/services/tag.repository"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"
import { createGameFilter } from "../functions/createGameFilter"
import { createNextGameCursor } from "../functions/createNextGameCursor"
import { toGameResponse } from "../functions/toGameResponse"

import type { CreatorDocument } from "@entities/creator/schemas/creator.schema"
import type { PrefixDocument } from "@entities/prefix/schemas/prefix.schema"
import type { TagDocument } from "@entities/tag/schemas/tag.schema"
import type { TListResponse } from "@shared/types/TListResponse"
import type { ListGamesQueryDto } from "../dto/query/list-games.query"
import type {
  CreatorResponseDto,
  GameResponseDto,
  PrefixResponseDto,
  TagResponseDto,
} from "../dto/response/game-list.response"

@Injectable()
class GamesService {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly gameRepository: GameRepository,
    private readonly prefixRepository: PrefixRepository,
    private readonly tagRepository: TagRepository,
  ) {}

  async listGames(
    query: ListGamesQueryDto,
  ): Promise<TListResponse<GameResponseDto>> {
    const limit = query.limit ?? 20
    const creatorIds = await this.findCreatorIdsBySearch(query.search)
    const filter = createGameFilter({ query, creatorIds })
    const items = await this.gameRepository.findByFilter(filter, limit + 1)
    const pageItems = items.slice(0, limit)
    const count = await this.gameRepository.countByFilter(filter)

    return {
      items: pageItems.map((game) => {
        return toGameResponse(game)
      }),
      count,
      nextCursor: items.length > limit ? createNextGameCursor(pageItems) : null,
    }
  }

  async listLatestGames(
    query: ListGamesQueryDto,
  ): Promise<TListResponse<GameResponseDto>> {
    return this.listGames(query)
  }

  async getGame(gameId: string): Promise<GameResponseDto> {
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new NotFoundException(ERROR_MESSAGES.GAME_NOT_FOUND)
    }

    return toGameResponse(game)
  }

  async listTags(): Promise<TListResponse<TagResponseDto>> {
    const tags = await this.tagRepository.findAll()

    return {
      items: tags.map((tag) => {
        return this.toTagResponse(tag)
      }),
      count: tags.length,
      nextCursor: null,
    }
  }

  async listPrefixes(): Promise<TListResponse<PrefixResponseDto>> {
    const prefixes = await this.prefixRepository.findAll()

    return {
      items: prefixes.map((prefix) => {
        return this.toPrefixResponse(prefix)
      }),
      count: prefixes.length,
      nextCursor: null,
    }
  }

  async listCreators(): Promise<TListResponse<CreatorResponseDto>> {
    const creators = await this.creatorRepository.findAll()

    return {
      items: creators.map((creator) => {
        return this.toCreatorResponse(creator)
      }),
      count: creators.length,
      nextCursor: null,
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

  private toTagResponse(tag: TagDocument): TagResponseDto {
    return {
      id: tag._id.toString(),
      f95TagId: tag.f95TagId,
      name: tag.name,
      slug: tag.slug,
    }
  }

  private toPrefixResponse(prefix: PrefixDocument): PrefixResponseDto {
    return {
      id: prefix._id.toString(),
      f95PrefixId: prefix.f95PrefixId,
      name: prefix.name,
      group: prefix.group,
      slug: prefix.slug,
    }
  }

  private toCreatorResponse(creator: CreatorDocument): CreatorResponseDto {
    return {
      id: creator._id.toString(),
      name: creator.name,
      slug: creator.slug,
    }
  }
}

export { GamesService }
