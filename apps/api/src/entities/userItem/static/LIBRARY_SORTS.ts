import { ESort } from "@entities/shared/types/ESort"

const LIBRARY_SORTS = [
  ESort.UPDATED_AT,
  ESort.CREATED_AT,
  ESort.TITLE,
  ESort.RATING,
] as const

export { LIBRARY_SORTS }
