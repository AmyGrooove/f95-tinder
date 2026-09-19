import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import type { Job, JobsOptions, Queue } from "bullmq"

import { isNil } from "@shared/functions/checks/isNil"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import type { IPaginatedResult } from "@shared/types/IPaginatedResult"

import { JobCancellationError } from "../errors/JobCancellationError"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import type { IJobDetails } from "../types/IJobDetails"
import type { IJobListOptions } from "../types/IJobListOptions"
import type { IJobPayloadMap } from "../types/IJobPayloadMap"
import type { IJobData } from "../types/IJobData"
import type { IJobProgress } from "../types/IJobProgress"
import type { TJobType } from "../types/IJobPayloadMap"
import { createJobDetails } from "../functions/createJobDetails"
import { getJobState } from "../functions/getJobState"
import { normalizeJobProgress } from "../functions/normalizeJobProgress"
import { JobRegistry } from "./jobRegistry.service"

@Injectable()
class JobService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
    private readonly jobRegistry: JobRegistry,
  ) {}

  async add<TType extends TJobType>(
    type: TType,
    payload: IJobPayloadMap[TType],
  ) {
    const registeredHandler = this.jobRegistry.get(type)

    if (isNil(registeredHandler)) {
      throw new Error(`No handler is registered for job type '${type}'`)
    }

    const job = await this.jobsQueue.add(
      type,
      { cancellationState: "none", payload, type } satisfies IJobData<TType>,
      {
        attempts: registeredHandler.options.attempts,
        backoff: { delay: registeredHandler.options.retryDelay, type: "fixed" },
        delay: 5_000,
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
        removeOnFail: { age: 60 * 60 * 24 * 14, count: 2_000 },
      } satisfies JobsOptions,
    )

    if (isNil(job.id)) {
      throw new Error("BullMQ did not assign an identifier to the queued job")
    }

    return job.id
  }

  async cancel(id: string) {
    const job = await this.jobsQueue.getJob(id)

    if (isNil(job)) {
      return false
    }

    const state = await this.getState(job)

    if (state === "completed" || state === "failed") {
      return false
    }

    if (state === "cancelling" || state === "cancelled") {
      return true
    }

    const data = job.data as IJobData<TJobType>
    const cancellationState = state === "queued" ? "cancelled" : "cancelling"

    if (data.cancellationState !== cancellationState) {
      await job.updateData({ ...data, cancellationState })
    }

    return true
  }

  async get(id: string) {
    const job = await this.jobsQueue.getJob(id)

    return isNil(job) ? null : this.createJobDetails(job)
  }

  async list<TType extends TJobType>(
    type: TType,
    options?: IJobListOptions,
  ): Promise<IPaginatedResult<IJobDetails>> {
    const { page, limit } = normalizePagination(options, 50)
    const requestedStates = options?.states
    const jobs = await this.jobsQueue.getJobs([
      "active",
      "completed",
      "delayed",
      "failed",
      "prioritized",
      "waiting",
      "waiting-children",
    ])
    const details = await Promise.all(
      jobs
        .filter((job) => job.name === type)
        .sort((firstJob, secondJob) => {
          const timestampDifference = secondJob.timestamp - firstJob.timestamp

          if (timestampDifference !== 0) {
            return timestampDifference
          }

          return String(secondJob.id).localeCompare(
            String(firstJob.id),
            undefined,
            {
              numeric: true,
            },
          )
        })
        .map((job) => this.createJobDetails(job)),
    )
    const matchingDetails = details.filter(
      (job) => !requestedStates || requestedStates.includes(job.state),
    )
    const total = matchingDetails.length
    const offset = (page - 1) * limit

    return createPaginatedResult(
      matchingDetails.slice(offset, offset + limit),
      total,
      page,
      limit,
    )
  }

  async update(id: string, progress?: number, status?: string) {
    if (isNil(progress) && isNil(status)) {
      throw new Error("Job update must include progress or status")
    }

    if (
      !isNil(progress) &&
      (!Number.isInteger(progress) || progress < 0 || progress > 100)
    ) {
      throw new Error("Job progress must be an integer between 0 and 100")
    }

    const job = await this.jobsQueue.getJob(id)

    if (isNil(job)) {
      throw new Error(`Job '${id}' does not exist`)
    }

    const state = await this.getState(job)

    if (["cancelled", "completed", "failed"].includes(state)) {
      throw new Error(`Job '${id}' is already finished`)
    }

    if (state === "cancelling") {
      throw new JobCancellationError(`Job '${id}' was cancelled`)
    }

    const currentProgress = normalizeJobProgress(job.progress)
    await job.updateProgress({
      executionState: currentProgress.executionState,
      progress: progress ?? currentProgress.progress,
      status: status ?? currentProgress.status,
    } satisfies IJobProgress)
  }

  async healthCheck() {
    await this.jobsQueue.getJobCounts()

    return true
  }

  private async createJobDetails(job: Job): Promise<IJobDetails> {
    const data = job.data as IJobData<TJobType>
    const progress = normalizeJobProgress(job.progress)
    const state = await getJobState(job, data, progress)

    return createJobDetails(job, data, progress, state)
  }

  private async getState(
    job: Job,
    data = job.data as IJobData<TJobType>,
    progress = normalizeJobProgress(job.progress),
  ) {
    return getJobState(job, data, progress)
  }
}

export { JobService }
