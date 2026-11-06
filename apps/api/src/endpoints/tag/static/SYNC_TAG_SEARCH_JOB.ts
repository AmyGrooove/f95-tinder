import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const SYNC_TAG_SEARCH_JOB = defineJob<null>("tagSearch.synchronize", {
  retryDelays: [5_000, 30_000, 120_000],
})

export { SYNC_TAG_SEARCH_JOB }
