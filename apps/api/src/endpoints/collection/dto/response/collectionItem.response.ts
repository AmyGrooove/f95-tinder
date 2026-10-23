import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import { EItemType } from "@entities/item/schemas/EItemType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"

import { CollectionItemMembershipResponseDto } from "./collectionItemMembership.response"
import { CollectionItemUserResponseDto } from "./collectionItemUser.response"

class CollectionItemResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]

  @ApiProperty({ type: CollectionItemMembershipResponseDto })
  membership: CollectionItemMembershipResponseDto

  @ApiPropertyOptional({ type: CollectionItemUserResponseDto, nullable: true })
  userItem?: CollectionItemUserResponseDto | null
}

export { CollectionItemResponseDto }
