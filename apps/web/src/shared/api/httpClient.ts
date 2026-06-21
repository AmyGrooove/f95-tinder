import { clearToken, getToken } from '../../entities/session/model/tokenStorage';
import { normalizeApiError } from './apiError';
import { queryClient } from './queryClient';

type RequestOptions<TBody> = Omit<RequestInit, 'body'> & {
  body?: TBody;
};

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');

  if (response.status === 204) {
    return undefined;
  }

  if (contentType?.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

async function request<TResponse, TBody = never>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const token = getToken();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api/${path.replace(/^\/+/, '')}`, {
    ...options,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    headers,
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      queryClient.clear();
    }

    throw normalizeApiError(response.status, payload);
  }

  return payload as TResponse;
}

export const httpClient = {
  delete<TResponse>(path: string): Promise<TResponse> {
    return request<TResponse>(path, { method: 'DELETE' });
  },
  get<TResponse>(path: string): Promise<TResponse> {
    return request<TResponse>(path, { method: 'GET' });
  },
  patch<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    return request<TResponse, TBody>(path, { body, method: 'PATCH' });
  },
  post<TResponse, TBody = never>(
    path: string,
    body?: TBody,
  ): Promise<TResponse> {
    return request<TResponse, TBody>(path, { body, method: 'POST' });
  },
};
