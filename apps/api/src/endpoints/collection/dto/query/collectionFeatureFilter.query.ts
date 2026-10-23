import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  Allow,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsMongoId,
  ValidateIf,
} from "class-validator"

import { isUndefined } from "@shared/functions/checks/isUndefined"

class CollectionFeatureFilterQueryDto {
  @ApiProperty({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @IsMongoId()
  featureId: string

  @ApiPropertyOptional({ type: [Boolean] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsBoolean({ each: true })
  values?: boolean[]

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

export { CollectionFeatureFilterQueryDto }
