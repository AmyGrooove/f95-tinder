# Runtime and configuration

Read for startup, configuration, health, HTTP policy or build changes. Return to [the map](index.md) for integration-specific contracts.

## HTTP entrypoint

[main.ts](../../src/main.ts) creates the Fastify Nest application and listens on `app.port` at `0.0.0.0`. Proxy trust is limited to loopback, link-local and unique-local addresses. Helmet is registered; CSP is removed for `/docs` and its nested/query routes.

Swagger is mounted at `/docs`, with bearer scheme `authToken`. URI versioning is enabled without a default version; the [health controller](../../src/infrastructure/health/controllers/health.controller.ts) has no version metadata. There is no global route prefix in bootstrap.

Global validation transforms input, whitelists DTO fields and rejects non-whitelisted fields. Multipart limits allow one file up to 25 MiB, 20 fields, 64 KiB per field and 21 parts. Image processing applies additional limits; see [storage](storage.md).

[KodikMoviesController](../../src/endpoints/kodikMovies/controllers/kodikMovies.controller.ts) предоставляет маршруты без версии: `POST /sources/kodik/movies/collectNew` (202) и `GET /sources/kodik/movies/jobs/:id`. Оба требуют токен доступа администратора. POST не принимает параметры; при дедупликации возвращает существующую активную задачу сбора. DTO статуса содержит состояние и прогресс задачи, номер попытки, временные отметки, необязательную причину ошибки и путь в S3; для задач другого типа возвращается 404. Источник с ключом `kodik` должен уже существовать. Срок хранения статуса определяется настройками очереди; отдельной постоянной коллекции запусков нет. Описания Swagger написаны на русском.

[KodikMoviesService](../../src/endpoints/kodikMovies/services/kodikMovies.service.ts) snapshots Kodik IDs of the ten latest imported, nondeleted movie Items, scans `/list` by `created_at desc` until the first matching ID, and separately rechecks imported `releaseStatus=anons` records through `/search?id=...`. Missing releaseStatus definitions mean no announcements are selected. An empty imported set scans to the end. Only foreign/russian movie types are accepted; anime kind and animation/anime genres are excluded locally, while documentaries remain eligible. Missing source metadata cannot establish a complete classification guarantee. Banned Kodik source/externalId pairs are skipped. No Item data is imported or updated.

[KodikMoviesService](../../src/endpoints/kodikMovies/services/kodikMovies.service.ts) delegates pagination and cancellation checks to [PageCollectorService](../../src/entities/source/services/pageCollector.service.ts), HTTP requests and safe serialization to [KodikService](../../src/entities/source/services/kodik.service.ts), and page/manifest uploads to [SourceDataWriterService](../../src/entities/source/services/sourceDataWriter.service.ts). It retains movie classification, bans, imported-ID stop conditions, announcement rechecks, counters and progress. Private methods separate new-movie collection from announcement rechecks; each returns its own counters. Record IDs are deduplicated within and across saved pages. List collection has an unknown endpoint, so progress stays at 0 with page/record counts in the status; announcement rechecks occupy 90–99, and 100 follows manifest upload. Selected records retain source fields in per-page JSON under `sources/kodik/movies/<jobId>/attempt-<attempt>/`; announcement pages use a separate `announcements` section. `manifest.json` is written only after both collection phases finish, so failed runs may leave partial pages without a manifest. Full refresh and scheduled collection are not implemented. The full Mongo/queue/S3 flow has not been run.

[SourceModule](../../src/entities/source/source.module.ts) exports the collector, Kodik client and writer alongside SourceRepository, and imports StorageModule for uploads. The collector rejects repeated state keys; the movies scenario additionally rejects an empty list page that still points to another page. KodikService exposes `list`, `search`, `findById` and `serializePage`. It registers the named `kodik` client through `@nestjs/http-client`, with a 30-second timeout, disabled retries and rejected redirects. HTTP/parse errors are mapped to token-safe job errors. Parameter types follow the supplied Kodik field reference; arrays become comma-separated values and false filters are preserved. It validates the minimal response envelope and material identity, retaining additional fields as unknown source data. Pagination URLs are restricted to the Kodik origin and `/list`; serialization removes tokens. Writer path generation needs only the job ID and attempt; its page filenames use six-digit padding. The extracted HTTP client has not been exercised against the live API.

CORS allows origins dynamically outside production and uses configured origins in production, with credentials enabled. Shutdown hooks are enabled. Request metadata is initialized before handling; see [observability](observability.md).

## Configuration authority

`KodikService.getSource()` reads the Source with key `kodik` through SourceRepository and throws 404 if it is absent. KodikMoviesService calls it before enqueueing and when collection starts.

[HttpModule](../../src/infrastructure/http/http.module.ts) is imported by AppModule and configures `@nestjs/http-client` application-wide defaults: a 10-second timeout per attempt and disabled retries. It does not register a client; consumers register clients through `HttpClientModule.register()` or `registerAsync()`. Existing direct `fetch` calls are unaffected.

[InfrastructureConfigModule](../../src/infrastructure/config/config.module.ts) loads a global, cached Nest configuration namespace. Consumers use [InfrastructureConfigService](../../src/infrastructure/config/services/config.service.ts), whose sections are `app`, `database`, `redis`, `jwt`, `storage`, `search`, `mail` and `sources`. The derived [configuration type](../../src/infrastructure/config/types/TInfrastructureConfiguration.ts) follows the factory return type.

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
| Sources | `KODIK_API_TOKEN` (available as `sources.kodikApiToken`)                                                |

All listed variables except `NODE_ENV` are required by the configuration factory. `NODE_ENV` defaults to `development` and accepts only `development` or `production`. JWT secrets must each contain at least 32 characters. The app helper validates the name, semantic version, port and comma-separated HTTP(S) CORS origins; production forbids `*`. Redis parsing extracts database, credentials and TLS from its URL. Do not document or copy actual secret values.

`APP_NAME` also identifies the storage bucket, queue prefix, cache namespace and JWT issuer/audience prefix. Changing it affects several integrations, not only display metadata.

## Health and initialization

[HealthController](../../src/infrastructure/health/controllers/health.controller.ts) exposes `GET /health` and `GET /health/live`. Liveness returns `{ status: "ok" }` without checking dependencies. [HealthService](../../src/infrastructure/health/services/health.service.ts) checks database, cache, jobs, mail, scheduler, search and storage through Terminus. Each check races a 1,500 ms timeout; errors or timeout produce a down indicator. This race does not cancel the underlying dependency operation.

Storage checks/initializes its bucket during module initialization; search rejects application bootstrap if Meilisearch is unavailable. [SchedulerHealthService](../../src/infrastructure/scheduler/services/schedulerHealth.service.ts) records a ten-minute cron heartbeat and measures elapsed time from startup until the first heartbeat. It is not a distributed scheduling lock.

Successful aggregate health responses contain `status`, `error` and `details`; the redundant Terminus `info` field is omitted. Failures still propagate through the existing exception filter.

## Persistence startup boundary

AppModule now imports 26 entity modules. DatabaseModule still uses autoIndex:true, so bootstrapping the application may apply schema index declarations. P1 was checked statically with no application context or service connections; use separately approved isolated targets before runtime, and never infer permission to migrate existing indexes/data from schema changes. No automatic TTL or cleanup was added.

## Tooling

[package.json](../../package.json) defines `dev` (`nest start --watch`), `build` (`nest build`), `start` (`node dist/main.js`) and `type-check` (`tsc --noEmit`). `tunnel` runs the local tunnel script with `.env.tunnel`; it is not needed for routine source verification. `lint:fix` and `format` operate on the entire package and write changes.

[nest-cli.json](../../nest-cli.json) selects Rspack. [tsconfig.json](../../tsconfig.json) uses strict TypeScript, ESNext modules, Bundler resolution, ES2023 and decorator metadata, with `@infrastructure/*`, `@shared/*`, `@entities/*` and `@endpoints/*` aliases. Do not infer runtime behavior from type checking or a successful build.
