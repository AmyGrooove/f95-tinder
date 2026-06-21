export type CreateUserRequest = Record<string, never>;

export interface CreateUserResponse {
  userId: string;
  token: string;
}

export interface SessionResponse {
  userId: string;
}

export interface TokenResponse {
  token: string;
}
