import {
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  userId: string;
}

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.userId;
  },
);
