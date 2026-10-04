# Jobs and mail

Read for background work, retry policies, queue contracts or sending email. Configuration and startup wiring are in [runtime](runtime.md).

## Queue API and registration

[JobsModule](../../src/infrastructure/jobs/jobs.module.ts) configures BullMQ from the Redis configuration and exports `JobService` and `JobsHealthService`. The queue is `jobs`, prefixed with the app name. [JobService](../../src/infrastructure/jobs/services/job.service.ts) exposes `add`, `get`, `list`, `update`, `cancel` and `retry`.

Use [defineJob](../../src/infrastructure/jobs/functions/defineJob/core/defineJob.ts) for a typed definition with a name, payload version and retry delays. Register a Nest provider implementing `handle(payload, context)` and decorate it with [JobHandler](../../src/infrastructure/jobs/decorators/JobHandler/core/JobHandler.ts). [JobRegistry](../../src/infrastructure/jobs/services/jobRegistry.service.ts) discovers providers and rejects duplicate handler names or missing handle methods. Import the handler's owning module so discovery can see the provider.

Persisted envelopes include name, version, payload, retry delays and cancellation state. [JobProcessorService](../../src/infrastructure/jobs/services/jobProcessor.service.ts) checks the envelope and handler version before execution. Missing handlers and incompatible versions are unrecoverable. A version change therefore affects already queued jobs.

The number of attempts is retry-delay count plus one, using custom backoff. [JOBS_SETTINGS](../../src/infrastructure/jobs/static/JOBS_SETTINGS.ts) sets concurrency to 10; completed jobs retain up to seven days/1,000 entries and failed jobs up to fourteen days/2,000 entries.

Handlers receive an ID, attempt, progress updater and `throwIfCancelled`. Progress must be an integer from 0 to 100. Cancellation is cooperative: the processor checks before and after the handler, and long-running handlers should use the same context check. It does not undo external effects. `NonRetryableJobError` disables automatic retry; `JobCancelledError` follows the cancellation result path.

`update` permits only matching queued jobs; `retry` permits failed jobs and resets attempt counters. `list` filters by definition name and supports states and an opaque cursor; it scans at most 500 queue entries per call. Its default limit is 50, permitted range 1–100. Inspect [job details](../../src/infrastructure/jobs/types/IJobDetails.ts) before exposing these results through a future endpoint.

## Mail delivery

Preserve the existing path: [MailService.send](../../src/infrastructure/mail/services/mail.service.ts) → `JobService.add` → [SendMailJobHandler.handle](../../src/infrastructure/mail/handlers/sendMailJob.handler.ts) → Resend. The service validates recipient, subject and text/HTML, serializes Buffer attachments to base64 and returns a queue ID with `status: "queued"`. It does not return a provider delivery ID.

[SEND_MAIL_JOB](../../src/infrastructure/mail/static/SEND_MAIL_JOB.ts) is `mail.send`, version 2, with retry delays of 1,000, 5,000 and 30,000 ms. [MailModule](../../src/infrastructure/mail/mail.module.ts) creates the Resend client from `RESEND_ACCESS_SECRET`; the sender domain comes from `MAIL_DOMAIN`. Sender keys and display names are defined in [MAIL_SENDERS](../../src/infrastructure/mail/static/MAIL_SENDERS.ts), defaulting to `no-reply`.

The handler checks cancellation before delivery, prefers nonempty HTML while retaining optional text, uses idempotency key `mail.send:<queueJobId>`, and rejects provider errors or missing delivery IDs. Its result is `{ id: providerDeliveryId, status: "sent" }`. Keep queue and provider identifiers distinct.

[MailHealthService](../../src/infrastructure/mail/services/mailHealth.service.ts) calls Resend `domains.list()` and checks for provider errors. This checks an API operation, not successful email delivery. [JobsHealthService](../../src/infrastructure/jobs/services/jobsHealth.service.ts) checks queue counts; that is not proof that a handler has completed work.
