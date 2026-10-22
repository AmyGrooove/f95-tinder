import { ApiProperty } from "@nestjs/swagger"

class LanguageTextResponseDto {
  @ApiProperty({ type: String, nullable: true })
  ru: string | null

  @ApiProperty({ type: String, nullable: true })
  en: string | null
}

export { LanguageTextResponseDto }
