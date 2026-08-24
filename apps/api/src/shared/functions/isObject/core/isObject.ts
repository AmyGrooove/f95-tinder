import { isNil } from "../../isNil"

const isObject = (value: unknown): value is object => {
  return typeof value === "object" && !isNil(value)
}

export { isObject }
