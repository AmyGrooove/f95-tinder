import { ApiProperty } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { EItemType } from "@entities/item/schemas/EItemType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { TLibraryStatus } from "@entities/userItem/services/userItemRepository"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"

const { card } = SWAGGER_DICTIONARY.user.library

class UserLibraryPosterResponseDto extends MediaResponseDto {
  @ApiProperty({ enum: [EMediaType.POSTER] })
  override type: EMediaType.POSTER = EMediaType.POSTER
}

class UserLibraryProgressResponseDto {
  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    description: card.progressValue,
  })
  value: number

  @ApiProperty({ enum: [EUnit.MINUTE, EUnit.EPISODE, EUnit.PERCENT] })
  unit: EUnit.MINUTE | EUnit.EPISODE | EUnit.PERCENT
}

class UserLibraryItemResponseDto {
  @ApiProperty({ type: String, description: card.itemId })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [UserLibraryPosterResponseDto] })
  media: UserLibraryPosterResponseDto[]

  @ApiProperty({ enum: USER_ITEM_LIBRARY_STATUSES })
  status: TLibraryStatus

  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({
    type: "integer",
    nullable: true,
    minimum: 1,
    maximum: 10,
    description: card.rating,
  })
  rating: number | null

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: 10,
    description: card.ratingAverage,
  })
  ratingAverage: number | null

  @ApiProperty({ type: String, nullable: true, description: card.userItemId })
  userItemId: string | null

  @ApiProperty({
    type: UserLibraryProgressResponseDto,
    nullable: true,
    description: card.progress,
  })
  progress: UserLibraryProgressResponseDto | null
}

class UserLibraryResponseDto {
  @ApiProperty({ type: [UserLibraryItemResponseDto] })
  items: UserLibraryItemResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export { UserLibraryResponseDto }
