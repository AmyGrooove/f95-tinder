import { defineJob } from "@infrastructure/jobs/functions/defineJob"

import type { ISendMailOptions } from "../types/ISendMailOptions"

const SEND_MAIL_JOB = defineJob<ISendMailOptions>("mail.send", {
  retryDelays: [1_000, 5_000, 30_000],
})

export { SEND_MAIL_JOB }
