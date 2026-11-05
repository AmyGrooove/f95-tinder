import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  IsInt,
  IsIn,
  IsString,
  Length,
  Max,
  Min,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import type { IPagePagination } from "@infrastructure/database/types/IPaginationInput"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import {
  SearchItemsBodyDto,
  SearchUsersBodyDto,
  SearchCollectionsBodyDto,
} from "./searchOptions.body"

class SearchBodyDto implements IPagePagination {
  @ApiPropertyOptional({ type: SearchItemsBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchItemsBodyDto)
  @IsObject()
  @ValidateNested()
  items?: SearchItemsBodyDto

  @ApiPropertyOptional({ type: SearchUsersBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchUsersBodyDto)
  @IsObject()
  @ValidateNested()
  users?: SearchUsersBodyDto

  @ApiPropertyOptional({ type: SearchCollectionsBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => SearchCollectionsBodyDto)
  @IsObject()
  @ValidateNested()
  collections?: SearchCollectionsBodyDto

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
    type: Number,
    minimum: 1,
    maximum: 10_000,
    default: 1,
    description: SWAGGER_DICTIONARY.search.page,
  })
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1

  @ApiPropertyOptional({
    type: Number,
    enum: [10, 20, 50],
    default: 50,
    description: SWAGGER_DICTIONARY.search.limit,
  })
  @IsInt()
  @IsIn([10, 20, 50])
  limit: TPageSize = 50
}

export { SearchBodyDto }
