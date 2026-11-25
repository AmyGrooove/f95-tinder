import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { REGEX } from "@shared/static/REGEX"

const { event, nextCursor } = SWAGGER_DICTIONARY.profile.history

enum EProfileHistoryEvent {
  ADDED = "added",
  STATUS_CHANGED = "statusChanged",
  RATING_CHANGED = "ratingChanged",
  FAVORITE_CHANGED = "favoriteChanged",
}

class ProfileHistoryPosterDto extends MediaResponseDto {
  @ApiProperty({ enum: [EMediaType.POSTER] })
  override type: EMediaType.POSTER = EMediaType.POSTER
}

class ProfileHistoryItemDto {
  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: ProfileHistoryPosterDto, nullable: true })
  poster: ProfileHistoryPosterDto | null
}

class ProfileHistoryEventDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  itemId: string

  @ApiProperty({ type: ProfileHistoryItemDto, nullable: true })
  item: ProfileHistoryItemDto | null

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string
}

class ProfileHistoryStatusEventDto extends ProfileHistoryEventDto {
  @ApiProperty({
    enum: [EProfileHistoryEvent.ADDED, EProfileHistoryEvent.STATUS_CHANGED],
  })
  type: EProfileHistoryEvent.ADDED | EProfileHistoryEvent.STATUS_CHANGED

  @ApiProperty({ enum: EUserItemStatus, description: event.status })
  status: EUserItemStatus
}

class ProfileHistoryRatingEventDto extends ProfileHistoryEventDto {
  @ApiProperty({ enum: [EProfileHistoryEvent.RATING_CHANGED] })
  type: EProfileHistoryEvent.RATING_CHANGED

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: 10,
    nullable: true,
    description: event.rating,
  })
  rating: number | null
}

class ProfileHistoryFavoriteEventDto extends ProfileHistoryEventDto {
  @ApiProperty({ enum: [EProfileHistoryEvent.FAVORITE_CHANGED] })
  type: EProfileHistoryEvent.FAVORITE_CHANGED

  @ApiProperty({ type: Boolean, description: event.isFavorite })
  isFavorite: boolean
}

@ApiExtraModels(
  ProfileHistoryStatusEventDto,
  ProfileHistoryRatingEventDto,
  ProfileHistoryFavoriteEventDto,
)
class ProfileHistoryResponseDto {
  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: getSchemaPath(ProfileHistoryStatusEventDto) },
        { $ref: getSchemaPath(ProfileHistoryRatingEventDto) },
        { $ref: getSchemaPath(ProfileHistoryFavoriteEventDto) },
      ],
    },
  })
  items: (
    | ProfileHistoryStatusEventDto
    | ProfileHistoryRatingEventDto
    | ProfileHistoryFavoriteEventDto
  )[]

  @ApiProperty({ type: String, nullable: true, description: nextCursor })
  nextCursor: string | null
}

export { EProfileHistoryEvent, ProfileHistoryResponseDto }
