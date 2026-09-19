import { isNil } from "../../isNil"

const isObject = (value: unknown) => {
  return typeof value === "object" && !isNil(value)
}

export { isObject }
