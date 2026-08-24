import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import type { Job, JobsOptions, Queue } from "bullmq"

import type { IAddJobOptions } from "../types/IAddJobOptions"
import type { IJobContext } from "../types/IJobContext"
import type { IJobListItem } from "../types/IJobListItem"
import type { IJobListOptions } from "../types/IJobListOptions"
import type { IJobListResult } from "../types/IJobListResult"
import type { IQueuedJobData } from "../types/IQueuedJobData"
import type { TJobState } from "../types/TJobState"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import { JOBS_ATTEMPTS } from "../static/JOBS_ATTEMPTS"
import { JOBS_BACKOFF_DELAY } from "../static/JOBS_BACKOFF_DELAY"
import { JOBS_REMOVE_ON_COMPLETE } from "../static/JOBS_REMOVE_ON_COMPLETE"
import { JOBS_REMOVE_ON_FAIL } from "../static/JOBS_REMOVE_ON_FAIL"

@Injectable()
class JobService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
  ) {}

  async add<TPayload>(
    name: string,
    payload: TPayload,
    options?: IAddJobOptions,
  ): Promise<string> {
    const jobOptions: JobsOptions = {
      attempts: JOBS_ATTEMPTS,
      backoff: {
        delay: JOBS_BACKOFF_DELAY,
        type: "exponential",
      },
      delay: options?.delay,
      jobId: options?.jobId,
      removeOnComplete: JOBS_REMOVE_ON_COMPLETE,
      removeOnFail: JOBS_REMOVE_ON_FAIL,
    }
    const job = await this.jobsQueue.add(
      name,
      {
        isCancellationRequested: false,
        payload,
      } satisfies IQueuedJobData<TPayload>,
      jobOptions,
    )

    if (job.id === undefined) {
      throw new Error("BullMQ did not assign an identifier to the queued job")
    }

    return job.id
  }

  async cancel(id: string): Promise<boolean> {
    const job = await this.jobsQueue.getJob(id)

    if (job === undefined) {
      return false
    }

    const state = await job.getState()
    const isRemovable =
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized" ||
      state === "waiting-children"

    if (isRemovable) {
      await job.remove()

      return true
    }

    if (state !== "active") {
      return false
    }

    const queuedJobData = job.data as IQueuedJobData<unknown>

    await job.updateData({
      isCancellationRequested: true,
      payload: queuedJobData.payload,
      status: queuedJobData.status,
    })

    return true
  }

  async get(id: string): Promise<IJobListItem | null> {
    const job = await this.jobsQueue.getJob(id)

    if (job === undefined) {
      return null
    }

    return this.createJobListItem(job)
  }

  async healthCheck(): Promise<boolean> {
    await this.jobsQueue.getJobCounts()

    return true
  }

  async list(name: string, options?: IJobListOptions): Promise<IJobListResult> {
    const offset = Math.max(0, options?.offset ?? 0)
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50))
    const end = offset + limit - 1
    const jobs = await this.jobsQueue.getJobs(undefined, offset, end)
    const matchingJobs = jobs.filter((job) => {
      return job.name === name
    })
    const jobListItems = await Promise.all(
      matchingJobs.map((job) => {
        return this.createJobListItem(job)
      }),
    )
    const requestedStates = options?.states
    const items = requestedStates
      ? jobListItems.filter((jobListItem) => {
          return requestedStates.includes(jobListItem.state)
        })
      : jobListItems

    return {
      items,
      limit,
      offset,
    }
  }

  createContext<TPayload>(job: Job<IQueuedJobData<TPayload>>): IJobContext {
    if (job.id === undefined) {
      throw new Error("BullMQ processor received a job without an identifier")
    }

    return {
      jobId: job.id,
      updateProgress: async (progress: number, status?: string): Promise<void> => {
        await job.updateProgress(progress)

        if (status === undefined) {
          return
        }

        const currentJob = await this.jobsQueue.getJob(job.id)

        if (currentJob === undefined) {
          return
        }

        const queuedJobData = currentJob.data as IQueuedJobData<TPayload>

        await job.updateData({
          isCancellationRequested: queuedJobData.isCancellationRequested,
          payload: queuedJobData.payload,
          status,
        })
      },
      isCancellationRequested: async (): Promise<boolean> => {
        const currentJob = await this.jobsQueue.getJob(job.id)

        if (currentJob === undefined) {
          return true
        }

        const queuedJobData = currentJob.data as IQueuedJobData<TPayload>

        return queuedJobData.isCancellationRequested
      },
      throwIfCancellationRequested: async (): Promise<void> => {
        const currentJob = await this.jobsQueue.getJob(job.id)
        const isCancellationRequested =
          currentJob === undefined ||
          (currentJob.data as IQueuedJobData<TPayload>)
            .isCancellationRequested

        if (isCancellationRequested) {
          throw new Error(`Job ${job.id} was cancelled`)
        }
      },
    }
  }

  private async createJobListItem(job: Job): Promise<IJobListItem> {
    const state = await job.getState()
    const queuedJobData = job.data as IQueuedJobData<unknown>

    return {
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp),
      failedReason: job.failedReason || undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      id: job.id ?? "",
      name: job.name,
      payload: queuedJobData.payload,
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      progress: job.progress,
      state: this.translateState(state),
      status: queuedJobData.status,
    }
  }

  private translateState(state: string): TJobState {
    if (state === "active") {
      return "active"
    }

    if (state === "completed") {
      return "completed"
    }

    if (state === "delayed") {
      return "delayed"
    }

    if (state === "failed") {
      return "failed"
    }

    if (state === "prioritized") {
      return "prioritized"
    }

    if (state === "waiting") {
      return "waiting"
    }

    if (state === "waiting-children") {
      return "waiting-children"
    }

    return "unknown"
  }
}

export { JobService }
