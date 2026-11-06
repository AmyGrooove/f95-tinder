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
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { ITransformProps } from "@endpoints/shared/types/ITransformProps"

const TAG_GROUP_VALUES = [...Object.values(ETagGroup), null]

class TagGroupBodyDto implements IValueFilter<ETagGroup | null> {
  @ApiPropertyOptional({
    type: "array",
    items: { type: ["string", "null"], enum: TAG_GROUP_VALUES },
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  allOf?: (ETagGroup | null)[]

  @ApiPropertyOptional({
    type: "array",
    items: { type: ["string", "null"], enum: TAG_GROUP_VALUES },
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  anyOf?: (ETagGroup | null)[]

  @ApiPropertyOptional({
    type: "array",
    items: { type: ["string", "null"], enum: TAG_GROUP_VALUES },
    minItems: 1,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(TAG_GROUP_VALUES, { each: true })
  noneOf?: (ETagGroup | null)[]
}

class TagsBodyDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 200 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Transform((props: ITransformProps) => {
    const { value } = props

    return isString(value) ? value.trim() : value
  })
  @IsString()
  @Length(1, 200)
  search?: string

  @ApiPropertyOptional({ type: TagGroupBodyDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @Type(() => TagGroupBodyDto)
  @IsObject()
  @ValidateNested()
  group?: TagGroupBodyDto

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 50 })
  @IsIn([10, 20, 50])
  limit: TPageSize = 50

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 256 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsString()
  @Length(1, 256)
  cursor?: string
}

export { TagsBodyDto }
