import { ApiProperty } from "@nestjs/swagger"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"

import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"

class GroupBlockResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: [ECollectionBlockType.GROUP] })
  type: ECollectionBlockType.GROUP

  @ApiProperty({ type: LanguageTextResponseDto, nullable: true })
  title: LanguageTextResponseDto | null

  @ApiProperty({ type: LanguageTextResponseDto, nullable: true })
  description: LanguageTextResponseDto | null
}

export { GroupBlockResponseDto }
