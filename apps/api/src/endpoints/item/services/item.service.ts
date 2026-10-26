import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import type { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import type { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

import type { ItemResponseDto } from "../dto/response/item.response"

@Injectable()
class ItemService {
  constructor(private readonly itemRepository: ItemRepository) {}

  async getById(id: Types.ObjectId): Promise<ItemResponseDto> {
    const item = await this.itemRepository.findDetailsById(id)

    if (isNil(item)) {
      throw new NotFoundException(DICTIONARY.item.notFound)
    }

    return {
      id: item._id.toString(),
      type: item.type,
      title: this.mapLanguageText(item.title),
      description: this.mapLanguageText(item.description),
      aliases: item.aliases ?? [],
      media: this.mapMedia(item.media ?? []),
      tags: item.tags.map((tag) => ({
        id: tag._id.toString(),
        key: tag.key,
        group: tag.group ?? null,
        name: this.mapLanguageText(tag.name),
      })),
      releaseDate: item.releaseDate?.toISOString() ?? null,
      ageRestriction: item.ageRestriction ?? null,
      movie: isNil(item.movie)
        ? null
        : { duration: item.movie.duration ?? null },
      series: isNil(item.series)
        ? null
        : {
            episodeCount: item.series.episodeCount ?? null,
            releasedEpisodeCount: item.series.releasedEpisodeCount ?? null,
            episodeDuration: item.series.episodeDuration ?? null,
            nextEpisodeAt: item.series.nextEpisodeAt?.toISOString() ?? null,
          },
      game: isNil(item.game)
        ? null
        : {
            mainStoryDuration: item.game.mainStoryDuration ?? null,
            fullCompletionDuration: item.game.fullCompletionDuration ?? null,
          },
      relations: item.relations.map(
        ({ item: relatedItem, role, roleNameOverride }) => ({
          item: {
            id: relatedItem._id.toString(),
            type: relatedItem.type,
            title: this.mapLanguageText(relatedItem.title),
            media: this.mapMedia(relatedItem.media ?? []),
          },
          role: {
            id: role._id.toString(),
            key: role.key,
            name: {
              ru: roleNameOverride?.ru ?? role.name?.ru ?? null,
              en: roleNameOverride?.en ?? role.name?.en ?? null,
            },
          },
        }),
      ),
    }
  }

  private mapLanguageText(
    text: LanguageText | null | undefined,
  ): LanguageTextResponseDto {
    return { ru: text?.ru ?? null, en: text?.en ?? null }
  }

  private mapMedia(media: MediaSrc[]): MediaResponseDto[] {
    return media.map((entry) => ({
      src: entry.src,
      language: entry.language ?? null,
      type: entry.type,
    }))
  }
}

export { ItemService }
