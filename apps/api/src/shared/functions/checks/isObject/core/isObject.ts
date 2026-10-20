import { isNil } from "@shared/functions/checks/isNil"

const isObject = (value: unknown) => {
  return typeof value === "object" && !isNil(value)
}

export { isObject }
