import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import { UnrecoverableError, type Job, type Queue } from "bullmq"

import { isObject } from "@shared/functions/isObject"
import { isString } from "@shared/functions/isString"

import { JobCancellationError } from "../errors/JobCancellationError"
import { NonRetryableJobError } from "../errors/NonRetryableJobError"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import type { IJobData } from "../types/IJobData"
import type { IJobProgress } from "../types/IJobProgress"
import type { TJobType } from "../types/IJobPayloadMap"
import { JobConcurrencyService } from "./jobConcurrency.service"
import { JobRegistry } from "./jobRegistry.service"

@Injectable()
class JobProcessorService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
    private readonly jobConcurrencyService: JobConcurrencyService,
    private readonly jobRegistry: JobRegistry,
  ) {}

  async process(job: Job) {
    if (!job.id) {
      throw new UnrecoverableError("BullMQ job does not have an identifier")
    }

    const id = job.id
    const data = this.getData(job.data)
    const registeredHandler = this.jobRegistry.get(data.type)

    if (!registeredHandler) {
      throw new UnrecoverableError(
        `No handler is registered for job type '${data.type}'`,
      )
    }

    if (data.cancellationState !== "none") {
      return
    }

    await job.updateProgress({
      progress: 0,
      executionState: "queued",
    } satisfies IJobProgress)

    await this.jobConcurrencyService.run(
      data.type,
      registeredHandler.options.concurrency,
      async () => {
        const currentJob = await this.jobsQueue.getJob(id)
        const currentData = currentJob
          ? this.getData(currentJob.data)
          : undefined

        if (!currentData || currentData.cancellationState !== "none") {
          return
        }

        await job.updateProgress({
          progress: 0,
          executionState: "running",
        } satisfies IJobProgress)

        try {
          await registeredHandler.handler.handle(id, currentData.payload)
          await this.markCancelledIfRequested(job, id)
        } catch (error) {
          if (error instanceof JobCancellationError) {
            await this.markCancelled(job, id)

            return
          }

          if (await this.markCancelledIfRequested(job, id)) {
            return
          }

          if (error instanceof NonRetryableJobError) {
            throw new UnrecoverableError(error.message)
          }

          throw error instanceof Error ? error : new Error("Job handler failed")
        }
      },
    )
  }

  private getData(value: unknown): IJobData<TJobType> {
    if (!isObject(value)) {
      throw new UnrecoverableError("Persisted job has an invalid type")
    }

    const candidate = value as Record<string, unknown>

    if (!isString(candidate.type)) {
      throw new UnrecoverableError("Persisted job has an invalid type")
    }

    if (
      candidate.cancellationState !== "none" &&
      candidate.cancellationState !== "cancelling" &&
      candidate.cancellationState !== "cancelled"
    ) {
      throw new UnrecoverableError("Persisted job has an invalid envelope")
    }

    return value as IJobData<TJobType>
  }

  private async markCancelledIfRequested(job: Job, id: string) {
    const currentJob = await this.jobsQueue.getJob(id)

    if (
      !currentJob ||
      this.getData(currentJob.data).cancellationState === "none"
    ) {
      return false
    }

    await this.markCancelled(job, id)

    return true
  }

  private async markCancelled(job: Job, id: string) {
    const currentJob = await this.jobsQueue.getJob(id)

    if (currentJob) {
      await job.updateData({
        ...this.getData(currentJob.data),
        cancellationState: "cancelled",
      })
    }
  }
}

export { JobProcessorService }
