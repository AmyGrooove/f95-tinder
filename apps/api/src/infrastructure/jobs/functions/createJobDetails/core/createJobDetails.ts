import type { Job } from "bullmq"

import type { IJobData } from "../../../types/IJobData"
import type { IJobDetails } from "../../../types/IJobDetails"
import type { IJobProgress } from "../../../types/IJobProgress"
import type { TJobType } from "../../../types/IJobPayloadMap"
import type { TJobState } from "../../../types/TJobState"

const createJobDetails = (
  job: Job,
  data: IJobData<TJobType>,
  progress: IJobProgress,
  state: TJobState,
): IJobDetails => {
  return {
    type: data.type,
    state,
    progress: progress.progress,
    createdAt: new Date(job.timestamp),
    failedReason: state === "failed" && job.failedReason ? job.failedReason : undefined,
    finishedAt:
      state === "completed" || state === "cancelled" || state === "failed"
        ? job.finishedOn
          ? new Date(job.finishedOn)
          : undefined
        : undefined,
    startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
    status: progress.status,
  }
}

export { createJobDetails }
