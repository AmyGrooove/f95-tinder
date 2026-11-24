import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { REGEX } from "@shared/static/REGEX"

const { event, nextCursor } = SWAGGER_DICTIONARY.account.libraryHistory

enum ELibraryHistoryEvent {
  ADDED = "added",
  STATUS_CHANGED = "statusChanged",
  RATING_CHANGED = "ratingChanged",
  FAVORITE_CHANGED = "favoriteChanged",
}

class LibraryHistoryPosterDto extends MediaResponseDto {
  @ApiProperty({ enum: [EMediaType.POSTER] })
  override type: EMediaType.POSTER = EMediaType.POSTER
}

class LibraryHistoryItemDto {
  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: LibraryHistoryPosterDto, nullable: true })
  poster: LibraryHistoryPosterDto | null
}

class LibraryHistoryEventDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  itemId: string

  @ApiProperty({ type: LibraryHistoryItemDto, nullable: true })
  item: LibraryHistoryItemDto | null

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string

  @ApiProperty({ enum: ELibraryHistoryEvent })
  type: ELibraryHistoryEvent

  @ApiPropertyOptional({ enum: EUserItemStatus, description: event.status })
  status?: EUserItemStatus

  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 10,
    nullable: true,
    description: event.rating,
  })
  rating?: number | null

  @ApiPropertyOptional({ type: Boolean, description: event.isFavorite })
  isFavorite?: boolean
}

class LibraryHistoryResponseDto {
  @ApiProperty({ type: [LibraryHistoryEventDto] })
  items: LibraryHistoryEventDto[]

  @ApiProperty({ type: String, nullable: true, description: nextCursor })
  nextCursor: string | null
}

export { ELibraryHistoryEvent, LibraryHistoryResponseDto }
