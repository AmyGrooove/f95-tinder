import { ApiProperty } from "@nestjs/swagger"

import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { REGEX } from "@shared/static/REGEX"

class FactResponseDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ type: LanguageTextResponseDto })
  text: LanguageTextResponseDto

  @ApiProperty({ type: String, nullable: true })
  sourceUrl: string | null
}

export { FactResponseDto }
