# Runtime and configuration

Read for startup, configuration, health, HTTP policy or build changes. Return to [the map](index.md) for integration-specific contracts.

## HTTP entrypoint

[main.ts](../../src/main.ts) creates the Fastify Nest application and listens on `app.port` at `0.0.0.0`. Shared HTTP setup lives in [configureApplication](../../src/app/functions/configureApplication/index.ts), reused by the integration-test application: CSRF, multipart, Helmet, request context, CORS, URI versioning and validation. Proxy trust is limited to loopback, link-local and unique-local addresses. CSP is removed for `/docs` and its nested/query routes.

Swagger is mounted at `/docs`, with bearer scheme `authToken` and cookie schemes `accessCookie` / `refreshCookie`. URI versioning is enabled without a default version; current health, account and auth controllers have no version metadata. There is no global route prefix.

Global validation transforms input, whitelists DTO fields and rejects non-whitelisted fields. Multipart limits allow one file up to 25 MiB, 20 fields, 64 KiB per field and 21 parts. Image processing applies additional limits; see [storage](storage.md).

[AppModule](../../src/app/app.module.ts) imports AuthModule and AccountModule. Their controllers implement all 20 routes in [the account/auth specification](../../../../docs/accountAndAuthSpec.md); see [security](security.md) for cookie authorization and session contracts. The current endpoint tree contains only auth and account slices.

[SourceModule](../../src/entities/source/source.module.ts) provides reusable source services, but no movie collection handler, collection/status endpoint or importer currently invokes them. Film classification, ban enforcement, incremental/full collection, scheduling and prepared-package application still require an application scenario.

[PageCollectorService.collect](../../src/entities/source/services/pageCollector.service.ts) loops through caller-defined page state, checks cooperative cancellation, rejects repeated state keys and returns the processed-page count and stop/completion reason. [SourceDataWriterService](../../src/entities/source/services/sourceDataWriter.service.ts) builds `sources/<sourceKey>/<scope>/<jobId>/attempt-<attempt>` paths and uploads numbered JSON pages and a caller-provided manifest to S3. It does not decide collection completeness, filter films or register a job.

[SourceModule](../../src/entities/source/source.module.ts) exports SourceRepository, PageCollectorService, KodikService and SourceDataWriterService, and imports StorageModule. [KodikService](../../src/entities/source/services/kodik.service.ts) exposes `getSource`, `list`, `search`, `findById` and `serializePage`. Its named HTTP client uses a 30-second timeout, disabled retries and rejected redirects. It validates the response envelope and material identity, preserves extra source fields, restricts pagination URLs to the Kodik origin and `/list`, and sanitizes tokens in serialized pages and job errors. Array parameters are serialized as comma-separated values and false values are retained.

CORS allows origins dynamically outside production and uses configured origins in production, with credentials enabled. Shutdown hooks are enabled. Request metadata is initialized before handling; see [observability](observability.md).

Bootstrap enables NestJS `enableCsrfProtection()` for the application before registering request hooks and before listening. It checks Fetch Metadata with an Origin/Host fallback for state-changing requests. Explicit `CORS_ORIGINS` entries are also passed as `trustedOrigins`; a development `*` entry is omitted because CSRF trust requires exact origins. Development CORS reflection does not grant CSRF trust. There are no route exclusions or required `X-Requested-With` headers.

## Configuration authority

`KodikService.getSource()` reads the Source with key `kodik` through SourceRepository and throws 404 if it is absent. A future collection scenario must establish that source before using its identity in stored artifacts and catalogue bindings.

[HttpModule](../../src/infrastructure/http/http.module.ts) is imported by AppModule and configures `@nestjs/http-client` application-wide defaults: a 10-second timeout per attempt and disabled retries. It does not register a client; consumers register clients through `HttpClientModule.register()` or `registerAsync()`. Existing direct `fetch` calls are unaffected.

[InfrastructureConfigModule](../../src/infrastructure/config/config.module.ts) loads a global, cached Nest configuration namespace. It skips `.env` loading when `NODE_ENV=test`; the test application overrides the configuration namespace with isolated container addresses and test values. Consumers use [InfrastructureConfigService](../../src/infrastructure/config/services/config.service.ts), whose sections are `app`, `database`, `redis`, `jwt`, `storage`, `search`, `mail` and `sources`. The derived [configuration type](../../src/infrastructure/config/types/TInfrastructureConfiguration.ts) follows the factory return type.

[createInfrastructureConfiguration](../../src/infrastructure/config/functions/createInfrastructureConfiguration/core/createInfrastructureConfiguration.ts) and its nested helpers define the current environment contract:

| Section | Variables                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------ |
| App     | `NODE_ENV`, `APP_NAME`, `APP_VERSION`, `APP_DESCRIPTION`, `PORT`, `CORS_ORIGINS`                       |
| MongoDB | `MONGO_URL`                                                                                            |
| Redis   | `REDIS_URL`                                                                                            |
| JWT     | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                              |
| Storage | `GARAGE_URL`, `GARAGE_REGION`, `GARAGE_ACCESS_KEY_ID`, `GARAGE_SECRET_ACCESS_KEY`, `GARAGE_PUBLIC_URL` |
| Search  | `MEILISEARCH_URL`, `MEILISEARCH_ACCESS_SECRET`                                                         |
| Mail    | `RESEND_ACCESS_SECRET`, `MAIL_DOMAIN`                                                                  |
| Sources | `KODIK_API_TOKEN` (available as `sources.kodikApiToken`)                                               |

All listed variables except `NODE_ENV` are required by the configuration factory. `NODE_ENV` defaults to `development` and accepts only `development` or `production`. JWT secrets must each contain at least 32 characters. The app helper validates the name, semantic version, port and comma-separated HTTP(S) CORS origins; production forbids `*`. Redis parsing extracts database, credentials and TLS from its URL. Do not document or copy actual secret values.

`APP_NAME` also identifies the storage bucket, queue prefix, cache namespace and JWT issuer/audience prefix. Changing it affects several integrations, not only display metadata.

## Health and initialization

[HealthController](../../src/infrastructure/health/controllers/health.controller.ts) exposes `GET /health` and `GET /health/live`. Liveness returns `{ status: "ok" }` without checking dependencies. [HealthService](../../src/infrastructure/health/services/health.service.ts) checks database, cache, jobs, mail, scheduler, search and storage through Terminus. Each check races a 1,500 ms timeout; errors or timeout produce a down indicator. This race does not cancel the underlying dependency operation.

Storage checks/initializes its bucket during module initialization; search rejects application bootstrap if Meilisearch is unavailable. [SchedulerHealthService](../../src/infrastructure/scheduler/services/schedulerHealth.service.ts) records a ten-minute cron heartbeat and measures elapsed time from startup until the first heartbeat. It is not a distributed scheduling lock.

Successful aggregate health responses contain `status`, `error` and `details`; the redundant Terminus `info` field is omitted. Failures still propagate through the existing exception filter.

## Persistence startup boundary

AppModule imports 20 entity modules. DatabaseModule uses `autoIndex: true`, so application startup can apply schema index declarations. Source declarations do not establish deployed indexes or migrate existing data. Session declares a cleanup TTL ten minutes after expiresAt; authorization checks expiry explicitly. No TTL or cleanup job is declared for UserRecommendationState.

## Tooling

[package.json](../../package.json) defines `dev` (`nest start --watch`), `build` (`nest build`), `start` (`node dist/main.js`) and `type-check` (`tsc --noEmit`). `tunnel` runs the local tunnel script with `.env.tunnel`; it is not needed for routine source verification. `lint:fix` and `format` operate on the entire package and write changes.

[nest-cli.json](../../nest-cli.json) selects Rspack. [tsconfig.json](../../tsconfig.json) uses strict TypeScript, ESNext modules, Bundler resolution, ES2023 and decorator metadata, with `@infrastructure/*`, `@shared/*`, `@entities/*` and `@endpoints/*` aliases. Do not infer runtime behavior from type checking or a successful build.
