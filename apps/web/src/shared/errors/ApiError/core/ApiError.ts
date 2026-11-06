import type { IApiErrorProps } from '../types/IApiErrorProps'
import type { TErrorCode } from '../types/TErrorCode'

class ApiError extends Error {
  readonly code: TErrorCode
  readonly details: Record<string, unknown> | null
  readonly status: number

  constructor(props: IApiErrorProps) {
    const { message, code, details, status } = props

    super(message)

    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

export { ApiError }
