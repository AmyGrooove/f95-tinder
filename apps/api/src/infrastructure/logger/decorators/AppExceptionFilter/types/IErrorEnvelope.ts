import type { IStructuredExceptionResponse } from "./IStructuredExceptionResponse";

interface IErrorEnvelope {
  error: IStructuredExceptionResponse & {
    traceId: string;
  };
}

export type { IErrorEnvelope };
