import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { LanguageTextBodyDto } from "@entities/shared/dto/body/languageText.body"
import { MediaBodyDto } from "@entities/shared/dto/body/media.body"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { CreateBlockBodyDto } from "./createBlock.body"
import { CreateCollectionItemBodyDto } from "./createCollectionItem.body"

class CreateCollectionBodyDto {
  @ApiProperty({ type: LanguageTextBodyDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  title: LanguageTextBodyDto

  @ApiPropertyOptional({ type: LanguageTextBodyDto })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsObject()
  @ValidateNested()
  @Type(() => LanguageTextBodyDto)
  description?: LanguageTextBodyDto

  @ApiPropertyOptional({
    enum: ECollectionType,
    default: ECollectionType.CUSTOM,
  })
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
  blocks?: CreateBlockBodyDto[]

  @ApiPropertyOptional({ type: [CreateCollectionItemBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CreateCollectionItemBodyDto)
  items?: CreateCollectionItemBodyDto[]
}

export { CreateCollectionBodyDto }
