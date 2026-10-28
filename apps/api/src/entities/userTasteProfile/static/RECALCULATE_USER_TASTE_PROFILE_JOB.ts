import { defineJob } from "@infrastructure/jobs/functions/defineJob"
import type { IRecalculateUserTasteProfilePayload } from "../types/IRecalculateUserTasteProfilePayload"

const RECALCULATE_USER_TASTE_PROFILE_JOB =
  defineJob<IRecalculateUserTasteProfilePayload>(
    "userTasteProfile.recalculate",
    { version: 2, retryDelays: [5_000, 30_000, 120_000] },
  )

export { RECALCULATE_USER_TASTE_PROFILE_JOB }
