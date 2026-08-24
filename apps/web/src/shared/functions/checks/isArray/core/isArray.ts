const isArray = <TValue = unknown>(value: unknown): value is TValue[] => {
  return Array.isArray(value)
}

export { isArray }
