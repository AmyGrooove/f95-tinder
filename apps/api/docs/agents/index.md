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

[AppModule](../../src/app/app.module.ts) imports config, logger, database, cache, throttling, scheduler, health and 23 entity modules. [HealthModule](../../src/infrastructure/health/health.module.ts) additionally imports jobs, mail, search and storage, making their initialization part of the application graph. Removing a health dependency can therefore also change provider and worker startup.

[AuthModule](../../src/endpoints/auth/auth.module.ts) and [AccountModule](../../src/endpoints/account/account.module.ts) implement the 20 cookie-based account/auth routes; read [security](security.md) and [the specification](../../../../docs/accountAndAuthSpec.md). Catalogue and recommendation endpoints are not implemented in the current source tree. Library mutations are implemented by UserItemEndpointModule. CollectionEndpointModule implements public GET /collections/:id for metadata and ordered blocks without membership, and authenticated POST /collections for atomic creation of a user collection with initial membership. CollectionUserController/CollectionUserService implement authenticated GET /collections/:id/user and PATCH /collections/:id/favorite, /rating and /hidden for independent current-user reactions. Rating the caller's own collection returns 409, while clearing its rating is allowed. CollectionController/CollectionService also implement DELETE /collections/:id to soft-delete only the current user's own collection, retaining membership and reactions. PATCH /collections/:id atomically edits metadata, ordered blocks and membership for the owner with an explicit version check; GET/POST/PATCH collection responses include version. See [data access](data-access.md). [Entities](../../src/entities) contains 23 persistence slices; use [data access](data-access.md) and [the entity inventory](../../../../docs/entities.md) for storage contracts. [Project foundations](../../../../docs/projectFoundations.md) and [MVP scope](../../../../docs/mvpScope.md) define target requirements. Item is the single catalogue entity, referenced directly by ObjectId. The `@entities/*` and `@endpoints/*` aliases are defined in [tsconfig.json](../../tsconfig.json); entity barrels are absent. SourceModule exports the Kodik client, page collector and S3 artifact writer; their current boundary is described in [runtime](runtime.md).

The [userItem endpoint module](../../src/endpoints/userItem/userItem.module.ts) provides nine cookie-authenticated library mutations under `/userItems`, without GET routes. See [data access](data-access.md) for status and attempt invariants.

Shared helpers live under [shared](../../src/shared): type checks, regex escaping, pagination and AsyncLocalStorage request context. Function and decorator objects commonly expose an `index.ts` entrypoint and keep implementation in `core/`; reuse those public entrypoints where available.
