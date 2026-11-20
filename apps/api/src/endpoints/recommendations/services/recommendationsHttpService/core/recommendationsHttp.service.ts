import { GoneException, Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import { RecommendationFeedService } from "@endpoints/recommendations/services/recommendationFeedService"
import { RecommendationCursorExpiredError } from "@endpoints/recommendations/services/recommendationsService"

import type { RecommendationsBodyDto } from "../dto/recommendations.body"
import type { RecommendationsResponseDto } from "../dto/recommendations.response"

@Injectable()
class RecommendationsHttpService {
  constructor(private readonly feedService: RecommendationFeedService) {}

  async readPage(
    accessToken: unknown,
    body: RecommendationsBodyDto,
  ): Promise<RecommendationsResponseDto> {
    const { cursor, limit = 20, filter, excludeItemIds = [] } = body
    const { types, statuses, tags } = filter ?? {}

    try {
      const { items, count, nextCursor } = await this.feedService.readPage(
        accessToken,
        {
          cursor,
          limit,
          ...(excludeItemIds.length > 0 && {
            excludeItemIds: excludeItemIds.map((id) => new Types.ObjectId(id)),
          }),
          filter: {
            types,
            library: statuses,
            tags: tags?.map(({ allOf, anyOf, noneOf }) => ({
              allOf: allOf?.map((id) => new Types.ObjectId(id)),
              anyOf: anyOf?.map((id) => new Types.ObjectId(id)),
              noneOf: noneOf?.map((id) => new Types.ObjectId(id)),
            })),
          },
        },
      )

      return {
        items: items.map(
          ({
            _id,
            type,
            title,
            media,
            ratingAverage,
            userRating,
            userStatus,
          }) => ({
            id: _id.toHexString(),
            type,
            title: { ru: title?.ru ?? null, en: title?.en ?? null },
            media: media.map(({ src, type, language }) => ({
              src,
              type,
              language: language ?? null,
            })),
            ratingAverage,
            userRating,
            userStatus,
          }),
        ),
        count,
        nextCursor,
      }
    } catch (error) {
      if (error instanceof RecommendationCursorExpiredError) {
        throw new GoneException(error.message, { cause: error })
      }

      throw error
    }
  }
}

export { RecommendationsHttpService }
