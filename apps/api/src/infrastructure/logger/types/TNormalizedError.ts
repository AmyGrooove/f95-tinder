type TNormalizedError = {
  message: string

  name?: string
  stack?: string
  details?: Record<string, unknown> | unknown[] | null
}

export type { TNormalizedError }
