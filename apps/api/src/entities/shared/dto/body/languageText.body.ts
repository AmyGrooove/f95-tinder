import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, ValidateIf } from "class-validator"

class LanguageTextBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  ru: string | null = null

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  en: string | null = null
}

export { LanguageTextBodyDto }
