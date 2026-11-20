import { ApiProperty, PickType } from "@nestjs/swagger"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class SearchItemPosterResponseDto extends MediaResponseDto {
  @ApiProperty({ enum: [EMediaType.POSTER] })
  override type: EMediaType.POSTER = EMediaType.POSTER
}

class SearchItemResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [SearchItemPosterResponseDto] })
  media: SearchItemPosterResponseDto[]

  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 10,
    nullable: true,
    description: SWAGGER_DICTIONARY.search.rating,
  })
  rating: number | null

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: 10,
    nullable: true,
    description: SWAGGER_DICTIONARY.search.userRating,
  })
  userRating: number | null

  @ApiProperty({
    enum: [...USER_ITEM_LIBRARY_STATUSES],
    nullable: true,
    description: SWAGGER_DICTIONARY.search.userStatus,
  })
  userStatus: (typeof USER_ITEM_LIBRARY_STATUSES)[number] | null
}

class SearchUserResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  username: string

  @ApiProperty({ type: String })
  displayName: string

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null
}

class SearchCollectionAuthorResponseDto extends PickType(
  SearchUserResponseDto,
  ["id", "displayName"],
) {
  @ApiProperty({ type: String, nullable: true })
  avatar: string | null
}

class SearchCollectionResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: ECollectionType })
  type: ECollectionType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]

  @ApiProperty({ type: SearchCollectionAuthorResponseDto, nullable: true })
  author: SearchCollectionAuthorResponseDto | null

  @ApiProperty({
    type: Boolean,
    description: "Коллекция без пользовательского автора",
  })
  isSiteCollection: boolean

  @ApiProperty({ type: "integer", minimum: 0 })
  itemCount: number

  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  ratingAverage: number | null
}

class SearchResponseDto {
  @ApiProperty({
    type: [SearchItemResponseDto],
    description: SWAGGER_DICTIONARY.search.items,
  })
  items: SearchItemResponseDto[]

  @ApiProperty({ type: [SearchCollectionResponseDto] })
  collections: SearchCollectionResponseDto[]

  @ApiProperty({ type: [SearchUserResponseDto] })
  users: SearchUserResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export { SearchResponseDto }
