import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../../infrastructure/config/config.service';
import { F95IntegrationError } from '../errors/f95Integration.error';
import { buildLatestUrl } from '../functions/buildLatestUrl';
import {
  isF95LatestResponse,
  type F95LatestResponse,
} from '../types/f95LatestResponse';

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

@Injectable()
export class F95LatestClient {
  private readonly logger = new Logger(F95LatestClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchPage(
    page: number,
    signal?: AbortSignal,
  ): Promise<F95LatestResponse> {
    const requestController = new AbortController();
    let callerAborted = signal?.aborted ?? false;
    let timedOut = false;
    const abortFromCaller = () => {
      callerAborted = true;
      requestController.abort(signal?.reason);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      signal?.removeEventListener('abort', abortFromCaller);
      requestController.abort();
    }, this.configService.f95RequestTimeoutMs);
    timeout.unref();

    if (signal?.aborted) {
      requestController.abort(signal.reason);
    } else {
      signal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      let response: Response;

      try {
        response = await fetch(buildLatestUrl(page), {
          headers: { accept: 'application/json' },
          signal: requestController.signal,
        });
      } catch (error) {
        if (callerAborted) {
          throw error;
        }

        if (timedOut) {
          throw this.createError(
            'request_timeout',
            'F95 latest request timed out',
            page,
            null,
            null,
            error,
          );
        }

        throw this.createError(
          'network_error',
          'F95 latest request failed',
          page,
          null,
          null,
          error,
        );
      }

      if (response.status === 429) {
        throw this.createError(
          'rate_limited',
          'F95 latest request was rate limited',
          page,
          response.status,
          parseRetryAfter(response.headers.get('retry-after')),
        );
      }

      if (!response.ok) {
        throw this.createError(
          'network_error',
          `F95 latest request failed with status ${response.status}`,
          page,
          response.status,
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch (error) {
        if (callerAborted) {
          throw error;
        }

        if (timedOut) {
          throw this.createError(
            'request_timeout',
            'F95 latest request timed out',
            page,
            response.status,
            null,
            error,
          );
        }

        throw this.createError(
          'invalid_response',
          'F95 latest response is not valid JSON',
          page,
          response.status,
          null,
          error,
        );
      }

      if (!isF95LatestResponse(payload)) {
        throw this.createError(
          'invalid_response',
          'F95 latest response has an unexpected shape',
          page,
          response.status,
        );
      }

      return payload;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private createError(
    code: F95IntegrationError['code'],
    message: string,
    page: number,
    statusCode: number | null,
    retryAfterMilliseconds: number | null = null,
    cause?: unknown,
  ): F95IntegrationError {
    this.logger.warn({
      event: 'f95_request_failed',
      errorCode: code,
      page,
      statusCode,
    });

    return new F95IntegrationError(
      code,
      message,
      retryAfterMilliseconds,
      cause === undefined ? undefined : { cause },
      {
        page,
        statusCode: statusCode ?? undefined,
      },
    );
  }
}
