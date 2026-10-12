import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

const isDate = (value: unknown): value is Date => {
  return value instanceof Date && isFiniteNumber(value.getTime())
}

export { isDate }
