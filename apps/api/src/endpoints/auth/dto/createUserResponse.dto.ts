import type { CreateUserResponse } from '@f95/contracts';

export class CreateUserResponseDto implements CreateUserResponse {
  userId!: string;
  token!: string;
}
