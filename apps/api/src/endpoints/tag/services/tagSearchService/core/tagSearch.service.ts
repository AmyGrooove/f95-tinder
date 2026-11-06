import { createHash } from "node:crypto"

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { SearchService } from "@infrastructure/search/services/searchService"
import { isNumber } from "@shared/functions/checks/isNumber"

import { TAG_SEARCH_SETTINGS } from "../../../static/TAG_SEARCH_SETTINGS"
import type { ITagSearchDocument } from "../../../types/ITagSearchDocument"
import type { TagsBodyDto } from "../dto/tags.body"
import type { TagsResponseDto } from "../dto/tags.response"

@Injectable()
class TagSearchService {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
  ) {}

  async search({
    search = "",
    group,
    limit,
    cursor,
  }: TagsBodyDto): Promise<TagsResponseDto> {
    const { index, checkpointKey, maxTotalHits, ungrouped } =
      TAG_SEARCH_SETTINGS
    const allOf = group?.allOf?.map((value) => value ?? ungrouped).sort() ?? []
    const anyOf = group?.anyOf?.map((value) => value ?? ungrouped).sort() ?? []
    const noneOf =
      group?.noneOf?.map((value) => value ?? ungrouped).sort() ?? []
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([search, allOf, anyOf, noneOf, limit]))
      .digest("base64url")
    const offset = this.readOffset({ cursor, fingerprint, limit })

    if (allOf.length > 1) {
      return { items: [], nextCursor: null }
    }

    const filter = [
      ...allOf.map((value) => `group = ${JSON.stringify(value)}`),
      ...(anyOf.length === 0 ? [] : [`group IN ${JSON.stringify(anyOf)}`]),
      ...(noneOf.length === 0
        ? []
        : [`group NOT IN ${JSON.stringify(noneOf)}`]),
    ]

    const hits = await this.searchIndex({
      search,
      filter,
      offset,
      limit: Math.min(limit + 1, maxTotalHits - offset),
    })
    const items = hits.slice(0, limit).map(({ id, key, group, name }) => ({
      id,
      key,
      group: group === ungrouped ? null : group,
      name: { ru: name.ru, en: name.en },
    }))
    const nextCursor =
      hits.length > limit
        ? Buffer.from(
            JSON.stringify([1, fingerprint, offset + limit]),
          ).toString("base64url")
        : null

    return { items, nextCursor }
  }

  private readOffset({
    cursor,
    fingerprint,
    limit,
  }: {
    cursor?: string
    fingerprint: string
    limit: number
  }) {
    if (cursor === undefined) {
      return 0
    }

    try {
      const buffer = Buffer.from(cursor, "base64url")
      const decoded: unknown = JSON.parse(buffer.toString("utf8"))

      if (
        buffer.toString("base64url") === cursor &&
        Array.isArray(decoded) &&
        decoded.length === 3
      ) {
        const [version, storedFingerprint, offset]: unknown[] = decoded

        if (
          version === 1 &&
          storedFingerprint === fingerprint &&
          isNumber(offset) &&
          Number.isSafeInteger(offset) &&
          offset >= limit &&
          offset < TAG_SEARCH_SETTINGS.maxTotalHits &&
          offset % limit === 0
        ) {
          return offset
        }
      }
    } catch (error) {
      throw new BadRequestException(DICTIONARY.tag.invalidCursor, {
        cause: error,
      })
    }

    throw new BadRequestException(DICTIONARY.tag.invalidCursor)
  }

  private async searchIndex({
    search,
    filter,
    offset,
    limit,
  }: {
    search: string
    filter: string[]
    offset: number
    limit: number
  }) {
    try {
      const checkpoint = await this.cacheService.get<number>(
        TAG_SEARCH_SETTINGS.checkpointKey,
      )

      if (checkpoint !== null) {
        const result = await this.searchService.search<ITagSearchDocument>(
          TAG_SEARCH_SETTINGS.index,
          search,
          {
            filter,
            sort: ["id:asc"],
            offset,
            limit,
          },
        )

        return result.hits
      }
    } catch (error) {
      throw new ServiceUnavailableException(DICTIONARY.tag.searchUnavailable, {
        cause: error,
      })
    }

    throw new ServiceUnavailableException(DICTIONARY.tag.searchUnavailable)
  }
}

export { TagSearchService }
