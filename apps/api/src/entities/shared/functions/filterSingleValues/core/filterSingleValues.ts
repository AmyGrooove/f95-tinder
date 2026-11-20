import type { ValueFilter } from "@entities/shared/types/ValueFilter"

const filterSingleValues = <TFilter, T extends TFilter>(
  values: readonly T[],
  filter: ValueFilter<TFilter> = {},
) => {
  const { allOf = [], anyOf, noneOf = [] } = filter

  return values.filter(
    (value) =>
      allOf.every((required) => required === value) &&
      (anyOf?.includes(value) ?? true) &&
      !noneOf.includes(value),
  )
}

export { filterSingleValues }
