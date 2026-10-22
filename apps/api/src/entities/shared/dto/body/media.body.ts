import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from "class-validator"

import { EMediaType } from "../../schemas/EMediaType"

class MediaBodyDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  src: string

  @ApiProperty({ enum: EMediaType })
  @IsEnum(EMediaType)
  type: EMediaType

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  language: string | null = null
}

export { MediaBodyDto }
