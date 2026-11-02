interface IValueFilter<TValue> {
  allOf?: readonly TValue[]
  anyOf?: readonly TValue[]
  noneOf?: readonly TValue[]
}

export type { IValueFilter }
