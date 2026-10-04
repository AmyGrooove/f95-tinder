type TFetchDataQueryValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[]
  | null
  | undefined

export type { TFetchDataQueryValue }
