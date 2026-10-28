import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, ValidateIf } from "class-validator"

class LanguageTextBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  [ELanguage.RUSSIAN]: string | null = null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  [ELanguage.ENGLISH]: string | null = null
}

export { LanguageTextBodyDto }
