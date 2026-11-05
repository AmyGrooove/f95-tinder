import { ApiProperty } from "@nestjs/swagger"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"

class CollectionSummaryResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: ECollectionType })
  type: ECollectionType

  @ApiProperty({ type: String, nullable: true })
  authorId: string | null

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]
}

export { CollectionSummaryResponseDto }
