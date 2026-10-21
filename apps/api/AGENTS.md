# API agent context

This package is `@bisky/api`, a NestJS application using Fastify, TypeScript and ESM. Start at [the capability map](docs/agents/index.md), then inspect the linked production code for your task.

## Current scope

- [Bootstrap](src/main.ts) configures HTTP, validation, Swagger and request context; [AppModule](src/app/app.module.ts) composes infrastructure and 23 entity modules.
- The current `src` contains `app`, `endpoints`, `entities`, `infrastructure` and `shared`. MongoDB entity schema classes and repositories live in `src/entities`; their current structure is described in [data access context](docs/agents/data-access.md) and [the entity inventory](../../docs/entities.md). Target requirements are in [project foundations](../../docs/projectFoundations.md), with the initial scope in [MVP scope](../../docs/mvpScope.md). Item is the single catalogue entity for all content types; catalogue and user records reference its ObjectId directly. Enums and derived create types live alongside schemas; entity `index.ts` barrels are absent. Source owns reusable collection, Kodik client and artifact writer services, with their contracts under `source/types`; no catalogue collection or import endpoint currently connects them. See [runtime](docs/agents/runtime.md).
- Existing capabilities include MongoDB repositories, Redis cache and throttling, BullMQ jobs, Resend mail, Garage-configured S3 storage, image processing, Meilisearch, JWT helpers, scheduling and structured logs.
- `AuthModule` and `AccountModule` implement the 20 routes in [the account/auth specification](../../docs/accountAndAuthSpec.md). They validate cookie JWTs and owned, unexpired sessions locally; authentication is not a global guard. The separate Bearer guard does not validate server sessions; see [security](docs/agents/security.md).

## Working boundaries

- Preserve unrelated changes and existing contracts. Do not commit unless requested.
- Read current production sources before relying on this map; it documents implementation, not a proposed architecture.
- Do not inspect, run or change tests or Storybook without explicit authorization. Do not expose environment secrets.
- Use existing infrastructure services before adding another client or mechanism. Import the owning module where its providers are needed.
- Run package commands from `apps/api`. Available scripts are listed in [package.json](package.json); `type-check` is static verification, while `lint:fix` and `format` mutate files broadly.
- Update affected context when its documented contracts change. Keep detailed facts in the routed documents below, rather than expanding this entrypoint.
