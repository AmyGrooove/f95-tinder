import type {
  ApiErrorCode,
  ApiErrorResponse,
} from '@f95/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'unknown_error',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiErrorResponse>;

  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  );
}

export function normalizeApiError(
  status: number,
  payload: unknown,
): ApiError {
  if (isApiErrorResponse(payload)) {
    return new ApiError(status, payload.code, payload.message);
  }

  return new ApiError(status, 'unknown_error', 'The request failed');
}
