import type { IApiErrorResponse } from './IApiErrorResponse'

interface IApiErrorProps extends IApiErrorResponse {
  status: number
}

export type { IApiErrorProps }
