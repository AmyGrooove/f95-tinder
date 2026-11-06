# API capability map

All source paths below belong to `apps/api`. This map describes inspected production code; it does not establish service availability or runtime verification.

| Read when changing                                                              | Context                                 |
| ------------------------------------------------------------------------------- | --------------------------------------- |
| HTTP use cases, account flows, library mutations, collection behavior or search | [Endpoint routes](endpoints.md)         |
| Startup, module wiring, configuration, CORS, health, build commands             | [Runtime and configuration](runtime.md) |
| MongoDB entities, queries, transactions, pagination, cache or search            | [Data access](data-access.md)           |
| JWTs, authenticated request context, roles or throttling                        | [Security](security.md)                 |
| Queue definitions, handlers, retries, cancellation or mail delivery             | [Jobs and mail](jobs-and-mail.md)       |
| S3 objects, bucket initialization or multipart image uploads                    | [Storage and images](storage.md)        |
| Logs, HTTP errors or shared request context                                     | [Observability](observability.md)       |

## Composition and reuse

[AppModule](../src/app/app.module.ts) imports config, logger, database, cache, throttling, scheduler, health and 16 entity modules. [HealthModule](../src/infrastructure/health/health.module.ts) additionally imports jobs, mail, search and storage, making their initialization part of the application graph. Removing a health dependency can therefore also change provider and worker startup.

Product HTTP endpoints, application event handlers and cron use cases belong in `src/endpoints`, grouped under a suitable existing slice or a dedicated slice when none fits. `src/app` owns application composition, initialization and AppController with its status page, background routes and related helpers and assets. UserItem metric coordination lives in `src/endpoints/userItem/services/userItemStatsService/core/userItemStats.service.ts`.

The old recommendation subsystem, taste profiles and tag-weight jobs were removed on 5 November 2026. [RecommendationsModule](../src/endpoints/recommendations/recommendations.module.ts) exports internal `RecommendationsService.readPopularItemIds` and `readNewItemIds` operations. They delegate to [RecommendationCandidatesService](../src/endpoints/recommendations/services/recommendationCandidatesService/index.ts), which verifies the token, active owned session and existing user, then prepares a context with the session country and site average for reuse across candidate sources. Each source accepts one Item type and defaults to 20 IDs. The new releases source passes an inclusive 90-day release window to ItemRepository. See the [recommendation plan](../public/docs/todos/recommendations/implementationPlan.md) for the full feed contract.

[FallbackRecommendationsService](../src/endpoints/recommendations/services/fallbackRecommendationsService/index.ts) is an internal provider in RecommendationsModule. It uses one prepared context to combine popular and new release candidates for one Item type, returning up to 100 unique IDs with a 60/40 target and filling shortages from the other source. `RecommendationsService.readFallbackItemIds` prepares that context once, requests the selected types (all types by default) and interleaves the resulting ID lists in EItemType declaration order.

`RecommendationsService.readFallbackItems` uses the ordered IDs to read current Item cards through the same poster projection as site search.

The six product HTTP endpoint modules implement 19 account/auth routes, seven UserItem mutations, one summary QUERY, eight collection routes and public QUERY /search and QUERY /tags, for 37 product routes in total. AppController additionally exposes the status page and background routes described in [runtime](runtime.md). Read [endpoint routes](endpoints.md) for task-specific controllers, services, repositories and invariants; [the endpoint catalog](../public/docs/api/endpoints.md) links every operation to its request-flow diagram, and [the API overview](../public/docs/api/readme.md) links the current contracts. General catalogue listing and recommendation HTTP routes are outside the current endpoint tree.

[Entities](../src/entities) contains 16 persistence slices. Use [data access](data-access.md) for repository APIs and [the entity inventory](../public/docs/api/entities.md) for fields and relationships. Item is the single catalogue entity, referenced directly by ObjectId. The `@entities/*` and `@endpoints/*` aliases are defined in [tsconfig.json](../tsconfig.json); entity barrels are absent. Target requirements and planned scope are in [product documentation](../public/docs/product/readme.md).

Shared helpers live under [shared](../src/shared): type checks, regex escaping and AsyncLocalStorage request context. Pagination helpers live under [database functions](../src/infrastructure/database/functions). Function and decorator objects commonly expose an `index.ts` entrypoint and keep implementation in `core/`; reuse those public entrypoints where available.
