import { hash } from "bcryptjs"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const hashValue = async (value: string, rounds = 12) => {
  if (!Number.isSafeInteger(rounds) || rounds <= 0) {
    throw new RangeError(DICTIONARY.security.invalidBcryptRounds)
  }

  return hash(value, rounds)
}

export { hashValue }
