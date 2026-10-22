import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsEnum,
  IsMongoId,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { LanguageTextBodyDto } from "@entities/shared/dto/body/languageText.body"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class CreateBlockBodyDto {
  @ApiProperty({ enum: ECollectionBlockType })
  @IsEnum(ECollectionBlockType)
  type: ECollectionBlockType

  @ApiPropertyOptional({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsMongoId()
  id?: string

  @ApiPropertyOptional({ type: LanguageTextBodyDto, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  title?: LanguageTextBodyDto | null

  @ApiPropertyOptional({ type: LanguageTextBodyDto, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  description?: LanguageTextBodyDto | null

  @ApiPropertyOptional({ type: LanguageTextBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  content?: LanguageTextBodyDto
}

export { CreateBlockBodyDto }
