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
import { parseCollectionQueryList } from "../../functions/parseCollectionQueryList"
import { parseCollectionFeatureFilters } from "../../functions/parseCollectionFeatureFilters"
import { CollectionFiltersQueryDto } from "./collectionFilters.query"
import { CollectionFeatureFilterQueryDto } from "./collectionFeatureFilter.query"

class CollectionItemsQueryDto extends CollectionFiltersQueryDto {
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
  @Transform(({ value }: { value: unknown }) => parseCollectionQueryList(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  tags?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseCollectionQueryList(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  excludeTags?: string[]

  @ApiPropertyOptional({
    type: String,
    description: SWAGGER_DICTIONARY.collection.featureFilters,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    parseCollectionFeatureFilters(value),
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  features?: CollectionFeatureFilterQueryDto[]

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

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export { CollectionItemsQueryDto }
