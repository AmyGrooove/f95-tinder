import type { IStructuredExceptionResponse } from "./IStructuredExceptionResponse"

interface IErrorEnvelope {
  error: IStructuredExceptionResponse & {
    requestId: string
  }
}

export type { IErrorEnvelope }
