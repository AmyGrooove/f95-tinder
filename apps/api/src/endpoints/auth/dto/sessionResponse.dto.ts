import type {
  SessionResponse,
  TokenResponse,
} from '@f95/contracts';

export class SessionResponseDto implements SessionResponse {
  userId!: string;
}

export class TokenResponseDto implements TokenResponse {
  token!: string;
}
