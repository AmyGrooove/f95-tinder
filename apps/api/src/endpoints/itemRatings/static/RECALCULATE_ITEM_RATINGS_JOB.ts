import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const RECALCULATE_ITEM_RATINGS_JOB = defineJob<null>(
  "item.recalculateRatings",
  {
    retryDelays: [5_000, 30_000, 120_000],
  },
)

export { RECALCULATE_ITEM_RATINGS_JOB }
