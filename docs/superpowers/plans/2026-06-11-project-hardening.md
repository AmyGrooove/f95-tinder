# F95 Tinder Project Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить подтвержденные дефекты корректности, безопасности, масштабирования, восстановления сессии, UX и эксплуатации в текущем NestJS/React monorepo.

**Architecture:** Сохраняется существующее разделение на NestJS API, React SPA, MongoDB, Redis/BullMQ и общий пакет контрактов. Исправления выполняются вертикальными этапами: сначала корректность синхронизации и защита API, затем сессии и очередь свайпов, после этого эксплуатация, UI и очистка репозитория.

**Tech Stack:** TypeScript, NestJS 11, Fastify, Mongoose, Redis/ioredis, BullMQ, React 19, TanStack Query, Vite, Docker Compose.

---

## Execution Rules

- Не изменять удаляемый Electron-код.
- Не добавлять зависимости без отдельного согласования.
- Не создавать тестовую инфраструктуру и test scripts в рамках этого плана.
- Не запускать tests, lint, format, build или typecheck без явного разрешения.
- Не создавать commits и не изменять Git index без явного запроса.
- После каждой задачи выполнять review только затронутого diff.
- Каждый этап должен оставлять приложение в согласованном состоянии.

## Target File Map

### Catalog ownership and jobs

- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/infrastructure/cache/services/distributedLock.service.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Modify: `apps/api/src/infrastructure/scheduler/catalogSync.scheduler.ts`
- Modify: `apps/api/src/endpoints/catalog/services/catalogSync.service.ts`
- Modify: `apps/api/src/entities/syncState/schemas/syncState.schema.ts`
- Modify: `apps/api/src/entities/syncState/services/syncState.repository.ts`

### Security and sessions

- Create: `apps/api/src/infrastructure/security/services/requestRateLimiter.service.ts`
- Create: `apps/api/src/infrastructure/security/guards/rateLimit.guard.ts`
- Modify: `apps/api/src/infrastructure/security/security.module.ts`
- Modify: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Modify: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Modify: `apps/api/src/infrastructure/config/config.service.ts`
- Modify: `apps/api/src/infrastructure/security/services/token.service.ts`
- Modify: `apps/api/src/endpoints/auth/services/auth.service.ts`
- Modify: `apps/api/src/entities/user/services/user.repository.ts`
- Modify: `apps/web/src/shared/api/httpClient.ts`
- Modify: `apps/web/src/pages/auth/api/auth.mutations.ts`
- Modify: `apps/web/src/pages/auth/hooks/useAuthPage.ts`
- Modify: `apps/web/src/app/router/AppRouter.tsx`

### Multi-instance progress and operations

- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/infrastructure/cache/cache.module.ts`
- Modify: `apps/api/src/endpoints/catalog/services/catalogSyncProgress.service.ts`
- Modify: `apps/api/src/infrastructure/health/health.controller.ts`
- Modify: `apps/api/src/infrastructure/health/health.service.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/web/nginx.conf`
- Modify: `docker-compose.yaml`
- Create: `docs/operations.md`

### Swipe and UI

- Modify: `apps/web/src/pages/swipe/hooks/useSwipeQueue.ts`
- Modify: `apps/web/src/pages/swipe/api/swipe.mutations.ts`
- Modify: `packages/contracts/src/game/game.contracts.ts`
- Modify: `apps/api/src/shared/functions/game/toGameDto.ts`
- Modify: taxonomy repositories and modules under `apps/api/src/entities/tag/` and `apps/api/src/entities/prefix/`
- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/entities/game/ui/GameListItem.tsx`
- Modify: `apps/web/src/pages/swipe/SwipePage.tsx`
- Modify: `apps/web/src/widgets/imageViewer/ImageViewer.tsx`
- Modify: `apps/web/src/widgets/imageViewer/hooks/useImageViewer.ts`

### Repository hygiene

- Modify: `.gitignore`
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Remove from tracking when explicitly authorized: generated `*.tsbuildinfo` files

---

## Phase 1: Catalog Correctness

### Task 1: Abort Synchronization After Lock Loss

**Files:**

- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/infrastructure/cache/services/distributedLock.service.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`
- Modify: `apps/api/src/endpoints/catalog/services/catalogSync.service.ts`
- Modify: `apps/api/src/entities/syncState/schemas/syncState.schema.ts`
- Modify: `apps/api/src/entities/syncState/services/syncState.repository.ts`

- [ ] **Step 1: Extend the lock contract with a fencing token**

Define the acquired lock as:

```ts
export interface DistributedLock {
  key: string;
  owner: string;
  fenceToken: number;
}
```

Acquire the owner lock and monotonically increment a Redis fencing counter in one Lua script.

- [ ] **Step 2: Make refresh ownership explicit**

Keep `refresh(lock, ttlMilliseconds): Promise<boolean>`. A `false` result means ownership has already been lost and must never be ignored.

- [ ] **Step 3: Propagate an abort signal into synchronization**

Change the sync entry point to:

```ts
run(
  kind: CatalogSyncKind,
  ownership: { fenceToken: number; signal: AbortSignal },
): Promise<void>
```

Check `signal.throwIfAborted()` before every remote request, page upsert, progress write and final completion write.

- [ ] **Step 4: Abort on refresh failure**

Create an `AbortController` in `CatalogSyncProcessor`. Abort when refresh returns `false` or throws, wait for `run()` to unwind, and do not schedule an integration retry for the lock-loss error.

- [ ] **Step 5: Fence sync-state updates**

Store `activeFenceToken` in `SyncState`. Start/update/complete operations must filter by the current fence token so a stale worker cannot publish progress or completion.

- [ ] **Step 6: Preserve idempotent game upserts**

Do not roll back already imported pages. Prevent only stale progress/completion publication; repeated game upserts remain safe by `f95ThreadId`.

- [ ] **Step 7: Review failure scenarios**

Trace: lock loss before fetch, during fetch, after game upsert, before progress save and before final completion. In every case, the stale worker must not write newer sync state.

**Acceptance:** A worker that loses Redis lock ownership cannot publish progress or mark synchronization complete.

### Task 2: Deduplicate Initial, Daily and Retry Jobs

**Files:**

- Modify: `apps/api/src/infrastructure/scheduler/catalogSync.scheduler.ts`
- Modify: `apps/api/src/infrastructure/jobs/processors/catalogSync.processor.ts`

- [ ] **Step 1: Introduce stable job IDs**

Use separate IDs:

```ts
const INITIAL_SYNC_JOB_ID = 'catalog-sync:initial';
const DAILY_SYNC_JOB_ID = 'catalog-sync:daily';
```

Retries for one run must reuse a deterministic run ID instead of creating unrelated jobs.

- [ ] **Step 2: Handle an existing job as a no-op**

Before adding a job, inspect the existing job state or handle BullMQ's duplicate-ID result. Do not convert “already queued/running” into an application error.

- [ ] **Step 3: Prevent retry fan-out**

Ensure one failed job can schedule at most one delayed retry and that a scheduler tick cannot add a parallel job while that retry is waiting.

- [ ] **Step 4: Review multi-instance bootstrap**

Trace two API replicas starting simultaneously and two cron callbacks firing simultaneously. Only one initial or daily synchronization run may become active.

**Acceptance:** Bootstrap, cron and retry paths cannot produce concurrent logical catalog runs.

---

## Phase 2: API Security

### Task 3: Add Redis-Backed Rate Limiting

**Files:**

- Create: `apps/api/src/infrastructure/security/services/requestRateLimiter.service.ts`
- Create: `apps/api/src/infrastructure/security/guards/rateLimit.guard.ts`
- Modify: `apps/api/src/infrastructure/security/security.module.ts`
- Modify: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Modify: protected mutation controllers under `apps/api/src/endpoints/`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Modify: `apps/api/src/infrastructure/config/config.service.ts`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`

- [ ] **Step 1: Define configuration**

Add validated positive integers for:

```text
RATE_LIMIT_CREATE_USER_PER_HOUR
RATE_LIMIT_SESSION_PER_MINUTE
RATE_LIMIT_MUTATIONS_PER_MINUTE
```

Use conservative defaults, but keep them configurable.

- [ ] **Step 2: Configure trusted proxy behavior**

Enable Fastify `trustProxy` only for the deployed nginx topology so the limiter uses the real client IP without trusting arbitrary forwarded headers.

- [ ] **Step 3: Implement an atomic Redis window**

Use a Lua script that increments the bucket, applies TTL on first use and returns count plus remaining TTL. Key anonymous limits by normalized IP and authenticated mutation limits by user ID.

- [ ] **Step 4: Apply endpoint policies**

Apply the strict anonymous policy to `POST /auth/createUser`, a moderate anonymous policy to `GET /auth/session`, and a per-user burst policy to swipe/list mutations.

- [ ] **Step 5: Return a stable API error**

Return:

```json
{
  "statusCode": 429,
  "code": "rate_limited",
  "message": "Too many requests"
}
```

Also return `Retry-After`.

- [ ] **Step 6: Review secret handling**

Confirm limiter keys, exception logs and request logs never contain bearer tokens or complete request bodies.

**Acceptance:** Anonymous account creation and mutation bursts are bounded consistently across API replicas.

### Task 4: Support Encryption Key Rotation

**Files:**

- Modify: `apps/api/src/infrastructure/config/getConfiguration.ts`
- Modify: `apps/api/src/infrastructure/config/config.service.ts`
- Modify: `apps/api/src/infrastructure/security/services/token.service.ts`
- Modify: `apps/api/src/endpoints/auth/services/auth.service.ts`
- Modify: `apps/api/src/entities/user/services/user.repository.ts`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Replace the single key configuration**

Use:

```text
TOKEN_ENCRYPTION_CURRENT_VERSION=v2
TOKEN_ENCRYPTION_KEYS={"v1":"<base64>","v2":"<base64>"}
```

Validate JSON shape, unique non-empty versions and canonical 32-byte base64 values.

- [ ] **Step 2: Encrypt with the current key**

New tokens must always store `TOKEN_ENCRYPTION_CURRENT_VERSION`.

- [ ] **Step 3: Decrypt by persisted version**

Resolve the key by `encryptedToken.keyVersion`. Unknown versions must produce a controlled internal configuration error without returning key details.

- [ ] **Step 4: Re-encrypt on token retrieval**

When `/auth/token` decrypts with an old version, persist a fresh ciphertext under the current version before returning the plaintext token.

- [ ] **Step 5: Remove the static example key**

Replace the usable zero-byte key in `apps/api/.env.example` with an intentionally invalid placeholder and generation instructions.

- [ ] **Step 6: Document rotation order**

Document: add new key, deploy current version, allow/review re-encryption, confirm no users reference the old version, then remove the old key.

**Acceptance:** Existing accounts remain usable during controlled encryption-key rotation.

---

## Phase 3: Session and Swipe Correctness

### Task 5: Verify Candidate Tokens Without Replacing the Session

**Files:**

- Modify: `apps/web/src/shared/api/httpClient.ts`
- Modify: `apps/web/src/pages/auth/api/auth.mutations.ts`
- Modify: `apps/web/src/pages/auth/hooks/useAuthPage.ts`
- Modify: `apps/web/src/app/router/AppRouter.tsx`

- [ ] **Step 1: Add an explicit bearer override**

Extend request options with:

```ts
type RequestOptions<TBody> = Omit<RequestInit, 'body'> & {
  body?: TBody;
  bearerToken?: string | null;
  clearSessionOnUnauthorized?: boolean;
};
```

The candidate token must be sent directly without writing to local storage.

- [ ] **Step 2: Narrow automatic session clearing**

Only clear the persisted token when a request made with that persisted token returns `401`. Never clear it for candidate-token verification or network/5xx errors.

- [ ] **Step 3: Persist only after success**

`useVerifyTokenMutation` must call `/auth/session` with `bearerToken: candidateToken`, then call `setToken(candidateToken)` only after a successful response.

- [ ] **Step 4: Preserve the original destination**

Keep `location.state.from` through auth recovery and navigate there only after session verification succeeds.

- [ ] **Step 5: Add outage recovery controls**

For network and 5xx errors, retain the token and render `Retry` plus `Use another token`. For `401`, clear the invalid persisted token and route to auth.

- [ ] **Step 6: Review session scenarios**

Trace valid restore, invalid candidate, persisted token returning `401`, API timeout and API `500`.

**Acceptance:** An invalid candidate token cannot destroy a valid stored session, and temporary outages do not log the user out.

### Task 6: Serialize Swipe State Transitions

**Files:**

- Modify: `apps/web/src/pages/swipe/hooks/useSwipeQueue.ts`
- Modify: `apps/web/src/pages/swipe/api/swipe.mutations.ts`

- [ ] **Step 1: Replace closure snapshots with operation state**

Represent local queue changes with a reducer:

```ts
type QueueState = {
  items: GameDto[];
  activeOperationId: number | null;
  canUndo: boolean;
};
```

Each decision receives a monotonically increasing operation ID.

- [ ] **Step 2: Block duplicate input synchronously**

Use a ref or reducer guard set before awaiting React rerender so keyboard and pointer events cannot submit the same top card twice.

- [ ] **Step 3: Make rollback conditional**

Rollback only when the failed operation ID is still active. Never restore an old `items` snapshot after a newer successful operation.

- [ ] **Step 4: Invalidate the queue after accepted decisions**

Invalidate `swipeQueueQueryKey` after decision and undo success. Merge unique incoming cards without moving the current top card.

- [ ] **Step 5: Separate empty and failed states**

Expose distinct UI states for catalog not ready, no undecided games, queue request failure and mutation failure.

- [ ] **Step 6: Review rapid interaction scenarios**

Trace double keypress, keypress plus pointer swipe, failed decision during refill, undo during refill and delayed response ordering.

**Acceptance:** Rapid input and failed mutations cannot duplicate, lose or resurrect obsolete cards.

---

## Phase 4: Multi-Instance Progress and Operations

### Task 7: Publish Catalog Progress Through Redis

**Files:**

- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/infrastructure/cache/cache.module.ts`
- Modify: `apps/api/src/endpoints/catalog/services/catalogSyncProgress.service.ts`

- [ ] **Step 1: Add dedicated pub/sub connections**

Keep the existing command client. Add a publisher and a duplicated subscriber connection with explicit shutdown handling.

- [ ] **Step 2: Publish after MongoDB state is saved**

Serialize `CatalogSyncEvent` to a fixed Redis channel only after `SyncStateRepository.update()` succeeds.

- [ ] **Step 3: Subscribe once per API process**

Convert Redis messages into an RxJS observable shared by SSE connections. Do not create one Redis subscriber per browser client.

- [ ] **Step 4: Preserve snapshot-first behavior**

Each SSE connection receives the current MongoDB snapshot, then shared Redis events, then periodic heartbeat events.

- [ ] **Step 5: Make reconnect self-healing**

Keep frontend status refetch on connection setup/reconnect so missed pub/sub messages cannot leave stale progress indefinitely.

**Acceptance:** A client connected to any API replica observes progress emitted by any worker replica.

### Task 8: Separate Liveness and Readiness

**Files:**

- Modify: `apps/api/src/infrastructure/health/health.controller.ts`
- Modify: `apps/api/src/infrastructure/health/health.service.ts`
- Modify: `apps/api/src/infrastructure/cache/cache.service.ts`
- Modify: `docker-compose.yaml`
- Modify: `README.md`

- [ ] **Step 1: Add `/api/health/live`**

Return process liveness without querying MongoDB or Redis.

- [ ] **Step 2: Add `/api/health/ready`**

Check MongoDB and Redis independently and return `503` with non-secret dependency status when either is unavailable.

- [ ] **Step 3: Bound dependency checks**

Wrap Redis ping and any MongoDB diagnostic operation in short local timeouts so readiness cannot hang beyond the container healthcheck timeout.

- [ ] **Step 4: Keep backward compatibility deliberately**

Either retain `/api/health` as a readiness alias for one release or update every caller in the same task.

- [ ] **Step 5: Update Compose**

Point the API container healthcheck at `/api/health/ready`. Document `/live` for orchestrator liveness probes.

**Acceptance:** Dependency failure marks the instance unready without presenting the API process as dead or hanging the probe.

### Task 9: Add Operational Logging and Runbook

**Files:**

- Create: `apps/api/src/infrastructure/observability/`
- Modify: `apps/api/src/main.ts`
- Modify: catalog and flush processors
- Create: `docs/operations.md`
- Modify: `README.md`

- [ ] **Step 1: Add request correlation**

Accept a valid incoming request ID or generate one, return it in the response and include it in request-scoped logs.

- [ ] **Step 2: Define structured worker events**

Log sync start/page/retry/lock-loss/completion and decision flush start/count/failure with JSON-serializable context.

- [ ] **Step 3: Redact credentials**

Never log `Authorization`, tokens, encryption keys, complete bodies or F95 response payloads.

- [ ] **Step 4: Document recovery procedures**

Cover MongoDB outage, Redis outage, lost Redis persistence, stalled catalog retry, initial-import recovery, key rotation and backup restore.

- [ ] **Step 5: State the durability boundary**

Document that decisions still pending only in Redis can be lost if Redis AOF and its volume are lost.

**Acceptance:** Production failures can be correlated and recovered without reading implementation code or exposing credentials.

---

## Phase 5: Complete the MVP UI

### Task 10: Return Human-Readable Taxonomy

**Files:**

- Modify: `packages/contracts/src/game/game.contracts.ts`
- Modify: `apps/api/src/shared/functions/game/toGameDto.ts`
- Modify: `apps/api/src/entities/tag/services/tag.repository.ts`
- Modify: `apps/api/src/entities/prefix/services/prefix.repository.ts`
- Modify: queue/list services that construct game DTOs
- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/entities/game/ui/GameListItem.tsx`

- [ ] **Step 1: Extend the shared contract**

Use:

```ts
export interface GameTaxonomyItem {
  id: number;
  name: string;
}

export interface GameDto {
  tags: GameTaxonomyItem[];
  prefixes: GameTaxonomyItem[];
}
```

- [ ] **Step 2: Resolve taxonomy in bulk**

Collect unique tag and prefix IDs for an entire response and execute at most one repository query per taxonomy type.

- [ ] **Step 3: Add observable fallbacks**

Unknown IDs must remain visible as `Unknown tag #123` or `Unknown prefix #45` instead of disappearing.

- [ ] **Step 4: Render accessible chips**

Replace comma-separated numeric IDs with readable labels and compact overflow behavior.

**Acceptance:** Users never need to interpret numeric taxonomy IDs, and the API avoids N+1 queries.

### Task 11: Reuse the Fullscreen Image Viewer

**Files:**

- Modify: `apps/web/src/entities/game/ui/GameCard.tsx`
- Modify: `apps/web/src/pages/swipe/SwipePage.tsx`
- Modify: `apps/web/src/widgets/imageViewer/ImageViewer.tsx`
- Modify: `apps/web/src/widgets/imageViewer/hooks/useImageViewer.ts`
- Modify: related SCSS modules

- [ ] **Step 1: Add image-open callbacks**

Expose:

```ts
onOpenImages(images: string[], startIndex: number): void;
```

Build one image list with cover first and screenshots after it.

- [ ] **Step 2: Replace external screenshot anchors**

Use buttons that open the existing fullscreen viewer. Keep the F95 thread as the only intended external navigation.

- [ ] **Step 3: Fix image accessibility**

Give the cover meaningful alt text, preserve screenshot descriptions and provide a visible fallback for failed remote images.

- [ ] **Step 4: Isolate keyboard handling**

While the viewer is open, arrow and Escape keys belong to the viewer and must not trigger swipe actions.

- [ ] **Step 5: Complete dialog behavior**

Add initial focus, focus trap, focus restoration and background interaction blocking.

**Acceptance:** Cover and screenshots open in one keyboard-accessible viewer without accidental swipe decisions.

---

## Phase 6: Repository and Documentation Hygiene

### Task 12: Remove Generated Artifacts and Unsafe Examples

**Files:**

- Modify: `.gitignore`
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Remove from tracking when explicitly authorized: `apps/web/tsconfig.tsbuildinfo`
- Remove from working tree when explicitly authorized: `apps/api/tsconfig.build.tsbuildinfo`

- [ ] **Step 1: Ignore TypeScript build metadata**

Add:

```gitignore
*.tsbuildinfo
```

- [ ] **Step 2: Remove generated metadata**

Delete generated `*.tsbuildinfo` files only after confirming they contain no hand-maintained data. Removing a tracked file from the Git index requires explicit authorization.

- [ ] **Step 3: Replace the usable example encryption key**

Keep only a placeholder plus `openssl rand -base64 32` instructions.

- [ ] **Step 4: Reconcile documentation**

Update README configuration, health endpoints, session behavior, rate limits, key rotation and operations-runbook links.

**Acceptance:** Generated build metadata and reusable secrets are not part of the maintained source tree.

---

## Phase 7: Verification and Release Review

### Task 13: Review Critical Scenarios

**Files:**

- Review only; update documentation where findings require it.

- [ ] **Step 1: Review catalog invariants**

Confirm by code trace:

```text
lock loss aborts the stale worker
fence mismatch blocks progress/completion
bootstrap and cron do not duplicate jobs
retry creates one delayed continuation
```

- [ ] **Step 2: Review security invariants**

Confirm by code trace:

```text
account creation is rate-limited by client IP
mutations are rate-limited by user
old encryption versions remain decryptable
logs contain no bearer token or encryption material
```

- [ ] **Step 3: Review frontend invariants**

Confirm by code trace:

```text
candidate token is not persisted before verification
network failure does not clear a valid session
rapid swipe cannot submit one game twice
stale rollback cannot replace newer queue state
viewer keys cannot trigger swipe actions
```

- [ ] **Step 4: Review operational invariants**

Confirm Redis pub/sub is process-shared, readiness checks are bounded and liveness does not depend on external services.

- [ ] **Step 5: Request permission for executable checks**

Do not run commands automatically. If authorized, run focused typecheck/build commands and record exact commands and outcomes separately from code-review conclusions.

- [ ] **Step 6: Record unverified areas**

The final implementation report must distinguish:

```text
reviewed in code
manually exercised
verified by an authorized command
not verified
```

**Acceptance:** Every critical finding has an implementation path and an explicit verification status.

---

## Recommended Execution Order

```text
1 -> 2
3 -> 4
5 -> 6
7 -> 8 -> 9
10 -> 11
12 -> 13
```

Tasks 3 and 4 may proceed independently after Phase 1. Tasks 7 and 10 may also proceed independently, but release review should preserve the phase order.

## Release Gates

### Gate A: Correctness

- Lock loss stops stale catalog-state writes.
- Catalog jobs are deduplicated across API replicas.
- Swipe rollback cannot restore obsolete state.

### Gate B: Security

- Anonymous account creation is bounded.
- Mutation bursts are bounded per user.
- Encryption keys can rotate without invalidating existing users.
- Tokens and encryption material are not logged.

### Gate C: Session Recovery

- Candidate tokens are verified before persistence.
- Only a real persisted-token `401` clears the session.
- Network and server outages retain recoverable local state.

### Gate D: Multi-Instance Operations

- SSE progress crosses process boundaries.
- Liveness and readiness are separate and bounded.
- Recovery and durability procedures are documented.

### Gate E: MVP and Hygiene

- Taxonomy labels are human-readable.
- Swipe images use the fullscreen viewer accessibly.
- Generated metadata and reusable example secrets are absent.

## Open Decisions Before Implementation

1. Confirm expected API replica count. Fencing and Redis pub/sub remain recommended even for one replica because they also protect restarts and delayed workers.
2. Choose production rate-limit values based on expected usage; implementation should keep values configurable.
3. Decide whether `/api/health` remains a temporary readiness alias or is replaced immediately by `/api/health/ready`.
4. Confirm whether tracked generated files may be removed from Git in Task 12.
5. Decide whether automated test infrastructure will be introduced in a separate approved project; this plan deliberately does not add it.
