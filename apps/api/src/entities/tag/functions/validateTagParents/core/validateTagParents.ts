import { isObjectIdOrHexString, Types } from "mongoose"

import { checkIsUniqueObjectIdArray } from "@entities/shared/functions/checks/checkIsUniqueObjectIdArray"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IValidateTagParentsProps } from "../types/IValidateTagParentsProps"

const validateTagParents = (props: IValidateTagParentsProps) => {
  const { id, parents } = props

  if (isUndefined(parents)) {
    return
  }

  if (
    !isArray(parents) ||
    !parents.every((parent) => isObjectIdOrHexString(parent))
  ) {
    throw new Error(DICTIONARY.tag.invalidParents)
  }

  const parentIds = parents.map((parent) => new Types.ObjectId(String(parent)))

  if (!checkIsUniqueObjectIdArray(parentIds)) {
    throw new Error(DICTIONARY.tag.duplicateParents)
  }

  if (parentIds.some((parent) => parent.equals(String(id)))) {
    throw new Error(DICTIONARY.tag.selfParent)
  }
}

export { validateTagParents }
