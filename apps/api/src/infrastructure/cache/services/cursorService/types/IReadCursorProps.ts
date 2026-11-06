interface IReadCursorProps<T> {
  cursor: string
  scope: readonly unknown[]
  isPosition: (value: unknown) => value is T
  invalidCursorMessage: string
}

export type { IReadCursorProps }
