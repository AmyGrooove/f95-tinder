export type F95IntegrationErrorCode =
  | 'network_error'
  | 'request_timeout'
  | 'rate_limited'
  | 'invalid_response';

export interface F95IntegrationErrorMetadata {
  page?: number;
  statusCode?: number;
}

export class F95IntegrationError extends Error {
  constructor(
    readonly code: F95IntegrationErrorCode,
    message: string,
    readonly retryAfterMilliseconds: number | null = null,
    options?: ErrorOptions,
    readonly metadata: F95IntegrationErrorMetadata = {},
  ) {
    super(message, options);
    this.name = F95IntegrationError.name;
  }
}
