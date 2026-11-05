import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextBodyDto } from "@entities/shared/dto/body/languageText.body"
import { MediaBodyDto } from "@entities/shared/dto/body/media.body"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { CollectionBlockChangesBodyDto } from "./collectionBlockChanges.body"
import { CollectionItemChangesBodyDto } from "./collectionItemChanges.body"

class UpdateCollectionBodyDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  version: number

  @ApiPropertyOptional({ type: LanguageTextBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  title?: LanguageTextBodyDto

  @ApiPropertyOptional({ type: LanguageTextBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  description?: LanguageTextBodyDto

  @ApiPropertyOptional({ enum: ECollectionType })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsEnum(ECollectionType)
  type?: ECollectionType

  @ApiPropertyOptional({ type: [MediaBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MediaBodyDto)
  media?: MediaBodyDto[]

  @ApiPropertyOptional({ type: CollectionBlockChangesBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CollectionBlockChangesBodyDto)
  blocks?: CollectionBlockChangesBodyDto

  @ApiPropertyOptional({ type: CollectionItemChangesBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CollectionItemChangesBodyDto)
  items?: CollectionItemChangesBodyDto
}

export { UpdateCollectionBodyDto }
