import { ApiProperty } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { EItemType } from "@entities/item/schemas/EItemType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"

class RecommendationPosterResponseDto extends MediaResponseDto {
  @ApiProperty({ enum: [EMediaType.POSTER] })
  override type: EMediaType.POSTER = EMediaType.POSTER
}

class RecommendationCardResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [RecommendationPosterResponseDto] })
  media: RecommendationPosterResponseDto[]

  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  ratingAverage: number | null

  @ApiProperty({ type: "integer", minimum: 1, maximum: 10, nullable: true })
  userRating: number | null

  @ApiProperty({ enum: USER_ITEM_LIBRARY_STATUSES, nullable: true })
  userStatus: TLibraryStatus | null
}

class RecommendationsResponseDto {
  @ApiProperty({ type: [RecommendationCardResponseDto] })
  items: RecommendationCardResponseDto[]

  @ApiProperty({ type: "integer", minimum: 0, maximum: 50 })
  count: number

  @ApiProperty({
    type: String,
    nullable: true,
    description: SWAGGER_DICTIONARY.recommendations.nextCursor,
  })
  nextCursor: string | null
}

export { RecommendationsResponseDto }
