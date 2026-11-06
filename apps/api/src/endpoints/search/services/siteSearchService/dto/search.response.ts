import { ApiProperty } from "@nestjs/swagger"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EMediaType } from "@entities/shared/schemas/EMediaType"

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

class SearchCollectionResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: ECollectionType })
  type: ECollectionType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]
}

class SearchResponseDto {
  @ApiProperty({ type: [SearchItemResponseDto] })
  items: SearchItemResponseDto[]

  @ApiProperty({ type: [SearchCollectionResponseDto] })
  collections: SearchCollectionResponseDto[]

  @ApiProperty({ type: [SearchUserResponseDto] })
  users: SearchUserResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export { SearchResponseDto }
