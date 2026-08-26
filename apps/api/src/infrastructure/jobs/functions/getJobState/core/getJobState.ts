import type { Job } from "bullmq"

import type { IJobData } from "../../../types/IJobData"
import type { IJobProgress } from "../../../types/IJobProgress"
import type { TJobType } from "../../../types/IJobPayloadMap"
import type { TJobState } from "../../../types/TJobState"

const getJobState = async (
  job: Job,
  data: IJobData<TJobType>,
  progress: IJobProgress,
): Promise<TJobState> => {
  if (data.cancellationState === "cancelled") {
    return "cancelled"
  }

  if (data.cancellationState === "cancelling") {
    return "cancelling"
  }

  const state = await job.getState()

  if (state === "active") {
    return progress.executionState === "queued" ? "queued" : "running"
  }

  if (["waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
    return "queued"
  }

  if (state === "completed" || state === "failed") {
    return state
  }

  throw new Error(`Unsupported BullMQ job state '${state}'`)
}

export { getJobState }
