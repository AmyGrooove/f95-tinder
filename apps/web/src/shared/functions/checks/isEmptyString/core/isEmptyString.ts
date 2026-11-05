import { isString } from '../../isString'

const isEmptyString = (value: unknown) => {
  return isString(value) && value.trim().length === 0
}

export { isEmptyString }
