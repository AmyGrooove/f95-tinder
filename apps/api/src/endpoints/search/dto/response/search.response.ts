import { ApiProperty } from "@nestjs/swagger"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"

class SearchItemResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]
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

  @ApiProperty({ type: String, nullable: true })
  authorId: string | null
}

class SearchItemsResponseDto {
  @ApiProperty({ type: [SearchItemResponseDto] })
  hits: SearchItemResponseDto[]

  @ApiProperty({ type: Number })
  estimatedTotalHits: number
}

class SearchUsersResponseDto {
  @ApiProperty({ type: [SearchUserResponseDto] })
  hits: SearchUserResponseDto[]

  @ApiProperty({ type: Number })
  estimatedTotalHits: number
}

class SearchCollectionsResponseDto {
  @ApiProperty({ type: [SearchCollectionResponseDto] })
  hits: SearchCollectionResponseDto[]

  @ApiProperty({ type: Number })
  estimatedTotalHits: number
}

class SearchResponseDto {
  @ApiProperty({ type: SearchItemsResponseDto })
  items: SearchItemsResponseDto

  @ApiProperty({ type: SearchUsersResponseDto })
  users: SearchUsersResponseDto

  @ApiProperty({ type: SearchCollectionsResponseDto })
  collections: SearchCollectionsResponseDto
}

export { SearchResponseDto }
