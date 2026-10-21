import { isString } from "@shared/functions/checks/isString"

const normalizeEmptyStringToNull = (value: unknown) => {
  return isString(value) && value.trim() === "" ? null : value
}

export { normalizeEmptyStringToNull }
