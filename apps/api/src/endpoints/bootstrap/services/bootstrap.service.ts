import { Injectable } from "@nestjs/common"

import { CreatorRepository } from "@entities/creator/services/creator.repository"
import { PrefixRepository } from "@entities/prefix/services/prefix.repository"
import { TagRepository } from "@entities/tag/services/tag.repository"
import { UserGameStateRepository } from "@entities/userGameState/services/userGameState.repository"
import { CatalogSyncStatusService } from "../../sync/services/catalogSyncStatus.service"

import type { CreatorDocument } from "@entities/creator/schemas/creator.schema"
import type { PrefixDocument } from "@entities/prefix/schemas/prefix.schema"
import type { TagDocument } from "@entities/tag/schemas/tag.schema"
import type { AuthUserDto } from "../../auth/dto/response/auth-session.response"
import type {
  CreatorResponseDto,
  PrefixResponseDto,
  TagResponseDto,
} from "../../games/dto/response/game-list.response"
import type { BootstrapResponseDto } from "../dto/response/bootstrap.response"

@Injectable()
class BootstrapService {
  constructor(
    private readonly catalogSyncStatusService: CatalogSyncStatusService,
    private readonly creatorRepository: CreatorRepository,
    private readonly prefixRepository: PrefixRepository,
    private readonly tagRepository: TagRepository,
    private readonly userGameStateRepository: UserGameStateRepository,
  ) {}

  async getBootstrap(user: AuthUserDto): Promise<BootstrapResponseDto> {
    const [
      total,
      favorites,
      trash,
      played,
      tags,
      prefixes,
      creators,
      catalogSyncStatus,
    ] = await Promise.all([
      this.userGameStateRepository.countByUser(user.id),
      this.userGameStateRepository.countByUserAndListType(user.id, "favorite"),
      this.userGameStateRepository.countByUserAndListType(user.id, "trash"),
      this.userGameStateRepository.countByUserAndListType(user.id, "played"),
      this.tagRepository.findAll(),
      this.prefixRepository.findAll(),
      this.creatorRepository.findAll(),
      this.catalogSyncStatusService.getStatus(),
    ])

    return {
      user,
      libraryInfo: {
        total,
        favorites,
        trash,
        played,
      },
      tags: tags.map((tag) => {
        return this.toTagResponse(tag)
      }),
      prefixes: prefixes.map((prefix) => {
        return this.toPrefixResponse(prefix)
      }),
      creators: creators.map((creator) => {
        return this.toCreatorResponse(creator)
      }),
      catalogSyncStatus,
    }
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

export { BootstrapService }
