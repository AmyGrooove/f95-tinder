interface IValueFilter<T> {
  allOf?: readonly T[]
  anyOf?: readonly T[]
  noneOf?: readonly T[]
}

export type { IValueFilter as ValueFilter }
