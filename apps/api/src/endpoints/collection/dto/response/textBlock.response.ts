import { ApiProperty } from "@nestjs/swagger"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"

import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"

class TextBlockResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: [ECollectionBlockType.TEXT] })
  type: ECollectionBlockType.TEXT

  @ApiProperty({ type: LanguageTextResponseDto })
  content: LanguageTextResponseDto
}

export { TextBlockResponseDto }
