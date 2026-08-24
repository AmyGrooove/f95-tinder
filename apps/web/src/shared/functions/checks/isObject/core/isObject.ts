import { isNil } from '../../isNil'

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && !isNil(value) && !Array.isArray(value)
}

export { isObject }
