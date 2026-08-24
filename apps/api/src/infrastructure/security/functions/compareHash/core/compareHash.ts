import { compare } from "bcryptjs"

const compareHash = async (
  value: string,
  hashedValue: string,
): Promise<boolean> => {
  return compare(value, hashedValue)
}

export { compareHash }
