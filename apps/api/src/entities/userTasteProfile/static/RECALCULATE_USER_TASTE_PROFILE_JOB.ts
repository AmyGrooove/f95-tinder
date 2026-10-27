import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const RECALCULATE_USER_TASTE_PROFILE_JOB = defineJob<string>(
  "userTasteProfile.recalculate",
  { retryDelays: [5_000, 30_000, 120_000] },
)

export { RECALCULATE_USER_TASTE_PROFILE_JOB }
