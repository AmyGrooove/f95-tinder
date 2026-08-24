interface IGlobalErrorProps {
  error: Error & {
    digest?: string
  }
  reset: () => void
}

export type { IGlobalErrorProps }
