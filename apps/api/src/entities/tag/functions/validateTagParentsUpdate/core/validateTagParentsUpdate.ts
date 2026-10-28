import { isObjectIdOrHexString } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import { validateTagParents } from "../../validateTagParents"
import type { IValidateTagParentsUpdateProps } from "../types/IValidateTagParentsUpdateProps"

const validateTagParentsUpdate = ({
  id,
  update,
}: IValidateTagParentsUpdateProps) => {
  if (isArray(update)) {
    throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
  }

  if (!isObject(update)) {
    return
  }

  for (const [operator, payload] of Object.entries(update)) {
    const entries: [string, unknown][] =
      operator.startsWith("$") && isObject(payload)
        ? Object.entries(payload)
        : [[operator, payload]]

    for (const [path, value] of entries) {
      if (
        operator === "$rename" &&
        isString(value) &&
        (value === "parents" || value.startsWith("parents."))
      ) {
        throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
      }

      if (path !== "parents" && !path.startsWith("parents.")) {
        continue
      }

      if (
        path !== "parents" ||
        !["parents", "$set", "$setOnInsert"].includes(operator) ||
        !isObjectIdOrHexString(id)
      ) {
        throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
      }

      validateTagParents({ id, parents: value })
    }
  }
}

export { validateTagParentsUpdate }
