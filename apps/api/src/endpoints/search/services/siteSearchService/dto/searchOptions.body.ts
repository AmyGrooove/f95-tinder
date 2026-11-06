import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import { ESearchSortDirection } from "@infrastructure/search/types/ESearchSortDirection"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { ESearchCollectionSort } from "../types/ESearchCollectionSort"
import { ESearchGroup } from "../types/ESearchGroup"
import { ESearchItemSort } from "../types/ESearchItemSort"
import { ESearchUserSort } from "../types/ESearchUserSort"

const isProvided = (_object: unknown, value: unknown) => !isUndefined(value)
const normalizeId = (value: unknown) =>
  isString(value) ? value.toLowerCase() : value

class SearchGroupFilterDto implements IValueFilter<ESearchGroup> {
  @ApiPropertyOptional({
    enum: ESearchGroup,
    isArray: true,
    minItems: 1,
    maxItems: 3,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(ESearchGroup, { each: true })
  allOf?: ESearchGroup[]

  @ApiPropertyOptional({
    enum: ESearchGroup,
    isArray: true,
    minItems: 1,
    maxItems: 3,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(ESearchGroup, { each: true })
  anyOf?: ESearchGroup[]

  @ApiPropertyOptional({
    enum: ESearchGroup,
    isArray: true,
    minItems: 1,
    maxItems: 3,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(ESearchGroup, { each: true })
  noneOf?: ESearchGroup[]
}

class SearchCollectionTypeFilterDto implements IValueFilter<ECollectionType> {
  @ApiPropertyOptional({
    enum: ECollectionType,
    isArray: true,
    minItems: 1,
    maxItems: 4,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(ECollectionType, { each: true })
  allOf?: ECollectionType[]

  @ApiPropertyOptional({
    enum: ECollectionType,
    isArray: true,
    minItems: 1,
    maxItems: 4,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(ECollectionType, { each: true })
  anyOf?: ECollectionType[]

  @ApiPropertyOptional({
    enum: ECollectionType,
    isArray: true,
    minItems: 1,
    maxItems: 4,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(ECollectionType, { each: true })
  noneOf?: ECollectionType[]
}

class SearchIdFilterDto implements IValueFilter<string> {
  @ApiPropertyOptional({ type: [String], minItems: 1, maxItems: 100 })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique(normalizeId)
  @IsMongoId({ each: true })
  allOf?: string[]

  @ApiPropertyOptional({ type: [String], minItems: 1, maxItems: 100 })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique(normalizeId)
  @IsMongoId({ each: true })
  anyOf?: string[]

  @ApiPropertyOptional({ type: [String], minItems: 1, maxItems: 100 })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique(normalizeId)
  @IsMongoId({ each: true })
  noneOf?: string[]
}

class SearchRatingDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf(isProvided)
  @IsNumber()
  @Min(1)
  @Max(10)
  min?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf(isProvided)
  @IsNumber()
  @Min(1)
  @Max(10)
  max?: number
}

class SearchSortDto {
  @ApiPropertyOptional({ enum: ESearchSortDirection })
  @ValidateIf(isProvided)
  @IsEnum(ESearchSortDirection)
  direction?: ESearchSortDirection
}

class SearchTitleSortDto extends SearchSortDto {
  @ApiPropertyOptional({ enum: ELanguage, default: ELanguage.RUSSIAN })
  @ValidateIf(isProvided)
  @IsEnum(ELanguage)
  language?: ELanguage
}

class SearchItemSortDto extends SearchTitleSortDto {
  @ApiProperty({ enum: ESearchItemSort })
  @IsEnum(ESearchItemSort)
  type: ESearchItemSort
}

class SearchCollectionSortDto extends SearchTitleSortDto {
  @ApiProperty({ enum: ESearchCollectionSort })
  @IsEnum(ESearchCollectionSort)
  type: ESearchCollectionSort
}

class SearchUserSortDto extends SearchSortDto {
  @ApiProperty({ enum: ESearchUserSort })
  @IsEnum(ESearchUserSort)
  type: ESearchUserSort
}

class SearchItemsBodyDto {
  @ApiPropertyOptional({ enum: EItemType, isArray: true })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(EItemType, { each: true })
  types?: EItemType[]

  @ApiPropertyOptional({ type: SearchIdFilterDto })
  @ValidateIf(isProvided)
  @Type(() => SearchIdFilterDto)
  @IsObject()
  @ValidateNested()
  tags?: SearchIdFilterDto

  @ApiPropertyOptional({ type: SearchRatingDto })
  @ValidateIf(isProvided)
  @Type(() => SearchRatingDto)
  @IsObject()
  @ValidateNested()
  rating?: SearchRatingDto

  @ApiPropertyOptional({ type: SearchItemSortDto })
  @ValidateIf(isProvided)
  @Type(() => SearchItemSortDto)
  @IsObject()
  @ValidateNested()
  sort?: SearchItemSortDto
}

class SearchUsersBodyDto {
  @ApiPropertyOptional({ type: SearchUserSortDto })
  @ValidateIf(isProvided)
  @Type(() => SearchUserSortDto)
  @IsObject()
  @ValidateNested()
  sort?: SearchUserSortDto
}

class SearchCollectionsBodyDto {
  @ApiPropertyOptional({ type: SearchCollectionTypeFilterDto })
  @ValidateIf(isProvided)
  @Type(() => SearchCollectionTypeFilterDto)
  @IsObject()
  @ValidateNested()
  types?: SearchCollectionTypeFilterDto

  @ApiPropertyOptional({ type: SearchIdFilterDto })
  @ValidateIf(isProvided)
  @Type(() => SearchIdFilterDto)
  @IsObject()
  @ValidateNested()
  authorIds?: SearchIdFilterDto

  @ApiPropertyOptional({ type: SearchCollectionSortDto })
  @ValidateIf(isProvided)
  @Type(() => SearchCollectionSortDto)
  @IsObject()
  @ValidateNested()
  sort?: SearchCollectionSortDto
}

export {
  SearchGroupFilterDto,
  SearchItemsBodyDto,
  SearchUsersBodyDto,
  SearchCollectionsBodyDto,
}
