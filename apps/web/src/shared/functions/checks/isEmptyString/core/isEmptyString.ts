import { isString } from '../../isString'

const isEmptyString = (value: unknown): boolean => {
  return isString(value) && value.trim().length === 0
}

export { isEmptyString }
