import { Injectable, ServiceUnavailableException } from "@nestjs/common"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { SearchService } from "@infrastructure/search/services/searchService"
import { ESearchSortDirection } from "@infrastructure/search/types/ESearchSortDirection"
import { isNumber } from "@shared/functions/checks/isNumber"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { TAG_SEARCH_SETTINGS } from "../../../static/TAG_SEARCH_SETTINGS"
import type { ITagSearchDocument } from "../../../types/ITagSearchDocument"
import type { TagsBodyDto } from "../dto/tags.body"
import type { TagsResponseDto } from "../dto/tags.response"
import type { ISearchIndexProps } from "../types/ISearchIndexProps"

@Injectable()
class TagSearchService {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
    private readonly cursorService: CursorService,
  ) {}

  async search(props: TagsBodyDto): Promise<TagsResponseDto> {
    const { search = "", group, limit, cursor } = props

    const { maxTotalHits, ungrouped } = TAG_SEARCH_SETTINGS
    const allOf = group?.allOf?.map((value) => value ?? ungrouped).sort() ?? []
    const anyOf = group?.anyOf?.map((value) => value ?? ungrouped).sort() ?? []
    const noneOf =
      group?.noneOf?.map((value) => value ?? ungrouped).sort() ?? []
    const scope = [search, allOf, anyOf, noneOf, limit]
    const offset = isUndefined(cursor)
      ? 0
      : this.cursorService.read({
          cursor,
          scope,
          invalidCursorMessage: DICTIONARY.tag.invalidCursor,
          isPosition: (value): value is number =>
            isNumber(value) &&
            Number.isSafeInteger(value) &&
            value >= limit &&
            value < maxTotalHits &&
            value % limit === 0,
        })

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
    const items = hits.slice(0, limit).map((props) => {
      const { id, key, group, name } = props

      return {
        id,
        key,
        group: group === ungrouped ? null : group,
        name: { ru: name.ru, en: name.en },
      }
    })
    const nextCursor =
      hits.length > limit
        ? this.cursorService.create({ scope, position: offset + limit })
        : null

    return { items, nextCursor }
  }

  private async searchIndex(props: ISearchIndexProps) {
    const { search, filter, offset, limit } = props

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
            sort: [`id:${ESearchSortDirection.ASC}`],
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
