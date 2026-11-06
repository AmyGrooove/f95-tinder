import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  IsInt,
  IsIn,
  IsString,
  Length,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import {
  SearchGroupFilterDto,
  SearchItemsBodyDto,
  SearchUsersBodyDto,
  SearchCollectionsBodyDto,
} from "./searchOptions.body"

class SearchBodyDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 200,
    description: SWAGGER_DICTIONARY.search.text,
  })
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim() : value,
  )
  @IsString()
  @Length(1, 200)
  search: string

  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 256,
    description: SWAGGER_DICTIONARY.search.cursor,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsString()
  @Length(1, 256)
  cursor?: string

  @ApiPropertyOptional({
    type: Number,
    enum: [10, 20, 50],
    default: 20,
    description: SWAGGER_DICTIONARY.search.limit,
  })
  @IsInt()
  @IsIn([10, 20, 50])
  limit: TPageSize = 20

  @ApiPropertyOptional({ type: SearchGroupFilterDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchGroupFilterDto)
  @IsObject()
  @ValidateNested()
  types?: SearchGroupFilterDto

  @ApiPropertyOptional({ type: SearchItemsBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchItemsBodyDto)
  @IsObject()
  @ValidateNested()
  items?: SearchItemsBodyDto

  @ApiPropertyOptional({ type: SearchCollectionsBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchCollectionsBodyDto)
  @IsObject()
  @ValidateNested()
  collections?: SearchCollectionsBodyDto

  @ApiPropertyOptional({ type: SearchUsersBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchUsersBodyDto)
  @IsObject()
  @ValidateNested()
  users?: SearchUsersBodyDto
}

export { SearchBodyDto }
