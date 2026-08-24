import { ApiPropertyOptional, ApiSchema } from "@nestjs/swagger"
import { isNil } from "@shared/functions/isNil"
import { Transform } from "class-transformer"
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator"

const normalizeQueryArray = (value: unknown): string[] | undefined => {
  if (isNil(value) || value === "") {
    return undefined
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((queryValue) => {
        return String(queryValue).split(",")
      })
      .filter((queryValue) => {
        return queryValue.length > 0
      })
  }

  return String(value)
    .split(",")
    .filter((queryValue) => {
      return queryValue.length > 0
    })
}

@ApiSchema({ name: "ListGamesQuery" })
class ListGamesQueryDto {
  @ApiPropertyOptional({ description: "Text search by title or creator" })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ description: "Required tag ids", type: [String] })
  @Transform(({ value }) => {
    return normalizeQueryArray(value)
  })
  @IsOptional()
  @IsMongoId({ each: true })
  tagIds?: string[]

  @ApiPropertyOptional({ description: "Required prefix ids", type: [String] })
  @Transform(({ value }) => {
    return normalizeQueryArray(value)
  })
  @IsOptional()
  @IsMongoId({ each: true })
  prefixIds?: string[]

  @ApiPropertyOptional({ description: "Excluded tag ids", type: [String] })
  @Transform(({ value }) => {
    return normalizeQueryArray(value)
  })
  @IsOptional()
  @IsMongoId({ each: true })
  excludeTagIds?: string[]

  @ApiPropertyOptional({ description: "Excluded prefix ids", type: [String] })
  @Transform(({ value }) => {
    return normalizeQueryArray(value)
  })
  @IsOptional()
  @IsMongoId({ each: true })
  excludePrefixIds?: string[]

  @ApiPropertyOptional({ description: "Opaque pagination cursor" })
  @IsOptional()
  @IsString()
  cursor?: string

  @ApiPropertyOptional({
    description: "Page size",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Transform(({ value }) => {
    return isNil(value) ? undefined : Number(value)
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number
}

export { ListGamesQueryDto }
