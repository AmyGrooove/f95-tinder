import { setTimeout } from "node:timers/promises"
import { afterEach, beforeEach, jest } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Queue } from "bullmq"

import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { LoggerService } from "@infrastructure/logger/services/loggerService"
import { getTestRedis } from "@infrastructure/cache/__tests__/setup/setupRedis"
import { JobHandler } from "../../decorators/JobHandler"
import { defineJob } from "../../functions/defineJob"
import { JobsModule } from "../../jobs.module"
import { JobService } from "@infrastructure/jobs/services/jobService"
import type { TJobState } from "@infrastructure/jobs/services/jobService"
import { JobsHealthService } from "@infrastructure/jobs/services/jobsHealthService"
import { JOBS_QUEUE_NAME } from "../../static/JOBS_QUEUE_NAME"
import type { IJobContext } from "../../types/IJobContext"
import type { IJobHandler } from "../../types/IJobHandler"

const createJobsTestContext = () => {
  const definition = defineJob<{ value: number }>("test.integration", {
    retryDelays: [100, 150],
  })
  const handle =
    jest.fn<
      (
        ...args: Parameters<IJobHandler<{ value: number }>["handle"]>
      ) => Promise<unknown>
    >()

  @JobHandler(definition)
  class Handler {
    handle(payload: { value: number }, context: IJobContext) {
      return handle(payload, context)
    }
  }

  let moduleRef: TestingModule | undefined
  let service: JobService
  let queue: Queue
  let health: JobsHealthService

  const waitForState = async (id: string, state: TJobState) => {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const details = await service.get(id)
      if (
        details?.state === state &&
        (!["completed", "failed", "cancelled"].includes(state) ||
          details.finishedAt !== undefined)
      ) {
        return details
      }
      await setTimeout(20)
    }
    throw new Error(
      `Задача ${id}: ожидалось ${state}, получено ${JSON.stringify(await service.get(id))}`,
    )
  }

  beforeEach(async () => {
    handle.mockReset().mockResolvedValue({ result: "done" })
    const { configuration } = getTestRedis()
    moduleRef = await Test.createTestingModule({
      imports: [JobsModule],
      providers: [Handler],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue({ app: configuration.app, redis: configuration.redis })
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = moduleRef.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    service = moduleRef.get(JobService)
    health = moduleRef.get(JobsHealthService)
    await queue.pause()
    await moduleRef.init()
  })

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  return {
    definition,
    handle,
    Handler,
    waitForState,
    get moduleRef() {
      return moduleRef
    },
    get service() {
      return service
    },
    get queue() {
      return queue
    },
    get health() {
      return health
    },
  }
}

export { createJobsTestContext }
