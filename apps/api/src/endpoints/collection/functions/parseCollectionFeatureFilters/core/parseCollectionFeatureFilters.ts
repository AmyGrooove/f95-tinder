import { plainToInstance } from "class-transformer"

import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

import { CollectionFeatureFilterQueryDto } from "../../../dto/query/collectionFeatureFilter.query"

const parseCollectionFeatureFilters = (value: unknown) => {
  if (!isString(value)) {
    return value
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return value
    }

    throw error
  }

  return isArray(parsed)
    ? plainToInstance(CollectionFeatureFilterQueryDto, parsed)
    : value
}

export { parseCollectionFeatureFilters }
