import type {
  CreateUserResponse,
  SessionResponse,
} from '@f95/contracts';
import { useMutation } from '@tanstack/react-query';

import {
  clearToken,
  setToken,
} from '../../../entities/session/model/tokenStorage';
import { httpClient } from '../../../shared/api/httpClient';

export function useCreateUserMutation() {
  return useMutation({
    mutationFn: () =>
      httpClient.post<CreateUserResponse>('auth/createUser'),
  });
}

export function useVerifyTokenMutation() {
  return useMutation({
    mutationFn: async (token: string) => {
      setToken(token);

      try {
        return await httpClient.get<SessionResponse>('auth/session');
      } catch (error) {
        clearToken();
        throw error;
      }
    },
  });
}
