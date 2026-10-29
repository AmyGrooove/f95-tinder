# Data and errors

## HTTP entrypoint

Reuse [fetchData](../src/shared/functions/api/fetchData/index.ts) for the existing JSON transport contract; its [implementation](../src/shared/functions/api/fetchData/core/fetchData.ts) accepts [IFetchDataProps](../src/shared/functions/api/fetchData/types/IFetchDataProps.ts): `path`, optional `body`, `method`, `query` and `signal`.

- Defaults to GET. Supported method literals are DELETE, GET, PATCH and POST; custom `QUERY` is not currently part of this interface.
- Reads `ENV.API_URL`, removes trailing slashes, appends `/v1` and normalizes the leading slash of `path`. Missing or empty API_URL throws an ordinary Error before fetching.
- Omits null/undefined query values, joins array values with commas and serializes other values through `URLSearchParams`.
- JSON-serializes non-null bodies and sets Content-Type only for those bodies. Passes the AbortSignal through to fetch.
- Returns `undefined` for status 204; otherwise returns parsed JSON as the requested generic response type. The generic is not runtime response validation.
- The request options do not explicitly set credentials, authorization headers, caching or cookie forwarding. Inspect the required authentication and server/client boundary before connecting a consumer.

[ENV](../src/shared/static/ENV.ts) currently reads `process.env.API_URL`. Neither this module nor [next.config.ts](../next.config.ts) configures a public client variable or proxy. Do not assume browser access to that value when introducing client-side requests. The current source search finds no application consumer of `fetchData` beyond its public export.

## Error contract

Non-OK HTTP responses throw [ApiError](../src/shared/errors/ApiError/index.ts), whose [class](../src/shared/errors/ApiError/core/ApiError.ts) retains `code`, `details`, `status` and Error's `message`.

The helper accepts an error body only when its code belongs to [ERROR_CODES](../src/shared/errors/ApiError/static/ERROR_CODES.ts), message is a string, and details is null or an object. Invalid or unreadable error bodies fall back to `INTERNAL_ERROR`, null details and `Network error: <status>`. Fetch failures themselves are not converted into ApiError.

## Query cache

[QueryProvider](../src/providers/QueryProvider/core/QueryProvider.tsx) supplies one QueryClient per mounted provider, created through lazy React state in [useQueryProvider](../src/providers/QueryProvider/core/useQueryProvider.ts). QueryCache and MutationCache error handlers log failures; they do not display toast notifications.

[QUERY_DEFAULT_OPTIONS](../src/providers/QueryProvider/static/QUERY_DEFAULT_OPTIONS.ts) sets query stale time to one minute, garbage collection to ten minutes, one query retry and zero mutation retries. Reuse this provider rather than creating another cache implicitly. The current source has provider wiring but no product `useQuery`/`useMutation` consumers.

## Shared helpers

Reuse public entrypoints under [checks](../src/shared/functions/checks) for type/nil/empty checks, [cn](../src/shared/functions/utility/cn/index.ts) for class composition, and [formatDateLabel](../src/shared/functions/format/formatDateLabel/index.ts) for displayed dates. Date formatting returns `DD.MM.YYYY` or `DICTIONARY.common.dateNotSpecified`; its implementation also rejects invalid calendar-date prefixes in strings.
