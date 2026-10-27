import { defineJob } from "@infrastructure/jobs/functions/defineJob"

const RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB = defineJob<null>(
  "tag.recalculateWeightModifiers",
  { retryDelays: [5_000, 30_000, 120_000] },
)

export { RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB }
