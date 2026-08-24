import { randomInt } from "node:crypto"

const generateNumericCode = (length: number): string => {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError("Code length must be a positive safe integer")
  }

  return Array.from({ length }, () => {
    return randomInt(0, 10).toString()
  }).join("")
}

export { generateNumericCode }
