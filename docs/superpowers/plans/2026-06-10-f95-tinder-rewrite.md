# F95 Tinder Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переписать Electron-приложение как multi-user web-сервис с NestJS, React/Vite, MongoDB и обязательным Redis.

**Architecture:** Один pnpm workspace содержит независимые `apps/api` и `apps/web`, общие API-контракты и конфигурацию. Backend является единственным владельцем каталога, очереди, решений, синхронизации и persistence; frontend отвечает за UI, жесты и API-состояние.

**Tech Stack:** pnpm workspace, TypeScript, NestJS, Fastify, Mongoose, Redis, BullMQ, React, Vite, TanStack Query, React Router, SCSS modules, Docker Compose, Nginx.

---

## Execution Rules

- Не переносить старую архитектуру или `useF95Browser`.
- Использовать старый UI только как ориентир поведения и визуального направления.
- Не добавлять рекомендации, фильтры, dashboard, AI profile или import/export.
- Весь backend реализовывать Nest-way: модули, providers, dependency injection,
  controllers, guards, decorators, pipes, interceptors и lifecycle hooks NestJS.
- Не создавать service locator, ручные singleton-контейнеры, глобальные mutable
  services или прямое конструирование зависимостей через `new` вне providers.
- Межмодульные зависимости экспортировать и подключать только через Nest modules.
- Не удалять старые файлы до готовности нового frontend и API.
- Не запускать проверки и не выполнять Git-операции без отдельного разрешения.
- Во время реализации проверять каждый этап целевыми тестами, если пользователь явно разрешит их запуск.

## Target File Map

```text
apps/
  api/
    src/
      app/
      endpoints/
        auth/
        catalog/
        swipe/
        lists/
      entities/
        user/
        game/
        tag/
        prefix/
        userGameState/
        syncState/
      infrastructure/
        config/
        database/
        cache/
        jobs/
        scheduler/
        security/
        health/
      integrations/f95/
      shared/
  web/
    src/
      app/
      pages/
        auth/
        swipe/
        lists/
        settings/
      entities/
        game/
        userGameState/
        session/
      widgets/
        appHeader/
        swipeDeck/
        gameLists/
        imageViewer/
      shared/
packages/
  contracts/
  config/
```

## Task 1: Create The Workspace Skeleton

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `apps/api/package.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app/app.module.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/typescript/base.json`

- [x] **Step 1:** Replace root scripts with workspace orchestration for `dev`, `build`, and per-app commands.
- [x] **Step 2:** Configure workspace packages as `apps/*` and `packages/*`.
- [x] **Step 3:** Scaffold a minimal NestJS application using Fastify.
- [x] **Step 4:** Scaffold a minimal React/Vite application.
- [x] **Step 5:** Configure both apps to consume `@f95/contracts`.
- [x] **Step 6:** Keep legacy source files untouched until migration completion.
- [ ] **Step 7:** When verification is approved, run workspace install and confirm both minimal apps start independently.

**Exit criteria:** Both apps exist in the workspace, share TypeScript contracts, and no longer depend on Electron for their new entry points.

## Task 2: Define Shared API Contracts

**Files:**

- Create: `packages/contracts/src/auth/auth.contracts.ts`
- Create: `packages/contracts/src/game/game.contracts.ts`
- Create: `packages/contracts/src/swipe/swipe.contracts.ts`
- Create: `packages/contracts/src/lists/lists.contracts.ts`
- Create: `packages/contracts/src/catalog/catalog.contracts.ts`
- Create: `packages/contracts/src/common/error.contracts.ts`
- Modify: `packages/contracts/src/index.ts`

- [x] **Step 1:** Define `GameDto` with all card and gallery fields.
- [x] **Step 2:** Define `UserGameStatus` as `bookmark | trash | played`.
- [x] **Step 3:** Define auth request and response contracts.
- [x] **Step 4:** Define the fixed 20-item swipe queue response.
- [x] **Step 5:** Define decision and undo contracts.
- [x] **Step 6:** Define cursor-based list responses.
- [x] **Step 7:** Define catalog sync status and SSE event payloads.
- [x] **Step 8:** Define stable API error codes including `catalog_not_ready`, `invalid_token`, and `redis_unavailable`.

**Exit criteria:** Backend and frontend can use the same transport types without importing application internals.

## Task 3: Add Backend Configuration And Infrastructure

**Files:**

- Create: `apps/api/src/infrastructure/config/config.module.ts`
- Create: `apps/api/src/infrastructure/config/config.service.ts`
- Create: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Create: `apps/api/src/infrastructure/database/database.module.ts`
- Create: `apps/api/src/infrastructure/cache/cache.module.ts`
- Create: `apps/api/src/infrastructure/cache/cache.service.ts`
- Create: `apps/api/src/infrastructure/jobs/jobs.module.ts`
- Create: `apps/api/src/infrastructure/health/health.module.ts`
- Create: `apps/api/src/infrastructure/health/health.controller.ts`
- Create: `apps/api/src/infrastructure/health/health.service.ts`
- Create: `apps/api/.env.example`
- Modify: `apps/api/src/app/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [x] **Step 1:** Validate required MongoDB, Redis, encryption, API prefix, CORS, and cron environment variables.
- [x] **Step 2:** Connect Mongoose through the config service.
- [x] **Step 3:** Create a Redis service with typed JSON, hash, set, lock, and TTL helpers.
- [x] **Step 4:** Register BullMQ using the same required Redis connection.
- [x] **Step 5:** Implement `/api/health` readiness checks for API, MongoDB, and Redis.
- [x] **Step 6:** Fail application startup when required configuration is missing.
- [x] **Step 7:** Enable Swagger only when the environment is development.

**Exit criteria:** Backend has centralized validated configuration and observable MongoDB/Redis readiness.

## Task 4: Implement Catalog Entities And F95 Integration

**Files:**

- Create: `apps/api/src/entities/game/schemas/game.schema.ts`
- Create: `apps/api/src/entities/game/services/game.repository.ts`
- Create: `apps/api/src/entities/game/game.module.ts`
- Create: `apps/api/src/entities/tag/schemas/tag.schema.ts`
- Create: `apps/api/src/entities/tag/services/tag.repository.ts`
- Create: `apps/api/src/entities/tag/tag.module.ts`
- Create: `apps/api/src/entities/prefix/schemas/prefix.schema.ts`
- Create: `apps/api/src/entities/prefix/services/prefix.repository.ts`
- Create: `apps/api/src/entities/prefix/prefix.module.ts`
- Create: `apps/api/src/integrations/f95/f95.module.ts`
- Create: `apps/api/src/integrations/f95/services/f95Latest.client.ts`
- Create: `apps/api/src/integrations/f95/functions/buildLatestUrl.ts`
- Create: `apps/api/src/integrations/f95/functions/normalizeF95Game.ts`
- Create: `apps/api/src/integrations/f95/types/f95LatestResponse.ts`
- Create: `apps/api/src/integrations/f95/errors/f95Integration.error.ts`
- Create: `apps/api/resources/tags.json`
- Create: `apps/api/resources/prefixes.json`

- [x] **Step 1:** Create the game schema and required indexes.
- [x] **Step 2:** Preserve numeric F95 tag and prefix IDs in games.
- [x] **Step 3:** Create small tag and prefix lookup collections with unique source IDs.
- [x] **Step 4:** Implement the `latest_data.php` client with `sort=date`.
- [x] **Step 5:** Validate response shape before normalization.
- [x] **Step 6:** Normalize source fields into stable MongoDB fields.
- [x] **Step 7:** Implement idempotent page upsert through `bulkWrite`.
- [x] **Step 8:** Seed tag and prefix collections from bundled JSON resources.

**Exit criteria:** A fetched F95 page can be validated, normalized, and idempotently stored.

## Task 5: Implement Durable Catalog Synchronization

**Files:**

- Create: `apps/api/src/entities/syncState/schemas/syncState.schema.ts`
- Create: `apps/api/src/entities/syncState/services/syncState.repository.ts`
- Create: `apps/api/src/entities/syncState/syncState.module.ts`
- Create: `apps/api/src/endpoints/catalog/catalog.module.ts`
- Create: `apps/api/src/endpoints/catalog/services/catalogSync.service.ts`
- Create: `apps/api/src/endpoints/catalog/services/catalogSyncProgress.service.ts`
- Create: `apps/api/src/endpoints/catalog/controllers/catalogSync.controller.ts`
- Create: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Create: `apps/api/src/infrastructure/scheduler/catalogSync.scheduler.ts`
- Create: `apps/api/src/infrastructure/cache/services/distributedLock.service.ts`
- Modify: `apps/api/src/infrastructure/jobs/jobs.module.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [x] **Step 1:** Persist sync phase, current page, total pages, checkpoint, counters, watermark, retry time, and last error.
- [x] **Step 2:** Start a full import automatically when the game collection is empty.
- [x] **Step 3:** Save progress after every successfully processed page.
- [x] **Step 4:** Use a Redis distributed lock to prevent concurrent imports.
- [x] **Step 5:** Implement retry delays of 1, 5, 15, and 30 minutes, then every 30 minutes.
- [x] **Step 6:** On resume, rescan from page 1 through the prior checkpoint before continuing.
- [x] **Step 7:** Complete initial import only after the final source page.
- [x] **Step 8:** Run daily sync from page 1 until a processed page fully reaches the previous watermark.
- [x] **Step 9:** Never delete games merely because they were absent from an incremental pass.
- [x] **Step 10:** Expose current progress through a status endpoint and SSE stream.

**Exit criteria:** Initial import and daily sync are restartable, idempotent, observable, and safe against overlapping workers.

## Task 6: Audit And Align Existing Backend With NestJS Architecture

**Files:**

- Review: `apps/api/src/app/`
- Review: `apps/api/src/endpoints/catalog/`
- Review: `apps/api/src/entities/`
- Review: `apps/api/src/infrastructure/`
- Review: `apps/api/src/integrations/f95/`
- Modify: only files that violate the rules below

- [x] **Step 1:** Verify every backend capability is owned by a focused Nest module.
- [x] **Step 2:** Verify controllers contain only transport concerns and delegate to injected services.
- [x] **Step 3:** Verify repositories, clients, schedulers, processors, locks, and progress publishers are injectable providers.
- [x] **Step 4:** Replace manually constructed dependencies with constructor injection.
- [x] **Step 5:** Replace global mutable state and service locators with scoped module providers.
- [x] **Step 6:** Verify cross-module providers are explicitly exported and imported through Nest modules.
- [x] **Step 7:** Verify configuration uses an injectable config service rather than direct environment reads throughout the codebase.
- [x] **Step 8:** Verify request validation uses DTOs and the global Nest `ValidationPipe`.
- [x] **Step 9:** Verify recurring work uses Nest scheduler and background work uses registered BullMQ processors.
- [x] **Step 10:** Verify startup and shutdown behavior uses Nest lifecycle hooks where resource management is required.
- [x] **Step 11:** Remove abstractions that duplicate built-in NestJS module, DI, guard, pipe, interceptor, scheduler, or queue behavior.
- [x] **Step 12:** Record any intentional exception in the plan review notes before continuing.

### Task 6 Review Notes

- `FastifyAdapter`, `ValidationPipe`, and Swagger's `DocumentBuilder` are created
  in the Nest bootstrap because they are framework bootstrap objects, not
  application dependencies.
- The Redis client, dynamic `CronJob`, and RxJS progress `Subject` are created
  only inside injectable providers. Redis is closed through `OnModuleDestroy`;
  cron registration and shutdown are owned by `SchedulerRegistry`; the subject
  is provider-local state rather than a global service locator.
- Tasks 1-5 expose only parameterless GET/SSE routes, so no request DTO classes
  are currently needed. A global strict `ValidationPipe` is enabled, and future
  body, query, and path inputs must use DTO classes.
- Mongoose and BullMQ connection shutdown remain owned by their official Nest
  modules rather than duplicated custom lifecycle wrappers.

**Exit criteria:** Tasks 1-5 follow NestJS module and DI conventions, with no parallel application framework or unmanaged dependency graph.

## Task 7: Implement Token Authentication

**Files:**

- Create: `apps/api/src/entities/user/schemas/user.schema.ts`
- Create: `apps/api/src/entities/user/services/user.repository.ts`
- Create: `apps/api/src/entities/user/user.module.ts`
- Create: `apps/api/src/infrastructure/security/security.module.ts`
- Create: `apps/api/src/infrastructure/security/services/token.service.ts`
- Create: `apps/api/src/infrastructure/security/guards/bearerToken.guard.ts`
- Create: `apps/api/src/infrastructure/security/decorators/CurrentUserId.ts`
- Create: `apps/api/src/endpoints/auth/auth.module.ts`
- Create: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Create: `apps/api/src/endpoints/auth/services/auth.service.ts`
- Create: `apps/api/src/endpoints/auth/dto/createUserResponse.dto.ts`
- Create: `apps/api/src/endpoints/auth/dto/sessionResponse.dto.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [x] **Step 1:** Generate a cryptographically random prefixed token.
- [x] **Step 2:** Hash the token for lookup and authentication.
- [x] **Step 3:** Encrypt the original token using authenticated encryption and a versioned backend key.
- [x] **Step 4:** Create `POST /api/auth/createUser`.
- [x] **Step 5:** Create a Bearer guard that resolves only the user ID.
- [x] **Step 6:** Create `GET /api/auth/session`.
- [x] **Step 7:** Create `GET /api/auth/token` with explicit decryption.
- [x] **Step 8:** Ensure responses and logs never expose hashes, encryption metadata, or tokens outside the intended endpoint.

**Exit criteria:** A random user can be created, authenticated indefinitely by token, and can retrieve that token from settings.

## Task 8: Implement User Game States And Redis Write-Behind

**Files:**

- Create: `apps/api/src/entities/userGameState/schemas/userGameState.schema.ts`
- Create: `apps/api/src/entities/userGameState/services/userGameState.repository.ts`
- Create: `apps/api/src/entities/userGameState/userGameState.module.ts`
- Create: `apps/api/src/infrastructure/database/types/pendingGameDecision.ts`
- Create: `apps/api/src/infrastructure/database/services/gameDecisionWriteBehind.service.ts`
- Create: `apps/api/src/infrastructure/jobs/processors/gameDecisionFlush.processor.ts`
- Create: `apps/api/src/infrastructure/scheduler/gameDecisionFlush.scheduler.ts`
- Modify: `apps/api/src/infrastructure/jobs/jobs.module.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [x] **Step 1:** Create the unique `userId + gameId` MongoDB state model.
- [x] **Step 2:** Define Redis keys for pending decisions, undo, and dirty users.
- [x] **Step 3:** Record the latest decision per game in a user Redis hash.
- [x] **Step 4:** Record one undo snapshot with a 10-minute TTL.
- [x] **Step 5:** Mark users dirty after each decision or undo.
- [x] **Step 6:** Flush dirty users every 60 seconds with idempotent MongoDB `bulkWrite`.
- [x] **Step 7:** Delete pending entries only after their exact version was persisted.
- [x] **Step 8:** Keep newer concurrent pending changes when an older flush completes.
- [x] **Step 9:** Merge MongoDB state with pending Redis state for all reads.

### Task 8 Review Notes

- Redis mutations and exact-version cleanup are atomic Lua operations. A newer
  pending version remains dirty when an older flush completes.
- MongoDB retains versioned tombstones for removed decisions so an older
  concurrent flush cannot recreate a deleted state.
- Automated checks were not run because the user explicitly prohibited them
  for this task.

**Exit criteria:** Decisions are immediately visible, survive normal flush, support undo, and do not lose concurrent updates during batching.

## Task 9: Implement Swipe Queue And Decisions API

**Files:**

- Create: `apps/api/src/endpoints/swipe/swipe.module.ts`
- Create: `apps/api/src/endpoints/swipe/controllers/swipe.controller.ts`
- Create: `apps/api/src/endpoints/swipe/services/swipeQueue.service.ts`
- Create: `apps/api/src/endpoints/swipe/services/swipeDecision.service.ts`
- Create: `apps/api/src/endpoints/swipe/dto/createDecisionBody.dto.ts`
- Create: `apps/api/src/endpoints/swipe/dto/swipeQueueResponse.dto.ts`
- Create: `apps/api/src/endpoints/swipe/dto/undoResponse.dto.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [x] **Step 1:** Implement `GET /api/swipe/queue` with no cursor or public limit.
- [x] **Step 2:** Return exactly up to 20 complete game cards.
- [x] **Step 3:** Sort MVP candidates by popularity with a stable `_id` tie-breaker.
- [x] **Step 4:** Exclude MongoDB and pending Redis decisions for the user.
- [x] **Step 5:** Return `503 catalog_not_ready` while the initial catalog is unusable.
- [x] **Step 6:** Implement `POST /api/swipe/decisions`.
- [x] **Step 7:** Validate that the target game exists.
- [x] **Step 8:** Implement `POST /api/swipe/undo`.
- [x] **Step 9:** Invalidate the cached user queue after decision and undo changes.

### Task 9 Review Notes

- The user queue is cached in Redis for five minutes and invalidated after
  decision and undo mutations.
- Queue candidates are ordered by `views DESC, _id ASC` and exclude the merged
  MongoDB plus pending Redis state.
- Automated checks were not run because they were not authorized.

**Exit criteria:** The backend owns queue composition and supports all three MVP decisions plus one-step undo.

## Task 10: Implement Lists API

**Files:**

- Create: `apps/api/src/endpoints/lists/lists.module.ts`
- Create: `apps/api/src/endpoints/lists/controllers/lists.controller.ts`
- Create: `apps/api/src/endpoints/lists/services/lists.service.ts`
- Create: `apps/api/src/endpoints/lists/dto/listQuery.dto.ts`
- Create: `apps/api/src/endpoints/lists/dto/updateGameStatusBody.dto.ts`
- Create: `apps/api/src/shared/functions/cursor/encodeCursor.ts`
- Create: `apps/api/src/shared/functions/cursor/decodeCursor.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [x] **Step 1:** Implement opaque cursors based on `updatedAt + _id`.
- [x] **Step 2:** Implement `GET /api/lists/:status` with a default limit of 20.
- [x] **Step 3:** Merge MongoDB and pending Redis states before pagination output.
- [x] **Step 4:** Return complete game cards with list metadata.
- [x] **Step 5:** Implement `PATCH /api/lists/games/:gameId`.
- [x] **Step 6:** Implement `DELETE /api/lists/games/:gameId`.
- [x] **Step 7:** Reuse the same write-behind and undo semantics as swipe decisions.
- [x] **Step 8:** Invalidate list and queue cache keys after mutations.

### Task 10 Review Notes

- Cursors encode `updatedAt` plus the game MongoDB `_id`, which is available
  for both persisted and pending states and provides a stable tie-breaker.
- List pages use versioned Redis cache keys. Every shared write-behind mutation,
  including swipe decisions and undo, invalidates the queue and advances the
  list cache namespace.
- Automated checks were not run because they were not authorized.

**Exit criteria:** Users can paginate each list, move games, and remove decisions without separate persistence logic.

## Task 11: Build Frontend Application Foundation

**Files:**

- Create: `apps/web/src/app/providers/AppProviders.tsx`
- Create: `apps/web/src/app/providers/QueryProvider.tsx`
- Create: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/app/router/routes.ts`
- Create: `apps/web/src/app/styles/global.scss`
- Create: `apps/web/src/shared/api/httpClient.ts`
- Create: `apps/web/src/shared/api/queryClient.ts`
- Create: `apps/web/src/shared/api/apiError.ts`
- Create: `apps/web/src/entities/session/model/tokenStorage.ts`
- Create: `apps/web/src/entities/session/api/session.queries.ts`
- Create: `apps/web/src/entities/game/types/game.ts`
- Create: `apps/web/src/entities/userGameState/types/userGameStatus.ts`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/main.tsx`

- [x] **Step 1:** Configure React Router pages.
- [x] **Step 2:** Configure TanStack Query with memory-only cache.
- [x] **Step 3:** Implement a typed fetch client against `/api`.
- [x] **Step 4:** Attach the Bearer token from `localStorage`.
- [x] **Step 5:** Normalize API errors and handle `401` globally.
- [x] **Step 6:** Add an authenticated route boundary.
- [x] **Step 7:** Establish shared visual tokens based on the existing dark interface.

### Task 11 Review Notes

- React Router exposes auth, swipe, lists, and settings routes. Protected routes
  verify the stored bearer token through the session endpoint before rendering.
- TanStack Query uses its in-memory cache only; no persistence adapter or
  frontend business-state store was added.
- A `401` clears the token and in-memory query cache, which updates the
  authenticated route boundary and returns the user to the auth route.
- Automated checks were not run because they were not authorized.

**Exit criteria:** The frontend has routing, API access, session handling, and a coherent styling foundation without global business state.

## Task 12: Build Authentication And Settings Pages

**Files:**

- Create: `apps/web/src/pages/auth/AuthPage.tsx`
- Create: `apps/web/src/pages/auth/AuthPage.module.scss`
- Create: `apps/web/src/pages/auth/api/auth.mutations.ts`
- Create: `apps/web/src/pages/auth/hooks/useAuthPage.ts`
- Create: `apps/web/src/pages/settings/SettingsPage.tsx`
- Create: `apps/web/src/pages/settings/SettingsPage.module.scss`
- Create: `apps/web/src/pages/settings/api/token.query.ts`
- Create: `apps/web/src/widgets/appHeader/AppHeader.tsx`
- Create: `apps/web/src/widgets/appHeader/AppHeader.module.scss`

- [x] **Step 1:** Implement the create-user flow.
- [x] **Step 2:** Implement token paste and verification.
- [x] **Step 3:** Persist only the token in `localStorage`.
- [x] **Step 4:** Redirect authenticated users to swipe.
- [x] **Step 5:** Show and copy the decrypted token in settings.
- [x] **Step 6:** Implement logout by clearing the local token and query cache.
- [x] **Step 7:** Add navigation between swipe, lists, and settings.

### Task 12 Review Notes

- Create-user and token-restore flows share the session query cache and store
  only the bearer token in `localStorage`.
- Authenticated routes render through a shared header with swipe, lists,
  settings, and logout controls.
- Settings fetches the decrypted token only from the protected token endpoint
  and supports clipboard copy with a manual-copy fallback.
- Automated checks were not run because they were not authorized.

**Exit criteria:** A user can create or restore access, navigate the app, inspect the token, and log out.

## Task 13: Build Swipe Experience

**Files:**

- Create: `apps/web/src/pages/swipe/SwipePage.tsx`
- Create: `apps/web/src/pages/swipe/SwipePage.module.scss`
- Create: `apps/web/src/pages/swipe/api/swipe.queries.ts`
- Create: `apps/web/src/pages/swipe/api/swipe.mutations.ts`
- Create: `apps/web/src/pages/swipe/hooks/useSwipeQueue.ts`
- Create: `apps/web/src/widgets/swipeDeck/SwipeDeck.tsx`
- Create: `apps/web/src/widgets/swipeDeck/SwipeDeck.module.scss`
- Create: `apps/web/src/widgets/swipeDeck/hooks/useSwipeGesture.ts`
- Create: `apps/web/src/entities/game/ui/GameCard.tsx`
- Create: `apps/web/src/entities/game/ui/GameCard.module.scss`

- [x] **Step 1:** Fetch the backend-owned 20-card queue.
- [x] **Step 2:** Implement right, left, and up gestures.
- [x] **Step 3:** Add buttons for bookmark, trash, and played.
- [x] **Step 4:** Add keyboard shortcuts without triggering inside form controls.
- [x] **Step 5:** Apply optimistic card removal.
- [x] **Step 6:** Roll back the exact card and queue state when a mutation fails.
- [x] **Step 7:** Request a refreshed queue when approximately five cards remain.
- [x] **Step 8:** Implement one-step undo and restore the returned card state.
- [x] **Step 9:** Open the F95 thread in a new browser tab.
- [x] **Step 10:** Preserve and improve the existing card information hierarchy.

### Task 13 Review Notes

- The displayed queue is local UI state backed by the server-owned queue query.
  Decisions remove the exact leading card optimistically and restore the
  captured queue snapshot if the mutation fails.
- Queue refills merge newly fetched cards without duplicates when five or fewer
  cards remain. Undo prepends the server-returned card when the restored status
  is undecided.
- Pointer gestures use browser Pointer Events with no added dependency.
  Keyboard shortcuts ignore interactive and editable targets.
- Automated checks were not run because the user explicitly prohibited them
  for this task.

**Exit criteria:** Swipe gestures, buttons, keyboard controls, optimistic updates, undo, and queue refill work against the API.

## Task 14: Build Lists And Image Viewer

**Files:**

- Create: `apps/web/src/pages/lists/ListsPage.tsx`
- Create: `apps/web/src/pages/lists/ListsPage.module.scss`
- Create: `apps/web/src/pages/lists/api/lists.queries.ts`
- Create: `apps/web/src/pages/lists/api/lists.mutations.ts`
- Create: `apps/web/src/pages/lists/hooks/useGameList.ts`
- Create: `apps/web/src/widgets/gameLists/GameLists.tsx`
- Create: `apps/web/src/widgets/gameLists/GameLists.module.scss`
- Create: `apps/web/src/entities/game/ui/GameListItem.tsx`
- Create: `apps/web/src/widgets/imageViewer/ImageViewer.tsx`
- Create: `apps/web/src/widgets/imageViewer/ImageViewer.module.scss`
- Create: `apps/web/src/widgets/imageViewer/hooks/useImageViewer.ts`

- [x] **Step 1:** Implement bookmark, trash, and played tabs.
- [x] **Step 2:** Implement cursor-based infinite loading.
- [x] **Step 3:** Move games between lists with optimistic updates.
- [x] **Step 4:** Delete a decision and remove the item from its list.
- [x] **Step 5:** Invalidate the swipe queue after list changes.
- [x] **Step 6:** Open F95 threads in a new tab.
- [x] **Step 7:** Implement fullscreen cover and screenshot viewing.
- [x] **Step 8:** Support Escape and left/right arrow controls in the viewer.

### Task 14 Review Notes

- Each status uses a cursor-backed TanStack infinite query. Loaded pages remain
  separated in the query cache while the UI renders their flattened items.
- Move and delete mutations snapshot every loaded list cache, apply optimistic
  changes across source and target lists, and restore the full snapshot on
  failure. Successful mutations invalidate all lists and the swipe queue.
- The shared fullscreen viewer opens covers and screenshots, locks background
  scrolling, and supports overlay close, Escape, and circular arrow navigation.
- Automated checks were not run because the user explicitly prohibited them
  for this task.

**Exit criteria:** All three lists are usable, paginated, mutable, and integrated with the shared image viewer.

## Task 15: Add Catalog Progress UI

**Files:**

- Create: `apps/web/src/entities/game/api/catalogSync.query.ts`
- Create: `apps/web/src/entities/game/api/catalogSync.events.ts`
- Create: `apps/web/src/entities/game/hooks/useCatalogSyncStatus.ts`
- Create: `apps/web/src/widgets/catalogProgress/CatalogProgress.tsx`
- Create: `apps/web/src/widgets/catalogProgress/CatalogProgress.module.scss`
- Modify: `apps/web/src/pages/swipe/SwipePage.tsx`
- Modify: `apps/web/src/pages/auth/AuthPage.tsx`

- [x] **Step 1:** Fetch the current sync snapshot.
- [x] **Step 2:** Subscribe to SSE progress events.
- [x] **Step 3:** Reconnect SSE and reconcile with the status endpoint.
- [x] **Step 4:** Show determinate progress when total pages are known.
- [x] **Step 5:** Show indeterminate progress and page counters otherwise.
- [x] **Step 6:** Display retry time and recoverable source errors.
- [x] **Step 7:** Replace `catalog_not_ready` errors with the progress experience.

### Task 15 Review Notes

- The catalog status query provides the reload-safe snapshot. Named SSE events
  update the same TanStack Query cache, while every connection open or error
  reconciles again through the status endpoint.
- The shared progress widget shows determinate progress when total pages are
  known, an indeterminate bar otherwise, page and game counters, retry time,
  and recoverable source errors.
- Auth always exposes the current catalog state. Swipe replaces
  `catalog_not_ready` with the progress widget and retries the queue once the
  initial import reports `completed`.
- Automated checks were not run because the user explicitly prohibited them
  for this task.

**Exit criteria:** Users see durable import/update progress before and after browser reloads.

## Task 16: Add Deployment Configuration

**Files:**

- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `compose.yaml`
- Create: `.dockerignore`
- Create: `.env.example`
- Modify: `README.md`

- [x] **Step 1:** Build the API as a production Node image.
- [x] **Step 2:** Build the SPA and serve it through Nginx.
- [x] **Step 3:** Proxy `/api` to the API container.
- [x] **Step 4:** Disable Nginx buffering for catalog SSE.
- [x] **Step 5:** Add MongoDB and Redis services with named volumes.
- [x] **Step 6:** Add health checks and dependency conditions.
- [x] **Step 7:** Document local workspace and Docker Compose startup.
- [x] **Step 8:** Document required secrets, especially the token encryption key.

### Task 16 Review Notes

- The API image builds the Nest application, installs production runtime
  dependencies, includes catalog seed resources, and runs as the non-root
  `node` user.
- The shared contracts package now exposes its compiled `dist` entrypoint so
  backend runtime constants are present in the production dependency graph.
- Nginx serves the SPA, proxies `/api` to the API service, and disables
  buffering specifically for catalog progress SSE.
- Compose waits for MongoDB and Redis health before starting the API, then
  waits for API readiness before starting the public web service. MongoDB and
  Redis use named persistent volumes.
- The Vite development server proxies `/api` to the local API so the documented
  workspace startup uses the same relative API paths as production.
- Automated checks and container builds were not run because the user
  explicitly prohibited them for this task.

**Exit criteria:** The complete stack runs behind one origin with persistent MongoDB and required Redis.

## Task 17: Add Focused Automated Coverage

**Files:**

- Create: `apps/api/src/integrations/f95/functions/normalizeF95Game.spec.ts`
- Create: `apps/api/src/endpoints/catalog/services/catalogSync.service.spec.ts`
- Create: `apps/api/src/infrastructure/security/services/token.service.spec.ts`
- Create: `apps/api/src/infrastructure/database/services/gameDecisionWriteBehind.service.spec.ts`
- Create: `apps/api/src/endpoints/swipe/services/swipeQueue.service.spec.ts`
- Create: `apps/api/src/endpoints/lists/services/lists.service.spec.ts`
- Create: `apps/web/src/pages/auth/AuthPage.test.tsx`
- Create: `apps/web/src/widgets/swipeDeck/SwipeDeck.test.tsx`
- Create: `apps/web/src/widgets/gameLists/GameLists.test.tsx`
- Create: `apps/web/src/widgets/imageViewer/ImageViewer.test.tsx`
- Create: `apps/web/e2e/user-flow.spec.ts`

- [ ] **Step 1:** Cover F95 normalization and malformed responses.
- [ ] **Step 2:** Cover import checkpoint, retry, rescan, and watermark behavior.
- [ ] **Step 3:** Cover token hash/encryption round trips without exposing secrets.
- [ ] **Step 4:** Cover concurrent write-behind updates and exact-version cleanup.
- [ ] **Step 5:** Cover queue exclusion using MongoDB plus pending Redis.
- [ ] **Step 6:** Cover list cursor ordering and pending-state overlay.
- [ ] **Step 7:** Cover frontend optimistic rollback and undo.
- [ ] **Step 8:** Cover the full create-user to list-management flow with mocked F95 HTTP.

**Exit criteria:** High-risk behavior has focused automated coverage without calling the real F95 service.

## Task 18: Cut Over And Remove Legacy Electron Code

**Files:**

- Delete after acceptance: `electron/`
- Delete after acceptance: `scripts/electron-dev.cjs`
- Delete after acceptance: `scripts/electron-launch.cjs`
- Delete after acceptance: legacy root `src/`
- Delete after acceptance: legacy root `vite.config.ts`
- Delete after acceptance: legacy root `index.html`
- Delete after acceptance: legacy Electron build configuration in `package.json`
- Review: `public/`
- Review: `mock/`
- Modify: `README.md`

- [x] **Step 1:** Compare the implemented MVP against the approved design.
- [ ] **Step 2:** Manually verify preserved visual and interaction behavior.
- [x] **Step 3:** Move any still-required static assets into the new apps.
- [x] **Step 4:** Remove Electron and legacy renderer code only after acceptance.
- [x] **Step 5:** Remove obsolete dependencies and scripts.
- [x] **Step 6:** Update documentation to describe only the new architecture.
- [ ] **Step 7:** Run the approved final verification matrix.

### Task 18 Review Notes

- The implemented routes and UI were compared statically with the approved MVP
  design. Authentication, swipe decisions and undo, lists, image viewing,
  catalog progress, and the Docker web deployment are represented in the new
  architecture.
- The shared tag and prefix resources already live in `apps/api/resources`.
  The favicon was moved to `apps/web/public`; legacy Electron icons, filters,
  and the old catalog mock are not used by the web service.
- The Electron runtime, launcher scripts, legacy renderer, old mock catalog,
  root Vite/TypeScript configuration, Electron dependencies, and builder
  configuration were removed after explicit approval.
- `pnpm-lock.yaml` still requires regeneration after dependency installation is
  separately approved.
- Manual interaction verification and the final verification matrix were not
  run because the user explicitly prohibited checks without separate approval.

**Exit criteria:** The repository contains only the new web architecture and required assets, with no Electron runtime or legacy business logic.

## Recommended Implementation Order

1. Workspace and contracts.
2. Infrastructure and catalog storage.
3. Reliable initial import, retries, cron, and SSE.
4. NestJS architecture audit for all completed backend work.
5. Token authentication.
6. User state write-behind.
7. Swipe and lists API.
8. Frontend foundation and auth.
9. Swipe UI, lists, viewer, and progress.
10. Docker deployment.
11. Coverage, acceptance, and legacy removal.

## Review Gates

- **Gate A:** Approve workspace and API contracts before building domain modules.
- **Gate B:** Demonstrate restartable full import before implementing user features.
- **Gate B2:** Complete the NestJS architecture audit before implementing authentication and user state.
- **Gate C:** Demonstrate Redis/Mongo merged state and safe flush before frontend mutations.
- **Gate D:** Approve auth, swipe, lists, viewer, keyboard controls, and progress UI before deleting legacy code.
- **Gate E:** Remove Electron only after the Dockerized web stack satisfies the MVP acceptance flow.
