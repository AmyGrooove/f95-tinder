import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsIn, IsString, Matches, ValidateIf } from "class-validator"

import { CATALOG_MEDIA_TYPES } from "../../schemas/EMediaType"
import type { EMediaType } from "../../schemas/EMediaType"

class MediaBodyDto {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(/\S/)
  src: string

  @ApiProperty({ enum: CATALOG_MEDIA_TYPES })
  @IsIn(CATALOG_MEDIA_TYPES)
  type: EMediaType

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  language: string | null = null
}

export { MediaBodyDto }
