import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const COLLECT_NEW_KODIK_MOVIES_JOB = defineJob<Record<string, never>>(
  "kodik.movies.collectNew",
)

export { COLLECT_NEW_KODIK_MOVIES_JOB }
