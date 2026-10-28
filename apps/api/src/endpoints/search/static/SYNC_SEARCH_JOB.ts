import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const SYNC_SEARCH_JOB = defineJob<null>("search.synchronize", {
  retryDelays: [5_000, 30_000, 120_000],
})

export { SYNC_SEARCH_JOB }
