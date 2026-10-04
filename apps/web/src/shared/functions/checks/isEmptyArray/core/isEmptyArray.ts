import { isArray } from '../../isArray'

const isEmptyArray = (value: unknown) => {
  return isArray(value) && value.length === 0
}

export { isEmptyArray }
