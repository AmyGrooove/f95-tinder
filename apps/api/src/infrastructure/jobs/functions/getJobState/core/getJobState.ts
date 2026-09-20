import type { Job } from "bullmq"

import { JOB_CANCELLED_RESULT } from "../../../static/JOB_CANCELLED_RESULT"
import type { IJobData } from "../../../types/IJobData"

const getJobState = async (job: Job, data: IJobData) => {
  const state = await job.getState()

  if (state === "failed") {
    return "failed"
  }

  if (state === "completed") {
    return job.returnvalue === JOB_CANCELLED_RESULT &&
      data.cancellationState !== "none"
      ? "cancelled"
      : "completed"
  }

  if (state === "active") {
    return data.cancellationState === "none" ? "running" : "cancelling"
  }

  if (
    ["waiting", "delayed", "prioritized", "waiting-children"].includes(state)
  ) {
    return data.cancellationState === "cancelled"
      ? "cancelled"
      : data.cancellationState === "cancelling"
        ? "cancelling"
        : "queued"
  }

  throw new Error(`Unsupported BullMQ job state '${state}'`)
}

export { getJobState }
