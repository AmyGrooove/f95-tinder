import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import type { Item } from "@entities/item/schemas/item.schema"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { ItemRelationRepository } from "@entities/itemRelation/services/itemRelationRepository"
import { ItemStatsRepository } from "@entities/itemStats/services/itemStatsRepository"
import { RelationRepository } from "@entities/relation/services/relationRepository"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { TagRepository } from "@entities/tag/services/tagRepository"
import { TagItemRepository } from "@entities/tagItem/services/tagItemRepository"
import { isNil } from "@shared/functions/checks/isNil"

import type { ItemResponseDto } from "../dto/item.response"

const mapLanguageText = (text: LanguageText | null | undefined) => ({
  ru: text?.ru ?? null,
  en: text?.en ?? null,
})

const mapItemSummary = (
  item: Pick<Item, "_id" | "type" | "title" | "media">,
) => ({
  id: item._id.toHexString(),
  type: item.type,
  title: mapLanguageText(item.title),
  media: (item.media ?? []).map((source) => {
    const { src, type, language } = source

    return {
      src,
      type,
      language: language ?? null,
    }
  }),
})

@Injectable()
class ItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly tagItemRepository: TagItemRepository,
    private readonly tagRepository: TagRepository,
    private readonly itemRelationRepository: ItemRelationRepository,
    private readonly relationRepository: RelationRepository,
    private readonly itemStatsRepository: ItemStatsRepository,
  ) {}

  async getById(id: Types.ObjectId): Promise<ItemResponseDto> {
    const item = await this.itemRepository.read.findOne(
      { _id: id, deletedAt: null },
      {
        _id: 1,
        type: 1,
        title: 1,
        description: 1,
        aliases: 1,
        media: 1,
        releaseDate: 1,
        ageRestriction: 1,
        movie: 1,
        series: 1,
        game: 1,
      },
      { lean: true },
    )

    if (isNil(item)) {
      throw new NotFoundException(DICTIONARY.item.notFound)
    }

    const [tags, relations, stats] = await Promise.all([
      this.readTags(id),
      this.readRelations(id),
      this.readStats(id),
    ])
    const { movie, series, game } = item

    return {
      ...mapItemSummary(item),
      description: mapLanguageText(item.description),
      aliases: item.aliases ?? [],
      tags,
      relations,
      stats,
      releaseDate: item.releaseDate?.toISOString() ?? null,
      ageRestriction: item.ageRestriction ?? null,
      movie: isNil(movie) ? null : { duration: movie.duration ?? null },
      series: isNil(series)
        ? null
        : {
            episodeCount: series.episodeCount ?? null,
            releasedEpisodeCount: series.releasedEpisodeCount ?? null,
            episodeDuration: series.episodeDuration ?? null,
            lastReleasedEpisodeAt:
              series.lastReleasedEpisodeAt?.toISOString() ?? null,
            nextEpisodeAt: series.nextEpisodeAt?.toISOString() ?? null,
          },
      game: isNil(game)
        ? null
        : {
            mainStoryDuration: game.mainStoryDuration ?? null,
            fullCompletionDuration: game.fullCompletionDuration ?? null,
          },
    }
  }

  private async readStats(
    id: Types.ObjectId,
  ): Promise<ItemResponseDto["stats"]> {
    const stats = await this.itemStatsRepository.read.findOne(
      { item: id },
      {
        _id: 0,
        ratingAverage: 1,
        ratingsCount: 1,
        favoritesCount: 1,
        statusCounts: 1,
      },
      { lean: true },
    )
    const ratingsCount = stats?.ratingsCount ?? 0
    const statusCounts = stats?.statusCounts

    return {
      ratingAverage: ratingsCount > 0 ? (stats?.ratingAverage ?? null) : null,
      ratingsCount,
      favoritesCount: stats?.favoritesCount ?? 0,
      statusCounts: {
        planned: statusCounts?.planned ?? 0,
        inProgress: statusCounts?.inProgress ?? 0,
        onHold: statusCounts?.onHold ?? 0,
        completed: statusCounts?.completed ?? 0,
        dropped: statusCounts?.dropped ?? 0,
      },
    }
  }

  private async readTags(id: Types.ObjectId): Promise<ItemResponseDto["tags"]> {
    const assignments = await this.tagItemRepository.read.findMany(
      { item: id },
      { tag: 1 },
      { lean: true, sort: { relevanceScore: -1, tag: 1 } },
    )

    if (assignments.length === 0) {
      return []
    }

    const tags = await this.tagRepository.read.findMany(
      {
        _id: {
          $in: assignments.map((assignment) => {
            const { tag } = assignment

            return tag
          }),
        },
      },
      { _id: 1, key: 1, group: 1, name: 1 },
      { lean: true },
    )
    const tagsById = new Map(tags.map((tag) => [tag._id.toHexString(), tag]))

    return assignments.flatMap((assignment) => {
      const { tag: tagId } = assignment

      const tag = tagsById.get(tagId.toHexString())

      return isNil(tag)
        ? []
        : [
            {
              id: tag._id.toHexString(),
              key: tag.key,
              group: tag.group ?? null,
              name: mapLanguageText(tag.name),
            },
          ]
    })
  }

  private async readRelations(
    id: Types.ObjectId,
  ): Promise<ItemResponseDto["relations"]> {
    const links = await this.itemRelationRepository.read.findMany(
      { $or: [{ "first.item": id }, { "second.item": id }] },
      { first: 1, second: 1 },
      { lean: true, sort: { _id: 1 } },
    )

    if (links.length === 0) {
      return []
    }

    const related = links.map((link) => {
      const { first, second } = link

      return id.equals(first.item) ? second : first
    })
    const [items, roles] = await Promise.all([
      this.itemRepository.read.findMany(
        {
          _id: {
            $in: related.map((relation) => {
              const { item } = relation

              return item
            }),
          },
          deletedAt: null,
        },
        { _id: 1, type: 1, title: 1, media: 1 },
        { lean: true },
      ),
      this.relationRepository.read.findMany(
        {
          _id: {
            $in: related.map((relation) => {
              const { role } = relation

              return role
            }),
          },
        },
        { _id: 1, key: 1, name: 1 },
        { lean: true },
      ),
    ])
    const itemsById = new Map(
      items.map((item) => [item._id.toHexString(), item]),
    )
    const rolesById = new Map(
      roles.map((role) => [role._id.toHexString(), role]),
    )

    return related.flatMap((relation) => {
      const { item: itemId, role: roleId, roleNameOverride } = relation

      const item = itemsById.get(itemId.toHexString())
      const role = rolesById.get(roleId.toHexString())

      if (isNil(item) || isNil(role)) {
        return []
      }

      return [
        {
          item: mapItemSummary(item),
          role: {
            id: role._id.toHexString(),
            key: role.key,
            name: {
              ru: roleNameOverride?.ru ?? role.name?.ru ?? null,
              en: roleNameOverride?.en ?? role.name?.en ?? null,
            },
          },
        },
      ]
    })
  }
}

export { ItemService }
