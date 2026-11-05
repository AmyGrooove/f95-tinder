# Jobs and mail

Read for background work, retry policies, queue contracts or sending email. Configuration and startup wiring are in [runtime](runtime.md).

## Queue API and registration

[JobsModule](../src/infrastructure/jobs/jobs.module.ts) configures BullMQ from the Redis configuration and exports `JobService` and `JobsHealthService`. The queue is `jobs`, prefixed with the app name. [JobService](../src/infrastructure/jobs/services/jobService/core/job.service.ts) exposes `add`, `get`, `list`, `update`, `cancel` and `retry`.

Use [defineJob](../src/infrastructure/jobs/functions/defineJob/core/defineJob.ts) for a typed definition with a name, payload version and retry delays. Register a Nest provider implementing `handle(payload, context)` and decorate it with [JobHandler](../src/infrastructure/jobs/decorators/JobHandler/core/JobHandler.ts). [JobRegistryService](../src/infrastructure/jobs/services/jobRegistryService/core/jobRegistry.service.ts) discovers providers and rejects duplicate handler names or missing handle methods. Import the handler's owning module so discovery can see the provider.

Persisted envelopes include name, version, payload, retry delays and cancellation state. [JobProcessorService](../src/infrastructure/jobs/services/jobProcessorService/core/jobProcessor.service.ts) checks the envelope and handler version before execution. Missing handlers and incompatible versions are unrecoverable. A version change therefore affects already queued jobs.

The number of attempts is retry-delay count plus one, using custom backoff. [JOBS_SETTINGS](../src/infrastructure/jobs/static/JOBS_SETTINGS.ts) sets concurrency to 10; completed jobs retain up to seven days/1,000 entries and failed jobs up to fourteen days/2,000 entries.

Handlers receive an ID, attempt, progress updater and `throwIfCancelled`. Progress must be an integer from 0 to 100. Cancellation is cooperative: the processor checks before and after the handler, and long-running handlers should use the same context check. It does not undo external effects. `NonRetryableJobError` disables automatic retry; `JobCancelledError` follows the cancellation result path.

`update` permits only matching queued jobs; `retry` permits failed jobs and resets attempt counters. `list` filters by definition name and supports states and an opaque cursor; it scans at most 500 queue entries per call. Its default limit is 50, permitted range 1–100. Inspect [job details](../src/infrastructure/jobs/services/jobService/types/IJobDetails.ts) before exposing these results through a future endpoint.

ItemStats and SiteStats are updated synchronously in the same MongoDB transaction as UserItem through [UserItemStatsService](../src/endpoints/userItem/services/userItemStats.service.ts). There are no item.recalculateRatings/item.recalculateRatingScores handlers, definitions, schedulers or startup rebuilds. Never enqueue counter deltas: every contributing UserItem write must call the service with before/after metric states and its transaction session. See [data access](data-access.md) for repository methods and counting semantics.

CollectionEndpointModule registers [TagCollectionsSynchronizationService](../src/endpoints/collection/services/tagCollectionsSynchronization.service.ts) and [SynchronizeTagCollectionsJobHandler](../src/endpoints/collection/services/handlers/synchronizeTagCollectionsJob.handler.ts). TagItemRepository.write and .bulk publish TagItemEventsService events after successful writes, retaining both previous and current Item IDs when assignments move. Partial bulk failures outside transactions also request reconciliation. Direct model/driver/database writes bypass these repository events. There is no TagItem HTTP mutation endpoint.

Transactions involving these writes must use MongoTransactionService.run and leave commit/abort to that service. Its afterCommit callbacks run only after withTransaction succeeds; callbacks reset on each retry and are discarded on rollback. Active unmanaged sessions are rejected before TagItem mutation. Queue insertion failures propagate after persistence, so an error can occur after MongoDB committed. The commit-to-enqueue window has no durable delivery guarantee, outbox or scheduled recovery.

The job is collection.synchronizeTags, version 1, with a string Item ObjectId payload and retry delays 5,000/30,000/120,000 ms. It uses name + Item ID deduplication with keepLastIfActive:true and no TTL. The handler rereads current direct TagItem records instead of replaying event state; waiting requests merge and active processing retains one follow-up. It upserts membership with the stored relevanceScore, removes obsolete memberships only from site tag collections, and preserves existing positions and notes. New members use the collection's ordinary group and position 0; relevance sorting uses the saved score with membership ID ties. Tag.parents never expands membership. There is no initial TagItem scan, backfill, cron or new HTTP trigger. The scoped tagCollections.integration.test.ts suite verifies bootstrap, membership updates, commit/rollback/retry publication and active-job deduplication on disposable MongoDB 8.0.17 and Redis 8.2.3. These tests do not establish durable delivery across the MongoDB/Redis gap or verify deployed services.

The old tag-weight and taste-profile jobs were removed with recommendations on 5 November 2026. UserItem mutations update statistics within their MongoDB transaction without enqueueing recommendation work. Existing MongoDB records and Redis jobs were not deleted.

## Mail delivery

Preserve the existing path: [MailService.send](../src/infrastructure/mail/services/mailService/core/mail.service.ts) → `JobService.add` → [SendMailJobHandler.handle](../src/infrastructure/mail/services/sendMailJobHandler/core/sendMailJob.handler.ts) → Resend. The service validates recipient, subject and text/HTML, serializes Buffer attachments to base64 and returns a queue ID with `status: "queued"`. It does not return a provider delivery ID.

[SEND_MAIL_JOB](../src/infrastructure/mail/static/SEND_MAIL_JOB.ts) is `mail.send`, version 2, with retry delays of 1,000, 5,000 and 30,000 ms. [MailModule](../src/infrastructure/mail/mail.module.ts) creates the Resend client from `RESEND_ACCESS_SECRET`; the sender domain comes from `MAIL_DOMAIN`. Sender keys and display names are defined in [MAIL_SENDERS](../src/infrastructure/mail/services/sendMailJobHandler/static/MAIL_SENDERS.ts), defaulting to `no-reply`.

The handler checks cancellation before delivery, prefers nonempty HTML while retaining optional text, uses idempotency key `mail.send:<queueJobId>`, and rejects provider errors or missing delivery IDs. Its result is `{ id: providerDeliveryId, status: "sent" }`. Keep queue and provider identifiers distinct.

[MailHealthService](../src/infrastructure/mail/services/mailHealthService/core/mailHealth.service.ts) calls Resend `domains.list()` and checks for provider errors. This checks an API operation, not successful email delivery. [JobsHealthService](../src/infrastructure/jobs/services/jobsHealthService/core/jobsHealth.service.ts) checks queue counts; that is not proof that a handler has completed work.
