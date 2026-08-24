import { randomInt } from "node:crypto"

import { ALPHANUMERIC_CODE_CHARACTERS } from "../static/ALPHANUMERIC_CODE_CHARACTERS"

const generateAlphanumericCode = (length: number): string => {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError("Code length must be a positive safe integer")
  }

  return Array.from({ length }, () => {
    const characterIndex = randomInt(ALPHANUMERIC_CODE_CHARACTERS.length)

    return ALPHANUMERIC_CODE_CHARACTERS[characterIndex]
  }).join("")
}

export { generateAlphanumericCode }
