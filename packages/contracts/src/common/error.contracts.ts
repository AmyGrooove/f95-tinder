export type IsoDateTime = string;

export type ApiErrorCode =
  | 'catalog_not_ready'
  | 'invalid_token'
  | 'redis_unavailable'
  | 'invalid_request'
  | 'game_not_found'
  | 'undo_not_available'
  | 'f95_unavailable'
  | 'internal_error';

export interface ApiErrorResponse {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
}
