import { ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsObject,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { EItemType } from "@entities/item/schemas/EItemType"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { ValueFilterProperty } from "../../decorators/ValueFilterProperty"
import { ELanguage } from "../../schemas/ELanguage"
import { ESort } from "../../types/ESort"
import { ESortDirection } from "../../types/ESortDirection"
import type { ValueFilter } from "../../types/ValueFilter"
import { RatingRangeDto } from "../body/ratingRange.body"

const isProvided = (_object: unknown, value: unknown) => !isUndefined(value)
const MAX_CURSOR_LENGTH = 256
const itemTypeCount = Object.values(EItemType).length

class QueryFieldsDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 200 })
  @Transform(({ value }: TransformFnParams) =>
    isString(value) ? value.trim() : value,
  )
  @ValidateIf(isProvided)
  @IsString()
  @Length(1, 200)
  search?: string

  @ApiPropertyOptional({
    enum: EItemType,
    isArray: true,
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf(isProvided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(itemTypeCount)
  @ArrayUnique()
  @IsEnum(EItemType, { each: true })
  types?: EItemType[]

  @ValueFilterProperty({ values: [...USER_ITEM_LIBRARY_STATUSES, "outside"] })
  statuses?: ValueFilter<TLibraryStatus | "outside">

  @ApiPropertyOptional({ type: RatingRangeDto })
  @ValidateIf(isProvided)
  @IsObject()
  @Type(() => RatingRangeDto)
  @ValidateNested()
  rating?: RatingRangeDto

  @ApiPropertyOptional({ enum: ESort })
  @ValidateIf(isProvided)
  @IsEnum(ESort)
  sort?: ESort

  @ApiPropertyOptional({ enum: ESortDirection })
  @ValidateIf(isProvided)
  @IsEnum(ESortDirection)
  direction?: ESortDirection

  @ApiPropertyOptional({ enum: ELanguage })
  @ValidateIf(isProvided)
  @IsEnum(ELanguage)
  language?: ELanguage

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50] })
  @ValidateIf(isProvided)
  @IsIn([10, 20, 50])
  limit?: TPageSize

  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: MAX_CURSOR_LENGTH,
  })
  @ValidateIf(isProvided)
  @IsString()
  @Length(1, MAX_CURSOR_LENGTH)
  cursor?: string
}

export { MAX_CURSOR_LENGTH, QueryFieldsDto }
