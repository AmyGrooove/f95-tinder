import type { TErrorCode } from './TErrorCode'

interface IApiErrorResponse {
  code: TErrorCode
  message: string
  details: Record<string, unknown> | null
}

export type { IApiErrorResponse }
