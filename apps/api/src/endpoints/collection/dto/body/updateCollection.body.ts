import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
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

import { CreateBlockBodyDto } from "./createBlock.body"
import { CreateItemCollectionBodyDto } from "./createItemCollection.body"

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

  @ApiPropertyOptional({ type: [CreateBlockBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CreateBlockBodyDto)
  upsertBlocks?: CreateBlockBodyDto[]

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsMongoId({ each: true })
  removeBlockIds?: string[]

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsMongoId({ each: true })
  blockOrder?: string[]

  @ApiPropertyOptional({ type: [CreateItemCollectionBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CreateItemCollectionBodyDto)
  upsertItems?: CreateItemCollectionBodyDto[]

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsMongoId({ each: true })
  removeItemIds?: string[]
}

export { UpdateCollectionBodyDto }
