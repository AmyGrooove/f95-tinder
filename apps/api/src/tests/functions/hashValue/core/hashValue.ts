import { hashValue as hash } from "@infrastructure/security/functions/hashValue/index"

const hashValue = async (value: string, rounds = 4) => {
  return hash(value, rounds)
}

export { hashValue }
