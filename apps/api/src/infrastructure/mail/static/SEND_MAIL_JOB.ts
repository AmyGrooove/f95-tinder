import { defineJob } from "@infrastructure/jobs/functions/defineJob"

import type { ISendMailJobPayload } from "../types/ISendMailJobPayload"

const SEND_MAIL_JOB = defineJob<ISendMailJobPayload>("mail.send", {
  retryDelays: [1_000, 5_000, 30_000],
  version: 2,
})

export { SEND_MAIL_JOB }
