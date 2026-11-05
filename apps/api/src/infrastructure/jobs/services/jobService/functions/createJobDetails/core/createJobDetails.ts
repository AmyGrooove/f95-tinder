import type { Job } from "bullmq"

import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import type { TJobState } from "../../../types/TJobState"
import type { IJobDetails } from "../../../types/IJobDetails"
import { normalizeJobProgress } from "../../normalizeJobProgress"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const createJobDetails = (
  job: Job,
  details: { state: TJobState; name: string },
) => {
  if (!isString(job.id) || job.id === "") {
    throw new Error(DICTIONARY.jobs.missingDetailsId)
  }

  const progress = normalizeJobProgress(job.progress)
  const { state, name } = details

  return {
    id: job.id,
    name,
    state,
    progress: progress.progress,
    attempt: job.attemptsStarted,
    createdAt: new Date(job.timestamp),
    failedReason:
      state === "failed" && !isNil(job.failedReason) && job.failedReason !== ""
        ? job.failedReason
        : undefined,
    finishedAt:
      state === "completed" || state === "cancelled" || state === "failed"
        ? !isNil(job.finishedOn) && job.finishedOn > 0
          ? new Date(job.finishedOn)
          : undefined
        : undefined,
    startedAt:
      !isNil(job.processedOn) && job.processedOn > 0
        ? new Date(job.processedOn)
        : undefined,
    status: progress.status,
  } satisfies IJobDetails
}

export { createJobDetails }
