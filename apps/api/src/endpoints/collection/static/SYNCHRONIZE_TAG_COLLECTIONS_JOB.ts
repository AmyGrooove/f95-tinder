import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const SYNCHRONIZE_TAG_COLLECTIONS_JOB = defineJob<string>(
  "collection.synchronizeTags",
  {
    retryDelays: [5_000, 30_000, 120_000],
  },
)

export { SYNCHRONIZE_TAG_COLLECTIONS_JOB }
