# F95 Tinder Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить обнаруженные дефекты, завершить заявленный MVP и подготовить сервис к безопасной эксплуатации и дальнейшему развитию рекомендаций.

**Architecture:** Сохраняется существующее разделение на NestJS API, React SPA, MongoDB, Redis/BullMQ и общий пакет контрактов. Работа выполняется по вертикальным сценариям: сначала корректность пользовательских решений, затем импорт каталога, безопасность, frontend, наблюдаемость и только после этого дополнительные продуктовые возможности.

**Tech Stack:** TypeScript, NestJS 11, Fastify, Mongoose, Redis/ioredis, BullMQ, React 19, TanStack Query, Vite, Docker Compose.

---

## Execution Rules

- Не изменять старый удаляемый Electron-код.
- Не выполнять попутные рефакторинги.
- Не добавлять runtime-зависимости без отдельного согласования.
- Не добавлять тестовую инфраструктуру, тестовые зависимости и тестовые scripts.
- Команды линтинга, сборки и typecheck выполнять только после явного разрешения пользователя.
- Не создавать commits и не изменять Git index без явного запроса.
- Каждый этап должен завершаться рабочим вертикальным сценарием и отдельным review diff.

## Target File Map

### Decision persistence

- Modify: `apps/api/src/infrastructure/database/services/gameDecisionWriteBehind.service.ts`
- Modify: `apps/api/src/infrastructure/database/types/pendingGameDecision.ts`
- Modify: `apps/api/src/entities/userGameState/services/userGameState.repository.ts`
- Modify: `apps/api/src/entities/userGameState/schemas/userGameState.schema.ts`
- Modify: `apps/api/src/endpoints/swipe/services/swipeDecision.service.ts`
- Modify: `apps/api/src/endpoints/lists/services/lists.service.ts`

### Catalog synchronization

- Modify: `apps/api/src/endpoints/catalog/services/catalogSync.service.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Modify: `apps/api/src/infrastructure/cache/services/distributedLock.service.ts`
- Modify: `apps/api/src/integrations/f95/services/f95Latest.client.ts`
- Modify: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Modify: `apps/api/src/infrastructure/config/config.service.ts`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`
- Create: `apps/api/src/infrastructure/observability/` in Task 15

### Authentication and protection

- Modify: `apps/api/src/infrastructure/security/services/token.service.ts`
- Modify: `apps/api/src/infrastructure/security/guards/bearerToken.guard.ts`
- Modify: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Modify: `apps/api/src/endpoints/auth/services/auth.service.ts`
- Modify: `apps/api/src/entities/user/services/user.repository.ts`
- Modify: token configuration files and examples
- Create: a small Redis-backed request limiter inside `infrastructure/security` if no dependency is approved

### Contracts and taxonomy

- Modify: `packages/contracts/src/game/game.contracts.ts`
- Modify: `packages/contracts/src/catalog/catalog.contracts.ts`
- Modify: `apps/api/src/shared/functions/game/toGameDto.ts`
- Modify: `apps/api/src/entities/tag/services/tag.repository.ts`
- Modify: `apps/api/src/entities/prefix/services/prefix.repository.ts`
- Modify: `apps/api/src/entities/game/services/game.repository.ts`

### Frontend MVP

- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/pages/swipe/SwipePage.tsx`
- Modify: `apps/web/src/widgets/imageViewer/ImageViewer.tsx`
- Modify: `apps/web/src/widgets/imageViewer/hooks/useImageViewer.ts`
- Modify: `apps/web/src/pages/auth/hooks/useAuthPage.ts`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/shared/api/httpClient.ts`
- Modify: relevant SCSS modules

### Operations and documentation

- Modify: `apps/api/src/infrastructure/health/health.service.ts`
- Modify: `apps/api/src/infrastructure/health/health.controller.ts`
- Modify: `apps/web/nginx.conf`
- Modify: `compose.yaml`
- Modify: `README.md`
- Create: `docs/operations.md`

---

## Phase 1: Data Correctness

### Task 1: Document Decision Invariants

**Purpose:** Зафиксировать ожидаемое поведение Redis/Mongo write-behind до изменения сложной конкурентной логики.

- [x] **Step 1: Document current state transitions**

Add a concise engineering note to the implementation task describing:

```text
first decision -> undo restores no decision
move bookmark -> played -> undo restores bookmark
delete decision -> queue contains game again
old flush cannot overwrite a newer decision
flush removes processed Redis entries only when versions still match
```

- [x] **Step 2: Document concurrency invariants**

```text
versions increase monotonically per user
only the current pending version may be removed from Redis
an older flush cannot overwrite or delete a newer state
undo applies only to the exact decision version it was created for
MongoDB stores only active decisions
```

- [x] **Step 3: Use these scenarios for implementation review**

Inspect each changed branch against the documented transitions before completing Tasks 2–4.

**Engineering note**

Definitions:

- An active decision is the user's current non-null status for a game.
- A pending tombstone is a versioned Redis delete awaiting removal of the active MongoDB decision.
- An undo record stores the exact decision version and previous active decision or absence to restore.

Current state transitions:

- A first decision creates an active pending state; undo restores absence of a decision.
- Moving a game from bookmark to played creates a new played decision; undo restores bookmark.
- Deleting a decision creates a pending tombstone; after it is applied, the game is undecided and returns to the queue.
- MongoDB set/delete applies only when the persisted version is older than the flushed version.
- Redis cleanup removes only the exact flushed version; a mismatch skips cleanup and preserves the newer state.

Concurrency invariants:

- One version counter is global per user and increases monotonically across all game decisions by that user.
- Only the current pending version may be removed from Redis.
- An older flush cannot overwrite or delete a newer Redis or MongoDB state; every version mismatch is a no-op.
- Undo applies only when the current decision version exactly matches the version for which the undo record was created.
- MongoDB stores active decisions only; deletion tombstones remain transient Redis state and remove the MongoDB document when applied.

Review checklist:

- Task 2: undo restores the recorded active decision or absence only for its exact decision version.
- Task 3: set/delete flushes require an older persisted version, and Redis cleanup requires an exact pending version.
- Task 4: list and queue overlays treat active pending decisions and tombstones consistently without duplicates or stale visibility.

**Acceptance:** Required transitions and concurrency rules are explicit before implementation starts.

### Task 2: Fix Undo Serialization and Semantics

**Files:**

- Modify: `apps/api/src/infrastructure/database/services/gameDecisionWriteBehind.service.ts`

- [x] **Step 1: Replace ambiguous `cjson.null` object access**

Store an explicit previous-state shape:

```ts
type UndoState =
  | { kind: 'absent' }
  | {
      kind: 'present';
      status: UserGameStatus;
      updatedAt: string;
      version: number;
    };
```

The Lua payload must branch on `undo.previous.kind`, never on truthiness of `cjson.null`.

- [x] **Step 2: Make undo compare-and-set explicit**

Undo succeeds only if the current pending decision version equals `decisionVersion`. If another decision happened afterward, return a distinct conflict result instead of silently treating it as missing.

- [x] **Step 3: Map conflict to an API error**

Use:

```text
409 undo_conflict
404 undo_not_available
```

- [x] **Step 4: Keep the 10-minute TTL behavior**

Expiry remains based on the latest successful decision.

- [x] **Step 5: Review all undo scenarios**

Expected results:

```text
first decision undo -> status null and game returned
move undo -> previous status returned
second decision invalidates undo for the first decision
expired undo -> 404
```

**Acceptance:** No Lua branch attempts to index JSON null; undo has deterministic conflict semantics.

### Task 3: Formalize Deletion Without Permanent Null States

**Decision:** Preserve versioned tombstones in Redis, but do not retain `status: null` documents in MongoDB.

**Files:**

- Modify: `apps/api/src/infrastructure/database/types/pendingGameDecision.ts`
- Modify: `apps/api/src/entities/userGameState/services/userGameState.repository.ts`
- Modify: `apps/api/src/entities/userGameState/schemas/userGameState.schema.ts`
- Modify: `apps/api/src/infrastructure/database/services/gameDecisionWriteBehind.service.ts`

- [x] **Step 1: Replace nullable status with an operation**

Use a discriminated union:

```ts
type PendingGameDecision =
  | {
      operation: 'set';
      gameId: string;
      status: UserGameStatus;
      updatedAt: string;
      version: number;
    }
  | {
      operation: 'delete';
      gameId: string;
      updatedAt: string;
      version: number;
    };
```

- [x] **Step 2: Update merge logic**

`set` replaces the merged state; `delete` removes it.

- [x] **Step 3: Split persistence operations**

For every flush:

```text
set operations -> version-guarded bulkWrite upserts
delete operations -> version-guarded deleteOne operations
```

Use `{ userId, gameId, version: { $lt: incomingVersion } }` as the delete guard. Keep one globally deduplicated BullMQ flush job and preserve the existing Redis compare-and-delete cleanup, so a decision created during a flush remains pending for the next flush. Document this invariant in the repository.

- [x] **Step 4: Remove nullable schema state**

Make `status` required and remove `default: null`. Add a one-time migration instruction for existing null documents:

```javascript
db.userGameStates.deleteMany({ status: null })
```

- [x] **Step 5: Verify queue and list behavior**

Deletion must immediately remove the game from lists through merged Redis state and return it to the next queue response.

**Acceptance:** MongoDB contains only actual decisions; deletion remains safe against delayed flushes.

### Task 4: Make List Pagination Repository-Driven

**Problem:** Current list reads load every user state into memory, sort it in Node and then paginate. This will degrade as account history grows.

**Files:**

- Modify: `apps/api/src/entities/userGameState/services/userGameState.repository.ts`
- Modify: `apps/api/src/endpoints/lists/services/lists.service.ts`

- [x] **Step 1: Add a paginated repository query**

Repository API:

```ts
findPageByUserAndStatus(
  userId: string,
  status: UserGameStatus,
  limit: number,
  cursor: CursorValue | null,
): Promise<UserGameStateRecord[]>
```

Query by `{ userId, status }`, apply `(updatedAt, _id)` cursor predicate, sort descending and request `limit + 1`.

- [x] **Step 2: Overlay pending Redis decisions**

Because pending decisions are few, merge them with the Mongo page and request additional Mongo records only when pending changes remove or move items out of the page.

- [x] **Step 3: Preserve opaque cursor behavior**

The cursor continues to encode only `updatedAt` and stable document/game identifier.

- [x] **Step 4: Add boundary cases**

Cover identical timestamps, pending move, pending delete, empty page and no duplicates across pages.

**Acceptance:** List response cost is bounded by page size plus pending decisions, not total account history.

---

## Phase 2: Catalog Reliability

### Task 5: Honor Retry-After and Add Request Timeouts

**Files:**

- Modify: `apps/api/src/integrations/f95/services/f95Latest.client.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Modify: configuration files

- [x] **Step 1: Add configurable request timeout**

Add `F95_REQUEST_TIMEOUT_MS`, defaulting to `30000`, validated as a positive integer.

- [x] **Step 2: Combine caller abort and timeout abort**

The client must abort when either signal fires and normalize timeout as a retryable integration error.

- [x] **Step 3: Use server retry guidance**

Processor delay:

```ts
const delay = Math.max(
  configuredBackoff,
  integrationError.retryAfterMilliseconds ?? 0,
);
```

Apply an upper bound such as 24 hours to reject pathological headers.

- [x] **Step 4: Add response diagnostics**

Record status code, error code, page and retry delay without logging response bodies or secrets.

**Acceptance:** A stalled F95 request cannot hold a worker indefinitely; HTTP 429 controls the next retry time.

### Task 6: Make Sync Resume and Lock Ownership Robust

**Files:**

- Modify: `apps/api/src/endpoints/catalog/services/catalogSync.service.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Modify: `apps/api/src/infrastructure/cache/services/distributedLock.service.ts`

- [ ] **Step 1: Define resume behavior**

Initial import retry must:

```text
rescan page 1 through saved checkpoint
continue from checkpoint + 1
retain a monotonic processed count for the current attempt only
never mark completed until the final page succeeds
```

- [ ] **Step 2: Detect lock loss**

Refresh must return ownership status. After any failed refresh, abort the running sync through an `AbortController` and do not write `completed`.

- [ ] **Step 3: Add a lock-fencing token**

Acquire a monotonically increasing Redis fencing token together with the lock. Store it in `syncStates.activeFenceToken`; every sync-state update filters by the worker's token. Verify lock ownership immediately before each page upsert. Game upserts remain idempotent, while stale workers are prevented from publishing progress or completion.

- [ ] **Step 4: Deduplicate queued sync jobs**

Give initial and daily jobs stable job IDs and explicitly handle “already queued/running” as a no-op.

- [ ] **Step 5: Review restart scenarios**

Trace failure before checkpoint, after checkpoint, during final page, during lock loss and during daily watermark traversal.

**Acceptance:** At most one valid owner writes sync progress; restart cannot falsely complete or skip pages.

### Task 7: Make Sync Events Multi-Instance Safe

**Files:**

- Modify: `apps/api/src/endpoints/catalog/services/catalogSyncProgress.service.ts`
- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/infrastructure/cache/cache.module.ts`

- [ ] **Step 1: Replace process-local Subject as the source of truth**

Publish catalog status to a Redis pub/sub channel after MongoDB state is saved.

- [ ] **Step 2: Use a dedicated Redis subscriber connection**

ioredis subscriber mode cannot share the command connection. Create and close a dedicated subscriber lifecycle.

- [ ] **Step 3: Keep snapshot-first SSE**

Each connection receives:

```text
current MongoDB snapshot
then Redis-published updates
periodic heartbeat comment/event
```

- [ ] **Step 4: Handle reconnect**

Frontend continues to re-fetch `/catalog/sync/status` before or after reconnect so dropped pub/sub events cannot corrupt displayed state.

**Acceptance:** SSE clients connected to any API instance observe the same progress.

---

## Phase 3: Security and Session Recovery

### Task 8: Add Abuse Protection

**Files:**

- Create: `apps/api/src/infrastructure/security/services/requestRateLimiter.service.ts`
- Create: `apps/api/src/infrastructure/security/guards/rateLimit.guard.ts`
- Modify: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Modify: protected mutation controllers as needed
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Trust proxy deliberately**

Configure Fastify proxy trust only for the deployed reverse proxy topology so client IP extraction is predictable.

- [ ] **Step 2: Implement Redis-backed fixed/sliding window limits**

Minimum policies:

```text
POST /auth/createUser: strict per-IP hourly limit
GET /auth/session: moderate per-IP limit
mutation endpoints: per-user burst limit
```

- [ ] **Step 3: Return standard headers and errors**

Return `429 rate_limited` with `Retry-After`.

- [ ] **Step 4: Avoid logging bearer tokens**

Review exception/log serialization and redact `Authorization`.

**Acceptance:** Anonymous user creation cannot be spammed without bound; normal swipe bursts remain responsive.

### Task 9: Support Encryption Key Rotation

**Files:**

- Modify: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Modify: `apps/api/src/infrastructure/config/config.service.ts`
- Modify: `apps/api/src/infrastructure/security/services/token.service.ts`
- Modify: `apps/api/src/endpoints/auth/services/auth.service.ts`
- Modify: env examples and README

- [ ] **Step 1: Replace one key with a versioned keyring**

Configuration shape:

```text
TOKEN_ENCRYPTION_CURRENT_VERSION=v2
TOKEN_ENCRYPTION_KEYS={"v1":"...base64...","v2":"...base64..."}
```

- [ ] **Step 2: Encrypt only with the current key**

New users always store the current version.

- [ ] **Step 3: Decrypt by stored version**

Unknown key versions produce a controlled server configuration error without exposing details to the client.

- [ ] **Step 4: Re-encrypt on token retrieval**

When a token is decrypted with an old key, persist encryption under the current key in the same request.

- [ ] **Step 5: Document rotation order**

Add new key, deploy, migrate/observe, then remove old key only after no records reference it.

**Acceptance:** Existing accounts survive key rotation without resetting tokens.

### Task 10: Fix Session Error Routing

**Files:**

- Modify: `apps/web/src/shared/api/httpClient.ts`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/pages/auth/hooks/useAuthPage.ts`

- [ ] **Step 1: Distinguish invalid credentials from network failure**

`401` clears token and routes to auth. Network/5xx retains token and displays a retryable outage state.

- [ ] **Step 2: Remove transient token persistence during verification**

Verify an entered token without committing it permanently first. Extend the HTTP client with an explicit bearer override:

```ts
request(path, { bearerToken: candidateToken })
```

Persist the candidate only after successful `/auth/session`.

- [ ] **Step 3: Preserve redirect destination**

After successful restoration, return to the originally requested route.

- [ ] **Step 4: Add recovery controls**

Authenticated outage screen gets `Retry` and `Use another token`, not only “reload”.

**Acceptance:** Invalid tokens return to auth; temporary API failure does not destroy a valid local session.

---

## Phase 4: Complete the MVP UI

### Task 11: Add Swipe-Page Fullscreen Gallery

**Files:**

- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/pages/swipe/SwipePage.tsx`
- Modify: `apps/web/src/widgets/imageViewer/ImageViewer.tsx`
- Modify: relevant SCSS modules

- [ ] **Step 1: Make cover and screenshots buttons**

Expose:

```ts
onOpenImages(images: string[], startIndex: number): void
```

Do not use external image anchors for gallery navigation.

- [ ] **Step 2: Reuse `useImageViewer` in SwipePage**

Build one image array containing cover first, followed by screenshots.

- [ ] **Step 3: Improve dialog accessibility**

Add initial focus, focus trap, focus restoration, descriptive alt text and prevent background interaction.

- [ ] **Step 4: Keep keyboard responsibilities isolated**

When the viewer is open, arrow keys navigate images and must not trigger swipe decisions.

**Acceptance:** Cover and every screenshot open in the same fullscreen viewer on swipe and list pages.

### Task 12: Return Taxonomy Names Instead of Numeric IDs

**Files:**

- Modify: `packages/contracts/src/game/game.contracts.ts`
- Modify: `apps/api/src/shared/functions/game/toGameDto.ts`
- Modify: taxonomy repositories
- Modify: queue/list services
- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/entities/game/ui/GameListItem.tsx`

- [ ] **Step 1: Extend the contract**

Use:

```ts
interface GameTaxonomyItem {
  id: number;
  name: string;
}

interface GameDto {
  tags: GameTaxonomyItem[];
  prefixes: GameTaxonomyItem[];
}
```

Remove raw IDs from the public contract only after all callers migrate, or keep them temporarily for compatibility during one task.

- [ ] **Step 2: Add bulk lookup methods**

Resolve all unique IDs for a response in two bulk queries, never one query per game.

- [ ] **Step 3: Build DTOs with lookup maps**

Unknown IDs remain visible with a neutral fallback such as `Unknown tag #123`, making stale resource files observable.

- [ ] **Step 4: Render chips**

Use readable names, compact overflow and accessible labels.

**Acceptance:** Users never need to interpret raw taxonomy numbers.

### Task 13: Improve Swipe Queue State Management

**Files:**

- Modify: `apps/web/src/pages/swipe/hooks/useSwipeQueue.ts`
- Modify: `apps/web/src/pages/swipe/api/swipe.queries.ts`
- Modify: `apps/api/src/endpoints/swipe/services/swipeQueue.service.ts`

- [ ] **Step 1: Prevent stale cache reuse after decisions**

Ensure every accepted decision invalidates the server queue cache and every client refill receives a newly computed queue.

- [ ] **Step 2: Avoid closure-based rollback races**

Serialize mutations or use reducer state with operation IDs so rapid keyboard/pointer input cannot restore an obsolete `items` array.

- [ ] **Step 3: Preserve more than one client-side card**

Refill should merge unique games and never reorder the current top card.

- [ ] **Step 4: Handle partial exhaustion**

Differentiate:

```text
catalog has no undecided games
temporary queue request failure
catalog still importing
```

**Acceptance:** Rapid input, failed mutation and background refill cannot duplicate or lose cards.

### Task 14: Finish UX and Accessibility Pass

**Files:**

- Modify: page/components and SCSS modules touched above
- Modify: `apps/web/src/app/styles/global.scss`

- [ ] **Step 1: Add loading skeletons and stable layout**

Avoid large content jumps on cards, lists and images.

- [ ] **Step 2: Add visible focus and reduced motion**

Respect `prefers-reduced-motion`; swipe animations must not be required to understand state.

- [ ] **Step 3: Add image failure fallbacks**

Broken remote covers/screenshots render a placeholder and do not collapse controls.

- [ ] **Step 4: Add mutation feedback**

Expose concise status for move/delete/copy operations and preserve error details long enough to retry.

- [ ] **Step 5: Verify responsive layouts**

Review narrow mobile, tablet and desktop widths for header, action buttons, cards, lists and dialog.

**Acceptance:** All primary workflows are keyboard-operable, responsive and understandable without animation.

---

## Phase 5: Operations and Observability

### Task 15: Add Structured Operational Logging

**Files:**

- Create or modify focused files under `apps/api/src/infrastructure/observability/`
- Modify: `apps/api/src/main.ts`
- Modify: catalog processor and decision flush processor

- [ ] **Step 1: Define event fields**

Minimum fields:

```text
event
requestId/jobId
userIdHash when needed
sync kind/page/attempt
durationMs
result
errorCode
```

Never log tokens, encryption material, complete request bodies or image/catalog payloads.

- [ ] **Step 2: Add request correlation**

Accept or generate a request ID and return it in response headers.

- [ ] **Step 3: Log worker lifecycle**

Log sync start/page/retry/completion, lock loss, flush counts and failures.

- [ ] **Step 4: Keep logging implementation dependency-free initially**

Use Nest logger with JSON-serializable context unless a logging dependency is separately approved.

**Acceptance:** Production failures can be correlated without exposing credentials.

### Task 16: Separate Liveness, Readiness and Diagnostics

**Files:**

- Modify: `apps/api/src/infrastructure/health/health.controller.ts`
- Modify: `apps/api/src/infrastructure/health/health.service.ts`
- Modify: `compose.yaml`
- Modify: `README.md`

- [ ] **Step 1: Add liveness endpoint**

`/api/health/live` verifies only that the process event loop can respond.

- [ ] **Step 2: Keep readiness dependency-aware**

`/api/health/ready` verifies MongoDB and Redis with bounded timeouts.

- [ ] **Step 3: Add non-secret catalog diagnostics**

Expose last successful sync, phase, retry time and catalog game count either in readiness details or a protected operations endpoint.

- [ ] **Step 4: Update container healthchecks**

API container uses readiness; orchestration can use liveness separately.

**Acceptance:** A dependency outage marks the service unready without misrepresenting the process as dead.

### Task 17: Add an Explicit Operations Runbook

**Files:**

- Create: `docs/operations.md`
- Modify: `README.md`

- [ ] **Step 1: Document startup and recovery**

Cover MongoDB/Redis loss, failed initial import, stuck retry, key rotation and backup restore.

- [ ] **Step 2: Document data durability**

State clearly that decisions pending only in Redis can be lost if Redis persistence and volume are lost.

- [ ] **Step 3: Document migration commands**

Include null-state cleanup and any schema/index migration introduced by this plan.

- [ ] **Step 4: Document backup scope**

Back up MongoDB and Redis AOF/volume; verify restore in a disposable environment.

**Acceptance:** An operator can diagnose and recover the documented failure modes without reading source code.

---

## Phase 6: Quality Gates

### Task 18: Complete Final Implementation Review

- [ ] **Step 1: Review backend invariants**

Trace token encryption and rotation, cursor validation, retry delay selection, catalog checkpoints, decision ordering, undo, move, delete and Redis outage handling through the final code.

- [ ] **Step 2: Review frontend workflows**

Trace session restoration, `401` handling, optimistic rollback, gallery keyboard isolation and catalog-not-ready recovery.

- [ ] **Step 3: Review complete user scenarios**

Use this manual acceptance checklist:

```text
create account
copy token
restore token in a clean browser context
swipe all three directions
undo
move and delete from lists
open cover/screenshots
reload and verify persistence
```

- [ ] **Step 4: Run only explicitly authorized non-test checks**

Build, typecheck and lint remain optional and require explicit permission.

- [ ] **Step 5: Record review and check results**

The implementation report must distinguish code review, manual checks and commands that were actually executed.

**Acceptance:** Every critical scenario has an explicit implementation path and a recorded review result.

### Task 19: Documentation and Contract Reconciliation

**Files:**

- Modify: `docs/superpowers/specs/2026-06-10-f95-tinder-rewrite-design.md`
- Modify: `README.md`
- Modify: OpenAPI decorators/DTOs where needed

- [ ] **Step 1: Reconcile deletion semantics**

Document Redis delete operations and absence of null Mongo states.

- [ ] **Step 2: Reconcile taxonomy contracts**

Document names returned to frontend.

- [ ] **Step 3: Reconcile sync and health behavior**

Document multi-instance SSE, timeout, lock loss, readiness and retry semantics.

- [ ] **Step 4: Reconcile security configuration**

Document rate limits, proxy assumptions and keyring format.

- [ ] **Step 5: Compare every MVP success criterion to implemented behavior**

Produce a short checklist with evidence from code review, manual checks or explicit “not verified” labels.

**Acceptance:** README, design specification, OpenAPI and actual runtime behavior describe the same system.

---

## Phase 7: Product Improvements After Stabilization

These are not blockers for correcting the current implementation. Start only after Phases 1–6 are accepted.

### Task 20: Filters and Sorting

Add backend-owned filters for tags, prefixes, rating, date and popularity. Keep filter state in URL search params and preserve the queue abstraction.

### Task 21: Recommendation Foundation

Store recommendation-ready events separately from the current final state:

```text
userId
gameId
action
occurredAt
algorithmVersion
```

Do not infer historical behavior solely from mutable `userGameStates`.

### Task 22: User Rating and Taste Profile

Add the planned 1–4 rating only after its semantics are specified. Separate “played status” from “liked/disliked score”.

### Task 23: Dashboard

Add counts, recent bookmarks, recently played games, undo availability and catalog freshness using dedicated aggregate endpoints rather than loading all lists.

### Task 24: Administrative Catalog Controls

Add protected/manual sync trigger, retry cancellation, current owner/job details and sync history. Define administrator authentication before exposing these endpoints.

---

## Recommended Execution Order

```text
1 -> 2 -> 3 -> 4
5 -> 6 -> 7
8 -> 9 -> 10
11 -> 12 -> 13 -> 14
15 -> 16 -> 17
18 -> 19
20+ only after stabilization
```

Tasks within different rows may be developed independently after their prerequisites, but review and release should preserve the phase order.

## Release Gates

### Gate A: Correctness

- Undo works for absent and existing previous decisions.
- MongoDB has no null decision documents.
- Stale flushes cannot overwrite or delete newer decisions.
- Pagination has no duplicates or omissions.

### Gate B: Reliability

- F95 requests time out.
- `Retry-After` is honored.
- Lock loss aborts sync.
- Restart resumes without false completion.
- SSE works across API instances.

### Gate C: Security

- Anonymous account creation is rate-limited.
- Tokens are never logged.
- Old encryption key versions remain decryptable during rotation.
- Temporary network failures do not erase valid sessions.

### Gate D: MVP Completion

- Swipe and list pages share fullscreen image viewing.
- Taxonomy names are readable.
- Keyboard, mobile and reduced-motion workflows work.
- Optimistic updates recover correctly.

### Gate E: Operability

- Structured logs and request/job IDs exist.
- Liveness and readiness are distinct.
- Recovery and backup procedures are documented.
- Critical user and failure scenarios have recorded review results.

## Explicit Open Decisions Before Implementation

1. Confirm whether deployment must support multiple API replicas immediately; if not, Task 7 can follow the first stable release, but should remain planned.
2. Choose rate-limit values based on expected traffic.
3. Choose whether operational/admin endpoints are postponed or require an administrator credential design now.
4. Confirm whether existing databases may contain `status: null` documents and require a production migration.
