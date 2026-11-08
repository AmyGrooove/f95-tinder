import { hash } from "bcryptjs"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const hashValue = async (value: string, rounds = 12) => {
  if (!isInt(rounds) || !isNonNegativeSafe(rounds) || rounds <= 0) {
    throw new RangeError(DICTIONARY.security.invalidBcryptRounds)
  }

  return hash(value, rounds)
}

export { hashValue }
