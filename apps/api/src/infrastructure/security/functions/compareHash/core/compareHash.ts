import { compare } from "bcryptjs"

const compareHash = async (value: string, hashedValue: string) => {
  return compare(value, hashedValue)
}

export { compareHash }
