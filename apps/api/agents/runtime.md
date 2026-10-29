# Runtime and configuration

Read for startup, configuration, health, HTTP policy or build changes. Return to [the map](index.md) for integration-specific contracts.

## HTTP entrypoint

[AppController](../src/app/controllers/app.controller.ts) exposes public `GET /` with an HTML status page and a link to `/docs`, and `GET /background` which proxies a random image from the fixed application background list. Both routes are excluded from Swagger and use `Cache-Control: no-store`. The page uses the exported HealthService to display dependency statuses, including failed readiness checks. The background route stores the last successful image index in the `biskyBackground` session cookie scoped to `/background` and excludes it from the next selection when the browser returns that cookie. Page and service markup live in `src/app/static`.

[main.ts](../src/main.ts) creates the Fastify Nest application and listens on `app.port` at `0.0.0.0`. Shared HTTP setup lives in [configureApplication](../src/app/functions/configureApplication/index.ts), reused by the integration-test application: CSRF, multipart, Helmet, request context, CORS, URI versioning and validation. Proxy trust is limited to loopback, link-local and unique-local addresses. CSP is removed for `/docs` and its nested/query routes.

Swagger uses OpenAPI 3.2.0 so QUERY operations remain in the generated schema. It is mounted at `/docs`, with bearer scheme `authToken` and cookie schemes `accessCookie` / `refreshCookie`. URI versioning is enabled without a default version; current health, account and auth controllers have no version metadata. There is no global route prefix.

[configureKnowledge](../src/app/functions/configureKnowledge/index.ts) mounts the Docsify knowledge base at `/knowledge/`. It serves the interface from `knowledge/`, project Markdown and images from `docs/` under `/knowledge/content/`, and the locally installed Docsify runtime and search plugin under `/knowledge/vendor/`. Every request under these static roots requires HTTP Basic authentication using `knowledge.username` and `knowledge.password` from InfrastructureConfigService. Missing or incorrect credentials return 401 with a browser authentication challenge; absent credentials in configuration or a username containing a colon disables access with 503. All responses use Cache-Control:no-store. Authentication is independent of Bisky accounts and roles and works on public hostnames; production must serve it over HTTPS. Agent instructions and production sources are outside the static roots. The browser converts source-code references into non-navigable labels and normalizes README links to the repository's lowercase filenames. The homepage, sidebar, styling and browser hooks live in `knowledge/`; search indexes pages linked in the sidebar in the browser. The Docker runtime copies `docs/` and `knowledge/` alongside the compiled application. No Markdown build step or external CDN is required.

[knowledge/diagrams.js](../knowledge/diagrams.js) extends Docsify 5's token-based code renderer for Mermaid fences and renders them after each page load. It lazy-loads the pinned Mermaid dependency from `/knowledge/vendor/mermaid/`; configureKnowledge serves only its minified ESM entrypoint and matching `.mjs` chunks under the same Basic-auth boundary. Ordinary code blocks retain Docsify highlighting. Diagram source remains escaped and available in a disclosure, including on rendering failures. The figure title comes from the rendered SVG's accessible title (`accTitle`); its compact legend includes only semantic node classes present in that diagram. Mermaid uses strict security and SVG text labels; do not enable loose security or external rendering services. Shared semantic colors live in [knowledge.css](../knowledge/knowledge.css), with notation and authoring rules in [the request-flow guide](../docs/api/requestFlows/readme.md). Preserve route-change handling, readable overflow, source access and the restricted vendor paths when changing rendering. The home entry card and sidebar link to [the endpoint catalog](../docs/api/endpoints.md); its compact rows link to per-operation anchors on six area pages, rather than rendering all diagrams in the catalog. The catalog sidebar link has `data-nosearch` to prevent raw HTML snippets in search; individual operations remain searchable through the six Markdown area pages. The search namespace was rotated when adding the catalog to avoid reusing previously cached HTML results. Keep catalog rows, navigation and diagrams current with endpoint and shared background-handler changes. Endpoint diagram maintenance is routed in [endpoint context](endpoints.md#request-flow-diagrams).

Global validation transforms input, whitelists DTO fields and rejects non-whitelisted fields. Multipart limits allow one file up to 25 MiB, 20 fields, 64 KiB per field and 21 parts. Image processing applies additional limits; see [storage](storage.md).

[AppModule](../src/app/app.module.ts) imports AuthModule and AccountModule. Their controllers implement 19 routes in [the account/auth specification](../docs/api/accountAndAuthSpec.md); see [security](security.md) for cookie authorization and session contracts. AppModule also imports [UserItemEndpointModule](../src/endpoints/userItem/userItem.module.ts), exposing seven mutation routes and QUERY /userItems for summaries by UserItem ID. It does not provide lookup by Item or full library reads.

CORS allows origins dynamically outside production and uses configured origins in production, with credentials enabled; allowed methods include QUERY. Shutdown hooks are enabled. Request metadata is initialized before handling; see [observability](observability.md).

Bootstrap enables NestJS `enableCsrfProtection()` for the application before registering request hooks and before listening. It checks Fetch Metadata with an Origin/Host fallback for state-changing requests. Explicit `CORS_ORIGINS` entries are also passed as `trustedOrigins`; a development `*` entry is omitted because CSRF trust requires exact origins. Development CORS reflection does not grant CSRF trust. There are no route exclusions or required `X-Requested-With` headers.

## Configuration authority

[HttpModule](../src/infrastructure/http/http.module.ts) is imported by AppModule and configures `@nestjs/http-client` application-wide defaults: a 10-second timeout per attempt and disabled retries. It does not register a client; consumers register clients through `HttpClientModule.register()` or `registerAsync()`. Existing direct `fetch` calls are unaffected.

[InfrastructureConfigModule](../src/infrastructure/config/config.module.ts) loads a global, cached Nest configuration namespace. It skips `.env` loading when `NODE_ENV=test`; the test application overrides the configuration namespace with isolated container addresses and test values. Consumers use [InfrastructureConfigService](../src/infrastructure/config/services/config.service.ts), whose sections are `app`, `database`, `redis`, `jwt`, `storage`, `search`, `mail` and `sources`. The derived [configuration type](../src/infrastructure/config/types/TInfrastructureConfiguration.ts) follows the factory return type.

[createInfrastructureConfiguration](../src/infrastructure/config/functions/createInfrastructureConfiguration/core/createInfrastructureConfiguration.ts) and its nested helpers define the current environment contract:

| Section   | Variables                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------ |
| App       | `NODE_ENV`, `APP_NAME`, `APP_VERSION`, `APP_DESCRIPTION`, `PORT`, `CORS_ORIGINS`                       |
| Knowledge | `KNOWLEDGE_USERNAME`, `KNOWLEDGE_PASSWORD`                                                             |
| MongoDB   | `MONGO_URL`                                                                                            |
| Redis     | `REDIS_URL`                                                                                            |
| JWT       | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                              |
| Storage   | `GARAGE_URL`, `GARAGE_REGION`, `GARAGE_ACCESS_KEY_ID`, `GARAGE_SECRET_ACCESS_KEY`, `GARAGE_PUBLIC_URL` |
| Search    | `MEILISEARCH_URL`, `MEILISEARCH_ACCESS_SECRET`                                                         |
| Mail      | `RESEND_ACCESS_SECRET`, `MAIL_DOMAIN`                                                                  |
| Sources   | `KODIK_API_TOKEN` (available as `sources.kodikApiToken`)                                               |

All listed variables except `NODE_ENV` and the knowledge credentials are required by the configuration factory. Knowledge credentials default to empty strings, which disable the knowledge base without preventing API startup. Set both values in the deployment environment; changing them requires an application restart. `NODE_ENV` defaults to `development` and accepts only `development` or `production`. JWT secrets must each contain at least 32 characters. The app helper validates the name, semantic version, port and comma-separated HTTP(S) CORS origins; production forbids `*`. Redis parsing extracts database, credentials and TLS from its URL. Do not document or copy actual secret values.

`APP_NAME` also identifies the storage bucket, queue prefix, cache namespace and JWT issuer/audience prefix. Changing it affects several integrations, not only display metadata.

## Health and initialization

[HealthController](../src/infrastructure/health/controllers/health.controller.ts) exposes `GET /health` and `GET /health/live`. Liveness returns `{ status: "ok" }` without checking dependencies. [HealthService](../src/infrastructure/health/services/health.service.ts) checks database, cache, jobs, mail, scheduler, search and storage through Terminus. Each check races a 1,500 ms timeout; errors or timeout produce a down indicator. This race does not cancel the underlying dependency operation.

Storage checks/initializes its bucket during module initialization; search rejects application bootstrap if Meilisearch is unavailable. [SchedulerHealthService](../src/infrastructure/scheduler/services/schedulerHealth.service.ts) records a ten-minute cron heartbeat and measures elapsed time from startup until the first heartbeat. It is not a distributed scheduling lock.

Successful aggregate health responses contain `status`, `error` and `details`; the redundant Terminus `info` field is omitted. Failures still propagate through the existing exception filter.

## Persistence startup boundary

[TagCollectionsInitializationService](../src/endpoints/collection/services/tagCollectionsInitialization.service.ts) runs during CollectionEndpointModule initialization. It waits for Tag and Collection model initialization (including their unique indexes), adds missing predefined Tags with parents resolved to actual stored IDs, then independently ensures one site Collection per Tag, including Tags already in the database. Existing Tags and existing collection contents are preserved. Collection.tag is nullable for ordinary collections; a partial unique index enforces one type=tag, author=null collection per referenced Tag. New automatic collections contain one unnamed ordinary group. Concurrent duplicate Tag or Collection creation is resolved by reading the winning record. Startup does not read TagItem or populate historical membership. Automatic collections cannot be edited through user routes because author=null; franchise composition remains manual. Initialization, repeat/concurrent runs and unique-index behavior are covered by tagCollections.integration.test.ts on disposable MongoDB 8.0.17; deployed services and indexes remain unverified.

AppModule imports 17 entity modules. DatabaseModule uses `autoIndex: true`, so application startup can apply schema index declarations. Source declarations do not establish deployed indexes or migrate existing data. UserSession declares a cleanup TTL ten minutes after expiresAt; authorization checks expiry explicitly. UserItem declares a partial expiresAt TTL index (expireAfterSeconds:0, status=skipped) for 90-day skips; blocked/library records do not expire. UserRecommendationState has been removed from the application. Existing database contents and old attempt statuses need separate migration review; no migration or collection drop runs at startup.

## Tooling

Both application packages require Node.js `>=24.0.0`, with no upper version bound. Their Dockerfiles use the Node.js 26 stable line for build and runtime stages.

[package.json](../package.json) defines `dev` (`nest start --watch`), `build` (`nest build`), `start` (`node dist/main.js`) and `type-check` (`tsc --noEmit`). `tunnel` runs the local tunnel script with `.env.tunnel`; it is not needed for routine source verification. `lint:fix` and `format` operate on the entire package and write changes.

[nest-cli.json](../nest-cli.json) selects Rspack. [tsconfig.json](../tsconfig.json) uses strict TypeScript 6, ESNext modules, Bundler resolution, ES2023 and decorator metadata, with `@infrastructure/*`, `@shared/*`, `@entities/*` and `@endpoints/*` aliases. Do not infer runtime behavior from type checking or a successful build.
