import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import type { Types } from "mongoose"

const checkIsUniqueObjectIdArray = (value: Types.ObjectId[]) => {
  return (
    isArray(value) &&
    value.every((entry) => !isNil(entry)) &&
    new Set(value.map(String)).size === value.length
  )
}

export { checkIsUniqueObjectIdArray }
