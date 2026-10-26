import { ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { isString } from "@shared/functions/checks/isString"

import { ECollectionMode } from "../../types/ECollectionMode"
import { ECollectionSort } from "../../types/ECollectionSort"
import { CollectionFieldFilterQueryDto } from "../query/collectionFieldFilter.query"

class CollectionItemsBodyDto {
  @ApiPropertyOptional({
    type: String,
    pattern: "^[a-fA-F0-9]{24}$",
    description: SWAGGER_DICTIONARY.collection.filterGroup,
  })
  @IsOptional()
  @IsMongoId()
  groupId?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  query?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  tags?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  excludeTags?: string[]

  @ApiPropertyOptional({
    type: [CollectionFieldFilterQueryDto],
    description: SWAGGER_DICTIONARY.collection.fieldFilters,
  })
  @IsOptional()
  @Type(() => CollectionFieldFilterQueryDto)
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  fields?: CollectionFieldFilterQueryDto[]

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  ratingMin?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  ratingMax?: number

  @ApiPropertyOptional({ enum: ECollectionMode })
  @IsOptional()
  @IsEnum(ECollectionMode)
  mode?: ECollectionMode

  @ApiPropertyOptional({
    enum: ECollectionSort,
    default: ECollectionSort.COLLECTION,
  })
  @IsOptional()
  @IsEnum(ECollectionSort)
  sort?: ECollectionSort

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "asc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  direction?: "asc" | "desc"

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  language?: "ru" | "en"

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 60, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number
}

export { CollectionItemsBodyDto }
