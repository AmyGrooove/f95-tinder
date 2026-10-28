import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ApiProperty } from "@nestjs/swagger"

class LanguageTextResponseDto {
  @ApiProperty({ type: String, nullable: true })
  [ELanguage.RUSSIAN]: string | null;

  @ApiProperty({ type: String, nullable: true })
  [ELanguage.ENGLISH]: string | null
}

export { LanguageTextResponseDto }
