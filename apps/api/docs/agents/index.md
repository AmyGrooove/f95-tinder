# API capability map

All source paths below belong to `apps/api`. This map describes inspected production code; it does not establish service availability or runtime verification.

| Read when changing                                                   | Context                                 |
| -------------------------------------------------------------------- | --------------------------------------- |
| Startup, module wiring, configuration, CORS, health, build commands  | [Runtime and configuration](runtime.md) |
| MongoDB entities, queries, transactions, pagination, cache or search | [Data access](data-access.md)           |
| JWTs, authenticated request context, roles or throttling             | [Security](security.md)                 |
| Queue definitions, handlers, retries, cancellation or mail delivery  | [Jobs and mail](jobs-and-mail.md)       |
| S3 objects, bucket initialization or multipart image uploads         | [Storage and images](storage.md)        |
| Logs, HTTP errors or shared request context                          | [Observability](observability.md)       |

## Composition and reuse

[AppModule](../../src/app/app.module.ts) imports config, logger, database, cache, throttling, scheduler, health and 17 entity modules. [HealthModule](../../src/infrastructure/health/health.module.ts) additionally imports jobs, mail, search and storage, making their initialization part of the application graph. Removing a health dependency can therefore also change provider and worker startup.

The JWT/security module is available separately. [Entities](../../src/entities) contains domain persistence schema classes and composed repositories; read [data access](data-access.md) for the current structure and [entitiesSpec.md](../entitiesSpec.md) for field contracts before extending them. There are no business controllers or domain synchronization jobs in `src`. The `@entities/*` alias in [tsconfig.json](../../tsconfig.json) resolves direct module, schema and repository file imports; entity `index.ts` barrels are absent. `@endpoints/*` remains configuration for a future layer.

Shared helpers live under [shared](../../src/shared): type checks, regex escaping, pagination and AsyncLocalStorage request context. Function and decorator objects commonly expose an `index.ts` entrypoint and keep implementation in `core/`; reuse those public entrypoints where available.
