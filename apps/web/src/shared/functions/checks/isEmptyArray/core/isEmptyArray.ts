import { isArray } from '../../isArray'

const isEmptyArray = <TValue = unknown>(value: unknown): value is TValue[] => {
  return isArray<TValue>(value) && value.length === 0
}

export { isEmptyArray }
