const isNonNegativeSafe = (value: unknown): value is number => {
  return (
    typeof value === "number" && value >= 0 && value <= Number.MAX_SAFE_INTEGER
  )
}

export { isNonNegativeSafe }
