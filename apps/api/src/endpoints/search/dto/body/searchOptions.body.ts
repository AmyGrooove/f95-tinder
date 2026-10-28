import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsObject,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { EItemType } from "@entities/item/schemas/EItemType"
import { EItemField } from "@entities/item/schemas/EItemField"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isString } from "@shared/functions/checks/isString"

class SearchFieldBodyDto {
  @ApiProperty({ enum: EItemField })
  @IsEnum(EItemField)
  field: EItemField

  @ApiPropertyOptional({
    oneOf: [{ type: "number" }, { type: "string", format: "date-time" }],
  })
  @Allow()
  min?: unknown

  @ApiPropertyOptional({
    oneOf: [{ type: "number" }, { type: "string", format: "date-time" }],
  })
  @Allow()
  max?: unknown
}

class SearchSortingBodyDto {
  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["asc", "desc"])
  direction?: "asc" | "desc"
}

class SearchItemsBodyDto extends SearchSortingBodyDto {
  @ApiPropertyOptional({ enum: EItemType, isArray: true })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(EItemType, { each: true })
  types?: EItemType[]

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((id: unknown) => (isString(id) ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  tagIds?: string[]

  @ApiPropertyOptional({ type: [SearchFieldBodyDto] })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchFieldBodyDto)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  fields?: SearchFieldBodyDto[]

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsNumber()
  @Min(1)
  @Max(10)
  ratingMin?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsNumber()
  @Min(1)
  @Max(10)
  ratingMax?: number

  @ApiPropertyOptional({
    enum: ["relevance", "title", "releaseDate", "rating"],
    default: "relevance",
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["relevance", "title", "releaseDate", "rating"])
  sort?: "relevance" | "title" | "releaseDate" | "rating"

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["ru", "en"])
  language?: "ru" | "en"
}

class SearchUsersBodyDto extends SearchSortingBodyDto {
  @ApiPropertyOptional({
    enum: ["relevance", "username", "displayName"],
    default: "relevance",
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["relevance", "username", "displayName"])
  sort?: "relevance" | "username" | "displayName"
}

class SearchCollectionsBodyDto extends SearchSortingBodyDto {
  @ApiPropertyOptional({ enum: ECollectionType, isArray: true })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(ECollectionType, { each: true })
  types?: ECollectionType[]

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((id: unknown) => (isString(id) ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  authorIds?: string[]

  @ApiPropertyOptional({
    enum: ["relevance", "title", "updatedAt"],
    default: "relevance",
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["relevance", "title", "updatedAt"])
  sort?: "relevance" | "title" | "updatedAt"

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(["ru", "en"])
  language?: "ru" | "en"
}

export { SearchItemsBodyDto, SearchUsersBodyDto, SearchCollectionsBodyDto }
