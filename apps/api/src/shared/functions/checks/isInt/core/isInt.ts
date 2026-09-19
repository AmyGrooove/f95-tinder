const isInt = (value: unknown): value is number => {
  return typeof value === "number" && Number.isInteger(value)
}

export { isInt }
