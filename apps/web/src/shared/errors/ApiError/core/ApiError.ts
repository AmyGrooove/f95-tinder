import type { IApiErrorProps } from '../types/IApiErrorProps'
import type { TErrorCode } from '../types/TErrorCode'

class ApiError extends Error {
  readonly code: TErrorCode
  readonly details: Record<string, unknown> | null
  readonly status: number

  constructor(props: IApiErrorProps) {
    super(props.message)

    this.name = 'ApiError'
    this.code = props.code
    this.details = props.details
    this.status = props.status
  }
}

export { ApiError }
