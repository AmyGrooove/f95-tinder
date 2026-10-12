# Runtime and configuration

Read for startup, configuration, health, HTTP policy or build changes. Return to [the map](index.md) for integration-specific contracts.

## HTTP entrypoint

[main.ts](../../src/main.ts) creates the Fastify Nest application and listens on `app.port` at `0.0.0.0`. Proxy trust is limited to loopback, link-local and unique-local addresses. Helmet is registered; CSP is removed for `/docs` and its nested/query routes.

Swagger is mounted at `/docs`, with bearer scheme `authToken`. URI versioning is enabled without a default version; the [health controller](../../src/infrastructure/health/controllers/health.controller.ts) has no version metadata. There is no global route prefix in bootstrap.

Global validation transforms input, whitelists DTO fields and rejects non-whitelisted fields. Multipart limits allow one file up to 25 MiB, 20 fields, 64 KiB per field and 21 parts. Image processing applies additional limits; see [storage](storage.md).

CORS allows origins dynamically outside production and uses configured origins in production, with credentials enabled. Shutdown hooks are enabled. Request metadata is initialized before handling; see [observability](observability.md).

## Configuration authority

[InfrastructureConfigModule](../../src/infrastructure/config/config.module.ts) loads a global, cached Nest configuration namespace. Consumers use [InfrastructureConfigService](../../src/infrastructure/config/services/config.service.ts), whose sections are `app`, `database`, `redis`, `jwt`, `storage`, `search` and `mail`. The derived [configuration type](../../src/infrastructure/config/types/TInfrastructureConfiguration.ts) follows the factory return type.

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

All listed variables except `NODE_ENV` are required by the configuration factory. `NODE_ENV` defaults to `development` and accepts only `development` or `production`. JWT secrets must each contain at least 32 characters. The app helper validates the name, semantic version, port and comma-separated HTTP(S) CORS origins; production forbids `*`. Redis parsing extracts database, credentials and TLS from its URL. Do not document or copy actual secret values.

`APP_NAME` also identifies the storage bucket, queue prefix, cache namespace and JWT issuer/audience prefix. Changing it affects several integrations, not only display metadata.

## Health and initialization

[HealthController](../../src/infrastructure/health/controllers/health.controller.ts) exposes `GET /health` and `GET /health/live`. Liveness returns `{ status: "ok" }` without checking dependencies. [HealthService](../../src/infrastructure/health/services/health.service.ts) checks database, cache, jobs, mail, scheduler, search and storage through Terminus. Each check races a 1,500 ms timeout; errors or timeout produce a down indicator. This race does not cancel the underlying dependency operation.

Storage checks/initializes its bucket during module initialization; search rejects application bootstrap if Meilisearch is unavailable. [SchedulerHealthService](../../src/infrastructure/scheduler/services/schedulerHealth.service.ts) records a ten-minute cron heartbeat and measures elapsed time from startup until the first heartbeat. It is not a distributed scheduling lock.

## Persistence startup boundary

AppModule now imports 26 entity modules. DatabaseModule still uses autoIndex:true, so bootstrapping the application may apply schema index declarations. P1 was checked statically with no application context or service connections; use separately approved isolated targets before runtime, and never infer permission to migrate existing indexes/data from schema changes. No automatic TTL or cleanup was added.

## Tooling

[package.json](../../package.json) defines `dev` (`nest start --watch`), `build` (`nest build`), `start` (`node dist/main.js`) and `type-check` (`tsc --noEmit`). `tunnel` runs the local tunnel script with `.env.tunnel`; it is not needed for routine source verification. `lint:fix` and `format` operate on the entire package and write changes.

[nest-cli.json](../../nest-cli.json) selects Rspack. [tsconfig.json](../../tsconfig.json) uses strict TypeScript, ESNext modules, Bundler resolution, ES2023 and decorator metadata, with `@infrastructure/*`, `@shared/*`, `@entities/*` and `@endpoints/*` aliases. Do not infer runtime behavior from type checking or a successful build.
