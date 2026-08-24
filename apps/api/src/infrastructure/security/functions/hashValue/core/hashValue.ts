import { hash } from "bcryptjs"

const hashValue = async (value: string, rounds = 12): Promise<string> => {
  if (!Number.isSafeInteger(rounds) || rounds <= 0) {
    throw new RangeError("Bcrypt rounds must be a positive safe integer")
  }

  return hash(value, rounds)
}

export { hashValue }
