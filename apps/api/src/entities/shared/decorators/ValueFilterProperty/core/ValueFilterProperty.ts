import { applyDecorators } from "@nestjs/common"
import { ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsMongoId,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { REGEX } from "@shared/static/REGEX"
import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

import type { IValueFilterPropertyOptions } from "../types/IValueFilterPropertyOptions"

const ValueFilterProperty = (options: IValueFilterPropertyOptions) => {
  const { values, maxGroups, description } = options
  const isGrouped = !isUndefined(maxGroups)
  const maxItems = values?.length ?? 100
  const items = isUndefined(values)
    ? { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source }
    : {
        type: values.includes(null) ? ["string", "null"] : "string",
        enum: [...values],
      }
  const arraySchema = {
    type: "array" as const,
    items,
    minItems: 1,
    maxItems,
    uniqueItems: true,
    ...(isUndefined(values) && {
      description: SWAGGER_DICTIONARY.valueFilter.caseInsensitiveIds,
    }),
  }
  const properties = {
    allOf: arraySchema,
    anyOf: arraySchema,
    noneOf: arraySchema,
  }
  const objectSchema = {
    type: "object" as const,
    properties,
    additionalProperties: false,
  }
  class ValueFilterDto {}

  const validateValues = isUndefined(values)
    ? [
        ArrayUnique((value: unknown) =>
          isString(value) ? value.toLowerCase() : value,
        ),
        IsMongoId({ each: true }),
      ]
    : [ArrayUnique(), IsIn(values, { each: true })]

  for (const key of Object.keys(properties)) {
    applyDecorators(
      ValidateIf((_object, value: unknown) => !isUndefined(value)),
      IsArray(),
      ArrayMinSize(1),
      ArrayMaxSize(maxItems),
      ...validateValues,
    )(ValueFilterDto.prototype, key)
  }

  return applyDecorators(
    ApiPropertyOptional(
      isGrouped
        ? {
            type: "array",
            items: objectSchema,
            maxItems: maxGroups,
            description,
          }
        : { ...objectSchema, description },
    ),
    ValidateIf((_object, value: unknown) => !isUndefined(value)),
    ...(isGrouped ? [IsArray(), ArrayMaxSize(maxGroups)] : []),
    IsObject({ each: isGrouped }),
    Type(() => ValueFilterDto),
    ValidateNested({ each: isGrouped }),
  )
}

export { ValueFilterProperty }
