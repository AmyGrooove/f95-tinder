# API agent context

This package is `@bisky/api`, a NestJS application using Fastify, TypeScript and ESM. Start at [the capability map](docs/agents/index.md), then inspect the linked production code for your task.

## Current scope

- [Bootstrap](src/main.ts) configures HTTP, validation, Swagger and request context; [AppModule](src/app/app.module.ts) composes infrastructure and 23 entity modules.
- The current `src` contains `app`, `endpoints`, `entities`, `infrastructure` and `shared`. MongoDB entity schema classes and repositories live in `src/entities`; their current structure is described in [data access context](docs/agents/data-access.md) and [the entity inventory](../../docs/api/entities.md). Target requirements are in [project foundations](../../docs/product/foundations.md), with the initial scope in [MVP scope](../../docs/product/mvpScope.md). Item is the single catalogue entity for all content types; catalogue and user records reference its ObjectId directly. Enums and derived create types live alongside schemas; entity `index.ts` barrels are absent. Source owns reusable collection, Kodik client and artifact writer services, with their contracts under `source/types`; no catalogue collection or import endpoint currently connects them. See [runtime](docs/agents/runtime.md).
- HTTP use cases are routed in [endpoint context](docs/agents/endpoints.md): 19 account/auth routes, five library mutations and ten collection routes. Library mutations are provided by [UserItemEndpointModule](src/endpoints/userItem/userItem.module.ts) under `/userItems`; see [endpoint context](docs/agents/endpoints.md#library-invariants) for status/attempt invariants.
- Existing capabilities include MongoDB repositories, Redis cache and throttling, BullMQ jobs, Resend mail, Garage-configured S3 storage, image processing, Meilisearch, JWT helpers, scheduling and structured logs.
- `AuthModule` and `AccountModule` implement the 19 routes in [the account/auth specification](../../docs/api/accountAndAuthSpec.md). They validate cookie JWTs and owned, unexpired sessions locally; authentication is not a global guard. The separate Bearer guard does not validate server sessions; see [security](docs/agents/security.md).

## Working boundaries

- Write API descriptions and similar short text values (Swagger summaries, parameter/property/response descriptions and dictionary messages) without a trailing period.
- Adding a new HTTP endpoint requires the user's explicit agreement on the proposed operations and their contracts before implementation. First discuss the purpose, method/path, request/response data, access, errors and loading/pagination boundaries where relevant. Until agreement, limit endpoint work to read-only investigation and proposals: do not add production code, DTOs or module wiring, or document a proposed route as implemented. Agreement on individual data rules or a general request to work on a page does not approve endpoint creation. A direct implementation request naming an endpoint and its agreed contract is sufficient authorization; do not request the same approval again.
- Preserve unrelated changes and existing contracts. Do not commit unless requested.
- Read current production sources before relying on this map; it documents implementation, not a proposed architecture.
- Do not inspect, run or change tests or Storybook without explicit authorization. Do not expose environment secrets.
- Use existing infrastructure services before adding another client or mechanism. Import the owning module where its providers are needed.
- Run package commands from `apps/api`. Available scripts are listed in [package.json](package.json); `type-check` is static verification, while `lint:fix` and `format` mutate files broadly.
- Update affected context when its documented contracts change. Keep detailed facts in the routed documents below, rather than expanding this entrypoint.
