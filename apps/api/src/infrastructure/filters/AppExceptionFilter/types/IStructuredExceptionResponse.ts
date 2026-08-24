import type { TErrorCode } from "./TErrorCode"

interface IStructuredExceptionResponse {
  code: TErrorCode;
  message: string;
  details: Record<string, unknown> | unknown[] | null;
}

export type { IStructuredExceptionResponse };
