import { ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsObject,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { isString } from "@shared/functions/checks/isString"

const TAG_GROUP_VALUES = [...Object.values(ETagGroup), null]

class TagGroupBodyDto {
  @ApiPropertyOptional({
    enum: TAG_GROUP_VALUES,
    isArray: true,
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  allOf?: (ETagGroup | null)[]

  @ApiPropertyOptional({
    enum: TAG_GROUP_VALUES,
    isArray: true,
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  anyOf?: (ETagGroup | null)[]

  @ApiPropertyOptional({
    enum: TAG_GROUP_VALUES,
    isArray: true,
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  noneOf?: (ETagGroup | null)[]
}

class TagsBodyDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 200 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim() : value,
  )
  @IsString()
  @Length(1, 200)
  search?: string

  @ApiPropertyOptional({ type: TagGroupBodyDto })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => TagGroupBodyDto)
  @IsObject()
  @ValidateNested()
  group?: TagGroupBodyDto

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 50 })
  @IsIn([10, 20, 50])
  limit: TPageSize = 50

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 256 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 256)
  cursor?: string
}

export { TagsBodyDto }
