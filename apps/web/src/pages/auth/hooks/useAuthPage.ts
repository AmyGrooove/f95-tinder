import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  sessionQueryKey,
  useSessionQuery,
} from '../../../entities/session/api/session.queries';
import {
  getToken,
  setToken,
  subscribeToToken,
} from '../../../entities/session/model/tokenStorage';
import { ApiError } from '../../../shared/api/apiError';
import { queryClient } from '../../../shared/api/queryClient';
import { routes } from '../../../app/router/routes';
import {
  useCreateUserMutation,
  useVerifyTokenMutation,
} from '../api/auth.mutations';

type AuthLocationState = {
  from?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Unable to authenticate. Please try again.';
}

export function useAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSyncExternalStore(subscribeToToken, getToken, () => null);
  const [tokenInput, setTokenInput] = useState('');
  const createUserMutation = useCreateUserMutation();
  const verifyTokenMutation = useVerifyTokenMutation();
  const sessionQuery = useSessionQuery(
    Boolean(token) && !verifyTokenMutation.isPending,
  );
  const redirectPath =
    (location.state as AuthLocationState | null)?.from ?? routes.swipe;

  useEffect(() => {
    if (token && sessionQuery.isSuccess) {
      navigate(redirectPath, { replace: true });
    }
  }, [
    navigate,
    redirectPath,
    sessionQuery.isSuccess,
    token,
  ]);

  const createUser = () => {
    createUserMutation.mutate(undefined, {
      onSuccess: ({ token: createdToken, userId }) => {
        setToken(createdToken);
        queryClient.setQueryData(sessionQueryKey, { userId });
        navigate(redirectPath, { replace: true });
      },
    });
  };

  const restoreSession = () => {
    const normalizedToken = tokenInput.trim();

    if (!normalizedToken) {
      return;
    }

    verifyTokenMutation.mutate(normalizedToken, {
      onSuccess: (session) => {
        queryClient.setQueryData(sessionQueryKey, session);
        navigate(redirectPath, { replace: true });
      },
    });
  };

  const error =
    createUserMutation.error ??
    verifyTokenMutation.error ??
    (sessionQuery.isError ? sessionQuery.error : null);

  return {
    createUser,
    errorMessage: error ? getErrorMessage(error) : null,
    isCreating: createUserMutation.isPending,
    isRestoring: verifyTokenMutation.isPending,
    restoreSession,
    setTokenInput,
    tokenInput,
  };
}
