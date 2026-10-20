import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import type { Job, JobsOptions, JobType, Queue } from "bullmq"

import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"

import { createJobDetails } from "../functions/createJobDetails"
import { getJobState } from "../functions/getJobState"
import { parseJobData } from "../functions/parseJobData"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import { JOBS_SETTINGS } from "../static/JOBS_SETTINGS"
import type { IJobAddOptions } from "../types/IJobAddOptions"
import type { IJobData } from "../types/IJobData"
import type { IJobDefinition } from "../types/IJobDefinition"
import type { IJobListOptions } from "../types/IJobListOptions"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class JobService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
  ) {}

  async add<TPayload>(
    definition: IJobDefinition<TPayload>,
    payload: NoInfer<TPayload>,
    options?: IJobAddOptions,
  ) {
    if (
      !isNil(options?.delay) &&
      (!isInt(options.delay) || options.delay < 0)
    ) {
      throw new Error(DICTIONARY.jobs.invalidDelay)
    }

    const job = await this.jobsQueue.add(
      definition.name,
      {
        name: definition.name,
        version: definition.version,
        payload,
        retryDelays: definition.retryDelays,
        cancellationState: "none",
      } satisfies IJobData<TPayload>,
      {
        attempts: definition.retryDelays.length + 1,
        backoff:
          definition.retryDelays.length > 0 ? { type: "custom" } : undefined,
        jobId: options?.jobId,
        delay: options?.delay,
        deduplication: options?.deduplication,
        removeOnComplete: JOBS_SETTINGS.removeOnComplete,
        removeOnFail: JOBS_SETTINGS.removeOnFail,
      } satisfies JobsOptions,
    )

    if (isNil(job.id)) {
      throw new Error(DICTIONARY.jobs.missingQueuedId)
    }

    return job.id
  }

  async get(id: string) {
    const job = await this.jobsQueue.getJob(id)
    return isNil(job) ? null : this.toDetails(job)
  }

  async list<TPayload>(
    definition: IJobDefinition<TPayload>,
    options?: IJobListOptions,
  ) {
    const limit = options?.limit ?? 50
    const allStates = [
      "active",
      "completed",
      "delayed",
      "failed",
      "prioritized",
      "waiting",
      "waiting-children",
    ] satisfies JobType[]
    const states = allStates.filter((state) => {
      if (isNil(options?.states)) {
        return true
      }

      if (state === "active") {
        return options.states.some((item) =>
          ["running", "cancelling"].includes(item),
        )
      }

      if (state === "completed") {
        return options.states.some((item) =>
          ["completed", "cancelled"].includes(item),
        )
      }

      if (state === "failed") {
        return options.states.includes("failed")
      }

      return options.states.some((item) =>
        ["queued", "cancelling", "cancelled"].includes(item),
      )
    })
    const [statePart, offsetPart] = (options?.cursor ?? "0:0").split(":")
    let stateIndex = Number(statePart)
    let offset = Number(offsetPart)

    if (
      !isInt(limit) ||
      limit < 1 ||
      limit > 100 ||
      !isInt(stateIndex) ||
      stateIndex < 0 ||
      stateIndex > states.length ||
      !isInt(offset) ||
      offset < 0
    ) {
      throw new Error(DICTIONARY.jobs.invalidListRange)
    }

    const items = []
    let scanned = 0

    while (
      stateIndex < states.length &&
      scanned < 500 &&
      items.length < limit
    ) {
      const batchSize = Math.min(100, 500 - scanned)
      const batch = await this.jobsQueue.getJobs(
        states[stateIndex],
        offset,
        offset + batchSize - 1,
      )

      for (const job of batch) {
        offset += 1
        scanned += 1

        if (job.name !== definition.name) {
          continue
        }

        const details = await this.toDetails(job)

        if (
          !isNil(options?.states) &&
          !options.states.includes(details.state)
        ) {
          continue
        }

        items.push(details)

        if (items.length === limit) {
          break
        }
      }

      if (batch.length < batchSize && items.length < limit) {
        stateIndex += 1
        offset = 0
      }
    }

    return stateIndex < states.length
      ? { items, hasMore: true, cursor: `${stateIndex}:${offset}` }
      : { items, hasMore: false }
  }

  async update<TPayload>(
    definition: IJobDefinition<TPayload>,
    id: string,
    payload: NoInfer<TPayload>,
  ) {
    const job = await this.jobsQueue.getJob(id)

    if (isNil(job)) {
      throw new Error(DICTIONARY.jobs.notFound(id))
    }

    const data = parseJobData(job.data)

    if (
      job.name !== definition.name ||
      data.name !== definition.name ||
      data.version !== definition.version
    ) {
      throw new Error(DICTIONARY.jobs.definitionMismatch(id, definition.name))
    }

    const state = await getJobState(job, data)

    if (state !== "queued") {
      throw new Error(DICTIONARY.jobs.cannotUpdate(id, state))
    }

    await job.updateData({ ...data, payload })
  }

  async cancel(id: string) {
    const job = await this.jobsQueue.getJob(id)

    if (isNil(job)) {
      return false
    }

    const data = parseJobData(job.data)
    const state = await getJobState(job, data)

    if (state === "completed" || state === "failed") {
      return false
    }

    if (state === "cancelled" || state === "cancelling") {
      return true
    }

    await job.updateData({
      ...data,
      cancellationState: state === "queued" ? "cancelled" : "cancelling",
    })

    return true
  }

  async retry(id: string) {
    const job = await this.jobsQueue.getJob(id)

    if (isNil(job)) {
      throw new Error(DICTIONARY.jobs.notFound(id))
    }

    const data = parseJobData(job.data)
    const state = await getJobState(job, data)

    if (state !== "failed") {
      throw new Error(DICTIONARY.jobs.cannotRetry(id, state))
    }

    if (data.cancellationState !== "none") {
      await job.updateData({ ...data, cancellationState: "none" })
    }

    await job.retry("failed", {
      resetAttemptsMade: true,
      resetAttemptsStarted: true,
    })
  }

  private async toDetails(job: Job) {
    const data = parseJobData(job.data)
    const state = await getJobState(job, data)
    return createJobDetails(job, { state, name: data.name })
  }
}

export { JobService }
