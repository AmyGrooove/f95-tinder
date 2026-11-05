interface INormalizedError {
  message: string
  details: Record<string, unknown> | null

  name?: string
  stack?: string
}

export type { INormalizedError }
