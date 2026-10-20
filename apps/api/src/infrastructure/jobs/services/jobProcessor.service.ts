import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from "@nestjs/bullmq"
import { UnrecoverableError, type Job } from "bullmq"
import type { Queue } from "bullmq"

import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { LoggerService } from "../../logger/services/logger.service"
import { JobCancelledError } from "../errors/JobCancelledError"
import { NonRetryableJobError } from "../errors/NonRetryableJobError"
import { parseJobData } from "../functions/parseJobData"
import { JOB_CANCELLED_RESULT } from "../static/JOB_CANCELLED_RESULT"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import { JOBS_SETTINGS } from "../static/JOBS_SETTINGS"
import type { IJobData } from "../types/IJobData"
import type { IJobContext } from "../types/IJobContext"
import { JobRegistryService } from "./jobRegistry.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Processor(JOBS_QUEUE_NAME, {
  concurrency: JOBS_SETTINGS.concurrency,
  settings: {
    backoffStrategy: (attempt, _type, _error, job) => {
      return isNil(job)
        ? -1
        : (parseJobData(job.data).retryDelays[attempt - 1] ?? -1)
    },
  },
})
class JobProcessorService extends WorkerHost {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
    private readonly jobRegistry: JobRegistryService,
    private readonly loggerService: LoggerService,
  ) {
    super()
  }

  @OnWorkerEvent("error")
  onWorkerError(error: Error) {
    this.loggerService.error(DICTIONARY.jobs.workerError, error, {
      context: JobProcessorService.name,
      data: { queue: JOBS_QUEUE_NAME },
    })
  }

  async process(job: Job) {
    const id = job.id

    if (!isString(id) || id === "") {
      throw new UnrecoverableError(DICTIONARY.jobs.missingId)
    }

    let data: IJobData
    try {
      data = parseJobData(job.data)
    } catch (error) {
      this.loggerService.error(
        DICTIONARY.jobs.invalidPersistedEnvelope,
        error,
        {
          context: JobProcessorService.name,
          data: { jobName: job.name },
          jobId: id,
        },
      )

      throw new UnrecoverableError(DICTIONARY.jobs.invalidEnvelope(job.name))
    }

    const registeredHandler = this.jobRegistry.get(job.name)

    if (isNil(registeredHandler)) {
      throw new UnrecoverableError(
        DICTIONARY.jobs.handlerNotRegistered(job.name),
      )
    }

    if (
      data.name !== job.name ||
      data.version !== registeredHandler.definition.version
    ) {
      throw new UnrecoverableError(
        DICTIONARY.jobs.incompatiblePayloadVersion(job.name),
      )
    }

    const context: IJobContext = {
      id,
      attempt: job.attemptsStarted,
      updateProgress: async (progress) => {
        if (
          !isInt(progress.progress) ||
          progress.progress < 0 ||
          progress.progress > 100 ||
          (!isNil(progress.status) && !isString(progress.status))
        ) {
          throw new Error(DICTIONARY.jobs.invalidProgress)
        }

        await job.updateProgress(progress)
      },
      throwIfCancelled: async () => {
        const currentJob = await this.jobsQueue.getJob(id)

        if (
          isNil(currentJob) ||
          parseJobData(currentJob.data).cancellationState !== "none"
        ) {
          throw new JobCancelledError(DICTIONARY.jobs.wasCancelled(id))
        }
      },
    }

    const startedAt = Date.now()

    try {
      await context.throwIfCancelled()
      const result = await registeredHandler.handler.handle(
        data.payload,
        context,
      )
      await context.throwIfCancelled()
      this.loggerService.info(DICTIONARY.jobs.completed, {
        context: JobProcessorService.name,
        data: {
          jobName: job.name,
          attempt: context.attempt,
          duration: Date.now() - startedAt,
        },
        jobId: id,
      })
      return result
    } catch (error) {
      const currentJob = await this.jobsQueue.getJob(id)
      const currentData = isNil(currentJob)
        ? undefined
        : parseJobData(currentJob.data)
      const isCancellationRequested =
        !isNil(currentData) && currentData.cancellationState !== "none"

      if (error instanceof JobCancelledError || isCancellationRequested) {
        if (!isNil(currentJob) && !isNil(currentData)) {
          await currentJob.updateData({
            ...currentData,
            cancellationState: "cancelled",
          })
        }
        this.loggerService.info(DICTIONARY.jobs.cancelled, {
          context: JobProcessorService.name,
          data: {
            jobName: job.name,
            attempt: context.attempt,
            duration: Date.now() - startedAt,
          },
          jobId: id,
        })
        return JOB_CANCELLED_RESULT
      }

      const processingError =
        error instanceof NonRetryableJobError
          ? new UnrecoverableError(error.message)
          : error instanceof Error
            ? error
            : new Error(DICTIONARY.jobs.handlerFailed)

      this.loggerService.error(DICTIONARY.jobs.handlerFailed, error, {
        context: JobProcessorService.name,
        data: {
          jobName: job.name,
          attempt: context.attempt,
          duration: Date.now() - startedAt,
        },
        jobId: id,
      })

      throw processingError
    }
  }
}

export { JobProcessorService }
