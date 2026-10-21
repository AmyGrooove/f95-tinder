# Observability and errors

Read for logs, request correlation, exception responses or shared execution context. Dependency health is documented in [runtime](runtime.md).

[requestContext](../../src/shared/functions/context/requestContext/core/requestContext.ts) wraps AsyncLocalStorage with `run`, `get`, `getAll` and `set`. [Bootstrap](../../src/main.ts) creates an HTTP context containing Fastify request ID, method and URL path without query parameters. `set` changes only an existing context; it does not create one for background execution.

[LoggerService](../../src/infrastructure/logger/services/logger.service.ts) exposes `info`, `warn` and `error`. It emits one JSON record per line to stdout for info/warn and stderr for errors. Records include timestamp, app name, environment, context, request metadata, optional job ID/data and normalized error. The active request ID takes priority over explicitly supplied request ID.

[redactLogValue](../../src/infrastructure/logger/functions/redactLogValue/core/redactLogValue.ts) masks keys matching password/token/authorization/cookie/secret/API-key patterns, handles circular references and serializes bigint/date values. This is key-based redaction, not a guarantee that arbitrary message strings are secret-free. Keep sensitive data out of messages and metadata.

[AppExceptionFilter](../../src/infrastructure/logger/decorators/AppExceptionFilter/core/AppExceptionFilter.ts) is registered globally through AppModule's `APP_FILTER`. It uses HttpException status or 500 for unknown exceptions and responds with `{ error: { code, message, details, requestId } }`. Only statuses at least 500 trigger automatic error logging.

[createStructuredResponse](../../src/infrastructure/logger/decorators/AppExceptionFilter/functions/createStructuredResponse/core/createStructuredResponse.ts) preserves explicitly structured HTTP error responses, converts validation message arrays into validation details and maps ordinary HTTP statuses through existing constants. Unknown exceptions receive the generic internal-error message with null details. Inspect these helpers before introducing endpoint-specific envelopes or exposing exception internals.
